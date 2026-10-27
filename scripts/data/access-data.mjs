import {
  DataContractError,
  assertMonth,
  assertMonthInsideSource,
  assertOpaqueIdentifier,
  isOpaqueIdentifierSafe,
  loadDataSet,
  loadManifest,
  nonNegativeInteger,
  readCache,
  readCsv,
  recordRejection,
} from './data-common.mjs';

const ACCESS_FILE = 'acessos.csv';
const RANKING_FILE = 'ranking_acessos.csv';
const ACCESS_CACHE = 'acessos';
const RANKING_CACHE = 'ranking_acessos';
const ACCESS_HEADERS = ['mes', 'produto_digital', 'total_logins', 'usuarios_unicos', 'empresas_clientes_distintas'];
const RANKING_HEADERS = ['mes', 'produto_digital', 'posicao', 'empresa_id_opaco', 'total_logins', 'usuarios_unicos'];
const PRODUCTS = ['Portal Web', 'Loja Web', 'Aplicativo', 'Loja Aplicativo'];
const PRODUCT_ORDER = new Map(PRODUCTS.map((product, index) => [product, index]));
const PARTIAL_PRODUCTS = new Set(['Aplicativo', 'Loja Aplicativo']);

function validateMysqlSource(source, fileName) {
  if (source.origin !== 'mysql') throw new DataContractError(`${fileName}: fonte_origem deve ser mysql.`);
  if (!['pronto', 'parcial'].includes(source.state)) {
    throw new DataContractError(`${fileName}: estado_fonte deve ser pronto ou parcial.`);
  }
}

function coverageFor(product, source) {
  return source.partial || source.state === 'parcial' || PARTIAL_PRODUCTS.has(product) ? 'partial' : 'ready';
}

function parseProduct(value, fileName, rowNumber) {
  if (!PRODUCT_ORDER.has(value)) throw new DataContractError(`${fileName}: produto_digital inválido na linha ${rowNumber}.`);
  return value;
}

function compareCombination(left, right) {
  return left.month.localeCompare(right.month)
    || PRODUCT_ORDER.get(left.product) - PRODUCT_ORDER.get(right.product);
}

async function loadAccessRows(dataDir, source) {
  validateMysqlSource(source, ACCESS_FILE);
  const rows = await readCsv(dataDir, ACCESS_FILE, ACCESS_HEADERS);
  if (rows.length === 0) throw new DataContractError(`${ACCESS_FILE}: deve conter ao menos uma combinação informada.`);
  const keys = new Set();
  const combinations = rows.map((row, index) => {
    const rowNumber = index + 2;
    const month = assertMonth(row.mes, ACCESS_FILE, rowNumber);
    assertMonthInsideSource(month, source, ACCESS_FILE, rowNumber);
    const product = parseProduct(row.produto_digital, ACCESS_FILE, rowNumber);
    const key = `${month}\u0000${product}`;
    if (keys.has(key)) throw new DataContractError(`${ACCESS_FILE}: chave mês e produto duplicada na linha ${rowNumber}.`);
    keys.add(key);

    const totalLogins = nonNegativeInteger(row.total_logins, 'total_logins', ACCESS_FILE, rowNumber);
    const uniqueUsers = nonNegativeInteger(row.usuarios_unicos, 'usuarios_unicos', ACCESS_FILE, rowNumber);
    const distinctCompanies = nonNegativeInteger(row.empresas_clientes_distintas, 'empresas_clientes_distintas', ACCESS_FILE, rowNumber);
    if (uniqueUsers > totalLogins) {
      throw new DataContractError(`${ACCESS_FILE}: usuarios_unicos supera total_logins na linha ${rowNumber}.`);
    }
    return {
      month,
      product,
      totalLogins,
      uniqueUsers,
      distinctCompanies,
      coverage: coverageFor(product, source),
    };
  });
  return combinations.sort(compareCombination);
}

async function loadRankingRows(dataDir, source) {
  validateMysqlSource(source, RANKING_FILE);
  const rows = await readCsv(dataDir, RANKING_FILE, RANKING_HEADERS);
  const keys = new Set();
  const ranking = rows.map((row, index) => {
    const rowNumber = index + 2;
    const month = assertMonth(row.mes, RANKING_FILE, rowNumber);
    assertMonthInsideSource(month, source, RANKING_FILE, rowNumber);
    const product = parseProduct(row.produto_digital, RANKING_FILE, rowNumber);
    const position = nonNegativeInteger(row.posicao, 'posicao', RANKING_FILE, rowNumber);
    if (position < 1 || position > 20) throw new DataContractError(`${RANKING_FILE}: posição fora do intervalo na linha ${rowNumber}.`);
    const key = `${month}\u0000${product}\u0000${position}`;
    if (keys.has(key)) throw new DataContractError(`${RANKING_FILE}: chave mês, produto e posição duplicada na linha ${rowNumber}.`);
    keys.add(key);
    assertOpaqueIdentifier(row.empresa_id_opaco, RANKING_FILE, rowNumber);
    const totalLogins = nonNegativeInteger(row.total_logins, 'total_logins', RANKING_FILE, rowNumber);
    const uniqueUsers = nonNegativeInteger(row.usuarios_unicos, 'usuarios_unicos', RANKING_FILE, rowNumber);
    if (uniqueUsers > totalLogins) {
      throw new DataContractError(`${RANKING_FILE}: usuarios_unicos supera total_logins na linha ${rowNumber}.`);
    }
    return {
      month,
      product,
      position,
      companyId: row.empresa_id_opaco,
      totalLogins,
      uniqueUsers,
      coverage: coverageFor(product, source),
    };
  });

  ranking.sort((left, right) => compareCombination(left, right) || left.position - right.position);
  const groups = new Map();
  ranking.forEach((item) => {
    const key = `${item.month}\u0000${item.product}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  groups.forEach((items) => {
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      if (current.totalLogins > previous.totalLogins) {
        throw new DataContractError(`${RANKING_FILE}: posições não seguem ordem decrescente de logins.`);
      }
      if (current.totalLogins === previous.totalLogins && current.companyId.localeCompare(previous.companyId, 'pt-BR') < 0) {
        throw new DataContractError(`${RANKING_FILE}: empate de logins não segue ordem determinística por empresa_id_opaco.`);
      }
    }
  });
  return ranking;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidProduct(value) {
  return PRODUCT_ORDER.has(value);
}

function isValidAccessData(data) {
  if (!Array.isArray(data) || data.length === 0) return false;
  const keys = new Set();
  return data.every((item) => {
    const key = `${item.month}\u0000${item.product}`;
    const valid = /^\d{4}-(?:0[1-9]|1[0-2])$/.test(item.month)
      && isValidProduct(item.product)
      && !keys.has(key)
      && isNonNegativeInteger(item.totalLogins)
      && isNonNegativeInteger(item.uniqueUsers)
      && item.uniqueUsers <= item.totalLogins
      && isNonNegativeInteger(item.distinctCompanies)
      && ['ready', 'partial'].includes(item.coverage)
      && (!PARTIAL_PRODUCTS.has(item.product) || item.coverage === 'partial');
    keys.add(key);
    return valid;
  });
}

function isValidRankingData(data) {
  if (!Array.isArray(data)) return false;
  const keys = new Set();
  const groups = new Map();
  for (const item of data) {
    const key = `${item.month}\u0000${item.product}\u0000${item.position}`;
    if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(item.month)
      || !isValidProduct(item.product)
      || keys.has(key)
      || !Number.isInteger(item.position)
      || item.position < 1
      || item.position > 20
      || !isOpaqueIdentifierSafe(item.companyId)
      || !isNonNegativeInteger(item.totalLogins)
      || !isNonNegativeInteger(item.uniqueUsers)
      || item.uniqueUsers > item.totalLogins
      || !['ready', 'partial'].includes(item.coverage)
      || (PARTIAL_PRODUCTS.has(item.product) && item.coverage !== 'partial')) return false;
    keys.add(key);
    const groupKey = `${item.month}\u0000${item.product}`;
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }
  for (const items of groups.values()) {
    items.sort((left, right) => left.position - right.position);
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      if (current.totalLogins > previous.totalLogins) return false;
      if (current.totalLogins === previous.totalLogins
        && current.companyId.localeCompare(previous.companyId, 'pt-BR') < 0) return false;
    }
  }
  return true;
}

function composeAccessData(accessCache, rankingCache, warnings = [], rejections = [], fileWarnings = {}) {
  const hasAccess = Boolean(accessCache?.data);
  const hasRanking = Boolean(rankingCache?.data);
  let status = 'unavailable';
  if (hasAccess && hasRanking) status = warnings.length > 0 ? 'stale' : 'ready';
  else if (hasAccess || hasRanking) status = 'partial';
  return {
    status,
    source: accessCache?.source ?? null,
    rankingSource: rankingCache?.source ?? null,
    fileStates: {
      access: hasAccess ? (fileWarnings.access ? 'stale' : 'ready') : 'unavailable',
      ranking: hasRanking ? (fileWarnings.ranking ? 'stale' : 'ready') : 'unavailable',
    },
    warnings,
    rejections,
    indicators: { combinations: accessCache?.data ?? [] },
    ranking: rankingCache?.data ?? [],
  };
}

export async function loadAccessData(dataDir, cacheDir) {
  let manifest;
  try {
    manifest = await loadManifest(dataDir);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const [accessCache, rankingCache] = await Promise.all([
      readCache(cacheDir, ACCESS_CACHE, isValidAccessData),
      readCache(cacheDir, RANKING_CACHE, isValidRankingData),
    ]);
    const rejection = await recordRejection(cacheDir, 'manifesto_carga.csv', [error.message]);
    return composeAccessData(
      accessCache,
      rankingCache,
      [error.message],
      [rejection],
      { access: error.message, ranking: error.message },
    );
  }

  const [accessResult, rankingResult] = await Promise.all([
    loadDataSet({
      cacheDir,
      fileName: ACCESS_FILE,
      loader: (source) => loadAccessRows(dataDir, source),
      manifest,
      name: ACCESS_CACHE,
      isValidData: isValidAccessData,
    }),
    loadDataSet({
      cacheDir,
      fileName: RANKING_FILE,
      loader: (source) => loadRankingRows(dataDir, source),
      manifest,
      name: RANKING_CACHE,
      isValidData: isValidRankingData,
    }),
  ]);
  return composeAccessData(
    accessResult.cache,
    rankingResult.cache,
    [accessResult.warning, rankingResult.warning].filter(Boolean),
    [accessResult.rejection, rankingResult.rejection].filter(Boolean),
    { access: accessResult.warning, ranking: rankingResult.warning },
  );
}
