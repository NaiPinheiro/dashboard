import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DataContractError } from './data/data-common.mjs';
import { loadPortalData } from './data/portal-data.mjs';
import { loadUserData } from './data/user-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = resolve(root, process.env.DATA_DIR ?? 'dados');
const cacheDir = resolve(root, process.env.CACHE_DIR ?? '.painel-cache');
const host = '127.0.0.1';
const port = Number.parseInt(process.env.PORT ?? '8792', 10);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
]);

const publicAssetTypes = new Set(['.css', '.js', '.json', '.png', '.svg', '.webp']);
const assetsRoot = resolve(root, 'assets');

function sendTextResponse(response, status, body = '') {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function sendJsonResponse(response, status, body, method = 'GET') {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(method === 'HEAD' ? undefined : JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    sendTextResponse(response, 405, 'Método não permitido.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
  } catch {
    sendTextResponse(response, 400, 'Caminho inválido.');
    return;
  }

  if (pathname === '/api/usuarios') {
    try {
      const data = await loadUserData(dataDir, cacheDir);
      sendJsonResponse(response, 200, data, request.method);
    } catch (error) {
      if (error instanceof DataContractError) {
        sendJsonResponse(response, 422, { status: 'unavailable', errors: [error.message] }, request.method);
        return;
      }
      console.error(error);
      sendJsonResponse(response, 500, { status: 'unavailable', errors: ['Falha interna ao carregar Usuários.'] }, request.method);
    }
    return;
  }

  if (pathname === '/api/telas-portal') {
    try {
      const data = await loadPortalData(dataDir, cacheDir);
      sendJsonResponse(response, 200, data, request.method);
    } catch (error) {
      if (error instanceof DataContractError) {
        sendJsonResponse(response, 422, { status: 'unavailable', errors: [error.message] }, request.method);
        return;
      }
      console.error(error);
      sendJsonResponse(response, 500, { status: 'unavailable', errors: ['Falha interna ao carregar telas do Portal.'] }, request.method);
    }
    return;
  }

  const isPanel = pathname === '/' || pathname === '/painel.html';
  const relativePath = isPanel ? 'painel.html' : pathname.replace(/^\/+/, '');
  const filePath = resolve(root, relativePath);
  const isPublicAsset = pathname.startsWith('/assets/')
    && filePath.startsWith(`${assetsRoot}${sep}`)
    && publicAssetTypes.has(extname(filePath).toLowerCase());
  if (!isPanel && !isPublicAsset) {
    sendTextResponse(response, 404, 'Arquivo não encontrado.');
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendTextResponse(response, 404, 'Arquivo não encontrado.');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      'Cache-Control': 'no-store',
      'Content-Type': contentTypes.get(extname(filePath).toLowerCase()) ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      sendTextResponse(response, 404, 'Arquivo não encontrado.');
      return;
    }
    console.error(error);
    sendTextResponse(response, 500, 'Erro interno do servidor.');
  }
});

server.listen(port, host, () => {
  console.log(`Painel disponível em http://${host}:${port}/painel.html`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
