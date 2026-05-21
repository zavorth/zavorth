import type { LegacySurfaceRole } from '../contracts/LegacySurfaceContract.js';

export function resolveLegacySurfaceRole(pathname: string): LegacySurfaceRole {
  const normalized = normalizePath(pathname);
  if (normalized === '/app') {
    return 'legacy-operational';
  }
  if (normalized === '/classic') {
    return 'legacy-observability';
  }
  return 'canonical';
}

export function renderLegacySurfaceBanner(pathname: string): string | null {
  const role = resolveLegacySurfaceRole(pathname);
  if (role === 'canonical') {
    return null;
  }
  const label = role === 'legacy-operational' ? '/app' : '/classic';
  const reason = role === 'legacy-operational'
    ? 'old operational cockpit'
    : 'classic observability dashboard';
  return `The ${label} surface is frozen as ${reason}. Use /control as the main entry; /dashboard remains compatible, and new product work must land in the Runtime API, Gateway Contract and official dashboard.`;
}

function normalizePath(value: string): string {
  const normalized = String(value || '/').trim().replace(/\/+$/u, '') || '/';
  return normalized === '' ? '/' : normalized;
}
