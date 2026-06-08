#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APP_NAME = 'acgn_journey';
const HOST = process.env.DATA_HOST || '127.0.0.1';
const PORT = Number(process.env.DATA_PORT || 5198);
const MAX_BODY_BYTES = Number(process.env.DATA_MAX_BODY_BYTES || 25 * 1024 * 1024);
const LLM_PROFILE_SETTING_KEY = 'llm-profile';
const LLM_REQUEST_TIMEOUT_MS = Number(process.env.LLM_PROFILE_TIMEOUT_MS || 30_000);
const DEFAULT_LLM_TEMPERATURE = 0.8;

const ALLOWED_ORIGINS = new Set([
  'https://chibarie.github.io',
  'http://127.0.0.1:5188',
  'http://localhost:5188',
]);

function getDefaultDataDir() {
  if (process.env.ACGN_DATA_DIR) return path.resolve(process.env.ACGN_DATA_DIR);
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), APP_NAME);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }
  return path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), APP_NAME);
}

const DATA_DIR = getDefaultDataDir();
const DB_PATH = process.env.ACGN_DB_PATH || path.join(DATA_DIR, `${APP_NAME}.sqlite`);

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    work_key TEXT,
    payload TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    added_at TEXT,
    updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_records_work_key ON records(work_key);
  CREATE INDEX IF NOT EXISTS idx_records_position ON records(position);
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const countRecordsStmt = db.prepare('SELECT COUNT(*) AS count FROM records');
const listRecordsStmt = db.prepare('SELECT payload FROM records ORDER BY position ASC, added_at DESC, rowid DESC');
const insertRecordStmt = db.prepare(`
  INSERT INTO records (id, work_key, payload, position, added_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const getSettingStmt = db.prepare('SELECT value, updated_at FROM settings WHERE key = ?');
const setSettingStmt = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);
const deleteSettingStmt = db.prepare('DELETE FROM settings WHERE key = ?');

function log(message) {
  process.stdout.write(`[acgn-data] ${message}${os.EOL}`);
}

function isLoopbackOrigin(origin) {
  try {
    const parsed = new URL(origin);
    return ['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function getCorsOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return '';
  if (ALLOWED_ORIGINS.has(origin) || isLoopbackOrigin(origin)) return origin;
  return '';
}

function applyCors(request, response) {
  const origin = getCorsOrigin(request);
  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Accept');
  response.setHeader('Access-Control-Max-Age', '86400');
}

function sendJson(request, response, statusCode, payload) {
  applyCors(request, response);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(request, response, statusCode = 204) {
  applyCors(request, response);
  response.writeHead(statusCode, { 'Cache-Control': 'no-store' });
  response.end();
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw createHttpError(413, 'Request body is too large.');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw createHttpError(400, 'Request body must be valid JSON.');
  }
}

function stableIdForRecord(record) {
  const source = String(record?.source || 'manual');
  const sourceId = String(record?.sourceId || '');
  const title = String(record?.title || '');
  const hash = createHash('sha1').update(`${source}:${sourceId}:${title}`).digest('hex').slice(0, 16);
  return `record-${hash}`;
}

function normalizeRecordForStorage(record) {
  const input = record && typeof record === 'object' ? record : {};
  const now = new Date().toISOString();
  const id = String(input.id || stableIdForRecord(input) || randomUUID());
  const workKey = String(
    input.workKey || `${input.source || 'manual'}:${input.sourceId || input.title || id}`,
  ).toLowerCase();
  const addedAt = String(input.addedAt || now);
  const updatedAt = String(input.updatedAt || now);
  return {
    ...input,
    id,
    workKey,
    addedAt,
    updatedAt,
  };
}

function listRecords() {
  return listRecordsStmt.all().map((row) => JSON.parse(row.payload));
}

function replaceRecords(records) {
  if (!Array.isArray(records)) {
    throw createHttpError(400, 'Expected records to be an array.');
  }

  const normalized = records.map(normalizeRecordForStorage);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM records');
    normalized.forEach((record, index) => {
      insertRecordStmt.run(
        record.id,
        record.workKey,
        JSON.stringify(record),
        index,
        record.addedAt,
        record.updatedAt,
      );
    });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return normalized;
}

function getRecordCount() {
  return Number(countRecordsStmt.get().count || 0);
}

function storageInfo() {
  return {
    type: 'sqlite',
    path: DB_PATH,
    directory: DATA_DIR,
  };
}

function getSetting(key) {
  const row = getSettingStmt.get(key);
  if (!row) return null;
  return {
    key,
    value: JSON.parse(row.value),
    updatedAt: row.updated_at,
  };
}

function stringifyProfileInput(input) {
  if (typeof input === 'string') return input.trim();
  if (input == null) return '';
  try {
    return JSON.stringify(input);
  } catch {
    return String(input);
  }
}

function getProfileMessages(payload) {
  if (Array.isArray(payload?.messages) && payload.messages.length > 0) {
    return payload.messages;
  }

  const profileText = stringifyProfileInput(payload?.profileInput);
  if (!profileText) {
    throw createHttpError(400, 'Missing profileInput or messages.');
  }

  return [{ role: 'user', content: profileText }];
}

function normalizeLlmProfileConfig(config, { requireModel = true } = {}) {
  if (!config || typeof config !== 'object') {
    throw createHttpError(422, 'Missing LLM profile configuration.');
  }

  const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '';
  const model = typeof config.model === 'string' ? config.model.trim() : '';
  const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
  const temperature =
    config.temperature == null || config.temperature === ''
      ? DEFAULT_LLM_TEMPERATURE
      : Number(config.temperature);

  if (!baseUrl || !apiKey || (requireModel && !model)) {
    throw createHttpError(
      422,
      requireModel
        ? 'LLM profile configuration must include baseUrl, model, and apiKey.'
        : 'LLM profile configuration must include baseUrl and apiKey.',
    );
  }
  if (!Number.isFinite(temperature)) {
    throw createHttpError(422, 'LLM profile configuration temperature must be a number.');
  }

  return { baseUrl, model, apiKey, temperature };
}

function getLlmProfileConfig(options) {
  let setting;
  try {
    setting = getSetting(LLM_PROFILE_SETTING_KEY);
  } catch {
    throw createHttpError(422, 'LLM profile configuration must be valid JSON.');
  }
  return normalizeLlmProfileConfig(setting?.value, options);
}

function getLlmConfigFromPayload(payload, options) {
  if (payload?.config && typeof payload.config === 'object') {
    return normalizeLlmProfileConfig(payload.config, options);
  }
  return getLlmProfileConfig(options);
}

function scrubApiKey(text, apiKey) {
  if (!text || !apiKey) return text;
  return String(text).replaceAll(apiKey, '[redacted]');
}

async function readLlmError(response, apiKey) {
  const text = scrubApiKey((await response.text()).slice(0, 1000), apiKey);
  if (!text) return '';
  try {
    const payload = JSON.parse(text);
    return scrubApiKey(payload?.error?.message || payload?.message || text, apiKey);
  } catch {
    return text;
  }
}

async function requestAiProfile(messages) {
  const config = getLlmProfileConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages,
    ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
  };

  try {
    const llmResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!llmResponse.ok) {
      const detail = await readLlmError(llmResponse, config.apiKey);
      if (llmResponse.status === 401) {
        throw createHttpError(401, detail || 'LLM authentication failed.');
      }
      if (llmResponse.status === 429) {
        throw createHttpError(429, detail || 'LLM rate limit exceeded.');
      }
      if (llmResponse.status >= 500) {
        throw createHttpError(502, detail || 'LLM provider is unavailable.');
      }
      throw createHttpError(422, detail || 'LLM provider rejected the request.');
    }

    const payload = await llmResponse.json();
    const rawText = payload?.choices?.[0]?.message?.content;
    if (typeof rawText !== 'string') {
      throw createHttpError(502, 'LLM response did not include message content.');
    }

    return {
      rawText,
      model: payload?.model || config.model,
      usage: payload?.usage || null,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createHttpError(504, 'LLM request timed out.');
    }
    if (error.status) throw error;
    throw createHttpError(502, 'LLM request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeModelList(payload) {
  const models = Array.isArray(payload?.data) ? payload.data : [];
  return models
    .map((item) => {
      if (typeof item === 'string') return { id: item, ownedBy: '' };
      return {
        id: String(item?.id || '').trim(),
        ownedBy: String(item?.owned_by || item?.ownedBy || '').trim(),
      };
    })
    .filter((item) => item.id)
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

async function requestAiModels(payload = {}) {
  const config = getLlmConfigFromPayload(payload, { requireModel: false });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  const url = `${config.baseUrl.replace(/\/$/, '')}/models`;

  try {
    const llmResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
    });

    if (!llmResponse.ok) {
      const detail = await readLlmError(llmResponse, config.apiKey);
      if (llmResponse.status === 401) {
        throw createHttpError(401, detail || 'LLM authentication failed.');
      }
      if (llmResponse.status === 429) {
        throw createHttpError(429, detail || 'LLM rate limit exceeded.');
      }
      if (llmResponse.status >= 500) {
        throw createHttpError(502, detail || 'LLM provider is unavailable.');
      }
      throw createHttpError(422, detail || 'LLM provider rejected the request.');
    }

    return {
      models: normalizeModelList(await llmResponse.json()),
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createHttpError(504, 'LLM model list request timed out.');
    }
    if (error.status) throw error;
    throw createHttpError(502, 'LLM model list request failed.');
  } finally {
    clearTimeout(timeout);
  }
}

async function testAiProfileConnection(payload = {}) {
  const config = getLlmConfigFromPayload(payload, { requireModel: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_REQUEST_TIMEOUT_MS);
  const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      {
        role: 'user',
        content: '请用一句中文回复“连接正常”，用于测试模型连通性。',
      },
    ],
    temperature: config.temperature,
  };

  try {
    const llmResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!llmResponse.ok) {
      const detail = await readLlmError(llmResponse, config.apiKey);
      if (llmResponse.status === 401) {
        throw createHttpError(401, detail || 'LLM authentication failed.');
      }
      if (llmResponse.status === 429) {
        throw createHttpError(429, detail || 'LLM rate limit exceeded.');
      }
      if (llmResponse.status >= 500) {
        throw createHttpError(502, detail || 'LLM provider is unavailable.');
      }
      throw createHttpError(422, detail || 'LLM provider rejected the request.');
    }

    const responsePayload = await llmResponse.json();
    return {
      ok: true,
      rawText: responsePayload?.choices?.[0]?.message?.content || '',
      model: responsePayload?.model || config.model,
      usage: responsePayload?.usage || null,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createHttpError(504, 'LLM connection test timed out.');
    }
    if (error.status) throw error;
    throw createHttpError(502, 'LLM connection test failed.');
  } finally {
    clearTimeout(timeout);
  }
}

function setSetting(key, value) {
  const updatedAt = new Date().toISOString();
  setSettingStmt.run(key, JSON.stringify(value), updatedAt);
  return { key, value, updatedAt };
}

function getSettingKey(pathname) {
  const prefix = '/api/local/settings/';
  if (!pathname.startsWith(prefix)) return '';
  return decodeURIComponent(pathname.slice(prefix.length)).trim();
}

async function handleRequest(request, response) {
  applyCors(request, response);
  if (request.method === 'OPTIONS') {
    sendEmpty(request, response);
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const { pathname } = url;

  if (request.headers.origin && !getCorsOrigin(request)) {
    throw createHttpError(403, 'Origin is not allowed.');
  }

  if (request.method === 'GET' && pathname === '/api/local/health') {
    sendJson(request, response, 200, {
      ok: true,
      app: APP_NAME,
      recordCount: getRecordCount(),
      storage: storageInfo(),
    });
    return;
  }

  if (pathname === '/api/local/records') {
    if (request.method === 'GET') {
      sendJson(request, response, 200, {
        records: listRecords(),
        recordCount: getRecordCount(),
        storage: storageInfo(),
      });
      return;
    }

    if (request.method === 'PUT') {
      const payload = await readJsonBody(request);
      const records = Array.isArray(payload) ? payload : payload?.records;
      const savedRecords = replaceRecords(records);
      sendJson(request, response, 200, {
        records: savedRecords,
        recordCount: savedRecords.length,
        storage: storageInfo(),
        savedAt: new Date().toISOString(),
      });
      return;
    }
  }

  if (request.method === 'POST' && pathname === '/api/local/ai/profile') {
    const payload = await readJsonBody(request);
    const messages = getProfileMessages(payload);
    sendJson(request, response, 200, await requestAiProfile(messages));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/local/ai/models') {
    sendJson(request, response, 200, await requestAiModels(await readJsonBody(request)));
    return;
  }

  if (request.method === 'POST' && pathname === '/api/local/ai/test') {
    sendJson(request, response, 200, await testAiProfileConnection(await readJsonBody(request)));
    return;
  }

  const settingKey = getSettingKey(pathname);
  if (settingKey) {
    if (request.method === 'GET') {
      const setting = getSetting(settingKey);
      if (!setting) {
        sendJson(request, response, 200, { key: settingKey, value: null, updatedAt: null });
        return;
      }
      sendJson(request, response, 200, setting);
      return;
    }

    if (request.method === 'PUT') {
      const payload = await readJsonBody(request);
      sendJson(request, response, 200, setSetting(settingKey, payload?.value ?? payload));
      return;
    }

    if (request.method === 'DELETE') {
      deleteSettingStmt.run(settingKey);
      sendEmpty(request, response);
      return;
    }
  }

  sendJson(request, response, 404, { error: 'Not found.' });
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    const status = Number(error.status || 500);
    sendJson(request, response, status, {
      error: error.message || 'Internal server error.',
    });
  });
});

server.listen(PORT, HOST, () => {
  log(`Listening at http://${HOST}:${PORT}`);
  log(`SQLite database: ${DB_PATH}`);
});

function close() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGTERM', close);
process.on('SIGINT', close);
