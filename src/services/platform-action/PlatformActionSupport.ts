import type {
  ZavorthPlatformRegistryEntry,
  ZavorthPlatformRegistrySnapshot,
} from '../ZavorthPlatformRegistryService.js';
import type { ZavorthPlatformActionExecution } from '../ZavorthPlatformActionService.js';

export function normalizePlatformActionValue(value: string | null | undefined): string {
  return String(value || '').trim();
}

export function normalizePlatformActionId(
  value: string | null | undefined,
): ZavorthPlatformActionExecution['actionId'] | '' {
  const normalized = normalizePlatformActionValue(value).split(':').pop() || '';
  switch (normalized) {
    case 'inspect':
    case 'open':
    case 'doctor':
    case 'trust':
    case 'review':
    case 'install':
    case 'update':
    case 'remove':
      return normalized;
    default:
      return '';
  }
}

export function extractLearningCandidateId(entryId: string): string | null {
  const normalized = normalizePlatformActionValue(entryId);
  if (!normalized.startsWith('skill:learned:')) {
    return null;
  }
  const parts = normalized.split(':');
  const workflowRunId = parts[parts.length - 1];
  if (!workflowRunId) {
    return null;
  }
  return normalizePlatformActionValue(`candidate:${workflowRunId}`);
}

export function supportsPlatformLocalLifecycle(selected: ZavorthPlatformRegistryEntry): boolean {
  return selected.kind === 'skill' || selected.kind === 'mcp';
}

export function isPlatformLocallyAdopted(selected: ZavorthPlatformRegistryEntry): boolean {
  switch (selected.installState) {
    case 'installed':
    case 'workspace':
    case 'enabled':
      return true;
    default:
      return false;
  }
}

export function buildPlatformLifecycleState(
  selected: ZavorthPlatformRegistryEntry,
  snapshot: ZavorthPlatformRegistrySnapshot,
): {
  installedRevision: string;
  sourceDigest: string | null;
  sourceLocator: string | null;
  sourceTrusted: boolean | null;
} {
  const sourceLocator = String(selected.registrySource || selected.source || '').trim() || null;
  const fromRemoteCatalog = Boolean(sourceLocator && sourceLocator.includes('remote-catalog'));
  const sourceDigest = fromRemoteCatalog
    ? snapshot.catalogSync.contentSha256 || null
    : null;
  const sourceTrusted = fromRemoteCatalog
    ? snapshot.catalogSync.status === 'ready'
      && snapshot.catalogSync.sourceTrusted === true
      && !snapshot.catalogSync.stale
      && !snapshot.catalogSync.error
    : sourceLocator
      ? true
      : null;
  const installedRevision = sourceDigest
    ? `sha256:${sourceDigest}`
    : String(selected.actionHint || sourceLocator || selected.id).trim();
  return {
    installedRevision,
    sourceDigest,
    sourceLocator,
    sourceTrusted,
  };
}
