export const RESERVED_SKILL_PATH_SEGMENTS = new Set(['recipes', 'mcp', 'library', 'install-plan']);

export function readTrimmedSearchParam(url: URL, names: string | string[]): string | null {
  const keys = Array.isArray(names) ? names : [names];
  for (const key of keys) {
    const value = String(url.searchParams.get(key) || '').trim();
    if (value) {
      return value;
    }
  }
  return null;
}

export function readLowerTrimmedSearchParam(url: URL, names: string | string[]): string | null {
  const value = readTrimmedSearchParam(url, names);
  return value ? value.toLowerCase() : null;
}

export function readBooleanSearchParam(url: URL, name: string): boolean {
  return readLowerTrimmedSearchParam(url, name) === 'true';
}

export function readNumberSearchParam(url: URL, name: string, fallback: number): number {
  const raw = String(url.searchParams.get(name) || '').trim();
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readDecodedPathSuffix(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  const value = decodeURIComponent(pathname.replace(prefix, '').trim());
  return value || null;
}

export function isReservedSkillRouteSegment(segment: string): boolean {
  return RESERVED_SKILL_PATH_SEGMENTS.has(String(segment || '').trim().toLowerCase());
}
