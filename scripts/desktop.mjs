#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const APP_HOST = process.env.APP_HOST || '127.0.0.1';
const APP_PORT = Number(process.env.APP_PORT || 5188);
const DATA_HOST = process.env.DATA_HOST || '127.0.0.1';
const DATA_PORT = Number(process.env.DATA_PORT || 5198);
const APP_URL = `http://${APP_HOST}:${APP_PORT}`;
const DATA_URL = `http://${DATA_HOST}:${DATA_PORT}`;
const LOG_FILE = path.join(ROOT, 'desktop-launch.log');
const DIST_DIR = path.join(ROOT, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const IS_WINDOWS = process.platform === 'win32';
const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

const managedChildren = new Set();
let electronProcess = null;
let appServer = null;
let isCleaningUp = false;

function log(message) {
  process.stdout.write(`[acgn-desktop] ${message}${os.EOL}`);
}

function fail(message) {
  process.stderr.write(`[acgn-desktop] ${message}${os.EOL}`);
  process.exit(1);
}

function appendLogHeader(label) {
  fs.appendFileSync(LOG_FILE, `${os.EOL}[${new Date().toISOString()}] ${label}${os.EOL}`);
}

function killProcessTree(child) {
  if (!child?.pid) return;
  try {
    if (IS_WINDOWS) {
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    child.kill('SIGTERM');
  } catch {
    // The process may have exited between the readiness check and cleanup.
  }
}

function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  if (appServer) {
    try {
      appServer.close();
    } catch {
      // The local static server may already be closed.
    }
    appServer = null;
  }
  for (const child of managedChildren) killProcessTree(child);
  managedChildren.clear();
}

function installExitHandlers() {
  process.once('exit', cleanup);
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      if (electronProcess) killProcessTree(electronProcess);
      cleanup();
      process.exit(signal === 'SIGINT' ? 130 : 143);
    });
  }
}

function requestText(url, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 500,
          statusCode: response.statusCode,
          text: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    request.on('error', () => resolve({ ok: false, statusCode: 0, text: '' }));
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve({ ok: false, statusCode: 0, text: '' });
    });
  });
}

async function waitFor(check, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function isDataReady() {
  const response = await requestText(`${DATA_URL}/api/local/health`);
  if (!response.ok) return false;
  try {
    const payload = JSON.parse(response.text);
    return payload.ok === true && payload.app === 'acgn_journey';
  } catch {
    return false;
  }
}

async function isAppReady() {
  const response = await requestText(APP_URL);
  return response.ok && response.text.includes('acgn_journey');
}

function spawnManaged(label, command, args, env = {}) {
  appendLogHeader(label);
  const out = fs.openSync(LOG_FILE, 'a');
  const child = spawn(command, args, {
    cwd: ROOT,
    stdio: ['ignore', out, out],
    env: { ...process.env, ...env },
    windowsHide: IS_WINDOWS,
  });

  managedChildren.add(child);
  child.once('exit', () => {
    managedChildren.delete(child);
    try {
      fs.closeSync(out);
    } catch {
      // The fd may already be closed by the OS when the child exits.
    }
  });
  return child;
}

function ensureDependencies() {
  const electronCli = path.join(ROOT, 'node_modules', 'electron', 'cli.js');
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  if (fs.existsSync(electronCli) && fs.existsSync(viteCli)) return;

  log('Dependencies are missing; running npm install...');
  const result = spawnSync(IS_WINDOWS ? 'npm.cmd' : 'npm', ['install'], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: IS_WINDOWS,
  });
  if (result.status !== 0) fail('npm install failed.');
}

function latestMtime(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;

  let latest = stat.mtimeMs;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    latest = Math.max(latest, latestMtime(path.join(target, entry.name)));
  }
  return latest;
}

function needsBuild() {
  if (!fs.existsSync(DIST_INDEX)) return true;
  const distTime = fs.statSync(DIST_INDEX).mtimeMs;
  const sourceTime = Math.max(
    latestMtime(path.join(ROOT, 'src')),
    latestMtime(path.join(ROOT, 'index.html')),
    latestMtime(path.join(ROOT, 'vite.config.js')),
    latestMtime(path.join(ROOT, 'package.json')),
  );
  return sourceTime > distTime + 1000;
}

function ensureProductionBundle() {
  if (!needsBuild()) return;

  log('Production bundle is missing or stale; building it...');
  const viteCli = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteCli, 'build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_LOCAL_API_BASE: DATA_URL,
    },
    windowsHide: IS_WINDOWS,
  });
  if (result.status !== 0) fail('npm run build failed.');
}

function resolveStaticPath(requestUrl) {
  const url = new URL(requestUrl, APP_URL);
  const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const target = pathname === '' ? DIST_INDEX : path.normalize(path.join(DIST_DIR, pathname));
  const relative = path.relative(DIST_DIR, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return '';
  return target;
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES.get(extension) || 'application/octet-stream';
  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Failed to read local app file.');
      return;
    }
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
}

function handleStaticRequest(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  const filePath = resolveStaticPath(request.url || '/');
  if (!filePath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden.');
    return;
  }

  const exists = fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  if (exists) {
    if (request.method === 'HEAD') {
      response.writeHead(200, {
        'Content-Type': MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
    sendFile(response, filePath);
    return;
  }

  if (request.url?.startsWith('/assets/')) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found.');
    return;
  }

  sendFile(response, DIST_INDEX);
}

async function ensureDataService() {
  if (await isDataReady()) {
    log(`Local data service already running at ${DATA_URL}.`);
    return;
  }

  log(`Starting local data service at ${DATA_URL}...`);
  spawnManaged('local data service', process.execPath, ['scripts/local-data-server.mjs'], {
    DATA_HOST,
    DATA_PORT: String(DATA_PORT),
    ACGN_DATA_DIR: process.env.ACGN_DATA_DIR || '',
    ACGN_DB_PATH: process.env.ACGN_DB_PATH || '',
  });

  const ready = await waitFor(isDataReady, 20000);
  if (!ready) {
    throw new Error(`Local data service did not become ready. See ${path.basename(LOG_FILE)}.`);
  }
}

async function ensureAppService() {
  if (await isAppReady()) {
    log(`App service already running at ${APP_URL}.`);
    return;
  }

  ensureProductionBundle();
  log(`Starting local app runtime at ${APP_URL}...`);
  appServer = http.createServer(handleStaticRequest);
  await new Promise((resolve, reject) => {
    appServer.once('error', reject);
    appServer.listen(APP_PORT, APP_HOST, () => {
      appServer.off('error', reject);
      resolve();
    });
  });

  const ready = await waitFor(isAppReady, 30000);
  if (!ready) {
    throw new Error(`App service did not become ready. See ${path.basename(LOG_FILE)}.`);
  }
}

function launchElectron() {
  const electronEntry = path.join(ROOT, 'electron', 'main.mjs');
  electronProcess = spawn(process.execPath, ['node_modules/electron/cli.js', electronEntry], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      ACGN_APP_URL: APP_URL,
      APP_HOST,
      APP_PORT: String(APP_PORT),
      DATA_HOST,
      DATA_PORT: String(DATA_PORT),
    },
    windowsHide: IS_WINDOWS,
  });

  return new Promise((resolve, reject) => {
    electronProcess.once('error', reject);
    electronProcess.once('exit', (code) => resolve(code ?? 0));
  });
}

async function main() {
  installExitHandlers();
  ensureDependencies();
  await ensureDataService();
  await ensureAppService();
  log('Opening desktop window...');
  const code = await launchElectron();
  cleanup();
  process.exitCode = code;
}

main().catch((error) => {
  cleanup();
  fail(error.message || String(error));
});
