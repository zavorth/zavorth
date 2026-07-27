import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import type { CockpitAction } from './OperationsCockpitTypes.js';
import {
  describeLocalChannelAttention,
  localChannelNeedsAttention,
} from './OperationsCockpitTextHelpers.js';

export function buildCockpitActions(operations: OperationsHealthSnapshot): CockpitAction[] {
  const actions: CockpitAction[] = [];
  const sidecars = [operations.sidecars.AIGateway, operations.sidecars.ZavorthTerminal].filter(Boolean);
  const discordBridge = operations.channels?.discordBridge;
  const whatsAppChannel = operations.channels?.whatsapp;
  const slackChannel = operations.channels?.slack;
  const nodeMeshSmoke = operations.nodeMeshSmoke;
  const channelProviderDoctor = operations.channelProviderDoctor;
  const remoteTransportDoctor = operations.remoteTransportDoctor;
  const wasm = operations.wasm;

  if (sidecars.some((sidecar) => sidecar.enabled && !sidecar.ready)) {
    actions.push({
      id: 'recover-sidecars',
      label: 'Reconcile local runtime',
      command: 'npm run ops:maintain',
      reason: 'Existe sidecar habilitado outside do estado ready e a reconciliaction controlada e mais safe.',
      priority: 'high',
    });
  }

  if (operations.security.needsAttention) {
    actions.push({
      id: 'security-preflight',
      label: 'Run security preflight',
      command: 'npm run security:preflight',
      reason: 'There are security or publishing signals without recent validation.',
      priority: 'high',
    });
  }

  if (!operations.publish.available) {
    actions.push({
      id: 'remote-publish',
      label: 'Publicar surfaces remotas',
      command: 'npm run remote:publish:fast',
      reason: 'No remote publish has been recorded yet.',
      priority: 'normal',
    });
  }

  if (nodeMeshSmoke?.status !== 'passed' || nodeMeshSmoke?.stale) {
    actions.push({
      id: 'validate-node-mesh-smoke',
      label: 'Validate Node Mesh',
      command: nodeMeshSmoke?.recommendedAction || nodeMeshSmoke?.command || 'npm run test:nodes:smoke',
      reason:
        nodeMeshSmoke?.status === 'failed'
          ? (nodeMeshSmoke.error || 'The last real Node Mesh smoke failed and needs to be repeated.')
          : nodeMeshSmoke?.stale ? 'The last real Node Mesh smoke became stale and needs renewal before new paired invokes.'
            : nodeMeshSmoke?.status === 'running'
              ? 'A real smoke is in progress; monitor the conclusion before releasing paired invokes.'
              : 'There is no recent real Node Mesh smoke on this host yet.',
      priority: nodeMeshSmoke?.status === 'failed' ? 'high' : 'normal',
    });
  }

  if (channelProviderDoctor?.status !== 'passed' || channelProviderDoctor?.stale) {
    actions.push({
      id: 'validate-channel-providers',
      label: 'Validate native channels',
      command:
        channelProviderDoctor?.recommendedAction ||
        channelProviderDoctor?.command ||
        'npm run test:channels:smoke',
      reason:
        channelProviderDoctor?.status === 'failed'
          ? (channelProviderDoctor.summary || 'The Slack native/WhatsApp Cloud API doctor failed and needs to be repeated.')
          : channelProviderDoctor?.stale ? 'The Slack native/WhatsApp Cloud API doctor became stale and should be renewed before expanding the rollout.'
            : 'There is no recent doctor for Slack native/WhatsApp Cloud API on this host yet.',
      priority: channelProviderDoctor?.status === 'failed' ? 'high' : 'normal',
    });
  }

  if (remoteTransportDoctor?.status !== 'passed' || remoteTransportDoctor?.stale) {
    actions.push({
      id: 'validate-remote-transports',
      label: 'Validate remote transports',
      command:
        remoteTransportDoctor?.recommendedAction ||
        remoteTransportDoctor?.command ||
        'npm run test:transports:smoke',
      reason:
        remoteTransportDoctor?.status === 'failed'
          ? (remoteTransportDoctor.summary || 'The remote transport doctor failed and needs to be repeated.')
          : remoteTransportDoctor?.stale ? 'The remote transport doctor became stale and should be renewed before trusting the remote surface.'
            : 'There is no recent doctor for remote transports on this host yet.',
      priority: remoteTransportDoctor?.status === 'failed' ? 'high' : 'normal',
    });
  }

  if (wasm?.enabled && !wasm.canRun) {
    actions.push({
      id: 'validate-wasm-smoke',
      label: 'Validate Wasm tier',
      command: wasm.recommendedAction || 'npm run sandbox:wasm:smoke',
      reason: wasm.detail || 'The Wasm tier has not yet confirmed operational readiness on this host.',
      priority: 'high',
    });
  }

  if (!operations.maintenanceAutomation.enabled) {
    actions.push({
      id: 'maintenance-keepalive',
      label: 'Ativar rotina de maintenance',
      command: 'ZAVORTH_MAINTENANCE_AUTOMATION_ENABLED=true',
      reason: 'The automatic maintenance routine is disabled on the current host.',
      priority: 'normal',
    });
  }

  if (discordBridge?.enabled && (!discordBridge.started || discordBridge.lastError)) {
    actions.push({
      id: 'recover-discord-bridge',
      label: discordBridge.mode === 'native' ? 'Recover Discord gateway' : 'Recover Discord bridge',
      command: 'npm run ops:maintain',
      reason:
        discordBridge.mode === 'native'
          ? 'The native Discord gateway lost readiness and should be reconciled by the supervised runtime.'
          : 'The local Discord relay lost readiness and should be reconciled by the supervised runtime.',
      priority: 'high',
    });
  }

  if (localChannelNeedsAttention(whatsAppChannel)) {
    actions.push({
      id: 'prepare-whatsapp-channel',
      label: whatsAppChannel?.mode === 'cloud-api' ? 'Validate WhatsApp Cloud API' : 'Prepare WhatsApp channel',
      command: '/channels prepare whatsapp',
      reason: describeLocalChannelAttention(
        whatsAppChannel,
        'WhatsApp',
        'chat(s)',
        whatsAppChannel?.mode === 'cloud-api' ? 'runtime Cloud API/webhook' : 'local adapter bootstrap',
      ),
      priority: whatsAppChannel?.lastError ? 'high' : 'normal',
    });
  }

  if (localChannelNeedsAttention(slackChannel)) {
    actions.push({
      id: 'prepare-slack-channel',
      label: slackChannel?.mode === 'native' ? 'Validate native Slack' : 'Prepare Slack onboarding',
      command: '/channels prepare slack',
      reason: describeLocalChannelAttention(
        slackChannel,
        'Slack',
        'channel(s)',
        slackChannel?.mode === 'native' ? 'native Slack runtime/webhook' : 'local adapter bootstrap',
      ),
      priority: slackChannel?.lastError ? 'high' : 'normal',
    });
  }

  if (operations.storage.freePercent < 20) {
    actions.push({
      id: 'maintenance',
      label: 'run maintenance operational',
      command: 'npm run ops:maintain',
      reason: 'O host is com pouco espaco livre.',
      priority: 'normal',
    });
  }

  if (!actions.length) {
    actions.push({
      id: 'maintenance-keepalive',
      label: 'Keep the host healthy',
      command: 'npm run ops:maintain',
      reason: 'Default flow keeps trim, backup, and verification current.',
      priority: 'normal',
    });
  }

  return actions;
}
