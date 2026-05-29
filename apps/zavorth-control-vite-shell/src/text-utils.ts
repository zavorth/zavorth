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

export function formatBytes(size: unknown) {
  const value = Number(size || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function compactText(value: unknown, max = 180) {
  const cleaned = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, Math.max(0, max - 1)).trim()}…`;
}

export function dashboardStatusText(value: unknown, fallback = 'ready') {
  const cleaned = compactText(value || '', 26);
  return cleaned || fallback;
}

