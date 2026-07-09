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
  source: 'github' | 'manifest' | 'none';
  githubRepo: string | null;
  releaseUrl: string | null;
  releaseNotes: string[];
  providerConfigured: boolean;
  canDownloadLater: boolean;
  canInstallNow: boolean;
  canOpenGithub: boolean;
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
  source?: string | null;
  githubRepo?: string | null;
  releaseUrl?: string | null;
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
  const source = normalizeUpdateSource(input.source || input.channel, input.providerConfigured);
  // GitHub is the default product channel when no custom site/CDN exists.
  const providerConfigured = Boolean(input.providerConfigured) || source === 'github';
  const releaseNotes = normalizeReleaseNotes(input.releaseNotes);
  const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
  const canRollback = Boolean(input.rollbackVersion);
  const githubRepo = input.githubRepo ? String(input.githubRepo) : (source === 'github' ? 'zavorth/zavorth' : null);
  const releaseUrl = input.releaseUrl
    ? String(input.releaseUrl)
    : (githubRepo ? `https://github.com/${githubRepo}/releases` : null);

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
    channel: String(input.channel || (source === 'github' ? 'github' : 'stable')),
    source,
    githubRepo,
    releaseUrl,
    releaseNotes,
    providerConfigured,
    // Open GitHub / package whenever there is a release URL (even if versions match).
    canDownloadLater: providerConfigured && state !== 'installing',
    canInstallNow: true,
    canOpenGithub: Boolean(releaseUrl || source === 'github'),
    canRollback,
    deferredUntil: input.deferredUntil || null,
    rollbackVersion: input.rollbackVersion || null,
    message: updateMessage({
      state,
      currentVersion,
      latestVersion,
      providerConfigured,
      source,
      githubRepo,
      error: input.error,
      deferredUntil: input.deferredUntil || null,
      rollbackVersion: input.rollbackVersion || null,
    }),
  };
}

function normalizeUpdateSource(value: unknown, providerConfigured?: boolean): DesktopUpdateStatus['source'] {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'github' || text.includes('github')) return 'github';
  if (text === 'manifest') return 'manifest';
  if (text === 'none' || text === 'manual') return 'none';
  // Default product channel is GitHub Releases unless caller explicitly disables provider.
  if (!text) return providerConfigured === false ? 'none' : 'github';
  return 'none';
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
  source?: DesktopUpdateStatus['source'];
  githubRepo?: string | null;
  error?: string | null;
  deferredUntil?: string | null;
  rollbackVersion?: string | null;
}): string {
  if (input.error) {
    return input.error;
  }
  const repo = input.githubRepo || 'zavorth/zavorth';
  switch (input.state) {
    case 'unconfigured':
      return 'No update channel is configured. Open GitHub Releases or Setup to upgrade manually.';
    case 'available':
      return input.source === 'github'
        ? `GitHub release ${input.latestVersion} is available (Desktop ${input.currentVersion}). Open Releases to upgrade.`
        : `Version ${input.latestVersion} available.`;
    case 'deferred':
      return `Update deferred until ${input.deferredUntil || 'later'}.`;
    case 'ready-to-install':
      return `Version ${input.latestVersion} ready — install from GitHub package/Setup.`;
    case 'installing':
      return 'Update install in progress.';
    case 'rollback-available':
      return `Rollback reference available for ${input.rollbackVersion}.`;
    case 'error':
      return 'Failed to check updates.';
    default:
      return input.source === 'github'
        ? `Desktop ${input.currentVersion} — channel github.com/${repo}. Open Releases to review tags anytime.`
        : `Zavorth Desktop ${input.currentVersion} is up to date.`;
  }
}

function normalizeVersion(value: string): string {
  const normalized = String(value || '0.0.0')
    .trim()
    .replace(/^v/iu, '')
    .replace(/[^0-9.].*$/u, '');
  return normalized || '0.0.0';
}
