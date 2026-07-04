export type RuntimeRecoveryReason =
  | 'bridge-unavailable'
  | 'runtime-unreachable'
  | 'runtime-offline'
  | null;

export type RuntimeRecoveryState = {
  visible: boolean;
  reason: RuntimeRecoveryReason;
  title: string;
  message: string;
  retryLabel: string;
  settingsLabel: string;
};

type RuntimeRecoveryInput = {
  bridgeReady: boolean;
  status: {
    running?: boolean;
    message?: string;
    runtimePid?: number | null;
  };
  notice?: string;
};

export function classifyRuntimeRecovery(input: RuntimeRecoveryInput): RuntimeRecoveryState {
  if (!input.bridgeReady) {
    return {
      visible: true,
      reason: 'bridge-unavailable',
      title: 'Desktop bridge indisponivel',
      message: 'A ponte nativa do Zavorth Desktop nao respondeu. Reabra a interface ou verifique a instalacao.',
      retryLabel: 'Reabrir interface',
      settingsLabel: 'Abrir diagnosticos',
    };
  }

  const notice = String(input.notice || '').toLowerCase();
  const runtimeMessage = String(input.status.message || '').toLowerCase();
  const unreachable = /could not reach|failed to fetch|network|indisponivel|unreachable|offline/.test(`${notice} ${runtimeMessage}`);
  if (!input.status.running && unreachable) {
    return {
      visible: true,
      reason: 'runtime-unreachable',
      title: 'Runtime local sem resposta',
      message: 'O runtime local parou de responder. Tente reconectar ou abra os diagnosticos para revisar logs e reparos.',
      retryLabel: 'Reconectar runtime',
      settingsLabel: 'Abrir diagnosticos',
    };
  }

  if (!input.status.running && input.status.message) {
    return {
      visible: false,
      reason: 'runtime-offline',
      title: 'Runtime local offline',
      message: input.status.message,
      retryLabel: 'Iniciar runtime',
      settingsLabel: 'Abrir diagnosticos',
    };
  }

  return {
    visible: false,
    reason: null,
    title: '',
    message: '',
    retryLabel: 'Tentar novamente',
    settingsLabel: 'Abrir diagnosticos',
  };
}

export function shouldRefreshRuntimeForEvent(input: {
  type: 'online' | 'focus' | 'visibilitychange' | 'resume';
  online: boolean;
  visibilityState: DocumentVisibilityState | 'visible' | 'hidden';
}): boolean {
  if (!input.online) return false;
  if (input.type === 'visibilitychange') {
    return input.visibilityState === 'visible';
  }
  return true;
}
