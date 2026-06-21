const MAX_MODEL_ID_LENGTH = 256;
const MAX_PROVIDER_ID_LENGTH = 128;
const MAX_LABEL_LENGTH = 256;

const BLOCKED_PATTERNS = [
  /[<>'"\\]/g,
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi,
  /\$\{/g,
  /\{\{/g,
  /__proto__/gi,
  /constructor/gi,
  /prototype/gi,
];

const MODEL_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9\-_./:]*$/;
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9\-]*$/;

function containsBlockedPattern(value: string): boolean {
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(value));
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
}

export function sanitizeModelId(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let sanitized = stripControlCharacters(raw.trim());

  sanitized = sanitized.replace(/\s+/g, '-');

  sanitized = sanitized.replace(/[^a-zA-Z0-9\-_./:]/g, '');

  if (sanitized.length > MAX_MODEL_ID_LENGTH) {
    sanitized = sanitized.slice(0, MAX_MODEL_ID_LENGTH);
  }

  if (containsBlockedPattern(sanitized)) {
    sanitized = sanitized.replace(/[<>'"\\${}]/g, '');
  }

  return sanitized;
}

export function sanitizeProviderId(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let sanitized = stripControlCharacters(raw.trim().toLowerCase());

  sanitized = sanitized.replace(/[^a-z0-9\-]/g, '-');

  sanitized = sanitized.replace(/^-+|-+$/g, '');

  sanitized = sanitized.replace(/-{2,}/g, '-');

  if (sanitized.length > MAX_PROVIDER_ID_LENGTH) {
    sanitized = sanitized.slice(0, MAX_PROVIDER_ID_LENGTH);
  }

  return sanitized;
}

export function sanitizeLabel(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let sanitized = stripControlCharacters(raw.trim());

  sanitized = sanitized.replace(/[<>'"\\]/g, '');

  if (sanitized.length > MAX_LABEL_LENGTH) {
    sanitized = sanitized.slice(0, MAX_LABEL_LENGTH);
  }

  return sanitized;
}

export function sanitizeBaseUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    return '';
  }

  let sanitized = raw.trim();

  try {
    const url = new URL(sanitized);

    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }

    url.hostname = url.hostname.toLowerCase();

    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1') {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

export function validateModelId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Model ID is required' };
  }

  if (id.length > MAX_MODEL_ID_LENGTH) {
    return { valid: false, error: `Model ID exceeds maximum length of ${MAX_MODEL_ID_LENGTH}` };
  }

  if (containsBlockedPattern(id)) {
    return { valid: false, error: 'Model ID contains blocked patterns' };
  }

  if (!MODEL_ID_PATTERN.test(id)) {
    return { valid: false, error: 'Model ID contains invalid characters' };
  }

  return { valid: true };
}

export function validateProviderId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Provider ID is required' };
  }

  if (id.length > MAX_PROVIDER_ID_LENGTH) {
    return { valid: false, error: `Provider ID exceeds maximum length of ${MAX_PROVIDER_ID_LENGTH}` };
  }

  if (!PROVIDER_ID_PATTERN.test(id)) {
    return { valid: false, error: 'Provider ID must be lowercase alphanumeric with hyphens' };
  }

  return { valid: true };
}
