export function normalizeLocalPreviewUrl(
  raw: string,
  _base: string,
): string | null {
  if (!raw) return null;
  if (raw.startsWith('javascript:')) return null;

  let url: URL;
  try {
    const candidate = raw.includes('://') ? raw : `http://${raw}`;
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') return null;

  return url.href;
}

export function normalizeExternalBrowserUrl(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.href;
}
