import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

const cleanup = [];
afterEach(async () => {
  while (cleanup.length) await cleanup.pop()();
});

async function startService({ version = 2, token = '', healthStatus = 200, records = [], revision = 'snapshot' } = {}) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ path: request.url, token: request.headers['x-acgn-local-token'] });
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/local/health') {
      response.writeHead(healthStatus);
      response.end(JSON.stringify({ ok: true, app: 'acgn_journey', recordsProtocolVersion: version, requiresToken: Boolean(token) }));
      return;
    }
    if (token && request.headers['x-acgn-local-token'] !== token) {
      response.writeHead(401);
      response.end(JSON.stringify({ error: 'Invalid token.' }));
      return;
    }
    response.end(JSON.stringify({ records, revision }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

async function check(url, token) {
  const { isLocalDataServiceReady } = await import('./local-data-service.mjs');
  return isLocalDataServiceReady(url, token, { timeoutMs: 1000 });
}

test('matching token must successfully read protected records before service reuse', async () => {
  const service = await startService({ token: 'matching-token' });
  expect(await check(service.url, 'matching-token')).toBe(true);
  expect(service.requests).toContainEqual({ path: '/api/local/records', token: 'matching-token' });
});

test('token-free service is reusable with a launcher token', async () => {
  const service = await startService();
  expect(await check(service.url, 'launcher-token')).toBe(true);
});

test('wrong token produces an explicit authentication failure', async () => {
  const service = await startService({ token: 'server-token' });
  await expect(check(service.url, 'wrong-token')).rejects.toMatchObject({ code: 'LOCAL_API_AUTH_FAILED', message: expect.stringMatching(/token/i) });
});

test.each([undefined, 1, 3])('protocol %s cannot be reused', async (version) => {
  const service = await startService({ version: version ?? null });
  await expect(check(service.url, 'token')).rejects.toMatchObject({ code: 'LOCAL_API_PROTOCOL_MISMATCH', message: expect.stringMatching(/protocol/i) });
  expect(service.requests).toHaveLength(1);
});

test('HTTP errors and malformed records are explicit compatibility failures', async () => {
  const unhealthy = await startService({ healthStatus: 503 });
  await expect(check(unhealthy.url, '')).rejects.toMatchObject({ code: 'LOCAL_API_INVALID_RESPONSE' });
  const malformed = await startService({ revision: '' });
  await expect(check(malformed.url, '')).rejects.toMatchObject({ code: 'LOCAL_API_INVALID_RESPONSE' });
});

test('unreachable service returns false so the launcher can start it', async () => {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  await new Promise((resolve) => server.close(resolve));
  expect(await check(url, 'token')).toBe(false);
});

test.each(['desktop.mjs', 'dev-server.mjs'])('%s aborts startup when the existing service uses an old protocol', async (script) => {
  const service = await startService({ version: 1 });
  const result = await runLauncher(script, service.url);
  expect(result.code, result.output).toBe(1);
  expect(result.output).toMatch(/protocol is incompatible/i);
  expect(service.requests).toHaveLength(1);
});

test.each(['desktop.mjs', 'dev-server.mjs'])('%s aborts startup when the current token cannot read records', async (script) => {
  const service = await startService({ token: 'different-token' });
  const result = await runLauncher(script, service.url);
  expect(result.code, result.output).toBe(1);
  expect(result.output).toMatch(/rejected the current API token/i);
  expect(service.requests).toContainEqual({ path: '/api/local/records', token: 'launcher-test-token' });
});

async function runLauncher(script, serviceUrl) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acgn-launcher-test-'));
  cleanup.push(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  const appPortServer = http.createServer();
  await new Promise((resolve) => appPortServer.listen(0, '127.0.0.1', resolve));
  const appPort = appPortServer.address().port;
  await new Promise((resolve) => appPortServer.close(resolve));
  const child = spawn(process.execPath, [path.join(import.meta.dirname, script), 'start', '--no-open'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      ACGN_LOCAL_API_TOKEN: 'launcher-test-token',
      ACGN_DATA_DIR: dataDir,
      ACGN_DB_PATH: path.join(dataDir, 'test.sqlite'),
      DATA_HOST: '127.0.0.1', DATA_PORT: new URL(serviceUrl).port,
      APP_HOST: '127.0.0.1', APP_PORT: String(appPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk) => { output += chunk.toString(); });
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`Launcher did not reject the incompatible service: ${script}`));
    }, 5000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); resolve({ code, output }); });
  });
}
