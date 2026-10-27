import {
  DataContractError,
  containsKnownPii,
  loadDataSet,
  loadManifest,
  nonNegativeInteger,
  parseAnalysisPeriod,
  readCache,
  readCsv,
  recordRejection,
} from './data-common.mjs';

const FILE_NAME = 'telas_aplicativo.csv';
const CACHE_NAME = 'telas_aplicativo';
const APPLICATION_HEADERS = [
  'periodo',
  'produto',
  'fonte',
  'propriedade',
  'property_id',
  'tipo_registro',
  'item',
  'contagem',
  'usuarios',
  'unidade_contagem',
  'metrica_usuarios',
  'evidencia',
  'observacao',
];
const RECORD_TYPES = new Set(['total_telas', 'classe_tela', 'total_eventos', 'evento']);
const EVIDENCE = new Set(['observado', 'derivado', 'nao_validado']);

function optionalNonNegativeInteger(value, field, rowNumber) {
  if (value === '' || value === '\\N') return null;
  return nonNegativeInteger(value, field, FILE_NAME, rowNumber);
}

function validateSource(source) {
  if (source.origin !== 'google_analytics') {
    throw new DataContractError(`${FILE_NAME}: fonte_origem deve ser google_analytics.`);
  }
  if (!['pronto', 'parcial'].includes(source.state)) {
    throw new DataContractError(`${FILE_NAME}: estado_fonte deve ser pronto ou parcial.`);
  }
}

function recordFromRow(row, period, rowNumber) {
  if (row.produto !== 'Aplicativo M2M') {
    throw new DataContractError(`${FILE_NAME}: produto inválido na linha ${rowNumber}.`);
  }
  if (row.fonte !== 'Google Analytics') {
    throw new DataContractError(`${FILE_NAME}: fonte inválida na linha ${rowNumber}.`);
  }
  if (!row.propriedade || !row.property_id || !row.item) {
    throw new DataContractError(`${FILE_NAME}: propriedade, property_id e item são obrigatórios na linha ${rowNumber}.`);
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(row.property_id)) {
    throw new DataContractError(`${FILE_NAME}: property_id possui formato inválido na linha ${rowNumber}.`);
  }
  if (!RECORD_TYPES.has(row.tipo_registro)) {
    throw new DataContractError(`${FILE_NAME}: tipo_registro inválido na linha ${rowNumber}.`);
  }
  if (!EVIDENCE.has(row.evidencia)) {
    throw new DataContractError(`${FILE_NAME}: evidência inválida na linha ${rowNumber}.`);
  }
  if (containsKnownPii(`${row.propriedade} ${row.item} ${row.unidade_contagem} ${row.metrica_usuarios} ${row.observacao}`)) {
    throw new DataContractError(`${FILE_NAME}: conteúdo contém PII conhecida na linha ${rowNumber}.`);
  }

  const count = optionalNonNegativeInteger(row.contagem, 'contagem', rowNumber);
  const users = optionalNonNegativeInteger(row.usuarios, 'usuarios', rowNumber);
  if (count !== null && !row.unidade_contagem) {
    throw new DataContractError(`${FILE_NAME}: unidade_contagem é obrigatória quando contagem é informada na linha ${rowNumber}.`);
  }
  if (users !== null && !row.metrica_usuarios) {
    throw new DataContractError(`${FILE_NAME}: metrica_usuarios é obrigatória quando usuarios é informado na linha ${rowNumber}.`);
  }
  if (row.tipo_registro === 'total_telas' && (count === null || row.evidencia !== 'observado')) {
    throw new DataContractError(`${FILE_NAME}: total_telas deve ter contagem observada na linha ${rowNumber}.`);
  }

  return {
    period: period.label,
    periodStart: period.start,
    periodEnd: period.end,
    property: row.propriedade,
    propertyId: row.property_id,
    type: row.tipo_registro,
    item: row.item,
    count,
    users,
    countUnit: row.unidade_contagem || null,
    userMetric: row.metrica_usuarios || null,
    evidence: row.evidencia,
    observation: row.observacao || null,
  };
}

async function loadApplicationRows(dataDir, source) {
  validateSource(source);
  const rows = await readCsv(dataDir, FILE_NAME, APPLICATION_HEADERS);
  const keys = new Set();
  const records = rows.map((row, index) => {
    const rowNumber = index + 2;
    const period = parseAnalysisPeriod(row.periodo, FILE_NAME, rowNumber);
    if (period.start < source.periodStart || period.end > source.periodEnd) {
      throw new DataContractError(`${FILE_NAME}: período da linha ${rowNumber} está fora da abrangência do manifesto.`);
    }
    const key = `${row.periodo}\u0000${row.tipo_registro}\u0000${row.item}`;
    if (keys.has(key)) throw new DataContractError(`${FILE_NAME}: chave duplicada na linha ${rowNumber}.`);
    keys.add(key);
    return recordFromRow(row, period, rowNumber);
  });

  const periodLabels = [...new Set(records.map((record) => record.period))];
  if (periodLabels.length === 0) {
    throw new DataContractError(`${FILE_NAME}: deve conter ao menos um período.`);
  }
  for (const period of periodLabels) {
    const periodRecords = records.filter((record) => record.period === period);
    const totals = periodRecords.filter((record) => record.type === 'total_telas');
    if (totals.length !== 1) {
      throw new DataContractError(`${FILE_NAME}: deve existir exatamente um total_telas por período.`);
    }
    const properties = new Set(periodRecords.map((record) => `${record.property}\u0000${record.propertyId}`));
    if (properties.size !== 1) {
      throw new DataContractError(`${FILE_NAME}: cada período deve usar uma única propriedade do Google Analytics.`);
    }
  }

  const activePeriod = [...records]
    .sort((left, right) => right.periodEnd.localeCompare(left.periodEnd) || right.periodStart.localeCompare(left.periodStart))[0].period;
  const activeRecords = records.filter((record) => record.period === activePeriod);
  const total = activeRecords.find((record) => record.type === 'total_telas');
  const mapEvidence = (record) => ({
    item: record.item,
    count: record.count,
    users: record.users,
    countUnit: record.countUnit,
    userMetric: record.userMetric,
    evidence: record.evidence,
    observation: record.observation,
  });

  return {
    activePeriod,
    property: { name: total.property, id: total.propertyId },
    totalViews: total.count,
    totalEvidence: total.evidence,
    technicalClasses: activeRecords.filter((record) => record.type === 'classe_tela').map(mapEvidence),
    eventTotals: activeRecords.filter((record) => record.type === 'total_eventos').map(mapEvidence),
    events: activeRecords.filter((record) => record.type === 'evento').map((record) => ({
      ...mapEvidence(record),
      accessEligible: false,
    })),
  };
}

function isNullableNonNegativeInteger(value) {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function isEvidenceItem(item, isEvent = false) {
  return item
    && typeof item.item === 'string'
    && !containsKnownPii(item.item)
    && isNullableNonNegativeInteger(item.count)
    && isNullableNonNegativeInteger(item.users)
    && (item.countUnit === null || (typeof item.countUnit === 'string' && !containsKnownPii(item.countUnit)))
    && (item.userMetric === null || (typeof item.userMetric === 'string' && !containsKnownPii(item.userMetric)))
    && EVIDENCE.has(item.evidence)
    && (item.observation === null || (typeof item.observation === 'string' && !containsKnownPii(item.observation)))
    && (!isEvent || item.accessEligible === false);
}

function isValidApplicationData(data) {
  return data
    && /^\d{4}-\d{2}-\d{2} a \d{4}-\d{2}-\d{2}$/.test(data.activePeriod)
    && data.property
    && typeof data.property.name === 'string'
    && !containsKnownPii(data.property.name)
    && typeof data.property.id === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(data.property.id)
    && Number.isSafeInteger(data.totalViews)
    && data.totalViews >= 0
    && data.totalEvidence === 'observado'
    && Array.isArray(data.technicalClasses)
    && data.technicalClasses.every((item) => isEvidenceItem(item))
    && Array.isArray(data.eventTotals)
    && data.eventTotals.every((item) => isEvidenceItem(item))
    && Array.isArray(data.events)
    && data.events.every((item) => isEvidenceItem(item, true));
}

function composeApplicationData(cache, warning, rejection) {
  const hasData = Boolean(cache?.data);
  return {
    status: hasData ? (warning ? 'stale' : 'ready') : 'unavailable',
    source: cache?.source ?? null,
    warning,
    rejection,
    indicators: {
      activePeriod: cache?.data?.activePeriod ?? null,
      property: cache?.data?.property ?? null,
      totalViews: cache?.data?.totalViews ?? null,
      totalEvidence: cache?.data?.totalEvidence ?? null,
      technicalClasses: cache?.data?.technicalClasses ?? [],
      eventTotals: cache?.data?.eventTotals ?? [],
      events: cache?.data?.events ?? [],
    },
  };
}

export async function loadApplicationData(dataDir, cacheDir) {
  let manifest;
  try {
    manifest = await loadManifest(dataDir);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const cache = await readCache(cacheDir, CACHE_NAME, isValidApplicationData);
    const rejection = await recordRejection(cacheDir, 'manifesto_carga.csv', [error.message]);
    return composeApplicationData(cache, error.message, rejection);
  }

  const result = await loadDataSet({
    cacheDir,
    fileName: FILE_NAME,
    loader: (source) => loadApplicationRows(dataDir, source),
    manifest,
    name: CACHE_NAME,
    isValidData: isValidApplicationData,
  });
  return composeApplicationData(result.cache, result.warning, result.rejection);
}
