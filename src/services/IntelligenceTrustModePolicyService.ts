import type {
  IntelligenceLegacyTrustMode,
  IntelligenceTrustMode,
  IntelligenceTrustResolutionSource,
} from '../contracts/IntelligenceFabricContract.js';
import { IntelligenceRiskGateService } from './IntelligenceRiskGateService.js';

export type IntelligenceTrustModePolicyInput = {
  requestedTrustMode?: unknown;
  surface?: string | null;
  userRole?: string | null;
};

export type IntelligenceTrustModePolicySnapshot = {
  requested: IntelligenceTrustMode;
  legacy: IntelligenceLegacyTrustMode;
  defaulted: boolean;
  source: IntelligenceTrustResolutionSource;
  ownerLocalDefault: boolean;
  surfacePolicy: IntelligenceTrustMode;
  reason: string;
};

const VALID_TRUST_MODES = new Set<IntelligenceTrustMode>([
  'locked_down',
  'balanced',
  'local_owner',
  'developer_fast',
  'enterprise',
]);

export class IntelligenceTrustModePolicyService {
  public resolve(input: IntelligenceTrustModePolicyInput = {}): IntelligenceTrustModePolicySnapshot {
    const surface = normalizeToken(input.surface, 'conversation');
    const surfacePolicy = this.resolveSurfacePolicy(surface);
    const explicit = normalizeTrustMode(input.requestedTrustMode);
    if (explicit) {
      return this.snapshot({
        requested: explicit,
        defaulted: false,
        source: 'explicit',
        surfacePolicy,
        ownerLocalDefault: false,
        reason: `Explicit Intelligence Fabric trust mode '${explicit}' was supplied.`,
      });
    }

    const surfaceOverride = normalizeTrustMode(readSurfaceOverride(surface));
    if (surfaceOverride) {
      return this.snapshot({
        requested: surfaceOverride,
        defaulted: true,
        source: 'surface_policy',
        surfacePolicy: surfaceOverride,
        ownerLocalDefault: false,
        reason: `Surface policy override selected '${surfaceOverride}' for '${surface}'.`,
      });
    }

    const configuredDefault = normalizeTrustMode(process.env.ZAVORTH_INTELLIGENCE_FABRIC_TRUST_MODE);
    if (configuredDefault) {
      return this.snapshot({
        requested: configuredDefault,
        defaulted: true,
        source: 'config_default',
        surfacePolicy,
        ownerLocalDefault: false,
        reason: `Configured Intelligence Fabric default selected '${configuredDefault}'.`,
      });
    }

    if (isLocalOwner(input.userRole, surface)) {
      return this.snapshot({
        requested: 'local_owner',
        defaulted: true,
        source: 'owner_local_default',
        surfacePolicy,
        ownerLocalDefault: true,
        reason: 'Local owner default keeps thinking and reversible workspace work fast while hard blocks remain active.',
      });
    }

    return this.snapshot({
      requested: surfacePolicy,
      defaulted: true,
      source: 'surface_policy',
      surfacePolicy,
      ownerLocalDefault: false,
      reason: `Surface '${surface}' defaulted to '${surfacePolicy}'.`,
    });
  }

  public normalize(value: unknown): IntelligenceTrustMode | null {
    return normalizeTrustMode(value);
  }

  private snapshot(input: {
    requested: IntelligenceTrustMode;
    defaulted: boolean;
    source: IntelligenceTrustResolutionSource;
    ownerLocalDefault: boolean;
    surfacePolicy: IntelligenceTrustMode;
    reason: string;
  }): IntelligenceTrustModePolicySnapshot {
    return {
      requested: input.requested,
      legacy: IntelligenceRiskGateService.toLegacyTrustMode(input.requested),
      defaulted: input.defaulted,
      source: input.source,
      ownerLocalDefault: input.ownerLocalDefault,
      surfacePolicy: input.surfacePolicy,
      reason: input.reason,
    };
  }

  private resolveSurfacePolicy(surface: string): IntelligenceTrustMode {
    if (surface === 'api') return 'enterprise';
    if (surface === 'telegram' || surface === 'discord') return 'balanced';
    return 'local_owner';
  }
}

function normalizeTrustMode(value: unknown): IntelligenceTrustMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_TRUST_MODES.has(normalized as IntelligenceTrustMode)
    ? normalized as IntelligenceTrustMode
    : null;
}

function normalizeToken(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

function readSurfaceOverride(surface: string): string | null {
  const key = `ZAVORTH_INTELLIGENCE_FABRIC_TRUST_${surface.toUpperCase()}`;
  return process.env[key] || null;
}

function isLocalOwner(userRole: string | null | undefined, surface: string): boolean {
  const role = String(userRole || '').trim().toLowerCase();
  if (role === 'owner' || role === 'operator' || role === 'local_owner' || role === 'local-owner') {
    return true;
  }
  return !role && (surface === 'cli' || surface === 'web' || surface === 'conversation' || surface === 'unknown');
}
