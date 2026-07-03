/**
 * Safe parseInt with NaN fallback.
 * Parse a string to integer, returning a default value if the result is NaN.
 *
 * @param value - The string to parse
 * @param defaultValue - The fallback value if parsing fails
 * @returns The parsed integer or the default value
 */
export function safeParseInt(value: string | null | undefined, defaultValue: number): number {
  if (value === null || value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe parseInt with min/max bounds.
 * Parse a string to integer, clamping to [min, max] range.
 *
 * @param value - The string to parse
 * @param defaultValue - The fallback value if parsing fails
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns The parsed and clamped integer
 */
export function safeParseIntBounded(
  value: string | null | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const parsed = safeParseInt(value, defaultValue);
  return Math.max(min, Math.min(max, parsed));
}
