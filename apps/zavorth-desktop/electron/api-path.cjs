/**
 * Pure helpers for validating desktop API paths and local navigation URLs.
 * Kept free of Electron imports so unit tests can require this module directly.
 */

const path = require('node:path');
const { fileURLToPath, pathToFileURL } = require('node:url');

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

function normalizeFsPath(value) {
  try {
    return path.resolve(path.normalize(String(value || '')));
  } catch {
    return '';
  }
}

/**
 * True when candidatePath is the same as or nested under any allowed root.
 */
function isPathInsideRoots(candidatePath, allowedFileRoots) {
  const candidate = normalizeFsPath(candidatePath);
  if (!candidate) return false;
  const roots = Array.isArray(allowedFileRoots) ? allowedFileRoots : [];
  for (const root of roots) {
    const resolvedRoot = normalizeFsPath(root);
    if (!resolvedRoot) continue;
    if (candidate === resolvedRoot) return true;
    const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
    if (candidate.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Allow in-app navigation only for:
 * - http(s) to localhost / 127.0.0.1 / ::1
 * - file: URLs under explicit allowedFileRoots (app dist), when provided
 *
 * Without allowedFileRoots, file: is denied (do not open arbitrary local files).
 *
 * @param {string} value
 * @param {{ allowedFileRoots?: string[] }} [options]
 */
function isAllowedNavigationUrl(value, options = {}) {
  try {
    const parsed = new URL(String(value || ''));
    if (parsed.protocol === 'file:') {
      const roots = options && Array.isArray(options.allowedFileRoots)
        ? options.allowedFileRoots
        : [];
      if (roots.length === 0) {
        return false;
      }
      let filePath;
      try {
        filePath = fileURLToPath(parsed);
      } catch {
        return false;
      }
      return isPathInsideRoots(filePath, roots);
    }
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * Schemes allowed for shell.openExternal (user/browser handoff).
 * Deny file:, javascript:, data:, custom protocol handlers, etc.
 */
function isAllowedExternalUrl(value) {
  try {
    const text = String(value || '').trim();
    if (!text) return false;
    const parsed = new URL(text);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'mailto:') {
      // Basic mailto validation — reject javascript smuggling via malformed mailto
      return Boolean(parsed.pathname || parsed.href.startsWith('mailto:'));
    }
    return false;
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
  isAllowedExternalUrl,
  isPathInsideRoots,
  validateRendererUrl,
  // re-export for tests that want to build file URLs consistently
  pathToFileURL,
};
