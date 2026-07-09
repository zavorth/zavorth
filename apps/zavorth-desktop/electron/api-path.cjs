/**
 * Pure helpers for validating desktop API paths and local navigation URLs.
 * Kept free of Electron imports so unit tests can require this module directly.
 */

function sanitizeApiPath(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('/api/')) {
    throw new Error('Only local Zavorth API paths are allowed.');
  }
  if (/^[a-z][a-z\d+.-]*:/iu.test(text) || text.includes('\\') || text.includes('..')) {
    throw new Error('Unsafe local API path.');
  }
  return text;
}

function isAllowedNavigationUrl(value) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol === 'file:') {
      return true;
    }
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function validateRendererUrl(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const parsed = new URL(text);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && localHosts.has(parsed.hostname)) {
    return parsed.toString();
  }
  throw new Error('ZAVORTH_DESKTOP_RENDERER_URL must point to localhost.');
}

module.exports = {
  sanitizeApiPath,
  isAllowedNavigationUrl,
  validateRendererUrl,
};
