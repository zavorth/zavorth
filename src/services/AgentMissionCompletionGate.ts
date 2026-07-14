/**
 * Mission completion is never granted from executor narrative alone.
 * Independent verification must pass before status can become `completed`.
 */

import type {
  ZavorthMissionDefinition,
  ZavorthMissionEvidence,
  ZavorthMissionStatus,
  ZavorthMissionVerificationReceipt,
} from '../contracts/runtime/ZavorthMissionContract.js';
import {
  validateZavorthMissionDefinition,
  verifyZavorthMission,
} from './ZavorthMissionVerificationService.js';

export type MissionCompletionGateInput = {
  missionId: string;
  definition: unknown;
  evidence: unknown[];
  /** Status the caller wants to set (e.g. completed). */
  proposedStatus: ZavorthMissionStatus | string;
  verifiedAt?: string;
};

export type MissionCompletionGateResult = {
  allowedStatus: ZavorthMissionStatus | string;
  verification: ZavorthMissionVerificationReceipt | null;
  blocked: boolean;
  reason: string;
};

/**
 * If the caller proposes `completed`, only allow it when verifyZavorthMission returns verified.
 * Missing/invalid definition or incomplete evidence → inconclusive (not completed).
 */
export function gateMissionCompletion(input: MissionCompletionGateInput): MissionCompletionGateResult {
  const proposed = String(input.proposedStatus || '').trim().toLowerCase();
  if (proposed !== 'completed') {
    return {
      allowedStatus: input.proposedStatus,
      verification: null,
      blocked: false,
      reason: 'non_completed_status_passthrough',
    };
  }

  const definitionCheck = validateZavorthMissionDefinition(input.definition);
  if (!definitionCheck.ok) {
    return {
      allowedStatus: 'blocked',
      verification: null,
      blocked: true,
      reason: `Mission cannot complete without a valid definition: ${definitionCheck.errors.join(' ')}`,
    };
  }

  try {
    const verification = verifyZavorthMission({
      missionId: input.missionId,
      definition: definitionCheck.value,
      evidence: input.evidence || [],
      verifiedAt: input.verifiedAt,
    });
    if (verification.status === 'verified') {
      return {
        allowedStatus: 'completed',
        verification,
        blocked: false,
        reason: 'independent_evidence_verified',
      };
    }
    return {
      allowedStatus: verification.status === 'failed' ? 'blocked' : 'ready',
      verification,
      blocked: true,
      reason: verification.status === 'failed'
        ? 'Independent evidence reported failure; mission is not completed.'
        : 'Required independent evidence is incomplete; mission stays inconclusive (not completed).',
    };
  } catch (error: unknown) {
    return {
      allowedStatus: 'blocked',
      verification: null,
      blocked: true,
      reason: error instanceof Error ? error.message : 'Mission verification failed.',
    };
  }
}

/** Convenience for agent runs that carry mission definition + evidence in metadata. */
export function gateRunCompletionFromMetadata(input: {
  runId: string;
  proposedStatus: string;
  metadata: Record<string, unknown> | null | undefined;
}): MissionCompletionGateResult {
  const meta = input.metadata || {};
  const definition = meta.missionDefinition || meta.definition || null;
  const evidence = Array.isArray(meta.missionEvidence)
    ? meta.missionEvidence
    : Array.isArray(meta.evidence)
      ? meta.evidence
      : [];
  if (!definition) {
    // Not a governed mission — leave status as proposed.
    return {
      allowedStatus: input.proposedStatus,
      verification: null,
      blocked: false,
      reason: 'no_mission_definition_on_run',
    };
  }
  return gateMissionCompletion({
    missionId: String(meta.missionId || input.runId),
    definition,
    evidence,
    proposedStatus: input.proposedStatus,
  });
}

export type { ZavorthMissionDefinition, ZavorthMissionEvidence };
