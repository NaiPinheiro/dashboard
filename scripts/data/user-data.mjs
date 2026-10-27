import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MANIFEST_HEADERS = [
  'versao_contrato',
  'arquivo',
  'gerado_em',
  'periodo_inicio',
  'periodo_fim',
  'periodo_parcial',
  'fonte_origem',
  'estado_fonte',
  'observacao',
];
const USER_HEADERS = [
  'tipo_registro',
  'mes',
  'empresa_id_opaco',
  'total_usuarios',
  'ativos_por_status',
  'inativos_por_status',
  'inativados_por_inadimplencia',
  'novos_usuarios',
  'posicao',
];
const INACTIVITY_HEADERS = [
  'data_referencia',
  'usuarios_sem_login_30_dias',
  'usuarios_ativos_no_cadastro_sem_login_30_dias',
  'usuarios_nao_ativos_no_cadastro_sem_login_30_dias',
];
const CANONICAL_FILES = new Set([
  'usuarios.csv',
  'usuarios_inatividade.csv',
  'acessos.csv',
  'ranking_acessos.csv',
  'empresas.csv',
  'telas_aplicativo.csv',
  'telas_portal.csv',
]);

export class DataContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DataContractError';
  }
}

function parseCsv(text, fileName) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ';') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new DataContractError(`${fileName}: campo entre aspas não foi encerrado.`);
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  if (rows.length === 0) throw new DataContractError(`${fileName}: arquivo vazio.`);
  return rows;
}

async function readCsv(dataDir, fileName, expectedHeaders) {
  const filePath = join(dataDir, fileName);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new DataContractError(`${fileName}: arquivo obrigatório ausente.`);
    }
    throw error;
  }
  if (!fileStat.isFile()) throw new DataContractError(`${fileName}: não é um arquivo regular.`);
  if (fileStat.size > MAX_FILE_BYTES) throw new DataContractError(`${fileName}: excede o limite de 5 MB.`);

  const rows = parseCsv(await readFile(filePath, 'utf8'), fileName);
  const headers = rows.shift();
  if (headers.length !== expectedHeaders.length || headers.some((header, index) => header !== expectedHeaders[index])) {
    throw new DataContractError(`${fileName}: cabeçalho incompatível ou com colunas extras.`);
  }

  return rows.map((values, index) => {
    if (values.length !== headers.length) {
      throw new DataContractError(`${fileName}: linha ${index + 2} possui quantidade de colunas incompatível.`);
    }
    return Object.fromEntries(headers.map((header, fieldIndex) => [header, values[fieldIndex]]));
  });
}

function assertDate(value, field, fileName, rowNumber) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  return value;
}

function assertTimestamp(value, field, fileName, rowNumber) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  return value;
}

function assertMonth(value, fileName, rowNumber) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)) {
    throw new DataContractError(`${fileName}: mês inválido na linha ${rowNumber}.`);
  }
  return value;
}

function nonNegativeInteger(value, field, fileName, rowNumber) {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new DataContractError(`${fileName}: ${field} deve ser um inteiro não negativo na linha ${rowNumber}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DataContractError(`${fileName}: ${field} excede o limite aceito na linha ${rowNumber}.`);
  }
  return parsed;
}

function assertEmpty(row, fields, fileName, rowNumber) {
  for (const field of fields) {
    if (row[field] !== '' && row[field] !== '\\N') {
      throw new DataContractError(`${fileName}: ${field} deve ficar vazio na linha ${rowNumber}.`);
    }
  }
}

function containsKnownPii(value) {
  return /[\u0000-\u001F\u007F]/.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(value)
    || /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(value)
    || /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}/.test(value);
}

function isOpaqueIdentifierSafe(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/.test(value)
    && !containsKnownPii(value)
    && !/^\d{10,20}$/.test(value);
}

function assertOpaqueIdentifier(value, fileName, rowNumber) {
  if (!isOpaqueIdentifierSafe(value)) {
    throw new DataContractError(`${fileName}: empresa_id_opaco ausente, fora do formato seguro ou contém PII conhecida na linha ${rowNumber}.`);
  }
}

function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01`;
  const end = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { start, end };
}

function assertMonthInsidePeriod(month, source, fileName) {
  const bounds = monthBounds(month);
  if (bounds.start < source.periodStart || bounds.end > source.periodEnd) {
    throw new DataContractError(`${fileName}: o mês ${month} está fora do período declarado no manifesto.`);
  }
}

function assertDateInsidePeriod(date, source, fileName) {
  if (date < source.periodStart || date > source.periodEnd) {
    throw new DataContractError(`${fileName}: a data de referência está fora do período declarado no manifesto.`);
  }
}

function validatePartPeriod(name, data, source) {
  if (name === 'usuarios') {
    assertMonthInsidePeriod(data.currentMonth, source, 'usuarios.csv');
    if (data.previousNewUsers !== null) assertMonthInsidePeriod(data.previousMonth, source, 'usuarios.csv');
    return;
  }
  assertDateInsidePeriod(data.referenceDate, source, 'usuarios_inatividade.csv');
}


function previousMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function loadManifest(dataDir) {
  const rows = await readCsv(dataDir, 'manifesto_carga.csv', MANIFEST_HEADERS);
  const entries = new Map();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    if (row.versao_contrato !== '1.0') throw new DataContractError(`manifesto_carga.csv: versão incompatível na linha ${rowNumber}.`);
    if (!CANONICAL_FILES.has(row.arquivo)) throw new DataContractError(`manifesto_carga.csv: arquivo não canônico na linha ${rowNumber}.`);
    if (entries.has(row.arquivo)) throw new DataContractError(`manifesto_carga.csv: chave arquivo duplicada na linha ${rowNumber}.`);
    assertTimestamp(row.gerado_em, 'gerado_em', 'manifesto_carga.csv', rowNumber);
    assertDate(row.periodo_inicio, 'periodo_inicio', 'manifesto_carga.csv', rowNumber);
    assertDate(row.periodo_fim, 'periodo_fim', 'manifesto_carga.csv', rowNumber);
    if (row.periodo_fim < row.periodo_inicio) throw new DataContractError(`manifesto_carga.csv: período invertido na linha ${rowNumber}.`);
    if (!['true', 'false'].includes(row.periodo_parcial)) throw new DataContractError(`manifesto_carga.csv: periodo_parcial inválido na linha ${rowNumber}.`);
    if (!['mysql', 'google_analytics', 'microsoft_clarity'].includes(row.fonte_origem)) throw new DataContractError(`manifesto_carga.csv: fonte_origem inválida na linha ${rowNumber}.`);
    if (!['pronto', 'parcial', 'indisponivel'].includes(row.estado_fonte)) throw new DataContractError(`manifesto_carga.csv: estado_fonte inválido na linha ${rowNumber}.`);
    if (containsKnownPii(row.observacao)) throw new DataContractError(`manifesto_carga.csv: observação contém PII conhecida na linha ${rowNumber}.`);
    entries.set(row.arquivo, { ...row, periodo_parcial: row.periodo_parcial === 'true' });
  });

  for (const requiredFile of ['usuarios.csv', 'usuarios_inatividade.csv']) {
    if (!entries.has(requiredFile)) throw new DataContractError(`manifesto_carga.csv: falta a linha de ${requiredFile}.`);
    if (entries.get(requiredFile).estado_fonte === 'indisponivel') {
      throw new DataContractError(`manifesto_carga.csv: ${requiredFile} está marcado como indisponível.`);
    }
  }
  return entries;
}

async function loadUsers(dataDir) {
  const rows = await readCsv(dataDir, 'usuarios.csv', USER_HEADERS);
  const snapshots = [];
  const newUsersByMonth = new Map();
  const ranking = [];
  const keys = new Set();

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const month = assertMonth(row.mes, 'usuarios.csv', rowNumber);
    if (row.tipo_registro === 'snapshot_status_atual') {
      assertEmpty(row, ['empresa_id_opaco', 'novos_usuarios', 'posicao'], 'usuarios.csv', rowNumber);
      const snapshot = {
        month,
        total: nonNegativeInteger(row.total_usuarios, 'total_usuarios', 'usuarios.csv', rowNumber),
        active: nonNegativeInteger(row.ativos_por_status, 'ativos_por_status', 'usuarios.csv', rowNumber),
        inactive: nonNegativeInteger(row.inativos_por_status, 'inativos_por_status', 'usuarios.csv', rowNumber),
        suspended: nonNegativeInteger(row.inativados_por_inadimplencia, 'inativados_por_inadimplencia', 'usuarios.csv', rowNumber),
      };
      if (snapshot.active + snapshot.inactive + snapshot.suspended !== snapshot.total) {
        throw new DataContractError(`usuarios.csv: grupos de status divergem do total na linha ${rowNumber}.`);
      }
      snapshots.push(snapshot);
      return;
    }

    if (row.tipo_registro === 'novos_usuarios_mes') {
      assertEmpty(row, ['empresa_id_opaco', 'total_usuarios', 'ativos_por_status', 'inativos_por_status', 'inativados_por_inadimplencia', 'posicao'], 'usuarios.csv', rowNumber);
      const key = `${row.tipo_registro}:${month}`;
      if (keys.has(key)) throw new DataContractError(`usuarios.csv: chave duplicada na linha ${rowNumber}.`);
      keys.add(key);
      newUsersByMonth.set(month, nonNegativeInteger(row.novos_usuarios, 'novos_usuarios', 'usuarios.csv', rowNumber));
      return;
    }

    if (row.tipo_registro === 'ranking_novos_usuarios_empresa') {
      assertEmpty(row, ['total_usuarios', 'ativos_por_status', 'inativos_por_status', 'inativados_por_inadimplencia'], 'usuarios.csv', rowNumber);
      assertOpaqueIdentifier(row.empresa_id_opaco, 'usuarios.csv', rowNumber);
      const position = nonNegativeInteger(row.posicao, 'posicao', 'usuarios.csv', rowNumber);
      if (position < 1 || position > 20) throw new DataContractError(`usuarios.csv: posição fora do intervalo na linha ${rowNumber}.`);
      const key = `${row.tipo_registro}:${month}:${position}`;
      if (keys.has(key)) throw new DataContractError(`usuarios.csv: chave duplicada na linha ${rowNumber}.`);
      keys.add(key);
      ranking.push({
        month,
        companyId: row.empresa_id_opaco,
        newUsers: nonNegativeInteger(row.novos_usuarios, 'novos_usuarios', 'usuarios.csv', rowNumber),
        position,
      });
      return;
    }

    throw new DataContractError(`usuarios.csv: tipo_registro inválido na linha ${rowNumber}.`);
  });

  if (snapshots.length !== 1) throw new DataContractError('usuarios.csv: deve existir exatamente um snapshot_status_atual.');
  const snapshot = snapshots[0];
  const currentRanking = ranking.filter((item) => item.month === snapshot.month).sort((left, right) => left.position - right.position);
  for (let index = 1; index < currentRanking.length; index += 1) {
    if (currentRanking[index].newUsers > currentRanking[index - 1].newUsers) {
      throw new DataContractError('usuarios.csv: ranking não segue ordem decrescente de novos usuários.');
    }
  }

  return {
    currentMonth: snapshot.month,
    currentTotal: snapshot.total,
    currentNewUsers: newUsersByMonth.get(snapshot.month) ?? null,
    previousMonth: previousMonth(snapshot.month),
    previousNewUsers: newUsersByMonth.get(previousMonth(snapshot.month)) ?? null,
    ranking: currentRanking,
  };
}

async function loadInactivity(dataDir) {
  const rows = await readCsv(dataDir, 'usuarios_inatividade.csv', INACTIVITY_HEADERS);
  if (rows.length !== 1) throw new DataContractError('usuarios_inatividade.csv: deve conter exatamente uma linha de dados.');
  const row = rows[0];
  const total = nonNegativeInteger(row.usuarios_sem_login_30_dias, 'usuarios_sem_login_30_dias', 'usuarios_inatividade.csv', 2);
  const active = nonNegativeInteger(row.usuarios_ativos_no_cadastro_sem_login_30_dias, 'usuarios_ativos_no_cadastro_sem_login_30_dias', 'usuarios_inatividade.csv', 2);
  const inactive = nonNegativeInteger(row.usuarios_nao_ativos_no_cadastro_sem_login_30_dias, 'usuarios_nao_ativos_no_cadastro_sem_login_30_dias', 'usuarios_inatividade.csv', 2);
  if (active + inactive !== total) throw new DataContractError('usuarios_inatividade.csv: componentes não somam o total de inatividade.');
  return { referenceDate: assertDate(row.data_referencia, 'data_referencia', 'usuarios_inatividade.csv', 2), total };
}

function sourceFromManifest(entry) {
  return {
    contractVersion: entry.versao_contrato,
    generatedAt: entry.gerado_em,
    periodStart: entry.periodo_inicio,
    periodEnd: entry.periodo_fim,
    partial: entry.periodo_parcial,
    origin: entry.fonte_origem,
    state: entry.estado_fonte,
  };
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidCachedSource(source) {
  return source
    && source.contractVersion === '1.0'
    && typeof source.generatedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(source.periodStart)
    && /^\d{4}-\d{2}-\d{2}$/.test(source.periodEnd)
    && typeof source.partial === 'boolean'
    && ['mysql', 'google_analytics', 'microsoft_clarity'].includes(source.origin)
    && ['pronto', 'parcial'].includes(source.state);
}

function isValidCachedData(name, data) {
  if (name === 'usuarios') {
    return /^\d{4}-(?:0[1-9]|1[0-2])$/.test(data.currentMonth)
      && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(data.previousMonth)
      && isNonNegativeInteger(data.currentTotal)
      && (data.currentNewUsers === null || isNonNegativeInteger(data.currentNewUsers))
      && (data.previousNewUsers === null || isNonNegativeInteger(data.previousNewUsers))
      && Array.isArray(data.ranking)
      && data.ranking.length <= 20
      && data.ranking.every((item) => item.month === data.currentMonth
        && isOpaqueIdentifierSafe(item.companyId)
        && isNonNegativeInteger(item.newUsers)
        && Number.isInteger(item.position)
        && item.position >= 1
        && item.position <= 20);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(data.referenceDate) && isNonNegativeInteger(data.total);
}

async function readCacheFile(filePath, name) {
  try {
    const cached = JSON.parse(await readFile(filePath, 'utf8'));
    if (cached?.schemaVersion !== 1 || cached?.name !== name || !isValidCachedSource(cached.source) || !isValidCachedData(name, cached.data)) return null;
    return cached;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

async function readCache(cacheDir, name) {
  const destination = join(cacheDir, `${name}.json`);
  return (await readCacheFile(destination, name)) ?? readCacheFile(`${destination}.bak`, name);
}

async function writeCache(cacheDir, name, data, source) {
  await mkdir(cacheDir, { recursive: true });
  const destination = join(cacheDir, `${name}.json`);
  const backup = `${destination}.bak`;
  const temporary = join(cacheDir, `.${name}.${process.pid}.${Date.now()}.tmp`);
  const payload = JSON.stringify({ schemaVersion: 1, name, data, source });
  await writeFile(temporary, payload, { encoding: 'utf8', flag: 'wx' });

  let movedPrevious = false;
  try {
    await rm(backup, { force: true });
    try {
      await rename(destination, backup);
      movedPrevious = true;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    await rename(temporary, destination);
    if (movedPrevious) await rm(backup, { force: true });
  } catch (error) {
    await rm(temporary, { force: true });
    if (movedPrevious) {
      await rm(destination, { force: true });
      await rename(backup, destination);
    }
    throw error;
  }
}

async function loadPart({ cacheDir, fileName, loader, manifest, name }) {
  try {
    const data = await loader();
    const source = sourceFromManifest(manifest.get(fileName));
    validatePartPeriod(name, data, source);
    await writeCache(cacheDir, name, data, source);
    return { cache: { data, source }, warning: null };
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    return { cache: await readCache(cacheDir, name), warning: error.message };
  }
}

function composeUserData(userPart, inactivityPart, warnings) {
  const hasUsers = Boolean(userPart?.data);
  const hasInactivity = Boolean(inactivityPart?.data);
  const hasWarnings = warnings.length > 0;
  const status = hasUsers && hasInactivity ? (hasWarnings ? 'stale' : 'ready') : (hasUsers || hasInactivity ? 'partial' : 'unavailable');
  const users = userPart?.data;
  const inactivity = inactivityPart?.data;

  return {
    status,
    source: userPart?.source ?? null,
    inactivitySource: inactivityPart?.source ?? null,
    warnings,
    indicators: {
      currentMonth: users?.currentMonth ?? null,
      currentTotal: users?.currentTotal ?? null,
      currentNewUsers: users?.currentNewUsers ?? null,
      previousMonth: users?.previousMonth ?? null,
      previousNewUsers: users?.previousNewUsers ?? null,
      ranking: users?.ranking ?? [],
      inactive30Days: inactivity?.total ?? null,
      inactivityReferenceDate: inactivity?.referenceDate ?? null,
      discharges: null,
    },
  };
}

export async function loadUserData(dataDir, cacheDir) {
  let manifest;
  try {
    manifest = await loadManifest(dataDir);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const [usersCache, inactivityCache] = await Promise.all([
      readCache(cacheDir, 'usuarios'),
      readCache(cacheDir, 'usuarios_inatividade'),
    ]);
    return composeUserData(usersCache, inactivityCache, [error.message]);
  }

  const [usersResult, inactivityResult] = await Promise.all([
    loadPart({ cacheDir, fileName: 'usuarios.csv', loader: () => loadUsers(dataDir), manifest, name: 'usuarios' }),
    loadPart({ cacheDir, fileName: 'usuarios_inatividade.csv', loader: () => loadInactivity(dataDir), manifest, name: 'usuarios_inatividade' }),
  ]);
  return composeUserData(
    usersResult.cache,
    inactivityResult.cache,
    [usersResult.warning, inactivityResult.warning].filter(Boolean),
  );
}
