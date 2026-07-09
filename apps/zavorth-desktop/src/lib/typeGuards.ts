/** Small parse helpers for UI select values and loosely-shaped API rows. */

export type DesktopThemeMode = 'light' | 'dark' | 'system';
export type DesktopEffort = 'low' | 'medium' | 'high' | 'ultra';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function parseThemeMode(value: string): DesktopThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export function parseEffort(value: string): DesktopEffort {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'ultra') return value;
  return 'medium';
}

export function parseAccent<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function isProviderConfigType(
  value: string,
  allowed: readonly string[],
): value is string {
  return allowed.includes(value);
}
