import type { Task } from '../../../../contracts/TaskContract.js';
import type { TenantContext } from './TenantContextTypes.js';

export function matchesResolvedTaskTenant(
  task: Task | null | undefined,
  tenantContext: TenantContext | null | undefined,
  options: {
    extractTenantId: (metadata: Record<string, unknown> | null | undefined) => string | null;
    resolveFromTask: (task: Task) => TenantContext | null;
    asRecord: (value: unknown) => Record<string, unknown>;
  },
): boolean {
  if (!task || !tenantContext?.tenantId) {
    return false;
  }

  const metadata = options.asRecord(task.metadata);
  const explicitTenantId = options.extractTenantId(metadata);
  if (explicitTenantId) {
    return explicitTenantId === tenantContext.tenantId;
  }

  const resolved = options.resolveFromTask(task);
  if (!resolved?.tenantId) {
    return true;
  }
  if (resolved.tenantType === 'unknown') {
    return true;
  }
  if (
    tenantContext.boundary === 'shared' &&
    resolved.boundary !== 'shared' &&
    resolved.platform === tenantContext.platform
  ) {
    return true;
  }

  return resolved.tenantId === tenantContext.tenantId;
}
