import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import type { CockpitAlert } from './OperationsDashboardTypes.js';
import {
  describeLocalChannelAttention,
  getTenantSummary,
  localChannelNeedsAttention,
} from './OperationsDashboardTextHelpers.js';

export function buildCockpitAlerts(operations: OperationsHealthSnapshot): CockpitAlert[] {
  const alerts: CockpitAlert[] = [];
  const discordBridge = operations.channels?.discordBridge;
  const whatsAppChannel = operations.channels?.whatsapp;
  const slackChannel = operations.channels?.slack;
  const tenantSummary = getTenantSummary(operations);
  const nodeMeshSmoke = operations.nodeMeshSmoke;
  const channelProviderDoctor = operations.channelProviderDoctor;
  const remoteTransportDoctor = operations.remoteTransportDoctor;
  const zavorthBridgeMobileAccess = operations.zavorthBridgeMobileAccess;
  const maintenanceAutomation = operations.maintenanceAutomation;

  if (operations.security.needsAttention) {
    alerts.push({
      level: 'error',
      source: 'security',
      title: 'Security posture needs attention',
      detail:
        operations.security.lastPreflight.summary ||
        operations.security.lastAudit.summary ||
        'Review the operational preflight before the next publish.',
      timestamp:
        operations.security.lastPreflight.generatedAt ||
        operations.security.lastAudit.generatedAt ||
        null,
    });
  }

  if (operations.docker.required && !operations.docker.canRun) {
    alerts.push({
      level: 'error',
      source: 'docker',
      title: 'Sandbox unavailable',
      detail: operations.docker.detail || 'Docker required, but unavailable on this host.',
      timestamp: operations.generatedAt,
    });
  }

  if (operations.storage.freePercent < 15) {
    alerts.push({
      level: operations.storage.freePercent < 8 ? 'error' : 'warn',
      source: 'storage',
      title: 'Low disk space',
      detail: `${operations.storage.freePercent}% free in ${operations.storage.rootPath}`,
      timestamp: operations.generatedAt,
    });
  }

  const sidecars = [operations.sidecars.AIGateway, operations.sidecars.ZavorthTerminal].filter(Boolean);
  sidecars
    .filter((sidecar) => sidecar.enabled && !sidecar.ready)
    .forEach((sidecar) => {
      alerts.push({
        level: sidecar.running ? 'warn' : 'error',
        source: 'sidecar',
        title: `${sidecar.name} needs intervention`,
        detail: sidecar.message || (sidecar.running ? 'Still starting.' : 'Sidecar offline.'),
        timestamp: sidecar.checkedAt || operations.generatedAt,
      });
    });

  if (discordBridge?.enabled && !discordBridge.started) {
    const discordLabel = discordBridge.mode === 'native' ? 'Native Discord gateway' : 'Discord bridge';
    alerts.push({
      level: discordBridge.lastError ? 'error' : 'warn',
      source: 'discord-bridge',
      title: `${discordLabel} needs intervention`,
      detail:
        discordBridge.lastError ||
        `${discordBridge.mode === 'native' ? 'Native gateway' : 'Bridge'} enabled, but has not started yet or lost ready state.`,
      timestamp: discordBridge.updatedAt || operations.generatedAt,
    });
  }

  if (localChannelNeedsAttention(whatsAppChannel)) {
    alerts.push({
      level: whatsAppChannel?.lastError ? 'error' : 'warn',
      source: 'whatsapp-channel',
      title: whatsAppChannel?.mode === 'cloud-api' ? 'WhatsApp Cloud API requires validation' : 'WhatsApp requires preparation',
      detail: describeLocalChannelAttention(
        whatsAppChannel,
        'WhatsApp',
        'chat(s)',
        whatsAppChannel?.mode === 'cloud-api' ? 'runtime Cloud API/webhook' : 'local adapter bootstrap',
      ),
      timestamp: whatsAppChannel?.updatedAt || operations.generatedAt,
    });
  }

  if (localChannelNeedsAttention(slackChannel)) {
    alerts.push({
      level: slackChannel?.lastError ? 'error' : 'warn',
      source: 'slack-channel',
      title: slackChannel?.mode === 'native' ? 'Native Slack requires validation' : 'Slack requires preparation',
      detail: describeLocalChannelAttention(
        slackChannel,
        'Slack',
        'channel(s)',
        slackChannel?.mode === 'native' ? 'native Slack runtime/webhook' : 'local adapter bootstrap',
      ),
      timestamp: slackChannel?.updatedAt || operations.generatedAt,
    });
  }

  if (tenantSummary.pendingOnboardingCount > 0) {
    alerts.push({
      level: 'warn',
      source: 'tenant-registry',
      title: 'Shared tenant pending onboarding',
      detail:
        tenantSummary.pendingOnboardingCount === 1
          ? 'There is 1 shared tenant still without completed onboarding.'
          : `There are ${tenantSummary.pendingOnboardingCount} shared tenants still without completed onboarding.`,
      timestamp: operations.generatedAt,
    });
  }

  if (nodeMeshSmoke?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke failed',
      detail:
        nodeMeshSmoke.error ||
        nodeMeshSmoke.summary ||
        'The last real Node Mesh smoke failed and the mesh should not be treated as validated.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'passed' && nodeMeshSmoke.stale) {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke is stale',
      detail:
        nodeMeshSmoke.summary ||
        'The last real Node Mesh smoke passed, but became stale; renew validation before trusting paired invokes.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'running') {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke running',
      detail:
        nodeMeshSmoke.summary ||
        'A real Node Mesh smoke is in progress; wait for the result before trusting paired invokes.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke pending',
      detail:
        nodeMeshSmoke.summary ||
        'There is no recent real Node Mesh smoke yet; validate the mesh before trusting remote invokes.',
      timestamp: operations.generatedAt,
    });
  }

  if (channelProviderDoctor?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'channel-provider-doctor',
      title: 'Native channel doctor failed',
      detail:
        channelProviderDoctor.summary ||
        'Slack native or WhatsApp Cloud API have not yet passed operational validation.',
      timestamp: channelProviderDoctor.checkedAt || operations.generatedAt,
    });
  } else if (channelProviderDoctor?.status === 'passed' && channelProviderDoctor.stale) {
    alerts.push({
      level: 'warn',
      source: 'channel-provider-doctor',
      title: 'Native channel doctor is stale',
      detail:
        channelProviderDoctor.summary ||
        'The operational validation of Slack native and WhatsApp Cloud API became stale and should be renewed.',
      timestamp: channelProviderDoctor.checkedAt || operations.generatedAt,
    });
  } else if (channelProviderDoctor?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'channel-provider-doctor',
      title: 'Native channel doctor pending',
      detail: 'There is no recent doctor for Slack native and WhatsApp Cloud API on this host yet.',
      timestamp: operations.generatedAt,
    });
  }

  if (remoteTransportDoctor?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'remote-transport-doctor',
      title: 'Remote transport doctor failed',
      detail:
        remoteTransportDoctor.summary ||
        'The remote transport doctor failed and the remote surface should not be treated as validated.',
      timestamp: remoteTransportDoctor.checkedAt || operations.generatedAt,
    });
  } else if (remoteTransportDoctor?.status === 'passed' && remoteTransportDoctor.stale) {
    alerts.push({
      level: 'warn',
      source: 'remote-transport-doctor',
      title: 'Remote transport doctor is stale',
      detail:
        remoteTransportDoctor.summary ||
        'The operational validation of remote transports became stale and should be renewed.',
      timestamp: remoteTransportDoctor.checkedAt || operations.generatedAt,
    });
  } else if (remoteTransportDoctor?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'remote-transport-doctor',
      title: 'Remote transport doctor pending',
      detail: 'There is no recent doctor for remote transports on this host yet.',
      timestamp: operations.generatedAt,
    });
  }

  if (operations.wasm?.enabled && !operations.wasm.canRun) {
    alerts.push({
      level: 'warn',
      source: 'wasm-sandbox',
      title: 'Wasm tier needs validation',
      detail:
        operations.wasm.detail || 'The Wasm tier has not yet confirmed operational readiness on this host.',
      timestamp: operations.generatedAt,
    });
  }

  if (maintenanceAutomation?.lastTriggerSource === 'priority') {
    alerts.push({
      level: 'info',
      source: 'maintenance-automation',
      title: 'Priority automation executed',
      detail:
        maintenanceAutomation.lastPriorityReason ||
        'Operational automation anticipated a priority revalidation.',
      timestamp: maintenanceAutomation.lastTriggeredAt || maintenanceAutomation.updatedAt || operations.generatedAt,
    });
  }

  if (zavorthBridgeMobileAccess?.status === 'active') {
    alerts.push({
      level: 'info',
      source: 'zavorth-bridge-mobile-access',
      title: 'ZavorthBridge mobile access active',
      detail:
        zavorthBridgeMobileAccess.summary ||
        'There is an active ZavorthBridge lease for mobile usage.',
      timestamp: zavorthBridgeMobileAccess.checkedAt || operations.generatedAt,
    });
  } else if (zavorthBridgeMobileAccess?.status === 'expired') {
    alerts.push({
      level: 'warn',
      source: 'zavorth-bridge-mobile-access',
      title: 'ZavorthBridge mobile access expired',
      detail:
        zavorthBridgeMobileAccess.summary ||
        'The last mobile ZavorthBridge lease expired and must be recreated.',
      timestamp: zavorthBridgeMobileAccess.checkedAt || operations.generatedAt,
    });
  }

  const recentErrors = (operations.errors.recent || []).slice(0, 3);
  recentErrors.forEach((entry) => {
    alerts.push({
      level: entry.level === 'error' ? 'error' : 'warn',
      source: entry.category || 'runtime',
      title: 'recent error in runtime',
      detail: entry.message,
      timestamp: entry.timestamp || null,
    });
  });

  return alerts.slice(0, 6);
}
