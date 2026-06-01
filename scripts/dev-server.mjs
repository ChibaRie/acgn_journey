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
const APP_URL = `http://${HOST}:${PORT}`;
const PID_FILE = path.join(ROOT, '.dev-server.pid');
const LOG_FILE = path.join(ROOT, 'vite-dev-server.log');
const IS_WINDOWS = process.platform === 'win32';
const NPM = 'npm';

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith('-')) || 'toggle';
const shouldOpen = !args.includes('--no-open');

function log(message) {
  process.stdout.write(`[my-acgn] ${message}${os.EOL}`);
}

function fail(message, code = 1) {
  process.stderr.write(`[my-acgn] ${message}${os.EOL}`);
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

function readPid() {
  try {
    return Number(fs.readFileSync(PID_FILE, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

function writePid(pid) {
  fs.writeFileSync(PID_FILE, `${pid}${os.EOL}`);
}

function clearPid() {
  fs.rmSync(PID_FILE, { force: true });
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

function findPortPids() {
  try {
    if (IS_WINDOWS) {
      return run('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        '$port=[int]$env:APP_PORT; Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique',
      ])
        .split(/\s+/)
        .map(Number)
        .filter(Boolean);
    }
    return run('lsof', [`-tiTCP:${PORT}`, '-sTCP:LISTEN'])
      .split(/\s+/)
      .map(Number)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getRunningState() {
  const pid = readPid();
  if (isPidAlive(pid)) {
    return { kind: 'managed', pids: [pid] };
  }
  if (pid) clearPid();

  const portPids = findPortPids();
  const projectPids = portPids.filter(looksLikeThisProject);
  if (projectPids.length > 0) {
    return { kind: 'unmanaged', pids: projectPids };
  }
  if (portPids.length > 0) {
    return { kind: 'occupied', pids: portPids };
  }
  return { kind: 'stopped', pids: [] };
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

function waitForServer(timeoutMs = 30000) {
  const started = Date.now();

  return new Promise((resolve) => {
    const tick = () => {
      const request = http.get(APP_URL, (response) => {
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
  const state = getRunningState();
  if (state.kind === 'managed' || state.kind === 'unmanaged') {
    log(`Already running at ${APP_URL} (PID ${state.pids.join(', ')}).`);
    if (shouldOpen) openUrl();
    return;
  }
  if (state.kind === 'occupied') {
    fail(`Port ${PORT} is used by another process (PID ${state.pids.join(', ')}).`);
  }

  ensureDependencies();
  log(`Starting dev server on ${APP_URL}...`);

  const out = fs.openSync(LOG_FILE, 'a');
  const npm = npmCommand(['run', 'dev', '--', '--host', HOST, '--port', String(PORT)]);
  const child = spawn(npm.command, npm.args, {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, APP_PORT: String(PORT), APP_HOST: HOST },
    windowsHide: IS_WINDOWS,
  });
  writePid(child.pid);

  log(`Process started (PID ${child.pid}).`);
  const ready = await waitForServer();
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

function stop() {
  const state = getRunningState();
  if (state.kind === 'stopped') {
    log(`Not running on ${APP_URL}.`);
    return;
  }
  if (state.kind === 'occupied') {
    fail(`Port ${PORT} is used by another process (PID ${state.pids.join(', ')}); nothing was stopped.`);
  }

  for (const pid of state.pids) killPid(pid);
  clearPid();
  log(`Stopped dev server on ${APP_URL}.`);
}

function status() {
  const state = getRunningState();
  if (state.kind === 'stopped') {
    log(`Stopped: ${APP_URL}`);
    return;
  }
  if (state.kind === 'occupied') {
    log(`Port ${PORT} is occupied by another process (PID ${state.pids.join(', ')}).`);
    process.exitCode = 1;
    return;
  }
  log(`Running at ${APP_URL} (${state.kind}, PID ${state.pids.join(', ')}).`);
}

function help() {
  console.log(`Usage:
  npm run app              Toggle start/stop
  npm run app:start        Start and open ${APP_URL}
  npm run app:stop         Stop the dev server
  npm run app:restart      Restart the dev server
  npm run app:status       Show status

Options:
  -- --no-open             Start without opening the browser

Environment:
  APP_PORT=5188            Override the dev server port
  APP_HOST=127.0.0.1       Override the dev server host`);
}

switch (command) {
  case 'toggle': {
    const state = getRunningState();
    if (state.kind === 'managed' || state.kind === 'unmanaged') {
      stop();
    } else if (state.kind === 'stopped') {
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
