type RuntimeHttpOptions = {
  authHeaders: () => Record<string, string>;
};

export function messageFromErrorPayload(payload: any, fallback = 'Try again in a moment.') {
  const candidates = [
    payload?.error,
    payload?.message,
    payload?.reason,
    payload?.detail,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'object') {
      const nested = candidate.message || candidate.detail || candidate.reason || candidate.code;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
    }
  }
  return fallback;
}

export function messageFromCaughtError(error: any, fallback = 'Try again in a moment.') {
  const message = String(error?.message || '').trim();
  if (message && message !== '[object Object]') return message;
  return messageFromErrorPayload(error?.payload, fallback);
}

export function createRuntimeHttp({ authHeaders }: RuntimeHttpOptions) {
  async function readJson(path: string, options: any = {}) {
    const requestHeaders = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(options.headers || {}),
    };
    const response = await fetch(path, {
      ...options,
      headers: requestHeaders,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(messageFromErrorPayload(payload, `${path} returned HTTP ${response.status}`));
      (error as any).status = response.status;
      (error as any).payload = payload;
      (error as any).recovery = payload?.recovery || null;
      throw error;
    }
    return payload;
  }

  async function readBlob(path: string, options: any = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: '*/*',
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      const error = new Error(messageFromErrorPayload(payload, `${path} returned HTTP ${response.status}`));
      (error as any).status = response.status;
      (error as any).payload = payload;
      throw error;
    }
    return response.blob();
  }

  return {
    readBlob,
    readJson,
  };
}
