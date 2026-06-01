#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const PORT = Number(process.env.APP_PORT || process.env.PORT || 5188);
const HOST = process.env.APP_HOST || '127.0.0.1';
const DATA_PORT = Number(process.env.DATA_PORT || 5198);
const DATA_HOST = process.env.DATA_HOST || '127.0.0.1';
const APP_URL = `http://${HOST}:${PORT}`;
const DATA_URL = `http://${DATA_HOST}:${DATA_PORT}`;
const PID_FILE = path.join(ROOT, '.dev-server.pid');
const DATA_PID_FILE = path.join(ROOT, '.local-data-server.pid');
const LOG_FILE = path.join(ROOT, 'vite-dev-server.log');
const DATA_LOG_FILE = path.join(ROOT, 'local-data-server.log');
const IS_WINDOWS = process.platform === 'win32';
const NPM = 'npm';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'toggle';
const shouldOpen = !args.includes('--no-open');

function log(message) {
  process.stdout.write(`[acgn] ${message}${os.EOL}`);
}

function fail(message, code = 1) {
  process.stderr.write(`[acgn] ${message}${os.EOL}`);
  process.exit(code);
}

function run(commandName, commandArgs, options = {}) {
  return execFileSync(commandName, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio || ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, APP_PORT: String(PORT), APP_ROOT: ROOT },
  });
}

function npmCommand(commandArgs) {
  if (!IS_WINDOWS) {
    return { command: NPM, args: commandArgs };
  }
  return {
    command: process.env.ComSpec || 'cmd.exe',
    args: ['/d', '/s', '/c', NPM, ...commandArgs],
  };
}

function normalizePath(value) {
  return String(value || '').replaceAll('\\', '/').toLowerCase();
}

function readPid(file = PID_FILE) {
  try {
    return Number(fs.readFileSync(file, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

function writePid(pid, file = PID_FILE) {
  fs.writeFileSync(file, `${pid}${os.EOL}`);
}

function clearPid(file = PID_FILE) {
  fs.rmSync(file, { force: true });
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function commandLine(pid) {
  if (!pid) return '';
  try {
    if (IS_WINDOWS) {
      return run('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
      ]).trim();
    }
    return run('ps', ['-p', String(pid), '-o', 'command=']).trim();
  } catch {
    return '';
  }
}

function looksLikeThisProject(pid) {
  const cmd = normalizePath(commandLine(pid));
  const root = normalizePath(ROOT);
  return cmd.includes(root) || (cmd.includes('vite') && cmd.includes(String(PORT)));
}

function findPortPids(port = PORT) {
  try {
    if (IS_WINDOWS) {
      return run('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        `$port=${Number(port)}; Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`,
      ])
        .split(/\s+/)
        .map(Number)
        .filter(Boolean);
    }
    return run('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'])
      .split(/\s+/)
      .map(Number)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getRunningState({
  pidFile = PID_FILE,
  port = PORT,
  predicate = looksLikeThisProject,
} = {}) {
  const pid = readPid(pidFile);
  if (isPidAlive(pid)) {
    return { kind: 'managed', pids: [pid] };
  }
  if (pid) clearPid(pidFile);

  const portPids = findPortPids(port);
  const projectPids = portPids.filter(predicate);
  if (projectPids.length > 0) {
    return { kind: 'unmanaged', pids: projectPids };
  }
  if (portPids.length > 0) {
    return { kind: 'occupied', pids: portPids };
  }
  return { kind: 'stopped', pids: [] };
}

function looksLikeDataServer(pid) {
  const cmd = normalizePath(commandLine(pid));
  const root = normalizePath(ROOT);
  return cmd.includes(root) && cmd.includes('local-data-server.mjs');
}

function getAppState() {
  return getRunningState({ pidFile: PID_FILE, port: PORT, predicate: looksLikeThisProject });
}

function getDataState() {
  return getRunningState({ pidFile: DATA_PID_FILE, port: DATA_PORT, predicate: looksLikeDataServer });
}

function ensureDependencies() {
  if (fs.existsSync(path.join(ROOT, 'node_modules'))) return;
  log('node_modules not found; running npm install...');
  const npm = npmCommand(['install']);
  const result = spawnSync(npm.command, npm.args, {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: IS_WINDOWS,
  });
  if (result.status !== 0) fail('npm install failed.');
}

function waitForServer(url = APP_URL, timeoutMs = 30000) {
  const started = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve(true);
      });
      request.on('error', () => {
        if (Date.now() - started >= timeoutMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 500);
      });
      request.setTimeout(1200, () => {
        request.destroy();
      });
    };
    tick();
  });
}

function openUrl() {
  const opener = IS_WINDOWS
    ? { cmd: 'cmd', args: ['/c', 'start', '', APP_URL] }
    : process.platform === 'darwin'
      ? { cmd: 'open', args: [APP_URL] }
      : { cmd: 'xdg-open', args: [APP_URL] };

  try {
    spawn(opener.cmd, opener.args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    log(`Open manually: ${APP_URL}`);
  }
}

async function start() {
  await startDataServer();
  await startAppServer();
}

async function startDataServer() {
  const state = getDataState();
  if (state.kind === 'managed' || state.kind === 'unmanaged') {
    log(`Local data server already running at ${DATA_URL} (PID ${state.pids.join(', ')}).`);
    return;
  }
  if (state.kind === 'occupied') {
    fail(`Data port ${DATA_PORT} is used by another process (PID ${state.pids.join(', ')}).`);
  }

  log(`Starting local SQLite data server on ${DATA_URL}...`);
  const out = fs.openSync(DATA_LOG_FILE, 'a');
  const child = spawn(process.execPath, ['scripts/local-data-server.mjs'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      DATA_PORT: String(DATA_PORT),
      DATA_HOST,
      APP_PORT: String(PORT),
      APP_HOST: HOST,
      APP_ROOT: ROOT,
    },
    windowsHide: IS_WINDOWS,
  });
  writePid(child.pid, DATA_PID_FILE);

  log(`Local data process started (PID ${child.pid}).`);
  const ready = await waitForServer(`${DATA_URL}/api/local/health`, 15000);
  if (ready) {
    log(`Local data ready: ${DATA_URL}`);
  } else {
    log(`Local data still starting. Check ${path.basename(DATA_LOG_FILE)}.`);
  }
  child.unref();
}

async function startAppServer() {
  const state = getAppState();
  if (state.kind === 'managed' || state.kind === 'unmanaged') {
    log(`App already running at ${APP_URL} (PID ${state.pids.join(', ')}).`);
    if (shouldOpen) openUrl();
    return;
  }
  if (state.kind === 'occupied') {
    fail(`App port ${PORT} is used by another process (PID ${state.pids.join(', ')}).`);
  }

  ensureDependencies();
  log(`Starting dev server on ${APP_URL}...`);

  const out = fs.openSync(LOG_FILE, 'a');
  const npm = npmCommand(['run', 'dev', '--', '--host', HOST, '--port', String(PORT)]);
  const child = spawn(npm.command, npm.args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: {
      ...process.env,
      APP_PORT: String(PORT),
      APP_HOST: HOST,
      DATA_PORT: String(DATA_PORT),
      DATA_HOST,
      VITE_LOCAL_API_BASE: DATA_URL,
    },
    windowsHide: IS_WINDOWS,
  });
  writePid(child.pid);

  log(`Process started (PID ${child.pid}).`);
  const ready = await waitForServer(APP_URL);
  if (ready) {
    log(`Ready: ${APP_URL}`);
    if (shouldOpen) openUrl();
  } else {
    log(`Still starting. Check ${path.basename(LOG_FILE)} or open ${APP_URL} shortly.`);
  }
  child.unref();
}

function killPid(pid) {
  if (!pid) return;
  try {
    if (IS_WINDOWS) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      return;
    }
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    // Process may have already exited.
  }
}

function stopAppServer() {
  const state = getAppState();
  if (state.kind === 'stopped') {
    log(`App not running on ${APP_URL}.`);
    return;
  }
  if (state.kind === 'occupied') {
    fail(`App port ${PORT} is used by another process (PID ${state.pids.join(', ')}); nothing was stopped.`);
  }

  for (const pid of state.pids) killPid(pid);
  clearPid();
  log(`Stopped dev server on ${APP_URL}.`);
}

function stopDataServer() {
  const state = getDataState();
  if (state.kind === 'stopped') {
    log(`Local data server not running on ${DATA_URL}.`);
    return;
  }
  if (state.kind === 'occupied') {
    fail(`Data port ${DATA_PORT} is used by another process (PID ${state.pids.join(', ')}); nothing was stopped.`);
  }

  for (const pid of state.pids) killPid(pid);
  clearPid(DATA_PID_FILE);
  log(`Stopped local data server on ${DATA_URL}.`);
}

function stop() {
  stopAppServer();
  stopDataServer();
}

function status() {
  const appState = getAppState();
  const dataState = getDataState();
  if (appState.kind === 'occupied' || dataState.kind === 'occupied') {
    if (appState.kind === 'occupied') {
      log(`App port ${PORT} is occupied by another process (PID ${appState.pids.join(', ')}).`);
    }
    if (dataState.kind === 'occupied') {
      log(`Data port ${DATA_PORT} is occupied by another process (PID ${dataState.pids.join(', ')}).`);
    }
    process.exitCode = 1;
    return;
  }
  log(`App: ${appState.kind} at ${APP_URL}${appState.pids.length ? ` (PID ${appState.pids.join(', ')})` : ''}.`);
  log(`Data: ${dataState.kind} at ${DATA_URL}${dataState.pids.length ? ` (PID ${dataState.pids.join(', ')})` : ''}.`);
}

function help() {
  console.log(`Usage:
  npm run app              Toggle start/stop
  npm run app:start        Start local data server, app server, and open ${APP_URL}
  npm run app:stop         Stop the app and local data server
  npm run app:restart      Restart both servers
  npm run app:status       Show status

Options:
  -- --no-open             Start without opening the browser

Environment:
  APP_PORT=5188            Override the dev server port
  APP_HOST=127.0.0.1       Override the dev server host
  DATA_PORT=5198           Override the local data server port
  DATA_HOST=127.0.0.1      Override the local data server host
  ACGN_DATA_DIR=...        Override the SQLite data directory`);
}

switch (command) {
  case 'toggle': {
    const appState = getAppState();
    const dataState = getDataState();
    if (
      appState.kind === 'managed' ||
      appState.kind === 'unmanaged' ||
      dataState.kind === 'managed' ||
      dataState.kind === 'unmanaged'
    ) {
      stop();
    } else if (appState.kind === 'stopped' && dataState.kind === 'stopped') {
      await start();
    } else {
      status();
    }
    break;
  }
  case 'start':
    await start();
    break;
  case 'stop':
    stop();
    break;
  case 'restart':
    stop();
    await start();
    break;
  case 'status':
    status();
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    fail(`Unknown command: ${command}. Run "npm run app:help".`);
}
