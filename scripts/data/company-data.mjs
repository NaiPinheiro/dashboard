import {
  DataContractError,
  containsKnownPii,
  loadDataSet,
  loadManifest,
  nonNegativeInteger,
  readCache,
  readCsv,
  recordRejection,
} from './data-common.mjs';

const FILE_NAME = 'empresas.csv';
const CACHE_NAME = 'empresas';
const COMPANY_HEADERS = ['status', 'si_status', 'quantidade'];
const ACTIVE_STATUSES = new Set(['production', 'test', 'activated', 'active']);
const INACTIVE_STATUSES = new Set(['cancelled', 'inactive']);
const SUSPENDED_STATUS = 'suspended_defaulter';
const EXCLUDED_STATUS = 'wait_aprovement';

function classifySiStatus(siStatus) {
  const normalized = siStatus.toLocaleLowerCase('pt-BR');
  if (ACTIVE_STATUSES.has(normalized)) return 'active';
  if (INACTIVE_STATUSES.has(normalized)) return 'inactive';
  if (normalized === SUSPENDED_STATUS) return 'suspended';
  if (normalized === EXCLUDED_STATUS) return 'excluded';
  return 'unclassified';
}

async function loadCompanyRows(dataDir, source) {
  if (source.origin !== 'mysql') {
    throw new DataContractError(`${FILE_NAME}: fonte_origem deve ser mysql.`);
  }
  if (source.state !== 'pronto') {
    throw new DataContractError(`${FILE_NAME}: estado_fonte deve ser pronto.`);
  }

  const rows = await readCsv(dataDir, FILE_NAME, COMPANY_HEADERS);
  if (rows.length === 0) {
    throw new DataContractError(`${FILE_NAME}: deve conter ao menos uma linha de dados.`);
  }

  const keys = new Set();
  const totals = {
    active: null,
    inactive: null,
    suspendedCurrent: null,
    excludedWaitApproval: null,
    unclassifiedTotal: null,
  };
  const addToTotal = (field, quantity, rowNumber) => {
    const next = (totals[field] ?? 0) + quantity;
    if (!Number.isSafeInteger(next)) {
      throw new DataContractError(`${FILE_NAME}: soma de quantidades excede o limite aceito na linha ${rowNumber}.`);
    }
    totals[field] = next;
  };
  const statusAudit = [];
  const unclassifiedStatuses = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const status = row.status.trim();
    const siStatus = row.si_status.trim();
    if (!status || !siStatus) {
      throw new DataContractError(`${FILE_NAME}: status e si_status são obrigatórios na linha ${rowNumber}.`);
    }
    if (containsKnownPii(`${status} ${siStatus}`)) {
      throw new DataContractError(`${FILE_NAME}: status ou si_status contém PII conhecida na linha ${rowNumber}.`);
    }

    const key = `${status}\u0000${siStatus}`;
    if (keys.has(key)) {
      throw new DataContractError(`${FILE_NAME}: chave status e si_status duplicada na linha ${rowNumber}.`);
    }
    keys.add(key);

    const quantity = nonNegativeInteger(row.quantidade, 'quantidade', FILE_NAME, rowNumber);
    const category = classifySiStatus(siStatus);
    statusAudit.push({ status, siStatus, category, quantity });

    if (category === 'active') addToTotal('active', quantity, rowNumber);
    else if (category === 'inactive') addToTotal('inactive', quantity, rowNumber);
    else if (category === 'suspended') addToTotal('suspendedCurrent', quantity, rowNumber);
    else if (category === 'excluded') addToTotal('excludedWaitApproval', quantity, rowNumber);
    else {
      addToTotal('unclassifiedTotal', quantity, rowNumber);
      const normalized = siStatus.toLocaleLowerCase('pt-BR');
      const current = unclassifiedStatuses.get(normalized);
      if (current) current.quantity += quantity;
      else unclassifiedStatuses.set(normalized, { siStatus, quantity });
    }
  });

  return {
    ...totals,
    suspendedLast30Days: null,
    statusAudit,
    unclassifiedStatuses: [...unclassifiedStatuses.values()],
  };
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isNullableNonNegativeInteger(value) {
  return value === null || isNonNegativeInteger(value);
}

function isValidCompanyData(data) {
  const validCategory = new Set(['active', 'inactive', 'suspended', 'excluded', 'unclassified']);
  return data
    && isNullableNonNegativeInteger(data.active)
    && isNullableNonNegativeInteger(data.inactive)
    && isNullableNonNegativeInteger(data.suspendedCurrent)
    && data.suspendedLast30Days === null
    && isNullableNonNegativeInteger(data.excludedWaitApproval)
    && isNullableNonNegativeInteger(data.unclassifiedTotal)
    && Array.isArray(data.statusAudit)
    && data.statusAudit.length > 0
    && data.statusAudit.every((item) => typeof item.status === 'string'
      && item.status.length > 0
      && typeof item.siStatus === 'string'
      && item.siStatus.length > 0
      && validCategory.has(item.category)
      && isNonNegativeInteger(item.quantity))
    && Array.isArray(data.unclassifiedStatuses)
    && data.unclassifiedStatuses.every((item) => typeof item.siStatus === 'string'
      && item.siStatus.length > 0
      && isNonNegativeInteger(item.quantity));
}

function emptyIndicators() {
  return {
    active: null,
    inactive: null,
    suspendedCurrent: null,
    suspendedLast30Days: null,
    excludedWaitApproval: null,
    unclassifiedTotal: null,
    statusAudit: [],
    unclassifiedStatuses: [],
  };
}

function composeCompanyData(cache, warning, rejection) {
  const hasData = Boolean(cache?.data);
  return {
    status: hasData ? (warning ? 'stale' : 'ready') : 'unavailable',
    source: cache?.source ?? null,
    warning,
    warnings: cache?.data?.unclassifiedStatuses.map(
      (item) => `Status não classificado: ${item.siStatus} · ${item.quantity} fora dos totais`,
    ) ?? [],
    rejection,
    indicators: cache?.data ?? emptyIndicators(),
  };
}

export async function loadCompanyData(dataDir, cacheDir) {
  let manifest;
  try {
    manifest = await loadManifest(dataDir);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const cache = await readCache(cacheDir, CACHE_NAME, isValidCompanyData);
    const rejection = await recordRejection(cacheDir, 'manifesto_carga.csv', [error.message]);
    return composeCompanyData(cache, error.message, rejection);
  }

  const result = await loadDataSet({
    cacheDir,
    fileName: FILE_NAME,
    loader: (source) => loadCompanyRows(dataDir, source),
    manifest,
    name: CACHE_NAME,
    isValidData: isValidCompanyData,
  });
  return composeCompanyData(result.cache, result.warning, result.rejection);
}
