import type { OperationsHealthSnapshot } from '../../../../observability/OperationsHealthService.js';

export type OperationsCockpitNow = () => Date;

type OperationsCockpitLocalChannelLike = {
  enabled: boolean;
  started: boolean;
  recipientsConfigured: number;
  lastError: string | null;
  mode?: string | null;
  providerConfigured?: boolean;
  webhookConfigured?: boolean;
  nativeConfigured?: boolean;
};

export function formatUptime(uptimeSeconds: number): string {
  const total = Math.max(0, Number(uptimeSeconds || 0));
  if (total >= 3600) {
    return `${Math.floor(total / 3600)}h ${Math.floor((total % 3600) / 60)}m`;
  }
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

export function formatAge(now: OperationsCockpitNow, isoTimestamp: string | null): string {
  if (!isoTimestamp) {
    return 'nenhum publish registrado';
  }

  const timestamp = Date.parse(isoTimestamp);
  if (!Number.isFinite(timestamp)) {
    return 'publish com data invalida';
  }

  const diffMs = Math.max(0, now().getTime() - timestamp);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'agora';
  }
  if (minutes < 60) {
    return `ha ${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `ha ${hours} h`;
  }
  const days = Math.floor(hours / 24);
  return `ha ${days} d`;
}

export function formatShortHash(hash: string | null): string {
  const normalized = String(hash || '').trim();
  if (!normalized) {
    return 'sem hash';
  }

  return normalized.slice(0, 10);
}

export function getTenantSummary(operations: OperationsHealthSnapshot): OperationsHealthSnapshot['tenants'] {
  return operations.tenants || {
    totalCount: 0,
    sharedCount: 0,
    personalCount: 0,
    pendingOnboardingCount: 0,
    publicServerCount: 0,
    byPlatform: {},
    recent: [],
    pendingOnboarding: [],
    file: '',
  };
}

export function localChannelNeedsAttention(channel: OperationsCockpitLocalChannelLike | undefined): boolean {
  return Boolean(
    channel?.enabled &&
      (!channel.started ||
        channel.recipientsConfigured < 1 ||
        channel.lastError ||
        channel.providerConfigured === false ||
        (channel.mode === 'cloud-api' && channel.webhookConfigured === false) ||
        (channel.mode === 'native' && channel.nativeConfigured === false)),
  );
}

export function describeLocalChannelAttention(
  channel: OperationsCockpitLocalChannelLike | undefined,
  channelLabel: string,
  recipientsLabel: string,
  bootstrapLabel: string,
): string {
  if (channel?.lastError) {
    return `Ultimo erro do ${channelLabel}: ${channel.lastError}`;
  }
  if (channel?.mode === 'cloud-api' && channel.providerConfigured === false) {
    return `${channelLabel} em Cloud API, mas ainda sem credenciais minimas completas para webhook e outbound reais.`;
  }
  if (channel?.mode === 'cloud-api' && channel.webhookConfigured === false) {
    return `${channelLabel} em Cloud API, mas o verify token ou a validacao do webhook ainda nao foi confirmada.`;
  }
  if (channel?.mode === 'native' && channel.nativeConfigured === false) {
    return `${channelLabel} em modo nativo, mas ainda sem credencial valida para confirmar o runtime real.`;
  }
  if (!channel?.started) {
    return `${channelLabel} habilitado, mas o ${bootstrapLabel} ainda nao confirmou estado pronto.`;
  }
  if ((channel?.recipientsConfigured || 0) < 1) {
    return `${channelLabel} habilitado, mas ainda sem ${recipientsLabel} permitidos para rollout no mesh.`;
  }
  return `${channelLabel} ainda precisa de preparacao operacional.`;
}
