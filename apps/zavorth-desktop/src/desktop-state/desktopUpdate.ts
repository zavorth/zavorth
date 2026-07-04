export type DesktopUpdateState =
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'deferred'
  | 'ready-to-install'
  | 'installing'
  | 'rollback-available'
  | 'unconfigured'
  | 'error';

export type DesktopUpdateStatus = {
  checkedAt: string;
  state: DesktopUpdateState;
  currentVersion: string;
  latestVersion: string;
  channel: string;
  releaseNotes: string[];
  providerConfigured: boolean;
  canDownloadLater: boolean;
  canInstallNow: boolean;
  canRollback: boolean;
  deferredUntil?: string | null;
  rollbackVersion?: string | null;
  message: string;
};

export type DesktopUpdateInput = {
  checkedAt?: string;
  currentVersion: string;
  latestVersion?: string | null;
  channel?: string | null;
  releaseNotes?: string[] | string | null;
  providerConfigured?: boolean;
  downloaded?: boolean;
  deferredUntil?: string | null;
  rollbackVersion?: string | null;
  installing?: boolean;
  error?: string | null;
};

export function buildDesktopUpdateStatus(input: DesktopUpdateInput): DesktopUpdateStatus {
  const currentVersion = normalizeVersion(input.currentVersion || '0.0.0');
  const latestVersion = normalizeVersion(input.latestVersion || currentVersion);
  const providerConfigured = Boolean(input.providerConfigured);
  const releaseNotes = normalizeReleaseNotes(input.releaseNotes);
  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
  const canRollback = Boolean(input.rollbackVersion);

  let state: DesktopUpdateState = 'up-to-date';
  if (input.error) {
    state = 'error';
  } else if (!providerConfigured) {
    state = 'unconfigured';
  } else if (input.installing) {
    state = 'installing';
  } else if (input.downloaded && hasUpdate) {
    state = 'ready-to-install';
  } else if (input.deferredUntil && hasUpdate) {
    state = 'deferred';
  } else if (hasUpdate) {
    state = 'available';
  } else if (canRollback) {
    state = 'rollback-available';
  }

  return {
    checkedAt: input.checkedAt || new Date().toISOString(),
    state,
    currentVersion,
    latestVersion,
    channel: String(input.channel || 'stable'),
    releaseNotes,
    providerConfigured,
    canDownloadLater: providerConfigured && hasUpdate && state !== 'installing',
    canInstallNow: providerConfigured && hasUpdate && (input.downloaded || state === 'available' || state === 'ready-to-install'),
    canRollback,
    deferredUntil: input.deferredUntil || null,
    rollbackVersion: input.rollbackVersion || null,
    message: updateMessage({
      state,
      currentVersion,
      latestVersion,
      providerConfigured,
      error: input.error,
      deferredUntil: input.deferredUntil || null,
      rollbackVersion: input.rollbackVersion || null,
    }),
  };
}

export function compareSemver(a: string, b: string): number {
  const left = normalizeVersion(a).split('.').map(part => Number(part) || 0);
  const right = normalizeVersion(b).split('.').map(part => Number(part) || 0);
  const length = Math.max(left.length, right.length, 3);
  for (let index = 0; index < length; index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }
  return 0;
}

export function normalizeReleaseNotes(value: DesktopUpdateInput['releaseNotes']): string[] {
  if (Array.isArray(value)) {
    return value.map(note => String(note || '').trim()).filter(Boolean).slice(0, 8);
  }
  const text = String(value || '').trim();
  if (!text) {
    return ['Sem release notes locais para esta versao.'];
  }
  return text
    .split(/\r?\n/u)
    .map(line => line.replace(/^[-*]\s*/u, '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function updateMessage(input: {
  state: DesktopUpdateState;
  currentVersion: string;
  latestVersion: string;
  providerConfigured: boolean;
  error?: string | null;
  deferredUntil?: string | null;
  rollbackVersion?: string | null;
}): string {
  if (input.error) {
    return input.error;
  }
  switch (input.state) {
    case 'unconfigured':
      return 'Canal de auto-update nao configurado nesta build; o desktop mostra release notes e orienta instalacao manual.';
    case 'available':
      return `Versao ${input.latestVersion} disponivel.`;
    case 'deferred':
      return `Atualizacao adiada ate ${input.deferredUntil || 'mais tarde'}.`;
    case 'ready-to-install':
      return `Versao ${input.latestVersion} pronta para instalar.`;
    case 'installing':
      return 'Instalacao da atualizacao em andamento.';
    case 'rollback-available':
      return `Rollback basico disponivel para ${input.rollbackVersion}.`;
    case 'error':
      return 'Falha ao verificar atualizacoes.';
    default:
      return `Zavorth Desktop ${input.currentVersion} esta atualizado.`;
  }
}

function normalizeVersion(value: string): string {
  const normalized = String(value || '0.0.0')
    .trim()
    .replace(/^v/iu, '')
    .replace(/[^0-9.].*$/u, '');
  return normalized || '0.0.0';
}
