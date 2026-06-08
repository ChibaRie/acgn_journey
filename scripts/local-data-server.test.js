import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_SERVER_SCRIPT = path.join(ROOT, 'scripts', 'local-data-server.mjs');

const cleanup = [];

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null);
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

async function getFreePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function startMockLlm(handler) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const body = await readRequestBody(request);
    requests.push({ request, body });
    await handler({ request, response, body });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise((resolve) => server.close(resolve)));
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}/v1/`,
    requests,
  };
}

async function startDataServer() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acgn-data-test-'));
  const port = await getFreePort();
  const child = spawn(process.execPath, [DATA_SERVER_SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      ACGN_DATA_DIR: dataDir,
      ACGN_DB_PATH: path.join(dataDir, 'test.sqlite'),
      DATA_HOST: '127.0.0.1',
      DATA_PORT: String(port),
      LLM_PROFILE_TIMEOUT_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  cleanup.push(async () => {
    if (!child.killed) child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/local/health`);
      if (response.ok) return baseUrl;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  child.kill();
  throw new Error('Data server did not become ready.');
}

async function setLlmProfileConfig(baseUrl, value = {}) {
  const response = await fetch(`${baseUrl}/api/local/settings/llm-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: {
        baseUrl: value.baseUrl,
        model: value.model || 'profile-model',
        apiKey: value.apiKey || 'secret-token',
        temperature: value.temperature ?? 0.8,
      },
    }),
  });
  expect(response.status).toBe(200);
}

afterEach(async () => {
  while (cleanup.length) {
    await cleanup.pop()();
  }
});

test('POST /api/local/ai/profile returns raw LLM text without exposing apiKey', async () => {
  const mockLlm = await startMockLlm(({ request, response, body }) => {
    expect(request.url).toBe('/v1/chat/completions');
    expect(request.headers.authorization).toBe('Bearer secret-token');
    expect(body).toMatchObject({
      model: 'profile-model',
      messages: [{ role: 'user', content: 'make a profile' }],
      temperature: 0.8,
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        model: 'profile-model',
        choices: [{ message: { content: 'profile text' } }],
        usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
      }),
    );
  });
  const dataServer = await startDataServer();
  await setLlmProfileConfig(dataServer, { baseUrl: mockLlm.baseUrl });

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileInput: 'make a profile' }),
  });
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload).toMatchObject({
    rawText: 'profile text',
    model: 'profile-model',
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  });
  expect(payload.createdAt).toEqual(expect.any(String));
  expect(JSON.stringify(payload)).not.toContain('secret-token');
  expect(mockLlm.requests).toHaveLength(1);
});

test('POST /api/local/ai/models fetches model list with current config', async () => {
  const mockLlm = await startMockLlm(({ request, response }) => {
    expect(request.method).toBe('GET');
    expect(request.url).toBe('/v1/models');
    expect(request.headers.authorization).toBe('Bearer model-token');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        data: [
          { id: 'zeta-model', owned_by: 'local' },
          { id: 'alpha-model', owned_by: 'local' },
        ],
      }),
    );
  });
  const dataServer = await startDataServer();

  const response = await fetch(`${dataServer}/api/local/ai/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        baseUrl: mockLlm.baseUrl,
        apiKey: 'model-token',
      },
    }),
  });
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload.models).toEqual([
    { id: 'alpha-model', ownedBy: 'local' },
    { id: 'zeta-model', ownedBy: 'local' },
  ]);
  expect(payload.createdAt).toEqual(expect.any(String));
});

test('POST /api/local/ai/test verifies chat completions connectivity', async () => {
  const mockLlm = await startMockLlm(({ request, response, body }) => {
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/v1/chat/completions');
    expect(request.headers.authorization).toBe('Bearer test-token');
    expect(body).toMatchObject({
      model: 'test-model',
      temperature: 0.8,
    });
    expect(body.messages[0].content).toContain('连接正常');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(
      JSON.stringify({
        model: 'test-model',
        choices: [{ message: { content: '连接正常' } }],
      }),
    );
  });
  const dataServer = await startDataServer();

  const response = await fetch(`${dataServer}/api/local/ai/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        baseUrl: mockLlm.baseUrl,
        model: 'test-model',
        apiKey: 'test-token',
      },
    }),
  });
  const payload = await response.json();

  expect(response.status).toBe(200);
  expect(payload).toMatchObject({
    ok: true,
    rawText: '连接正常',
    model: 'test-model',
  });
});

test('POST /api/local/ai/profile rejects missing input', async () => {
  const dataServer = await startDataServer();

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const payload = await response.json();

  expect(response.status).toBe(400);
  expect(payload.error).toMatch(/Missing profileInput or messages/);
});

test('POST /api/local/ai/profile rejects missing LLM config', async () => {
  const dataServer = await startDataServer();

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profileInput: 'make a profile' }),
  });
  const payload = await response.json();

  expect(response.status).toBe(422);
  expect(payload.error).toMatch(/Missing LLM profile configuration/);
});

test('POST /api/local/ai/profile maps upstream 401 and redacts apiKey', async () => {
  const mockLlm = await startMockLlm(({ response }) => {
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'bad key secret-token' } }));
  });
  const dataServer = await startDataServer();
  await setLlmProfileConfig(dataServer, { baseUrl: mockLlm.baseUrl });

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'make a profile' }] }),
  });
  const payload = await response.json();

  expect(response.status).toBe(401);
  expect(payload.error).toContain('[redacted]');
  expect(payload.error).not.toContain('secret-token');
});

test('POST /api/local/ai/profile maps upstream 429 rate limits', async () => {
  const mockLlm = await startMockLlm(({ response }) => {
    response.writeHead(429, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'slow down' } }));
  });
  const dataServer = await startDataServer();
  await setLlmProfileConfig(dataServer, { baseUrl: mockLlm.baseUrl });

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'make a profile' }] }),
  });
  const payload = await response.json();

  expect(response.status).toBe(429);
  expect(payload.error).toContain('slow down');
});

test('POST /api/local/ai/profile maps upstream 5xx failures', async () => {
  const mockLlm = await startMockLlm(({ response }) => {
    response.writeHead(503, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: { message: 'provider down' } }));
  });
  const dataServer = await startDataServer();
  await setLlmProfileConfig(dataServer, { baseUrl: mockLlm.baseUrl });

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'make a profile' }] }),
  });
  const payload = await response.json();

  expect(response.status).toBe(502);
  expect(payload.error).toContain('provider down');
});

test('POST /api/local/ai/profile times out slow providers', async () => {
  const mockLlm = await startMockLlm(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
  });
  const dataServer = await startDataServer();
  await setLlmProfileConfig(dataServer, { baseUrl: mockLlm.baseUrl });

  const response = await fetch(`${dataServer}/api/local/ai/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'make a profile' }] }),
  });
  const payload = await response.json();

  expect(response.status).toBe(504);
  expect(payload.error).toMatch(/timed out/i);
}, 10_000);
