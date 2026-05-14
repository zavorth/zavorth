import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import type {
  CockpitAction,
  CockpitAlert,
  CockpitStatus,
  OperationsCockpitSnapshot,
} from './OperationsCockpitTypes.js';
import { formatAge, getTenantSummary, localChannelNeedsAttention } from './OperationsCockpitTextHelpers.js';

export function buildCockpitSummary(
  now: () => Date,
  operations: OperationsHealthSnapshot,
): OperationsCockpitSnapshot['summary'] {
  const cards = [operations.sidecars.AIGateway, operations.sidecars.ZavorthTerminal].filter(Boolean);
  const enabledSidecars = cards.filter((card) => card.enabled).length;
  const readySidecars = cards.filter((card) => card.enabled && card.ready).length;
  const recentErrorCount = Array.isArray(operations.errors.recent) ? operations.errors.recent.length : 0;

  return {
    enabledSidecars,
    readySidecars,
    recentErrorCount,
    freeDiskPercent: Number(operations.storage.freePercent || 0),
    publishAgeLabel: formatAge(now, operations.publish.publishedAt),
  };
}

export function resolveCockpitStatus(
  operations: OperationsHealthSnapshot,
  alerts: CockpitAlert[],
  summary: OperationsCockpitSnapshot['summary'],
): CockpitStatus {
  const tenantSummary = getTenantSummary(operations);
  const discordBridgeNeedsAttention = Boolean(
    operations.channels?.discordBridge?.enabled && !operations.channels?.discordBridge?.started,
  );
  const whatsAppNeedsAttention = localChannelNeedsAttention(operations.channels?.whatsapp);
  const slackNeedsAttention = localChannelNeedsAttention(operations.channels?.slack);
  const nodeMeshSmokeStatus = operations.nodeMeshSmoke?.status || 'missing';
  const channelProviderDoctorStatus = operations.channelProviderDoctor?.status || 'missing';
  const remoteTransportDoctorStatus = operations.remoteTransportDoctor?.status || 'missing';

  if (
    operations.security.needsAttention ||
    (operations.docker.required && !operations.docker.canRun) ||
    nodeMeshSmokeStatus === 'failed' ||
    channelProviderDoctorStatus === 'failed' ||
    remoteTransportDoctorStatus === 'failed' ||
    summary.freeDiskPercent < 8 ||
    alerts.some((alert) => alert.level === 'error')
  ) {
    return 'degraded';
  }

  if (
    summary.recentErrorCount > 0 ||
    summary.freeDiskPercent < 20 ||
    summary.readySidecars < summary.enabledSidecars ||
    tenantSummary.pendingOnboardingCount > 0 ||
    nodeMeshSmokeStatus === 'missing' ||
    nodeMeshSmokeStatus === 'running' ||
    operations.nodeMeshSmoke?.stale === true ||
    channelProviderDoctorStatus === 'missing' ||
    operations.channelProviderDoctor?.stale === true ||
    remoteTransportDoctorStatus === 'missing' ||
    remoteTransportDoctorStatus === 'running' ||
    operations.remoteTransportDoctor?.stale === true ||
    (operations.wasm?.enabled && !operations.wasm.canRun) ||
    discordBridgeNeedsAttention ||
    whatsAppNeedsAttention ||
    slackNeedsAttention ||
    !operations.publish.available ||
    !operations.maintenanceAutomation.enabled
  ) {
    return 'attention';
  }

  return 'healthy';
}

export function buildCockpitHeadline(
  status: CockpitStatus,
  summary: OperationsCockpitSnapshot['summary'],
  alerts: CockpitAlert[],
): string {
  if (status === 'healthy') {
    return `Runtime estavel, ${summary.readySidecars}/${summary.enabledSidecars} sidecars prontos e nenhum alerta critico.`;
  }

  if (status === 'attention') {
    return `${alerts.length} sinal(is) pedem acompanhamento, mas o host segue operacional.`;
  }

  return `Cockpit degradado: ${alerts.length} alerta(s) exigem intervencao antes do proximo ciclo pesado.`;
}
