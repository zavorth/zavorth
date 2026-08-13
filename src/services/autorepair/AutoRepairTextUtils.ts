import { logger } from '../../logger.js';
export const MAX_LOG_EXCERPT_CHARACTERS = 5_000;
export const MAX_OUTPUT_CHARACTERS = 4_000;

export function trimAutoRepairOutput(text: string, maxLength = MAX_OUTPUT_CHARACTERS): string {
  const normalized = String(text || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...[truncado]`;
}

export function normalizeAutoRepairError(error: unknown): string {
  const text = String(error || '').trim();
  if (!text) {
    return 'Unknown failure.';
  }

  return trimAutoRepairOutput(text, MAX_OUTPUT_CHARACTERS);
}

export function tryParseAutoRepairJson(rawText: string): any | null {
  const cleaned = String(rawText || '')
    .replace(/```(?:json|javascript|js|text)?/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!cleaned) {
    return null;
  }

  const candidates = [cleaned];
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    candidates.push(cleaned.slice(start, end + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error: unknown) {// Keep trying.
      logger.warn('[Auto Repair Text Utils] JSON parse failed', error);
    }
  }

  return null;
}

export function readAutoRepairString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function readAutoRepairConfidence(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(1, parsed));
}

export function readAutoRepairStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

export function readOptionalAutoRepairText(
  filePath: string,
  existsSync: (filePath: string) => boolean,
  readText: (filePath: string) => string,
): string {
  if (!existsSync(filePath)) {
    return '';
  }

  try {
    return trimAutoRepairOutput(readText(filePath), MAX_LOG_EXCERPT_CHARACTERS);
  } catch (error: unknown) {logger.warn('[Auto Repair Text Utils] filesystem operation failed', error); return ''; }
}
