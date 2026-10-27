import {
  DataContractError,
  containsKnownPii,
  loadDataSet,
  loadManifest,
  readCache,
  readCsv,
  recordRejection,
} from './data-common.mjs';

const FILE_NAME = 'telas_portal.csv';
const CACHE_NAME = 'telas_portal';
const PORTAL_HEADERS = [
  'periodo',
  'produto',
  'fonte',
  'escopo',
  'metrica',
  'tela_ou_funcao',
  'valor',
  'unidade',
  'evidencia',
  'observacao',
];
const EVIDENCE = new Set(['observado', 'derivado', 'nao_validado']);

function parsePeriod(value, rowNumber) {
  const full = /^(\d{4}-\d{2}-\d{2}) a (\d{4}-\d{2}-\d{2})$/.exec(value);
  const monthly = /^(\d{4}-(?:0[1-9]|1[0-2])) a (\d{4}-(?:0[1-9]|1[0-2]))$/.exec(value);
  if (!full && !monthly) throw new DataContractError(`${FILE_NAME}: período inválido na linha ${rowNumber}.`);

  if (full) {
    const [, start, end] = full;
    const validStart = new Date(`${start}T00:00:00Z`);
    const validEnd = new Date(`${end}T00:00:00Z`);
    if (Number.isNaN(validStart.valueOf()) || validStart.toISOString().slice(0, 10) !== start
      || Number.isNaN(validEnd.valueOf()) || validEnd.toISOString().slice(0, 10) !== end || end < start) {
      throw new DataContractError(`${FILE_NAME}: período inválido na linha ${rowNumber}.`);
    }
    return { start, end };
  }

  const [, startMonth, endMonth] = monthly;
  const [endYear, endMonthNumber] = endMonth.split('-').map(Number);
  const start = `${startMonth}-01`;
  const end = new Date(Date.UTC(endYear, endMonthNumber, 0)).toISOString().slice(0, 10);
  if (end < start) throw new DataContractError(`${FILE_NAME}: período invertido na linha ${rowNumber}.`);
  return { start, end };
}

function parseOptionalNumber(value, field, rowNumber) {
  if (value === '' || value === '\\N') return null;
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new DataContractError(`${FILE_NAME}: ${field} deve ser numérico e não negativo na linha ${rowNumber}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed > Number.MAX_SAFE_INTEGER) {
    throw new DataContractError(`${FILE_NAME}: ${field} excede o limite aceito na linha ${rowNumber}.`);
  }
  return parsed;
}

function isLocalEnvironment(value) {
  return /(?:^|[/:.])localhost(?=[:/]|$)|\.local(?=[:/]|$)/i.test(value);
}

function validateSource(source) {
  if (source.origin !== 'microsoft_clarity') {
    throw new DataContractError(`${FILE_NAME}: fonte_origem deve ser microsoft_clarity.`);
  }
  if (source.state !== 'parcial') {
    throw new DataContractError(`${FILE_NAME}: estado_fonte deve permanecer parcial.`);
  }
}

async function loadPortalRows(dataDir, source) {
  validateSource(source);
  const rows = await readCsv(dataDir, FILE_NAME, PORTAL_HEADERS);
  const keys = new Set();
  const totals = [];
  const limitations = [];
  let unvalidatedPerScreen = false;
  let excludedLocalRows = 0;
  let excludedSessionOrEventRows = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const period = parsePeriod(row.periodo, rowNumber);
    if (period.start < source.periodStart || period.end > source.periodEnd) {
      throw new DataContractError(`${FILE_NAME}: período da linha ${rowNumber} está fora da abrangência do manifesto.`);
    }
    if (row.produto !== 'Portal M2M') throw new DataContractError(`${FILE_NAME}: produto inválido na linha ${rowNumber}.`);
    if (row.fonte !== 'Microsoft Clarity') throw new DataContractError(`${FILE_NAME}: fonte inválida na linha ${rowNumber}.`);
    if (!row.escopo || !row.metrica || !row.tela_ou_funcao || !row.unidade) {
      throw new DataContractError(`${FILE_NAME}: campo textual obrigatório ausente na linha ${rowNumber}.`);
    }
    if (!EVIDENCE.has(row.evidencia)) throw new DataContractError(`${FILE_NAME}: evidência inválida na linha ${rowNumber}.`);
    if (containsKnownPii(`${row.tela_ou_funcao} ${row.observacao}`)) {
      throw new DataContractError(`${FILE_NAME}: conteúdo contém PII conhecida na linha ${rowNumber}.`);
    }

    const key = `${row.periodo}\u0000${row.escopo}\u0000${row.metrica}\u0000${row.tela_ou_funcao}`;
    if (keys.has(key)) throw new DataContractError(`${FILE_NAME}: chave duplicada na linha ${rowNumber}.`);
    keys.add(key);
    const value = parseOptionalNumber(row.valor, 'valor', rowNumber);

    if (isLocalEnvironment(row.tela_ou_funcao)) {
      excludedLocalRows += 1;
      return;
    }

    if (row.metrica === 'visualizacoes_de_pagina_total') {
      if (row.escopo !== 'producao' || row.evidencia !== 'derivado' || value === null) {
        throw new DataContractError(`${FILE_NAME}: visualizacoes_de_pagina_total deve ser uma estimativa derivada de produção na linha ${rowNumber}.`);
      }
      totals.push(value);
      return;
    }

    if (row.metrica === 'visualizacoes_por_tela') {
      if (row.evidencia !== 'nao_validado' || value !== null) {
        throw new DataContractError(`${FILE_NAME}: visualizacoes_por_tela deve permanecer não validada e sem valor na linha ${rowNumber}.`);
      }
      unvalidatedPerScreen = true;
    }

    if (row.metrica === 'sessoes_com_url' || /^screen_view_/i.test(row.metrica)) {
      excludedSessionOrEventRows += 1;
    }
    if ((row.escopo === 'metodologia' || row.evidencia === 'nao_validado')
      && row.observacao && !limitations.includes(row.observacao)) {
      limitations.push(row.observacao);
    }
  });

  if (totals.length !== 1) {
    throw new DataContractError(`${FILE_NAME}: deve existir exatamente uma estimativa visualizacoes_de_pagina_total de produção.`);
  }
  if (!unvalidatedPerScreen) {
    throw new DataContractError(`${FILE_NAME}: falta a limitação não validada de visualizacoes_por_tela.`);
  }

  return {
    totalViews: totals[0],
    totalEvidence: 'derivado',
    perScreenStatus: 'nao_validado',
    limitations,
    excludedLocalRows,
    excludedSessionOrEventRows,
  };
}

function isNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidPortalData(data) {
  return data
    && isNonNegativeNumber(data.totalViews)
    && data.totalEvidence === 'derivado'
    && data.perScreenStatus === 'nao_validado'
    && Array.isArray(data.limitations)
    && data.limitations.every((item) => typeof item === 'string' && !containsKnownPii(item))
    && Number.isSafeInteger(data.excludedLocalRows)
    && data.excludedLocalRows >= 0
    && Number.isSafeInteger(data.excludedSessionOrEventRows)
    && data.excludedSessionOrEventRows >= 0;
}

function composePortalData(cache, warning, rejection) {
  const hasData = Boolean(cache?.data);
  return {
    status: hasData ? (warning ? 'stale' : 'ready') : 'unavailable',
    source: cache?.source ?? null,
    warning,
    rejection,
    indicators: {
      totalViews: cache?.data?.totalViews ?? null,
      totalEvidence: cache?.data?.totalEvidence ?? null,
      perScreenStatus: cache?.data?.perScreenStatus ?? 'nao_validado',
      limitations: cache?.data?.limitations ?? [],
      excludedLocalRows: cache?.data?.excludedLocalRows ?? null,
      excludedSessionOrEventRows: cache?.data?.excludedSessionOrEventRows ?? null,
    },
  };
}

export async function loadPortalData(dataDir, cacheDir) {
  let manifest;
  try {
    manifest = await loadManifest(dataDir);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const cache = await readCache(cacheDir, CACHE_NAME, isValidPortalData);
    const rejection = await recordRejection(cacheDir, 'manifesto_carga.csv', [error.message]);
    return composePortalData(cache, error.message, rejection);
  }

  const result = await loadDataSet({
    cacheDir,
    fileName: FILE_NAME,
    loader: (source) => loadPortalRows(dataDir, source),
    manifest,
    name: CACHE_NAME,
    isValidData: isValidPortalData,
  });
  return composePortalData(result.cache, result.warning, result.rejection);
}
