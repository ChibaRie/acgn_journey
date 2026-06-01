const DEFAULT_LOCAL_API_PORT = 5198;
const REQUEST_TIMEOUT_MS = 2500;

function isLoopbackHost(hostname) {
  return ['127.0.0.1', 'localhost', '::1'].includes(hostname);
}

export function getLocalApiBase() {
  const configured = import.meta.env.VITE_LOCAL_API_BASE;
  if (configured) return configured.replace(/\/$/, '');
  if (typeof window === 'undefined') return '';
  if (!isLoopbackHost(window.location.hostname)) return '';
  return `http://${window.location.hostname}:${DEFAULT_LOCAL_API_PORT}`;
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
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(payload?.error || `Local API request failed: ${response.status}`);
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

export async function saveLocalRecords(records) {
  return requestJson('/api/local/records', {
    method: 'PUT',
    body: JSON.stringify({ records }),
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
