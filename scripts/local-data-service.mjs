function serviceError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

async function readJsonResponse(response) {
  if (!response.ok) {
    await response.arrayBuffer();
    throw serviceError('LOCAL_API_INVALID_RESPONSE', `Local data service returned HTTP ${response.status}.`);
  }
  try {
    return await response.json();
  } catch {
    throw serviceError('LOCAL_API_INVALID_RESPONSE', 'Local data service returned invalid JSON.');
  }
}

export async function isLocalDataServiceReady(baseUrl, token, { timeoutMs = 1500 } = {}) {
  let healthResponse;
  try {
    // Close probe connections so failed launchers can exit cleanly on Windows.
    healthResponse = await fetch(`${baseUrl}/api/local/health`, { headers: { Connection: 'close' }, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return false;
  }
  const health = await readJsonResponse(healthResponse);
  if (health?.ok !== true || health?.app !== 'acgn_journey') {
    throw serviceError('LOCAL_API_INVALID_RESPONSE', 'The data port is occupied by an incompatible local service.');
  }
  if (health.recordsProtocolVersion !== 2) {
    throw serviceError('LOCAL_API_PROTOCOL_MISMATCH', 'Local data service records protocol is incompatible. Stop the old service and restart V0.9.');
  }

  let recordsResponse;
  try {
    recordsResponse = await fetch(`${baseUrl}/api/local/records`, {
      headers: { Connection: 'close', 'X-Acgn-Local-Token': String(token || '').trim() },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw serviceError('LOCAL_API_INVALID_RESPONSE', 'Local data service could not complete the protected records read.');
  }
  if (recordsResponse.status === 401 || recordsResponse.status === 403) {
    await recordsResponse.arrayBuffer();
    throw serviceError('LOCAL_API_AUTH_FAILED', 'Local data service rejected the current API token. Stop that service and restart with the matching token.');
  }
  const snapshot = await readJsonResponse(recordsResponse);
  if (!Array.isArray(snapshot?.records) || typeof snapshot?.revision !== 'string' || !snapshot.revision.trim()) {
    throw serviceError('LOCAL_API_INVALID_RESPONSE', 'Local data service records response does not include records and a revision.');
  }
  return true;
}
