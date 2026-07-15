import { createHash } from 'crypto';
import type {
  ZavorthMissionCompletionCriterion,
  ZavorthMissionDefinition,
  ZavorthMissionEvidence,
  ZavorthMissionEvidenceKind,
  ZavorthMissionVerificationReceipt,
  ZavorthMissionVerificationStatus,
} from '../contracts/runtime/ZavorthMissionContract.js';

export type ZavorthMissionValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const EVIDENCE_KINDS: ZavorthMissionEvidenceKind[] = [
  'test_result',
  'file_snapshot',
  'git_diff',
  'process_exit',
  'service_probe',
  'artifact_digest',
  'approval_record',
  'executor_claim',
];
const INDEPENDENT_OBSERVERS = ['verifier', 'runtime', 'policy_broker'] as const;
const STATUSES = ['passed', 'failed', 'observed'] as const;
const SHA256 = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

function validIsoDate(value: unknown): value is string {
  return nonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function validateCriterion(value: unknown, path: string, errors: string[]): value is ZavorthMissionCompletionCriterion {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }
  if (!nonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string.`);
  if (!nonEmptyString(value.description)) errors.push(`${path}.description must be a non-empty string.`);
  const kinds = value.requiredEvidence;
  if (
    !Array.isArray(kinds) ||
    kinds.length === 0 ||
    kinds.some((kind) => !EVIDENCE_KINDS.includes(kind as ZavorthMissionEvidenceKind) || kind === 'executor_claim')
  ) {
    errors.push(`${path}.requiredEvidence must contain supported independent evidence kinds.`);
  } else if (!unique(kinds as string[])) {
    errors.push(`${path}.requiredEvidence must not contain duplicates.`);
  }
  if (!Number.isSafeInteger(value.minimumEvidenceCount) || Number(value.minimumEvidenceCount) < 1) {
    errors.push(`${path}.minimumEvidenceCount must be a positive integer.`);
  }
  return errors.length === 0;
}

/** Validates an untrusted mission definition before execution or persistence. */
export function validateZavorthMissionDefinition(
  value: unknown,
): ZavorthMissionValidationResult<ZavorthMissionDefinition> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['Mission definition must be an object.'] };
  if (!nonEmptyString(value.objective)) errors.push('objective must be a non-empty string.');
  if (!nonEmptyString(value.expectedOutcome)) errors.push('expectedOutcome must be a non-empty string.');
  if (!Array.isArray(value.completionCriteria) || value.completionCriteria.length === 0) {
    errors.push('completionCriteria must contain at least one criterion.');
  } else {
    value.completionCriteria.forEach((criterion, index) =>
      validateCriterion(criterion, `completionCriteria[${index}]`, errors),
    );
    const ids = value.completionCriteria
      .filter(isRecord)
      .map((criterion) => criterion.id)
      .filter(nonEmptyString);
    if (!unique(ids)) errors.push('completionCriteria ids must be unique.');
  }
  if (!isRecord(value.boundaries)) {
    errors.push('boundaries must be an object.');
  } else {
    const boundary = value.boundaries;
    for (const field of ['workspaceRoots', 'allowedFilePatterns', 'deniedFilePatterns', 'allowedServices'] as const) {
      if (!stringArray(boundary[field])) errors.push(`boundaries.${field} must be an array of non-empty strings.`);
    }
    if (!['denied', 'read_only', 'approved_writes'].includes(String(boundary.networkAccess))) {
      errors.push('boundaries.networkAccess is invalid.');
    }
    if (
      boundary.maximumDurationMs !== null &&
      (!Number.isSafeInteger(boundary.maximumDurationMs) || Number(boundary.maximumDurationMs) < 1)
    ) {
      errors.push('boundaries.maximumDurationMs must be null or a positive integer.');
    }
  }
  if (
    !Array.isArray(value.approvalRequirements) ||
    value.approvalRequirements.some(
      (entry) =>
        !isRecord(entry) ||
        !nonEmptyString(entry.id) ||
        !nonEmptyString(entry.description) ||
        !nonEmptyString(entry.requiredBefore),
    )
  ) {
    errors.push('approvalRequirements must contain valid approval requirements.');
  }
  for (const field of ['verificationRequirements', 'stopConditions'] as const) {
    if (!stringArray(value[field])) errors.push(`${field} must be an array of non-empty strings.`);
  }
  if (value.rollbackPlan !== null && !nonEmptyString(value.rollbackPlan)) {
    errors.push('rollbackPlan must be null or a non-empty string.');
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: value as ZavorthMissionDefinition };
}

/** Validates evidence captured by runtime components or supplied to a verifier. */
export function validateZavorthMissionEvidence(value: unknown): ZavorthMissionValidationResult<ZavorthMissionEvidence> {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['Mission evidence must be an object.'] };
  if (!nonEmptyString(value.id)) errors.push('id must be a non-empty string.');
  if (!nonEmptyString(value.criterionId)) errors.push('criterionId must be a non-empty string.');
  if (!EVIDENCE_KINDS.includes(value.kind as ZavorthMissionEvidenceKind)) errors.push('kind is invalid.');
  if (![...INDEPENDENT_OBSERVERS, 'executor'].includes(value.observedBy as never))
    errors.push('observedBy is invalid.');
  if (!validIsoDate(value.capturedAt)) errors.push('capturedAt must be an ISO-compatible date.');
  if (!STATUSES.includes(value.status as never)) errors.push('status is invalid.');
  if (!nonEmptyString(value.summary)) errors.push('summary must be a non-empty string.');
  if (value.digest !== null && (typeof value.digest !== 'string' || !SHA256.test(value.digest))) {
    errors.push('digest must be null or a lowercase SHA-256 digest.');
  }
  if (
    !isRecord(value.details) ||
    Object.values(value.details).some(
      (detail) => detail !== null && !['string', 'number', 'boolean'].includes(typeof detail),
    )
  ) {
    errors.push('details must contain only scalar JSON values.');
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: value as ZavorthMissionEvidence };
}

function digestEvidence(evidence: ZavorthMissionEvidence[]): string {
  const canonical = evidence
    .map((item) => ({
      ...item,
      details: Object.fromEntries(Object.entries(item.details).sort(([a], [b]) => a.localeCompare(b))),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function criterionStatus(
  accepted: ZavorthMissionEvidence[],
  criterion: ZavorthMissionCompletionCriterion,
): ZavorthMissionVerificationStatus {
  if (accepted.some((evidence) => evidence.status === 'failed')) return 'failed';
  const kinds = new Set(accepted.map((evidence) => evidence.kind));
  const hasAllKinds = criterion.requiredEvidence.every((kind) => kinds.has(kind));
  return hasAllKinds && accepted.length >= criterion.minimumEvidenceCount ? 'verified' : 'inconclusive';
}

/** Produces a receipt from independently observed evidence; executor claims are always rejected. */
export function verifyZavorthMission(input: {
  missionId: string;
  definition: unknown;
  evidence: unknown[];
  verifiedAt?: string;
}): ZavorthMissionVerificationReceipt {
  if (!nonEmptyString(input.missionId)) throw new TypeError('missionId must be a non-empty string.');
  const definition = validateZavorthMissionDefinition(input.definition);
  if (!definition.ok) {
    const errors = 'errors' in definition ? definition.errors : ['Unknown validation error.'];
    throw new TypeError(`Invalid mission definition: ${errors.join(' ')}`);
  }
  const verifiedAt = input.verifiedAt ?? new Date().toISOString();
  if (!validIsoDate(verifiedAt)) throw new TypeError('verifiedAt must be an ISO-compatible date.');

  const validEvidence = input.evidence.flatMap((candidate) => {
    const result = validateZavorthMissionEvidence(candidate);
    return result.ok ? [result.value] : [];
  });
  const criteria = definition.value.completionCriteria.map((criterion) => {
    const related = validEvidence.filter((item) => item.criterionId === criterion.id);
    const accepted = related.filter(
      (item) =>
        item.kind !== 'executor_claim' && (INDEPENDENT_OBSERVERS as readonly string[]).includes(item.observedBy),
    );
    const rejected = related.filter((item) => !accepted.includes(item));
    const status = criterionStatus(accepted, criterion);
    const reason =
      status === 'verified'
        ? 'Required independent evidence was observed.'
        : status === 'failed'
          ? 'Independent evidence reported a failed check.'
          : 'Required independent evidence is incomplete.';
    return {
      criterionId: criterion.id,
      status,
      acceptedEvidenceIds: accepted.map((item) => item.id),
      rejectedEvidenceIds: rejected.map((item) => item.id),
      reason,
    };
  });
  const status: ZavorthMissionVerificationStatus = criteria.some((criterion) => criterion.status === 'failed')
    ? 'failed'
    : criteria.every((criterion) => criterion.status === 'verified')
      ? 'verified'
      : 'inconclusive';
  return {
    schemaVersion: 1,
    surface: 'mission-verification',
    missionId: input.missionId,
    verifiedAt,
    status,
    criteria,
    evidenceDigest: digestEvidence(validEvidence),
    executorClaimsAccepted: false,
  };
}
