import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';

export function parseEnvInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  return safeParseInt(value, defaultValue);
}

export function parseEnvFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}
