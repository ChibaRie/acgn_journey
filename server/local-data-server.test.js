import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, test } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_SERVER_SCRIPT = path.join(ROOT, 'server', 'local-data-server.mjs');

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

async function startDataServer({ token = '', databasePath, initializeDatabase } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'acgn-data-test-'));
  const dbPath = databasePath || path.join(dataDir, 'test.sqlite');
  initializeDatabase?.(dbPath);
  const port = await getFreePort();
  const child = spawn(process.execPath, [DATA_SERVER_SCRIPT], {
    cwd: ROOT,
    env: {
      ...process.env,
      ACGN_DATA_DIR: dataDir,
      ACGN_DB_PATH: dbPath,
      ACGN_LOCAL_API_TOKEN: token,
      DATA_HOST: '127.0.0.1',
      DATA_PORT: String(port),
      LLM_PROFILE_TIMEOUT_MS: '1000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill();
      await exited;
    }
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

async function readRecords(baseUrl) {
  const response = await fetch(`${baseUrl}/api/local/records`);
  expect(response.status).toBe(200);
  return response.json();
}

function writeRecords(baseUrl, records, revision) {
  return fetch(`${baseUrl}/api/local/records`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, revision }),
  });
}

test('health advertises revision protocol and empty snapshots have stable revisions', async () => {
  const baseUrl = await startDataServer();
  const health = await (await fetch(`${baseUrl}/api/local/health`)).json();
  expect(health.recordsProtocolVersion).toBe(2);
  const first = await readRecords(baseUrl);
  expect(first.records).toEqual([]);
  expect(first.revision).toEqual(expect.any(String));
  expect(first.revision.length).toBeGreaterThan(0);
  expect((await readRecords(baseUrl)).revision).toBe(first.revision);
});

test('legacy writes require a revision and leave the database untouched', async () => {
  const baseUrl = await startDataServer();
  const before = await readRecords(baseUrl);
  for (const body of [{ records: [{ id: 'legacy' }] }, [{ id: 'legacy' }]]) {
    const response = await fetch(`${baseUrl}/api/local/records`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    expect(response.status).toBe(428);
    expect(await response.json()).toMatchObject({ code: 'REVISION_REQUIRED', error: expect.stringMatching(/export.*refresh.*import/i) });
  }
  expect(await readRecords(baseUrl)).toEqual(before);
});

test('successful writes preserve fields and reject stale replacement and empty migration', async () => {
  const baseUrl = await startDataServer();
  const empty = await readRecords(baseUrl);
  const record = { id: 'one', title: 'First', source: 'manual', tags: ['tag'], status: 'done', score: 8, completedAt: '2025-01-01', physical: { format: 'book' } };
  const response = await writeRecords(baseUrl, [record], empty.revision);
  expect(response.status).toBe(200);
  const saved = await response.json();
  expect(saved.records[0]).toMatchObject(record);
  expect(saved.revision).toEqual(expect.any(String));
  expect(saved.revision).not.toBe(empty.revision);
  for (const records of [[], [{ id: 'stale-migration' }]]) {
    const stale = await writeRecords(baseUrl, records, empty.revision);
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: 'REVISION_CONFLICT', currentRevision: saved.revision, error: expect.any(String) });
  }
  expect((await readRecords(baseUrl)).records).toEqual(saved.records);
  const cleared = await writeRecords(baseUrl, [], saved.revision);
  expect(cleared.status).toBe(200);
  expect((await cleared.json()).records).toEqual([]);
});

test('two connections writing the same revision only commit one snapshot', async () => {
  let sharedPath;
  const first = await startDataServer({ initializeDatabase(dbPath) { sharedPath = dbPath; } });
  const second = await startDataServer({ databasePath: sharedPath });
  const baseline = await readRecords(first);
  const responses = await Promise.all([
    writeRecords(first, [{ id: 'first' }], baseline.revision),
    writeRecords(second, [{ id: 'second' }], baseline.revision),
  ]);
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  const committed = await responses.find((response) => response.status === 200).json();
  const conflict = await responses.find((response) => response.status === 409).json();
  expect(conflict.currentRevision).toBe(committed.revision);
  expect((await readRecords(second)).records).toEqual(committed.records);
});

test('invalid record replacement rolls back the entire transaction and revision', async () => {
  const baseUrl = await startDataServer();
  const initial = await readRecords(baseUrl);
  const response = await writeRecords(baseUrl, [{ id: 'kept', title: 'Keep me' }], initial.revision);
  const saved = await response.json();
  const duplicate = await writeRecords(baseUrl, [{ id: 'duplicate' }, { id: 'duplicate' }], saved.revision);
  expect(duplicate.ok).toBe(false);
  const invalidArray = await writeRecords(baseUrl, {}, saved.revision);
  expect(invalidArray.status).toBe(400);
  const after = await readRecords(baseUrl);
  expect(after.records).toEqual(saved.records);
  expect(after.revision).toBe(saved.revision);
});

test('existing database payloads keep their fields, order and revision after restart', async () => {
  let sharedPath;
  const oldRecords = [{ id: 'old-b', title: 'Old B', custom: { kept: true } }, { id: 'old-a', tags: ['old'], score: 7 }];
  const first = await startDataServer({ initializeDatabase(dbPath) {
    sharedPath = dbPath;
    const oldDb = new DatabaseSync(dbPath);
    oldDb.exec('CREATE TABLE records (id TEXT PRIMARY KEY, work_key TEXT, payload TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0, added_at TEXT, updated_at TEXT)');
    const insert = oldDb.prepare('INSERT INTO records (id, payload, position) VALUES (?, ?, ?)');
    oldRecords.forEach((record, index) => insert.run(record.id, JSON.stringify(record), index));
    oldDb.close();
  } });
  const loaded = await readRecords(first);
  expect(loaded.records).toEqual(oldRecords);
  expect(loaded.revision).toEqual(expect.any(String));
  const second = await startDataServer({ databasePath: sharedPath });
  expect((await readRecords(second)).revision).toBe(loaded.revision);
});

test.each([
  ['empty object', {}],
  ['empty choices', { choices: [] }],
  ['object content', { choices: [{ message: { content: {} } }] }],
  ['array content', { choices: [{ message: { content: ['text'] } }] }],
  ['empty text', { choices: [{ message: { content: '  ' } }] }],
])('AI test and generation reject successful HTTP with %s', async (_label, upstreamPayload) => {
  const llm = await startMockLlm(({ response }) => {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(upstreamPayload));
  });
  const baseUrl = await startDataServer();
  await setLlmProfileConfig(baseUrl, { baseUrl: llm.baseUrl });
  for (const endpoint of ['test', 'profile']) {
    const response = await fetch(`${baseUrl}/api/local/ai/${endpoint}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileInput: 'profile' }),
    });
    expect(response.status).toBe(502);
    expect((await response.json()).error).toMatch(/message content/i);
  }
});

test('local API token protects records when configured', async () => {
  const dataServer = await startDataServer({ token: 'local-test-token' });

  const rejected = await fetch(`${dataServer}/api/local/records`);
  const rejectedPayload = await rejected.json();
  expect(rejected.status).toBe(401);
  expect(rejectedPayload.error).toMatch(/token/);

  const accepted = await fetch(`${dataServer}/api/local/records`, {
    headers: { 'X-Acgn-Local-Token': 'local-test-token' },
  });
  const acceptedPayload = await accepted.json();
  expect(accepted.status).toBe(200);
  expect(acceptedPayload.records).toEqual([]);
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
