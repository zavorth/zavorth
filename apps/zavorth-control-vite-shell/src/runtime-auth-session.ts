type RuntimeState = {
  sessionId?: string | null;
  runId?: string | null;
};

type RuntimeAuthSessionOptions = {
  state: RuntimeState;
  authStorageKey: string;
  sessionStorageKey: string;
  runStorageKey: string;
};

export function createRuntimeAuthSession({
  state,
  authStorageKey,
  sessionStorageKey,
  runStorageKey,
}: RuntimeAuthSessionOptions) {
  function readUrlParam(name: string) {
    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
      return String(url.searchParams.get(name) || hashParams.get(name) || '').trim();
    } catch {
      return '';
    }
  }

  function readToken() {
    try {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
      const tokenFromHash = String(hashParams.get('token') || '').trim();
      const hadQueryToken = url.searchParams.has('token');
      if (tokenFromHash || hadQueryToken) {
        if (tokenFromHash) {
          sessionStorage.setItem(authStorageKey, tokenFromHash);
        }
        hashParams.delete('token');
        url.searchParams.delete('token');
        url.hash = hashParams.toString() ? `#${hashParams.toString()}` : '';
        history.replaceState(null, '', url);
        if (tokenFromHash) return tokenFromHash;
      }
      return String(sessionStorage.getItem(authStorageKey) || '').trim();
    } catch {
      return '';
    }
  }

  function authHeaders() {
    const token = readToken();
    return token ? { 'X-Zavorth-Token': token } : {};
  }

  function hasStoredToken() {
    return Boolean(readToken());
  }

  function clearStoredToken() {
    try {
      sessionStorage.removeItem(authStorageKey);
    } catch {
      // Token storage is best-effort in restricted browsers.
    }
  }

  function writeSessionId(sessionId: unknown) {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    state.sessionId = normalized;
    try {
      sessionStorage.setItem(sessionStorageKey, normalized);
    } catch {
      // Session continuity is best-effort in restricted browsers.
    }
  }

  function readSessionId() {
    try {
      const urlSessionId = readUrlParam('sessionId');
      if (urlSessionId) {
        writeSessionId(urlSessionId);
        return urlSessionId;
      }
      return String(sessionStorage.getItem(sessionStorageKey) || '').trim();
    } catch {
      return '';
    }
  }

  function writeRunId(runId: unknown) {
    const normalized = String(runId || '').trim();
    if (!normalized) return;
    state.runId = normalized;
    try {
      sessionStorage.setItem(runStorageKey, normalized);
    } catch {
      // Run continuity is best-effort in restricted browsers.
    }
  }

  function readRunId() {
    try {
      const urlRunId = readUrlParam('runId');
      if (urlRunId) {
        writeRunId(urlRunId);
        return urlRunId;
      }
      return String(sessionStorage.getItem(runStorageKey) || '').trim();
    } catch {
      return '';
    }
  }

  function buildZavorthControlQueryString(extra: Record<string, unknown> = {}) {
    const params = new URLSearchParams();
    const sessionId = String(extra.sessionId || readSessionId() || '').trim();
    const runId = String(extra.runId || readRunId() || '').trim();
    const traceId = String(extra.traceId || readUrlParam('traceId') || '').trim();
    const status = String(extra.status || readUrlParam('status') || '').trim();
    const limit = String(extra.limit || readUrlParam('limit') || '').trim();
    if (sessionId) params.set('sessionId', sessionId);
    if (runId) params.set('runId', runId);
    if (traceId) params.set('traceId', traceId);
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  function replaceZavorthControlUrlParams(values: Record<string, unknown> = {}) {
    try {
      const url = new URL(window.location.href);
      for (const [key, value] of Object.entries(values)) {
        const normalized = String(value || '').trim();
        if (normalized) url.searchParams.set(key, normalized);
      }
      history.replaceState(null, '', url);
    } catch {
      // URL continuity is best-effort.
    }
  }

  function realtimePath(sessionId: unknown) {
    return `/api/web/events?sessionId=${encodeURIComponent(String(sessionId || ''))}`;
  }

  return {
    authHeaders,
    buildZavorthControlQueryString,
    clearStoredToken,
    hasStoredToken,
    readRunId,
    readSessionId,
    readToken,
    readUrlParam,
    realtimePath,
    replaceZavorthControlUrlParams,
    writeRunId,
    writeSessionId,
  };
}
