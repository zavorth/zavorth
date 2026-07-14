import type { ProfileRuntimeBundle } from '../../contracts/ProfileManifestContract.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function resolveProfileRuntimeBundleFromRun(run: UniversalAgentRun): ProfileRuntimeBundle | null {
  const direct = recordOrNull(run.metadata.profileBundle)
    || recordOrNull(run.metadata.profileRuntimeBundle);
  if (!direct) return null;
  if (
    typeof direct.id !== 'string'
    || typeof direct.checksum !== 'string'
    || !recordOrNull(direct.runtimePolicy)
    || !recordOrNull(direct.runtimePolicyBundle)
    || !recordOrNull(direct.cognitiveContextBundle)
  ) {
    return null;
  }
  return direct as ProfileRuntimeBundle;
}
