import crypto from 'node:crypto';
import {
  ZAVORTH_PROFILE_ENFORCEMENT_RECEIPT_VERSION,
  type ProfileEnforcementReceipt,
  type ProfileEnforcementReceiptDecision,
  type ProfileEnforcementReceiptKind,
  type RuntimePolicyBundle,
  type SurfaceExperienceBundle,
} from '../contracts/ProfileManifestContract.js';

export type BuildProfileEnforcementReceiptInput = {
  profileId: string;
  bundleChecksum: string;
  kind: ProfileEnforcementReceiptKind;
  subject: string;
  decision: ProfileEnforcementReceiptDecision;
  summary: string;
  surface?: string | null;
  details?: Record<string, unknown> | null;
  createdAt?: Date | string | null;
};

export class ProfileEnforcementReceiptService {
  public build(input: BuildProfileEnforcementReceiptInput): ProfileEnforcementReceipt {
    const createdAt = input.createdAt instanceof Date
      ? input.createdAt.toISOString()
      : normalizeText(input.createdAt, new Date().toISOString());
    const payload = {
      profileId: input.profileId,
      bundleChecksum: input.bundleChecksum,
      kind: input.kind,
      subject: input.subject,
      decision: input.decision,
      surface: input.surface || null,
      details: input.details || {},
    };
    return {
      contractVersion: ZAVORTH_PROFILE_ENFORCEMENT_RECEIPT_VERSION,
      id: `profile-enforcement:${input.profileId}:${input.kind}:${stableHash(payload).slice(0, 16)}`,
      profileId: input.profileId,
      bundleChecksum: input.bundleChecksum,
      kind: input.kind,
      subject: input.subject,
      decision: input.decision,
      summary: input.summary,
      surface: input.surface || null,
      details: Object.freeze({ ...(input.details || {}) }),
      createdAt,
    };
  }

  public fromSurface(input: {
    bundle: SurfaceExperienceBundle;
    activeSurface: string;
    surfaceAllowed: boolean;
    allowedSurfaces: string[];
    createdAt?: Date | string | null;
  }): ProfileEnforcementReceipt {
    return this.build({
      profileId: input.bundle.profileId,
      bundleChecksum: input.bundle.checksum,
      kind: 'surface_projection',
      subject: input.activeSurface,
      decision: input.surfaceAllowed ? 'allowed' : 'blocked',
      surface: input.activeSurface,
      summary: input.surfaceAllowed
        ? `Profile ${input.bundle.profileId} allowed surface ${input.activeSurface}.`
        : `Profile ${input.bundle.profileId} blocked surface ${input.activeSurface}.`,
      details: {
        defaultSurface: input.bundle.defaultSurface,
        allowedSurfaces: input.allowedSurfaces,
        sourceIds: input.bundle.sourceIds,
      },
      createdAt: input.createdAt,
    });
  }

  public fromToolExposure(input: {
    runtimePolicy: RuntimePolicyBundle;
    toolName: string;
    aliases: string[];
    decision: 'allowed' | 'hidden' | 'requires_approval';
    reason: string;
    runId?: string | null;
    createdAt?: Date | string | null;
  }): ProfileEnforcementReceipt {
    return this.build({
      profileId: input.runtimePolicy.profileId,
      bundleChecksum: input.runtimePolicy.checksum,
      kind: input.decision === 'requires_approval' ? 'approval_gate' : 'tool_exposure',
      subject: input.toolName,
      decision: input.decision,
      summary: `Profile ${input.runtimePolicy.profileId} ${input.decision.replace('_', ' ')} tool ${input.toolName}.`,
      details: {
        runId: input.runId || null,
        aliases: input.aliases,
        reason: input.reason,
        trustMode: input.runtimePolicy.trustMode,
        approvalMode: input.runtimePolicy.approvalMode,
        sandboxMode: input.runtimePolicy.sandboxMode,
      },
      createdAt: input.createdAt,
    });
  }

  public fromRuntimeLimit(input: {
    runtimePolicy: RuntimePolicyBundle;
    subject: 'maxToolRounds' | 'maxDeniedAttempts';
    value: number;
    fallback: number;
    runId?: string | null;
    createdAt?: Date | string | null;
  }): ProfileEnforcementReceipt {
    return this.build({
      profileId: input.runtimePolicy.profileId,
      bundleChecksum: input.runtimePolicy.checksum,
      kind: input.subject === 'maxToolRounds' ? 'runtime_limit' : 'policy_denial_limit',
      subject: input.subject,
      decision: 'limited',
      summary: `Profile ${input.runtimePolicy.profileId} set ${input.subject} to ${input.value}.`,
      details: {
        runId: input.runId || null,
        value: input.value,
        fallback: input.fallback,
        trustMode: input.runtimePolicy.trustMode,
      },
      createdAt: input.createdAt,
    });
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function stableHash(value: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
