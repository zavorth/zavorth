import type { LegacySurfaceRole } from '../contracts/LegacySurfaceContract.js';

export function resolveLegacySurfaceRole(pathname: string): LegacySurfaceRole {
  const normalized = normalizePath(pathname);
  if (normalized === '/app' || normalized === '/classic') {
    return 'retired';
  }
  return 'canonical';
}

export function renderLegacySurfaceBanner(pathname: string): string | null {
  const role = resolveLegacySurfaceRole(pathname);
  if (role === 'canonical') {
    return null;
  }
  const label = normalizePath(pathname) === '/app' ? '/app' : '/classic';
  return `The ${label} surface has been removed. Use /zavorthControl as the only web entry; product work must land in the Runtime API, Gateway Contract and official zavorthControl.`;
}

function normalizePath(value: string): string {
  const normalized = String(value || '/').trim().replace(/\/+$/u, '') || '/';
  return normalized === '' ? '/' : normalized;
}
