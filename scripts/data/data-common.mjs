import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
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

    if (character === '"' && field === '') quoted = true;
    else if (character === ';') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += character;
  }

  if (quoted) throw new DataContractError(`${fileName}: campo entre aspas não foi encerrado.`);
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  if (rows.length === 0) throw new DataContractError(`${fileName}: arquivo vazio.`);
  return rows;
}

export async function readCsv(dataDir, fileName, expectedHeaders) {
  const filePath = join(dataDir, fileName);
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new DataContractError(`${fileName}: arquivo ausente.`);
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

export function assertDate(value, field, fileName, rowNumber) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  return value;
}

export function assertTimestamp(value, field, fileName, rowNumber) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new DataContractError(`${fileName}: ${field} inválido na linha ${rowNumber}.`);
  }
  return value;
}

export function assertMonth(value, fileName, rowNumber) {
  if (!/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)) {
    throw new DataContractError(`${fileName}: mês inválido na linha ${rowNumber}.`);
  }
  return value;
}

export function monthBounds(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  };
}

export function assertMonthInsideSource(month, source, fileName, rowNumber = null) {
  const bounds = monthBounds(month);
  if (bounds.start < source.periodStart || bounds.end > source.periodEnd) {
    const location = rowNumber === null ? '' : ` na linha ${rowNumber}`;
    throw new DataContractError(`${fileName}: o mês ${month} está fora do período declarado no manifesto${location}.`);
  }
  return month;
}

export function nonNegativeInteger(value, field, fileName, rowNumber) {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new DataContractError(`${fileName}: ${field} deve ser um inteiro não negativo na linha ${rowNumber}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new DataContractError(`${fileName}: ${field} excede o limite aceito na linha ${rowNumber}.`);
  }
  return parsed;
}

export function assertEmpty(row, fields, fileName, rowNumber) {
  for (const field of fields) {
    if (row[field] !== '' && row[field] !== '\\N') {
      throw new DataContractError(`${fileName}: ${field} deve ficar vazio na linha ${rowNumber}.`);
    }
  }
}

export function containsKnownPii(value) {
  return /[\u0000-\u001F\u007F]/.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(value)
    || /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/.test(value)
    || /(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?9?\d{4}[\s.-]?\d{4}/.test(value);
}

export function isOpaqueIdentifierSafe(value) {
  return typeof value === 'string'
    && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,63}$/.test(value)
    && !containsKnownPii(value)
    && !/^\d{10,20}$/.test(value);
}

export function assertOpaqueIdentifier(value, fileName, rowNumber) {
  if (!isOpaqueIdentifierSafe(value)) {
    throw new DataContractError(`${fileName}: empresa_id_opaco ausente, fora do formato seguro ou contém PII conhecida na linha ${rowNumber}.`);
  }
}

export async function loadManifest(dataDir, requiredFiles = []) {
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

  for (const requiredFile of requiredFiles) {
    if (!entries.has(requiredFile)) throw new DataContractError(`manifesto_carga.csv: falta a linha de ${requiredFile}.`);
    if (entries.get(requiredFile).estado_fonte === 'indisponivel') {
      throw new DataContractError(`manifesto_carga.csv: ${requiredFile} está marcado como indisponível.`);
    }
  }
  return entries;
}

export function sourceFromManifest(entry) {
  return {
    contractVersion: entry.versao_contrato,
    generatedAt: entry.gerado_em,
    periodStart: entry.periodo_inicio,
    periodEnd: entry.periodo_fim,
    partial: entry.periodo_parcial,
    origin: entry.fonte_origem,
    state: entry.estado_fonte,
    observation: entry.observacao || null,
  };
}

export function isValidCachedSource(source) {
  return source
    && source.contractVersion === '1.0'
    && typeof source.generatedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(source.periodStart)
    && /^\d{4}-\d{2}-\d{2}$/.test(source.periodEnd)
    && typeof source.partial === 'boolean'
    && ['mysql', 'google_analytics', 'microsoft_clarity'].includes(source.origin)
    && ['pronto', 'parcial'].includes(source.state)
    && (source.observation === undefined || source.observation === null || typeof source.observation === 'string');
}

async function readCacheFile(filePath, name, isValidData) {
  try {
    const cached = JSON.parse(await readFile(filePath, 'utf8'));
    if (cached?.schemaVersion !== 1 || cached?.name !== name || !isValidCachedSource(cached.source) || !isValidData(cached.data)) return null;
    return cached;
  } catch (error) {
    if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
    throw error;
  }
}

export async function readCache(cacheDir, name, isValidData) {
  const destination = join(cacheDir, `${name}.json`);
  return (await readCacheFile(destination, name, isValidData)) ?? readCacheFile(`${destination}.bak`, name, isValidData);
}

export async function writeCache(cacheDir, name, data, source) {
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

export async function recordRejection(cacheDir, file, reasons) {
  await mkdir(cacheDir, { recursive: true });
  const rejection = {
    file,
    attemptedAt: new Date().toISOString(),
    reasons,
  };
  await appendFile(
    join(cacheDir, 'validation-rejections.jsonl'),
    `${JSON.stringify(rejection)}\n`,
    { encoding: 'utf8' },
  );
  return rejection;
}

export async function loadDataSet({ cacheDir, fileName, loader, manifest, name, isValidData, validatePeriod }) {
  try {
    const entry = manifest.get(fileName);
    if (!entry) throw new DataContractError(`${fileName}: fonte não atualizada; arquivo ausente do manifesto.`);
    if (entry.estado_fonte === 'indisponivel') throw new DataContractError(`${fileName}: fonte marcada como indisponível.`);
    const source = sourceFromManifest(entry);
    const data = await loader(source);
    validatePeriod?.(data, source);
    await writeCache(cacheDir, name, data, source);
    return { cache: { data, source }, warning: null, rejection: null };
  } catch (error) {
    if (!(error instanceof DataContractError)) throw error;
    const rejection = await recordRejection(cacheDir, fileName, [error.message]);
    return {
      cache: await readCache(cacheDir, name, isValidData),
      warning: error.message,
      rejection,
    };
  }
}
