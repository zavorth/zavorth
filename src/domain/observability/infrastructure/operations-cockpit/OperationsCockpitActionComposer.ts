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
      reason: 'Existe sidecar habilitado fora do estado pronto e a reconciliacao controlada e mais segura.',
      priority: 'high',
    });
  }

  if (operations.security.needsAttention) {
    actions.push({
      id: 'security-preflight',
      label: 'Rodar preflight de seguranca',
      command: 'npm run security:preflight',
      reason: 'Existem sinais de seguranca ou publish sem validacao recente.',
      priority: 'high',
    });
  }

  if (!operations.publish.available) {
    actions.push({
      id: 'remote-publish',
      label: 'Publicar superficies remotas',
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
          ? (nodeMeshSmoke.error || 'O ultimo smoke real do Node Mesh falhou e precisa ser repetido.')
          : nodeMeshSmoke?.stale
            ? 'O ultimo smoke real do Node Mesh ficou velho e precisa ser renovado antes de novos invokes pareados.'
            : nodeMeshSmoke?.status === 'running'
              ? 'Existe um smoke real em andamento; acompanhe a conclusao antes de liberar invokes pareados.'
              : 'Ainda nao existe um smoke real recente do Node Mesh neste host.',
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
          ? (channelProviderDoctor.summary || 'O doctor de Slack native/WhatsApp Cloud API falhou e precisa ser repetido.')
          : channelProviderDoctor?.stale
            ? 'O doctor de Slack native/WhatsApp Cloud API ficou velho e deve ser renovado antes de ampliar o rollout.'
            : 'Ainda nao existe doctor recente para Slack native/WhatsApp Cloud API neste host.',
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
          ? (remoteTransportDoctor.summary || 'O doctor dos transportes remotos falhou e precisa ser repetido.')
          : remoteTransportDoctor?.stale
            ? 'O doctor dos transportes remotos ficou velho e deve ser renovado antes de confiar em surface remota.'
            : 'Ainda nao existe doctor recente para os transportes remotos neste host.',
      priority: remoteTransportDoctor?.status === 'failed' ? 'high' : 'normal',
    });
  }

  if (wasm?.enabled && !wasm.canRun) {
    actions.push({
      id: 'validate-wasm-smoke',
      label: 'Validate Wasm tier',
      command: wasm.recommendedAction || 'npm run sandbox:wasm:smoke',
      reason: wasm.detail || 'O tier Wasm ainda nao confirmou prontidao operacional neste host.',
      priority: 'high',
    });
  }

  if (!operations.maintenanceAutomation.enabled) {
    actions.push({
      id: 'maintenance-keepalive',
      label: 'Ativar rotina de manutencao',
      command: 'ZAVORTH_MAINTENANCE_AUTOMATION_ENABLED=true',
      reason: 'The automatic maintenance routine is disabled on the current host.',
      priority: 'normal',
    });
  }

  if (discordBridge?.enabled && (!discordBridge.started || discordBridge.lastError)) {
    actions.push({
      id: 'recover-discord-bridge',
      label: discordBridge.mode === 'native' ? 'Recuperar gateway do Discord' : 'Recuperar Discord bridge',
      command: 'npm run ops:maintain',
      reason:
        discordBridge.mode === 'native'
          ? 'O gateway nativo do Discord perdeu prontidao e deve ser reconciliado pelo runtime supervisionado.'
          : 'O relay local do Discord perdeu prontidao e deve ser reconciliado pelo runtime supervisionado.',
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
      label: 'Rodar manutencao operacional',
      command: 'npm run ops:maintain',
      reason: 'O host esta com pouco espaco livre.',
      priority: 'normal',
    });
  }

  if (!actions.length) {
    actions.push({
      id: 'maintenance-keepalive',
      label: 'Keep the host healthy',
      command: 'npm run ops:maintain',
      reason: 'Fluxo padrao para manter trim, backup e verificacoes em dia.',
      priority: 'normal',
    });
  }

  return actions;
}
