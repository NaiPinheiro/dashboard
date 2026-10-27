import {
  DataContractError,
  assertDate,
  assertEmpty,
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

export { DataContractError };

function assertDateInsidePeriod(date, source, fileName) {
  if (date < source.periodStart || date > source.periodEnd) {
    throw new DataContractError(`${fileName}: a data de referência está fora do período declarado no manifesto.`);
  }
}

function validatePartPeriod(name, data, source) {
  if (name === 'usuarios') {
    assertMonthInsideSource(data.currentMonth, source, 'usuarios.csv');
    if (data.previousNewUsers !== null) assertMonthInsideSource(data.previousMonth, source, 'usuarios.csv');
    return;
  }
  assertDateInsidePeriod(data.referenceDate, source, 'usuarios_inatividade.csv');
}

function previousMonth(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isValidUsersData(data) {
  return data
    && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(data.currentMonth)
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

function isValidInactivityData(data) {
  return data && /^\d{4}-\d{2}-\d{2}$/.test(data.referenceDate) && isNonNegativeInteger(data.total);
}

function composeUserData(userPart, inactivityPart, warnings, rejections = []) {
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
    rejections,
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
    manifest = await loadManifest(dataDir, ['usuarios.csv', 'usuarios_inatividade.csv']);
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const [usersCache, inactivityCache] = await Promise.all([
      readCache(cacheDir, 'usuarios', isValidUsersData),
      readCache(cacheDir, 'usuarios_inatividade', isValidInactivityData),
    ]);
    const rejection = await recordRejection(cacheDir, 'manifesto_carga.csv', [error.message]);
    return composeUserData(usersCache, inactivityCache, [error.message], [rejection]);
  }

  const [usersResult, inactivityResult] = await Promise.all([
    loadDataSet({
      cacheDir,
      fileName: 'usuarios.csv',
      loader: () => loadUsers(dataDir),
      manifest,
      name: 'usuarios',
      isValidData: isValidUsersData,
      validatePeriod: (data, source) => validatePartPeriod('usuarios', data, source),
    }),
    loadDataSet({
      cacheDir,
      fileName: 'usuarios_inatividade.csv',
      loader: () => loadInactivity(dataDir),
      manifest,
      name: 'usuarios_inatividade',
      isValidData: isValidInactivityData,
      validatePeriod: (data, source) => validatePartPeriod('usuarios_inatividade', data, source),
    }),
  ]);
  return composeUserData(
    usersResult.cache,
    inactivityResult.cache,
    [usersResult.warning, inactivityResult.warning].filter(Boolean),
    [usersResult.rejection, inactivityResult.rejection].filter(Boolean),
  );
}
