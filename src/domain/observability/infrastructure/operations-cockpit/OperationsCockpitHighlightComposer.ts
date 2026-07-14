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
    `${summary.freeDiskPercent}% de espaco livre em disco.`,
    `Ultimo publish: ${summary.publishAgeLabel}.`,
  ];

  if (operations.maintenance.available) {
    highlights.push(
      `Manutencao registrada com ${operations.maintenance.completedSteps}/${operations.maintenance.stepCount} etapas concluidas.`,
    );
  } else {
    highlights.push('Nenhuma manutencao recente registrada.');
  }

  if (operations.maintenanceAutomation.enabled) {
    highlights.push(
      `Automacao recorrente ativa; proxima janela ${formatAge(now, operations.maintenanceAutomation.nextPlannedAt)}.`,
    );
  } else {
    highlights.push('Automacao recorrente desativada neste host.');
  }

  if (operations.maintenanceAutomation.lastTriggerSource === 'priority') {
    highlights.push(
      `Ultimo autodisparo prioritario: ${operations.maintenanceAutomation.lastPriorityReason || 'revalidacao operacional antecipada.'}`,
    );
  }

  if (zavorthBridgeMobileAccess?.status === 'active') {
    highlights.push(
      `ZavorthBridge mobile ativo via ${zavorthBridgeMobileAccess.mode === 'public' ? 'URL publica' : 'LAN'}${zavorthBridgeMobileAccess.expiresAt ? ` ate ${zavorthBridgeMobileAccess.expiresAt}` : ''}.`,
    );
  } else if (zavorthBridgeMobileAccess?.status === 'expired') {
    highlights.push('ZavorthBridge mobile tinha lease ativo, mas ele expirou e precisa ser reaberto.');
  }

  if (audit.totalEvents > 0) {
    highlights.push(
      `Trilha de auditoria com ${audit.totalEvents} evento(s); ultimo ${audit.latestEventType || 'evento'} em ${audit.latestTaskId || 'task desconhecida'} (${formatShortHash(audit.latestChainHash)}).`,
    );
  } else if (audit.available) {
    highlights.push('Status da auditoria criptografica disponivel, mas sem eventos encadeados ainda.');
  }

  if (discordBridge?.enabled) {
    if (discordBridge.started) {
      highlights.push(
        discordBridge.mode === 'native'
          ? `Gateway nativo do Discord ativo; ${discordBridge.pendingOutbox} envios recentes registrados.`
          : `Discord bridge ativo; inbox ${discordBridge.pendingInbox} e outbox ${discordBridge.pendingOutbox}.`,
      );
    } else {
      highlights.push(
        discordBridge.mode === 'native'
          ? 'Gateway nativo do Discord habilitado, mas fora do estado pronto.'
          : 'Discord bridge habilitado, mas fora do estado pronto.',
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
          `WhatsApp local supervisionado ativo; ${whatsAppChannel.recipientsConfigured} chat(s) permitidos${whatsAppChannel.sessionDir ? ` em ${whatsAppChannel.sessionDir}` : ''}.`,
        );
      }
    } else {
      highlights.push(
        whatsAppChannel.mode === 'cloud-api'
          ? 'WhatsApp Cloud API habilitada, mas ainda faltam chats permitidos, credenciais ou validacao final do webhook.'
          : 'WhatsApp habilitado em modo local supervisionado; faltam chats permitidos ou bootstrap final antes de prometer operacao real.',
      );
    }
  }

  if (slackChannel?.enabled) {
    if (slackChannel.started && slackChannel.recipientsConfigured > 0 && !slackChannel.lastError) {
      if (slackChannel.mode === 'native') {
        highlights.push(
          `Slack nativo ativo; ${slackChannel.recipientsConfigured} canal(is) permitidos${slackChannel.workspaceId ? ` no workspace ${slackChannel.workspaceId}` : ''}${slackChannel.apiBaseUrl ? ` via ${slackChannel.apiBaseUrl}` : ''}.`,
        );
      } else {
        highlights.push(
          `Slack local supervisionado ativo; ${slackChannel.recipientsConfigured} canal(is) permitidos${slackChannel.workspaceId ? ` no workspace ${slackChannel.workspaceId}` : ''}.`,
        );
      }
    } else {
      highlights.push(
        slackChannel.mode === 'native'
          ? 'Slack nativo habilitado, mas faltam canais permitidos ou validacao final do runtime/webhook.'
          : 'Slack habilitado em modo local supervisionado; faltam canais permitidos ou bootstrap final antes de prometer operacao real.',
      );
    }
  }

  if (tenantSummary.totalCount > 0) {
    highlights.push(
      tenantSummary.pendingOnboardingCount > 0
        ? `${tenantSummary.totalCount} tenant(s) observados; ${tenantSummary.pendingOnboardingCount} onboarding pendente(s).`
        : `${tenantSummary.totalCount} tenant(s) observados; onboarding compartilhado em dia.`,
    );
  }

  if (nodeMeshSmoke?.status === 'passed' && !nodeMeshSmoke.stale) {
    highlights.push(
      `Node Mesh validado por smoke real ${formatAge(now, nodeMeshSmoke.checkedAt)}; ultimo invoke ${nodeMeshSmoke.recentCapabilityId || 'n/d'}.`,
    );
  } else if (nodeMeshSmoke?.status === 'passed' && nodeMeshSmoke.stale) {
    highlights.push('Node Mesh tinha smoke real valido, mas o relatorio ficou velho e precisa ser renovado.');
  } else if (nodeMeshSmoke?.status === 'failed') {
    highlights.push('Node Mesh com falha no ultimo smoke real; revise a malha antes de confiar em invokes remotos.');
  } else if (nodeMeshSmoke?.status === 'running') {
    highlights.push('Node Mesh is under real smoke validation right now.');
  } else {
    highlights.push('Node Mesh ainda sem smoke real recente registrado neste host.');
  }

  if (channelProviderDoctor?.status === 'passed' && !channelProviderDoctor.stale) {
    const passedItems = (channelProviderDoctor.items || []).filter((item) => item.status === 'passed');
    highlights.push(
      `Canais nativos validados por doctor ${formatAge(now, channelProviderDoctor.checkedAt)}; ${passedItems.length} provider(s) confirmados.`,
    );
  } else if (channelProviderDoctor?.status === 'failed') {
    highlights.push(
      channelProviderDoctor.summary || 'Doctor dos canais nativos falhou e ainda existem pendencias em Slack native ou WhatsApp Cloud API.',
    );
  } else if (channelProviderDoctor?.status === 'missing') {
    highlights.push('Doctor dos canais nativos ainda nao foi executado neste host.');
  }

  if (remoteTransportDoctor?.status === 'passed' && !remoteTransportDoctor.stale) {
    const passedItems = (remoteTransportDoctor.items || []).filter((item) => item.status === 'passed');
    highlights.push(
      `Transportes remotos validados por doctor ${formatAge(now, remoteTransportDoctor.checkedAt)}; ${passedItems.length} flow(s) confirmados.`,
    );
  } else if (remoteTransportDoctor?.status === 'passed' && remoteTransportDoctor.stale) {
    highlights.push('Transportes remotos tinham doctor valido, mas o relatorio ficou velho e precisa ser renovado.');
  } else if (remoteTransportDoctor?.status === 'failed') {
    highlights.push(
      remoteTransportDoctor.summary || 'Doctor dos transportes remotos falhou e ainda existem pendencias no plano remoto.',
    );
  } else if (remoteTransportDoctor?.status === 'running') {
    highlights.push('Remote transport doctor is validating right now.');
  } else {
    highlights.push('Doctor dos transportes remotos ainda nao foi executado neste host.');
  }

  if (operations.wasm?.enabled) {
    highlights.push(
      operations.wasm.canRun
        ? `Tier Wasm pronto para execucao controlada (${operations.wasm.runtime || 'node-webassembly'}).`
        : `Tier Wasm pendente: ${operations.wasm.detail || 'smoke operacional ainda nao confirmou prontidao.'}`,
    );
  }

  return highlights;
}
