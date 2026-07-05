export function safeParseInt(val: unknown, fallback: number): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : Math.floor(val);
  }
  if (val === undefined || val === null) {
    return fallback;
  }
  const parsed = parseInt(String(val), 10);
  return isNaN(parsed) ? fallback : parsed;
}

export function safeParseIntBounded(val: unknown, fallback: number, min: number, max: number): number {
  const parsed = safeParseInt(val, fallback);
  return Math.min(Math.max(parsed, min), max);
}
