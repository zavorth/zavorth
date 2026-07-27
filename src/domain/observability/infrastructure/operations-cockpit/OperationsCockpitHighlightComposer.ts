import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import type { OperationsCockpitSnapshot } from './OperationsCockpitTypes.js';
import { formatAge, formatShortHash, getTenantSummary } from './OperationsCockpitTextHelpers.js';

export function buildCockpitHighlights(
  now: () => Date,
  operations: OperationsHealthSnapshot,
  summary: OperationsCockpitSnapshot['summary'],
): string[] {
  const discordBridge = operations.channels?.discordBridge;
  const whatsAppChannel = operations.channels?.whatsapp;
  const slackChannel = operations.channels?.slack;
  const tenantSummary = getTenantSummary(operations);
  const audit = operations.security.lastAudit;
  const nodeMeshSmoke = operations.nodeMeshSmoke;
  const channelProviderDoctor = operations.channelProviderDoctor;
  const remoteTransportDoctor = operations.remoteTransportDoctor;
  const zavorthBridgeMobileAccess = operations.zavorthBridgeMobileAccess;
  const highlights = [
    `${summary.readySidecars}/${summary.enabledSidecars} enabled sidecars are ready.`,
    `${summary.freeDiskPercent}% free disk space.`,
    `Last publish: ${summary.publishAgeLabel}.`,
  ];

  if (operations.maintenance.available) {
    highlights.push(
      `Maintenance recorded with ${operations.maintenance.completedSteps}/${operations.maintenance.stepCount} steps completed.`,
    );
  } else {
    highlights.push('No recent maintenance recorded.');
  }

  if (operations.maintenanceAutomation.enabled) {
    highlights.push(
      `Recurring automation active; next window ${formatAge(now, operations.maintenanceAutomation.nextPlannedAt)}.`,
    );
  } else {
    highlights.push('Recurring automation disabled on this host.');
  }

  if (operations.maintenanceAutomation.lastTriggerSource === 'priority') {
    highlights.push(
      `Last priority auto-trigger: ${operations.maintenanceAutomation.lastPriorityReason || 'early operational revalidation.'}`,
    );
  }

  if (zavorthBridgeMobileAccess?.status === 'active') {
    highlights.push(
      `ZavorthBridge mobile active via ${zavorthBridgeMobileAccess.mode === 'public' ? 'public URL' : 'LAN'}${zavorthBridgeMobileAccess.expiresAt ? ` until ${zavorthBridgeMobileAccess.expiresAt}` : ''}.`,
    );
  } else if (zavorthBridgeMobileAccess?.status === 'expired') {
    highlights.push('ZavorthBridge mobile had an active lease, but it expired and needs to be reopened.');
  }

  if (audit.totalEvents > 0) {
    highlights.push(
      `Audit trail with ${audit.totalEvents} event(s); latest ${audit.latestEventType || 'event'} in ${audit.latestTaskId || 'unknown task'} (${formatShortHash(audit.latestChainHash)}).`,
    );
  } else if (audit.available) {
    highlights.push('Cryptographic audit status available, but no chained events yet.');
  }

  if (discordBridge?.enabled) {
    if (discordBridge.started) {
      highlights.push(
        discordBridge.mode === 'native'
          ? `Native Discord gateway active; ${discordBridge.pendingOutbox} recent sends recorded.`
          : `Discord bridge active; inbox ${discordBridge.pendingInbox} and outbox ${discordBridge.pendingOutbox}.`,
      );
    } else {
      highlights.push(
        discordBridge.mode === 'native'
          ? 'Native Discord gateway enabled, but not in ready state.'
          : 'Discord bridge enabled, but not in ready state.',
      );
    }
  }

  if (whatsAppChannel?.enabled) {
    if (whatsAppChannel.started && whatsAppChannel.recipientsConfigured > 0 && !whatsAppChannel.lastError) {
      if (whatsAppChannel.mode === 'cloud-api') {
        highlights.push(
          `WhatsApp Cloud API active; ${whatsAppChannel.recipientsConfigured} allowed chat(s)${whatsAppChannel.phoneNumberId ? ` on phone number ${whatsAppChannel.phoneNumberId}` : ''}.`,
        );
      } else {
        highlights.push(
          `WhatsApp supervised local active; ${whatsAppChannel.recipientsConfigured} allowed chat(s)${whatsAppChannel.sessionDir ? ` in ${whatsAppChannel.sessionDir}` : ''}.`,
        );
      }
    } else {
      highlights.push(
        whatsAppChannel.mode === 'cloud-api'
          ? 'WhatsApp Cloud API enabled, but still missing allowed chats, credentials, or final webhook validation.'
          : 'WhatsApp enabled in supervised local mode; missing allowed chats or final bootstrap before committing to real operation.',
      );
    }
  }

  if (slackChannel?.enabled) {
    if (slackChannel.started && slackChannel.recipientsConfigured > 0 && !slackChannel.lastError) {
      if (slackChannel.mode === 'native') {
        highlights.push(
          `Native Slack active; ${slackChannel.recipientsConfigured} allowed channel(s)${slackChannel.workspaceId ? ` in workspace ${slackChannel.workspaceId}` : ''}${slackChannel.apiBaseUrl ? ` via ${slackChannel.apiBaseUrl}` : ''}.`,
        );
      } else {
        highlights.push(
          `Slack supervised local active; ${slackChannel.recipientsConfigured} allowed channel(s)${slackChannel.workspaceId ? ` in workspace ${slackChannel.workspaceId}` : ''}.`,
        );
      }
    } else {
      highlights.push(
        slackChannel.mode === 'native'
          ? 'Native Slack enabled, but missing allowed channels or final runtime/webhook validation.'
          : 'Slack enabled in supervised local mode; missing allowed channels or final bootstrap before committing to real operation.',
      );
    }
  }

  if (tenantSummary.totalCount > 0) {
    highlights.push(
      tenantSummary.pendingOnboardingCount > 0
        ? `${tenantSummary.totalCount} tenant(s) observed; ${tenantSummary.pendingOnboardingCount} pending onboarding.`
        : `${tenantSummary.totalCount} tenant(s) observed; shared onboarding up to date.`,
    );
  }

  if (nodeMeshSmoke?.status === 'passed' && !nodeMeshSmoke.stale) {
    highlights.push(
      `Node Mesh validated by real smoke test ${formatAge(now, nodeMeshSmoke.checkedAt)}; last invoke ${nodeMeshSmoke.recentCapabilityId || 'n/d'}.`,
    );
  } else if (nodeMeshSmoke?.status === 'passed' && nodeMeshSmoke.stale) {
    highlights.push('Node Mesh had a valid real smoke test, but the report became stale and needs renewal.');
  } else if (nodeMeshSmoke?.status === 'failed') {
    highlights.push('Node Mesh failed the last real smoke test; review the mesh before trusting remote invokes.');
  } else if (nodeMeshSmoke?.status === 'running') {
    highlights.push('Node Mesh is under real smoke validation right now.');
  } else {
    highlights.push('Node Mesh has no recent real smoke test recorded on this host.');
  }

  if (channelProviderDoctor?.status === 'passed' && !channelProviderDoctor.stale) {
    const passedItems = (channelProviderDoctor.items || []).filter((item) => item.status === 'passed');
    highlights.push(
      `Native channels validated by doctor ${formatAge(now, channelProviderDoctor.checkedAt)}; ${passedItems.length} provider(s) confirmed.`,
    );
  } else if (channelProviderDoctor?.status === 'failed') {
    highlights.push(
      channelProviderDoctor.summary || 'Native channel doctor failed and there are still pending issues in Slack native or WhatsApp Cloud API.',
    );
  } else if (channelProviderDoctor?.status === 'missing') {
    highlights.push('Native channel doctor has not yet been executed on this host.');
  }

  if (remoteTransportDoctor?.status === 'passed' && !remoteTransportDoctor.stale) {
    const passedItems = (remoteTransportDoctor.items || []).filter((item) => item.status === 'passed');
    highlights.push(
      `Remote transports validated by doctor ${formatAge(now, remoteTransportDoctor.checkedAt)}; ${passedItems.length} flow(s) confirmed.`,
    );
  } else if (remoteTransportDoctor?.status === 'passed' && remoteTransportDoctor.stale) {
    highlights.push('Remote transports had a valid doctor, but the report became stale and needs renewal.');
  } else if (remoteTransportDoctor?.status === 'failed') {
    highlights.push(
      remoteTransportDoctor.summary || 'Remote transport doctor failed and there are still pending issues on the remote plane.',
    );
  } else if (remoteTransportDoctor?.status === 'running') {
    highlights.push('Remote transport doctor is validating right now.');
  } else {
    highlights.push('Remote transport doctor has not yet been executed on this host.');
  }

  if (operations.wasm?.enabled) {
    highlights.push(
      operations.wasm.canRun ? `Wasm tier ready for controlled execution (${operations.wasm.runtime || 'node-webassembly'}).`
        : `Wasm tier pending: ${operations.wasm.detail || 'operational smoke has not yet confirmed readiness.'}`,
    );
  }

  return highlights;
}
