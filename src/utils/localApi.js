const DEFAULT_LOCAL_API_PORT = 5198;
const REQUEST_TIMEOUT_MS = 2500;
const LOCAL_API_TOKEN_HEADER = 'X-Acgn-Local-Token';

function getRuntimeLocalApiConfig() {
  if (typeof window === 'undefined') return {};
  return window.__ACGN_LOCAL_API__ && typeof window.__ACGN_LOCAL_API__ === 'object'
    ? window.__ACGN_LOCAL_API__
    : {};
}

function isLoopbackHost(hostname) {
  return ['127.0.0.1', 'localhost', '::1'].includes(hostname);
}

export function getLocalApiBase() {
  const runtimeBase = getRuntimeLocalApiConfig().baseUrl;
  if (runtimeBase) return String(runtimeBase).replace(/\/$/, '');
  const configured = import.meta.env.VITE_LOCAL_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window === 'undefined') return '';
  if (!isLoopbackHost(window.location.hostname)) return '';
  return `http://${window.location.hostname}:${DEFAULT_LOCAL_API_PORT}`;
}

function getLocalApiToken() {
  const runtimeToken = getRuntimeLocalApiConfig().token;
  if (runtimeToken) return String(runtimeToken);
  return String(import.meta.env.VITE_LOCAL_API_TOKEN || '');
}

function getAuthHeaders() {
  const token = getLocalApiToken().trim();
  return token ? { [LOCAL_API_TOKEN_HEADER]: token } : {};
}

async function requestJson(path, options = {}) {
  const base = getLocalApiBase();
  if (!base) throw new Error('Local API is not configured.');

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs || REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...getAuthHeaders(),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const error = new Error(payload?.error || `Local API request failed: ${response.status}`);
      error.status = response.status;
      error.code = payload?.code;
      error.currentRevision = payload?.currentRevision;
      throw error;
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getLocalHealth() {
  return requestJson('/api/local/health');
}

export async function loadLocalRecords() {
  return requestJson('/api/local/records');
}

export async function saveLocalRecords(records, revision) {
  return requestJson('/api/local/records', {
    method: 'PUT',
    body: JSON.stringify({ records, revision }),
    timeoutMs: 8000,
  });
}

export async function loadLocalSetting(key) {
  return requestJson(`/api/local/settings/${encodeURIComponent(key)}`);
}

export async function saveLocalSetting(key, value) {
  return requestJson(`/api/local/settings/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
    timeoutMs: 8000,
  });
}

export async function deleteLocalSetting(key) {
  return requestJson(`/api/local/settings/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    timeoutMs: 8000,
  });
}

export async function requestAiProfile(profileInputOrMessages) {
  return requestJson('/api/local/ai/profile', {
    method: 'POST',
    body: JSON.stringify(
      Array.isArray(profileInputOrMessages)
        ? { messages: profileInputOrMessages }
        : { profileInput: profileInputOrMessages },
    ),
    timeoutMs: 45000,
  });
}

export async function requestAiModels(config) {
  return requestJson('/api/local/ai/models', {
    method: 'POST',
    body: JSON.stringify({ config }),
    timeoutMs: 45000,
  });
}

export async function testAiProfileConnection(config) {
  return requestJson('/api/local/ai/test', {
    method: 'POST',
    body: JSON.stringify({ config }),
    timeoutMs: 45000,
  });
}
