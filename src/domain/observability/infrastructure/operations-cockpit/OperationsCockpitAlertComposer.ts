import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';
import type { CockpitAlert } from './OperationsCockpitTypes.js';
import {
  describeLocalChannelAttention,
  getTenantSummary,
  localChannelNeedsAttention,
} from './OperationsCockpitTextHelpers.js';

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
      title: 'Postura de seguranca precisa de atencao',
      detail:
        operations.security.lastPreflight.summary ||
        operations.security.lastAudit.summary ||
        'Revise o preflight operacional antes do proximo publish.',
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
      title: 'Sandbox forte indisponivel',
      detail: operations.docker.detail || 'Docker obrigatorio, mas indisponivel neste host.',
      timestamp: operations.generatedAt,
    });
  }

  if (operations.storage.freePercent < 15) {
    alerts.push({
      level: operations.storage.freePercent < 8 ? 'error' : 'warn',
      source: 'storage',
      title: 'Espaco em disco apertado',
      detail: `${operations.storage.freePercent}% livres em ${operations.storage.rootPath}`,
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
        detail: sidecar.message || (sidecar.running ? 'Ainda iniciando.' : 'Sidecar offline.'),
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
        `${discordBridge.mode === 'native' ? 'Gateway nativo' : 'Bridge'} habilitado, mas ainda nao iniciou ou perdeu o estado pronto.`,
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
      title: 'Tenant compartilhado pendente de onboarding',
      detail:
        tenantSummary.pendingOnboardingCount === 1
          ? 'Existe 1 tenant compartilhado ainda sem onboarding fechado.'
          : `Existem ${tenantSummary.pendingOnboardingCount} tenants compartilhados ainda sem onboarding fechado.`,
      timestamp: operations.generatedAt,
    });
  }

  if (nodeMeshSmoke?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke falhou',
      detail:
        nodeMeshSmoke.error ||
        nodeMeshSmoke.summary ||
        'O ultimo smoke real do Node Mesh falhou e a malha nao deve ser tratada como validada.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'passed' && nodeMeshSmoke.stale) {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke desatualizado',
      detail:
        nodeMeshSmoke.summary ||
        'O ultimo smoke real do Node Mesh passou, mas ficou velho; renove a validacao antes de confiar em invokes pareados.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'running') {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke em andamento',
      detail:
        nodeMeshSmoke.summary ||
        'Existe um smoke real do Node Mesh em andamento; aguarde o resultado antes de confiar em invokes pareados.',
      timestamp: nodeMeshSmoke.checkedAt || operations.generatedAt,
    });
  } else if (nodeMeshSmoke?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'node-mesh-smoke',
      title: 'Node Mesh smoke pendente',
      detail:
        nodeMeshSmoke.summary ||
        'Ainda nao existe um smoke real recente do Node Mesh; valide a malha antes de confiar em invokes remotos.',
      timestamp: operations.generatedAt,
    });
  }

  if (channelProviderDoctor?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'channel-provider-doctor',
      title: 'Doctor dos canais nativos falhou',
      detail:
        channelProviderDoctor.summary ||
        'Slack native ou WhatsApp Cloud API ainda nao passaram na validacao operacional.',
      timestamp: channelProviderDoctor.checkedAt || operations.generatedAt,
    });
  } else if (channelProviderDoctor?.status === 'passed' && channelProviderDoctor.stale) {
    alerts.push({
      level: 'warn',
      source: 'channel-provider-doctor',
      title: 'Native channel doctor is stale',
      detail:
        channelProviderDoctor.summary ||
        'A validacao operacional de Slack native e WhatsApp Cloud API ficou velha e deve ser renovada.',
      timestamp: channelProviderDoctor.checkedAt || operations.generatedAt,
    });
  } else if (channelProviderDoctor?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'channel-provider-doctor',
      title: 'Doctor dos canais nativos pendente',
      detail: 'Ainda nao existe um doctor recente para Slack native e WhatsApp Cloud API neste host.',
      timestamp: operations.generatedAt,
    });
  }

  if (remoteTransportDoctor?.status === 'failed') {
    alerts.push({
      level: 'error',
      source: 'remote-transport-doctor',
      title: 'Doctor dos transportes remotos falhou',
      detail:
        remoteTransportDoctor.summary ||
        'O doctor dos transportes remotos falhou e a superficie remota nao deve ser tratada como validada.',
      timestamp: remoteTransportDoctor.checkedAt || operations.generatedAt,
    });
  } else if (remoteTransportDoctor?.status === 'passed' && remoteTransportDoctor.stale) {
    alerts.push({
      level: 'warn',
      source: 'remote-transport-doctor',
      title: 'Remote transport doctor is stale',
      detail:
        remoteTransportDoctor.summary ||
        'A validacao operacional dos transportes remotos ficou velha e deve ser renovada.',
      timestamp: remoteTransportDoctor.checkedAt || operations.generatedAt,
    });
  } else if (remoteTransportDoctor?.status === 'missing') {
    alerts.push({
      level: 'warn',
      source: 'remote-transport-doctor',
      title: 'Doctor dos transportes remotos pendente',
      detail: 'Ainda nao existe um doctor recente para os transportes remotos neste host.',
      timestamp: operations.generatedAt,
    });
  }

  if (operations.wasm?.enabled && !operations.wasm.canRun) {
    alerts.push({
      level: 'warn',
      source: 'wasm-sandbox',
      title: 'Wasm tier needs validation',
      detail:
        operations.wasm.detail || 'O tier Wasm ainda nao confirmou prontidao operacional neste host.',
      timestamp: operations.generatedAt,
    });
  }

  if (maintenanceAutomation?.lastTriggerSource === 'priority') {
    alerts.push({
      level: 'info',
      source: 'maintenance-automation',
      title: 'Automacao prioritaria executada',
      detail:
        maintenanceAutomation.lastPriorityReason ||
        'A automacao operacional antecipou uma revalidacao por prioridade.',
      timestamp: maintenanceAutomation.lastTriggeredAt || maintenanceAutomation.updatedAt || operations.generatedAt,
    });
  }

  if (zavorthBridgeMobileAccess?.status === 'active') {
    alerts.push({
      level: 'info',
      source: 'zavorth-bridge-mobile-access',
      title: 'Acesso movel do ZavorthBridge ativo',
      detail:
        zavorthBridgeMobileAccess.summary ||
        'Existe um lease ativo do ZavorthBridge para uso no celular.',
      timestamp: zavorthBridgeMobileAccess.checkedAt || operations.generatedAt,
    });
  } else if (zavorthBridgeMobileAccess?.status === 'expired') {
    alerts.push({
      level: 'warn',
      source: 'zavorth-bridge-mobile-access',
      title: 'Acesso movel do ZavorthBridge expirou',
      detail:
        zavorthBridgeMobileAccess.summary ||
        'O ultimo lease movel do ZavorthBridge expirou e precisa ser recriado.',
      timestamp: zavorthBridgeMobileAccess.checkedAt || operations.generatedAt,
    });
  }

  const recentErrors = (operations.errors.recent || []).slice(0, 3);
  recentErrors.forEach((entry) => {
    alerts.push({
      level: entry.level === 'error' ? 'error' : 'warn',
      source: entry.category || 'runtime',
      title: 'Erro recente no runtime',
      detail: entry.message,
      timestamp: entry.timestamp || null,
    });
  });

  return alerts.slice(0, 6);
}
