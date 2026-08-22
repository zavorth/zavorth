import type { GatewayDomainListDTO, GatewayStatusDTO } from '../../../contracts/public/rest/dto.js';
import type { OpsHealthDTO } from '../../../contracts/public/rest/platform-ops-dto.js';
import type { CanonicalPublicApiRuntime } from './types.js';
import type { CanonicalPublicApiSharedSupport } from './shared.js';

export function readGatewayStatus(input: {
  runtime: CanonicalPublicApiRuntime;
  support: CanonicalPublicApiSharedSupport;
  version: string;
}): GatewayStatusDTO {
  const runtime = input.runtime.getRuntime();
  const operationsHealth = input.runtime.getOperationsHealth()?.readSnapshotFast() || null;
  const maintenanceRunning = input.support.isMaintenanceRunning(operationsHealth);
  const status: GatewayStatusDTO['status'] =
    maintenanceRunning ? 'maintenance'
      : runtime ? 'ready'
        : (input.support.hasBlockingOperationalError(operationsHealth?.errors?.lastError) ? 'error' : 'starting');

  return {
    version: input.version,
    status,
    uptime: process.uptime(),
    environment: input.support.resolveEnvironment(),
  };
}

export async function readGatewayDomains(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  input: {
    userId?: string | null;
    sessionId?: string | null;
    chatId?: string | null;
    detail?: 'summary' | 'full';
  } = {},
): Promise<GatewayDomainListDTO> {
  const gateway = runtime.getGateway();
  if (!gateway) {
    return {
      generatedAt: new Date().toISOString(),
      summary: {
        total: 0,
        initialized: 0,
        pending: 0,
      },
      domains: [],
    };
  }

  if (input.detail === 'full' && typeof gateway.buildDomainSnapshot === 'function') {
    const snapshot = gateway.buildDomainSnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      domains: Object.values(snapshot.domains).map((entry) => ({
        id: entry.id,
        label: entry.label,
        initialized: entry.initialized,
        initializedAt: entry.initializedAt,
        summary: entry.summary,
        metrics: entry.metrics,
      })),
    };
  }

  if (typeof gateway.buildDomainSummarySnapshot === 'function') {
    const snapshot = gateway.buildDomainSummarySnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      domains: snapshot.domains.map((entry) => ({
        id: entry.id,
        label: entry.label,
        initialized: entry.initialized,
        initializedAt: entry.initializedAt,
      })),
    };
  }

  if (typeof gateway.buildDomainSnapshot === 'function') {
    const snapshot = gateway.buildDomainSnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      domains: Object.values(snapshot.domains).map((entry) => ({
        id: entry.id,
        label: entry.label,
        initialized: entry.initialized,
        initializedAt: entry.initializedAt,
        summary: entry.summary,
        metrics: entry.metrics,
      })),
    };
  }

  const hydrated = await gateway.buildHydratedSnapshot({
    userId: support.resolveUserId(input.userId),
    sessionId: support.normalizeValue(input.sessionId),
    chatId: support.normalizeValue(input.chatId),
  });
  const snapshot = hydrated?.domains || null;
  const entries = Array.isArray(snapshot?.domains)
    ? snapshot.domains
    : snapshot?.domains
      ? Object.values(snapshot.domains)
      : [];

  return {
    generatedAt: snapshot?.generatedAt || hydrated?.generatedAt || new Date().toISOString(),
    summary: snapshot?.summary || {
      total: entries.length,
      initialized: entries.filter((entry: unknown) => Boolean((entry as Record<string, unknown>)?.initialized)).length,
      pending: entries.filter((entry: unknown) => !(entry as Record<string, unknown>)?.initialized).length,
    },
    domains: entries.map((entry: unknown) => {
      const e = entry as Record<string, unknown>;
      return {
        id: String(e?.id || '').trim(),
        label: String(e?.label || '').trim(),
        initialized: Boolean(e?.initialized),
        initializedAt: e?.initializedAt || null,
        summary: e?.summary,
        metrics: e?.metrics,
      };
    }),
  };
}

export function readOpsHealth(
  runtime: CanonicalPublicApiRuntime,
  support: CanonicalPublicApiSharedSupport,
  mode: 'fast' | 'live' = 'fast',
): OpsHealthDTO {
  const healthService = runtime.getOperationsHealth();
  const snapshot = healthService
    ? (mode === 'live' ? healthService.readSnapshotLive() : healthService.readSnapshotFast())
    : null;
  const lastError = snapshot?.errors?.lastError || null;
  const components = {
    database: lastError && /sqlite|database|db/i.test(lastError.message || '') ? 'error' as const : 'ok' as const,
    eventBus: runtime.getRuntime() ? 'ok' as const : 'error' as const,
  };
  const mem = process.memoryUsage();

  return {
    healthy:
      !support.hasBlockingOperationalError(lastError)
      && components.database === 'ok'
      && components.eventBus === 'ok',
    uptime: process.uptime(),
    memoryUsage: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
    },
    components,
  };
}
