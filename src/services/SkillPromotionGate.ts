import crypto from 'crypto';
import {
  OperatorContinuityKernel,
  type OperatorContinuityEnvelope,
} from '../runtime/operator/OperatorContinuityEnvelope.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import {
  ZavorthSkillEvolutionRegistryService,
  type ZavorthEvolvedSkillRecord,
} from './ZavorthSkillEvolutionRegistryService.js';
import {
  ZavorthSkillEvolutionService,
  type ZavorthSkillEvolutionApplyResult,
  type ZavorthSkillEvolutionPreview,
  type ZavorthSkillEvolutionPreviewInput,
  type ZavorthSkillEvolutionRollbackResult,
} from './ZavorthSkillEvolutionService.js';

export type SkillPromotionGateStatus =
  | 'materialized'
  | 'preview-ready'
  | 'waiting_approval'
  | 'installed'
  | 'rejected'
  | 'blocked'
  | 'rolled_back';

export type SkillPromotionGateResult = {
  generatedAt: string;
  status: SkillPromotionGateStatus;
  ok: boolean;
  summary: string;
  details: string[];
  candidateId: string | null;
  record: ZavorthEvolvedSkillRecord | null;
  mutationPlanId: string | null;
  approvalId: string | null;
  silentInstallBlocked: true;
  installed: boolean;
  continuity: OperatorContinuityEnvelope;
  evolution:
    | ZavorthSkillEvolutionPreview
    | ZavorthSkillEvolutionApplyResult
    | ZavorthSkillEvolutionRollbackResult
    | null;
};

export type SkillPromotionMaterializeInput = {
  intentText: string;
  candidateKind?: string | null;
  runId?: string | null;
  sessionId?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  approvalRequired?: boolean;
  suggestedCommand?: string | null;
  demonstration?: string | null;
};

export type SkillPromotionGateRuntime = {
  now?: () => Date;
  createId?: () => string;
  evolutionService?: Pick<
    ZavorthSkillEvolutionService,
    'preview' | 'apply' | 'rollback' | 'buildSnapshot'
  > | null;
  registryService?: Pick<
    ZavorthSkillEvolutionRegistryService,
    'listRecords' | 'getRecord' | 'upsertRecord' | 'updateRecord'
  > | null;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'readPlan' | 'approvePlan' | 'rejectPlan' | 'markBlocked'
  > | null;
  continuityKernel?: OperatorContinuityKernel | null;
};

const INTENT_NOTE_PREFIX = 'intent:';

export class SkillPromotionGate {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly evolution: Pick<
    ZavorthSkillEvolutionService,
    'preview' | 'apply' | 'rollback' | 'buildSnapshot'
  >;
  private readonly registry: Pick<
    ZavorthSkillEvolutionRegistryService,
    'listRecords' | 'getRecord' | 'upsertRecord' | 'updateRecord'
  >;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'readPlan' | 'approvePlan' | 'rejectPlan' | 'markBlocked'
  >;
  private readonly continuity: OperatorContinuityKernel;

  constructor(runtime: SkillPromotionGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.createId = runtime.createId || (() => crypto.randomUUID());
    this.evolution = runtime.evolutionService || new ZavorthSkillEvolutionService();
    this.registry = runtime.registryService || new ZavorthSkillEvolutionRegistryService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.continuity = runtime.continuityKernel || new OperatorContinuityKernel({
      now: this.now,
      createId: this.createId,
    });
  }

  public materializeCandidate(input: SkillPromotionMaterializeInput): SkillPromotionGateResult {
    const intentText = this.cleanText(input.intentText);
    const surface = input.sourceSurface || 'agent-run';
    let envelope = this.beginRequest({
      surface,
      operation: 'skill.promotion.materialize',
      target: intentText ? this.compact(intentText, 64) : '<empty-intent>',
      actorId: input.requestedBy || null,
      sourceSurface: surface,
      metadata: {
        candidateKind: input.candidateKind || null,
        runId: input.runId || null,
      },
    });

    if (!intentText) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: 'Skill promotion materialize blocked: intentText is required.',
        details: ['No registry record was written.'],
        candidateId: null,
        record: null,
        mutationPlanId: null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'materialize',
          allowed: false,
          rule: 'intent-required',
          reasons: ['intentText is required'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    const redactedIntent = this.redactSensitiveText(intentText);
    const skillName = this.normalizeSkillName(redactedIntent);
    // Persist and hash the redacted intent so later preview reuses the same draft id
    // as ZavorthSkillEvolutionService.synthesizeSkill when given the same text.
    const intentHash = this.hash(redactedIntent);
    const candidateId = `skill-draft:${skillName}:${intentHash.slice(0, 10)}`;
    const existing = this.registry.getRecord(candidateId);
    const createdAt = existing?.createdAt || this.now().toISOString();
    const candidateKind = String(input.candidateKind || 'auto-skill').trim() || 'auto-skill';
    const kind = candidateKind === 'procedure' ? 'procedure' as const : 'skill-draft' as const;
    const record = this.registry.upsertRecord({
      id: candidateId,
      skillName,
      version: existing?.version || '0.1.0',
      status: existing?.status && existing.status !== 'rolled_back' ? existing.status : 'draft',
      kind,
      createdAt,
      updatedAt: this.now().toISOString(),
      requestedBy: input.requestedBy || existing?.requestedBy || null,
      sourceSurface: surface,
      intentHash,
      draftDirPath: existing?.draftDirPath || '',
      targetDirPath: existing?.targetDirPath || null,
      skillFilePath: existing?.skillFilePath || null,
      riskLevel: existing?.riskLevel || 'medium',
      mutationPlanId: existing?.mutationPlanId || null,
      permissionId: existing?.permissionId || null,
      sandboxEvidenceId: existing?.sandboxEvidenceId || null,
      evalGateStatus: existing?.evalGateStatus || null,
      artifact: existing?.artifact || {
        id: `learning:${candidateId}`,
        kind: kind === 'procedure' ? 'procedure' : 'skill-draft',
        status: 'draft',
        createdAt,
        updatedAt: this.now().toISOString(),
        source: {
          domain: 'skill-evolution',
          surface,
          requestedBy: input.requestedBy || null,
          originRef: input.runId ? `run:${input.runId}` : `intent:${intentHash.slice(0, 16)}`,
        },
        subject: {
          name: skillName,
          version: '0.1.0',
          summary: this.firstSentence(redactedIntent),
          riskLevel: 'medium',
        },
        evidence: [],
        retention: {
          ttlMs: 30 * 24 * 60 * 60 * 1000,
          maxBytes: 25 * 1024 * 1024,
          cleanupOnSuccess: false,
          cleanupOnBoot: false,
          notes: ['Materialized candidates are local and not installed until approved.'],
        },
        redaction: {
          rawTranscriptPersisted: false,
          rawSecretsPersisted: false,
          notes: ['Intent is redacted before registry persistence.'],
        },
        hashes: {
          intentHash,
          contentHash: intentHash,
        },
      },
      rollback: existing?.rollback || {
        installedAt: null,
        targetDirPath: null,
        backupDirPath: null,
        policySnapshotBefore: null,
        policySnapshotAfter: null,
        rolledBackAt: null,
      },
      notes: this.mergeNotes(existing?.notes || [], [
        'Materialized from agent.skill.evolution.candidate signal.',
        `candidateKind=${candidateKind}`,
        `${INTENT_NOTE_PREFIX}${redactedIntent}`,
        input.suggestedCommand ? `suggestedCommand=${input.suggestedCommand}` : '',
        input.runId ? `runId=${input.runId}` : '',
        'silentInstallBlocked=true; no auto-install.',
      ]),
    });

    envelope = this.continuity.correlate(envelope, {
      runId: input.runId || null,
      sessionId: input.sessionId || null,
      mutationPlanId: record.mutationPlanId,
    });

    return this.finalize({
      envelope,
      status: 'materialized',
      ok: true,
      summary: `Skill candidate ${record.id} persisted in evolution registry (not installed).`,
      details: [
        `status=${record.status}`,
        `skill=${record.skillName}`,
        'Install requires explicit approvalId and mutation plan approval.',
      ],
      candidateId: record.id,
      record,
      mutationPlanId: record.mutationPlanId,
      approvalId: null,
      installed: record.status === 'trusted_local',
      decision: {
        source: 'mutation-plane',
        action: 'materialize',
        allowed: true,
        rule: 'registry-persist-only',
        reasons: ['Candidate stored without install.'],
        requiresApproval: input.approvalRequired !== false,
        mutationPlanId: record.mutationPlanId,
      },
      resultStatus: 'preview',
    });
  }

  public async preview(
    candidateId: string,
    options: { requestedBy?: string | null; sourceSurface?: string | null; retest?: boolean } = {},
  ): Promise<SkillPromotionGateResult> {
    const id = this.cleanText(candidateId);
    let envelope = this.beginRequest({
      surface: options.sourceSurface || 'cli',
      operation: 'skill.promotion.preview',
      target: id || '<missing-candidate>',
      actorId: options.requestedBy || null,
      sourceSurface: options.sourceSurface || 'cli',
    });

    const record = id ? this.registry.getRecord(id) : null;
    if (!record) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Skill promotion candidate not found: ${id || 'n/d'}.`,
        details: ['Materialize a candidate first or pass a valid candidateId.'],
        candidateId: id || null,
        record: null,
        mutationPlanId: null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'preview',
          allowed: false,
          rule: 'candidate-not-found',
          reasons: ['candidate missing'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    if (
      !options.retest
      && record.status === 'waiting_approval'
      && record.mutationPlanId
    ) {
      const plan = this.mutationPlane.readPlan(record.mutationPlanId);
      envelope = this.continuity.correlate(envelope, {
        mutationPlanId: record.mutationPlanId,
      });
      return this.finalize({
        envelope,
        status: 'waiting_approval',
        ok: false,
        summary: `Candidate ${record.id} already tested; install waits for approval on plan ${record.mutationPlanId}.`,
        details: [
          `skill=${record.skillName}`,
          plan ? `planStatus=${plan.status}` : 'plan missing',
          'No files were installed.',
        ],
        candidateId: record.id,
        record,
        mutationPlanId: record.mutationPlanId,
        approvalId: record.permissionId,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'preview',
          allowed: true,
          rule: 'awaiting-approval',
          reasons: ['Mutation plan already pending approval.'],
          requiresApproval: true,
          mutationPlanId: record.mutationPlanId,
        },
        resultStatus: 'approval_required',
      });
    }

    const intentText = this.extractIntent(record);
    if (!intentText) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Candidate ${record.id} has no recoverable intent for preview.`,
        details: ['Re-materialize with intentText or create a fresh evolution preview.'],
        candidateId: record.id,
        record,
        mutationPlanId: record.mutationPlanId,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'preview',
          allowed: false,
          rule: 'intent-missing',
          reasons: ['no recoverable intent'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    const evolution = await this.evolution.preview({
      intentText,
      requestedBy: options.requestedBy || record.requestedBy,
      sourceSurface: options.sourceSurface || record.sourceSurface || 'skill-promotion-gate',
      procedureOnly: record.kind === 'procedure',
    });
    const next = evolution.record;
    envelope = this.continuity.correlate(envelope, {
      mutationPlanId: next.mutationPlanId,
    });

    const status: SkillPromotionGateStatus = evolution.status === 'waiting_approval'
      ? 'waiting_approval'
      : evolution.status === 'blocked'
        ? 'blocked'
        : evolution.status === 'procedure_only'
          ? 'preview-ready'
          : 'preview-ready';

    return this.finalize({
      envelope,
      status,
      ok: evolution.status !== 'blocked',
      summary: evolution.summary,
      details: evolution.details,
      candidateId: next.id,
      record: next,
      mutationPlanId: next.mutationPlanId,
      approvalId: next.permissionId,
      installed: false,
      evolution,
      decision: {
        source: 'mutation-plane',
        action: 'preview',
        allowed: evolution.status !== 'blocked',
        rule: evolution.status === 'waiting_approval' ? 'awaiting-approval' : `preview-${evolution.status}`,
        reasons: evolution.details.slice(0, 6),
        requiresApproval: true,
        mutationPlanId: next.mutationPlanId,
      },
      resultStatus: evolution.status === 'waiting_approval'
        ? 'approval_required'
        : evolution.status === 'blocked'
          ? 'blocked'
          : 'preview',
    });
  }

  public reject(
    candidateId: string,
    reason: string,
    options: { requestedBy?: string | null; sourceSurface?: string | null } = {},
  ): SkillPromotionGateResult {
    const id = this.cleanText(candidateId);
    const rejectReason = this.cleanText(reason) || 'Rejected by operator.';
    let envelope = this.beginRequest({
      surface: options.sourceSurface || 'cli',
      operation: 'skill.promotion.reject',
      target: id || '<missing-candidate>',
      actorId: options.requestedBy || null,
      sourceSurface: options.sourceSurface || 'cli',
      metadata: { reason: rejectReason },
    });

    const current = id ? this.registry.getRecord(id) : null;
    if (!current) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Skill promotion candidate not found: ${id || 'n/d'}.`,
        details: [rejectReason],
        candidateId: id || null,
        record: null,
        mutationPlanId: null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'reject',
          allowed: false,
          rule: 'candidate-not-found',
          reasons: ['candidate missing'],
          requiresApproval: false,
        },
        resultStatus: 'blocked',
      });
    }

    if (current.mutationPlanId) {
      try {
        this.mutationPlane.rejectPlan(current.mutationPlanId, rejectReason, options.requestedBy || null);
      } catch {
        try {
          this.mutationPlane.markBlocked(current.mutationPlanId, rejectReason);
        } catch {
          // Plan may already be terminal; registry rejection still proceeds.
        }
      }
    }

    const record = this.registry.upsertRecord({
      ...current,
      status: 'blocked',
      notes: this.mergeNotes(current.notes, [
        `Rejected by ${options.requestedBy || 'operator'}: ${rejectReason}`,
      ]),
      artifact: {
        ...current.artifact,
        status: 'blocked',
        updatedAt: this.now().toISOString(),
      },
    });

    envelope = this.continuity.correlate(envelope, {
      mutationPlanId: record.mutationPlanId,
    });

    return this.finalize({
      envelope,
      status: 'rejected',
      ok: true,
      summary: `Candidate ${record.id} rejected; install path closed.`,
      details: [rejectReason, 'No skill files were installed.'],
      candidateId: record.id,
      record,
      mutationPlanId: record.mutationPlanId,
      approvalId: null,
      installed: false,
      decision: {
        source: 'mutation-plane',
        action: 'reject',
        allowed: true,
        rule: 'operator-reject',
        reasons: [rejectReason],
        requiresApproval: false,
        mutationPlanId: record.mutationPlanId,
      },
      resultStatus: 'blocked',
    });
  }

  public async apply(input: {
    candidateId: string;
    approvalId?: string | null;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): Promise<SkillPromotionGateResult> {
    const candidateId = this.cleanText(input.candidateId);
    const approvalId = this.cleanText(input.approvalId || '');
    let envelope = this.beginRequest({
      surface: input.sourceSurface || 'cli',
      operation: 'skill.promotion.apply',
      target: candidateId || '<missing-candidate>',
      actorId: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'cli',
      metadata: {
        approvalId: approvalId || null,
        silentInstallBlocked: true,
      },
    });

    if (!candidateId) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: 'Skill promotion apply blocked: candidateId is required.',
        details: ['No install attempted.'],
        candidateId: null,
        record: null,
        mutationPlanId: null,
        approvalId: approvalId || null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: false,
          rule: 'candidate-required',
          reasons: ['candidateId missing'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    if (!approvalId) {
      const record = this.registry.getRecord(candidateId);
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Install blocked for ${candidateId}: approvalId is required (silent install disabled).`,
        details: [
          'silentInstallBlocked=true',
          'Provide a mutation-plan approvalId after operator approval.',
          'No skill files were installed.',
        ],
        candidateId,
        record,
        mutationPlanId: record?.mutationPlanId || null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: false,
          rule: 'approval-id-required',
          reasons: ['approvalId required', 'silentInstallBlocked'],
          requiresApproval: true,
          mutationPlanId: record?.mutationPlanId || null,
        },
        resultStatus: 'blocked',
      });
    }

    let record = this.registry.getRecord(candidateId);
    if (!record) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Skill promotion candidate not found: ${candidateId}.`,
        details: ['No install attempted.'],
        candidateId,
        record: null,
        mutationPlanId: null,
        approvalId,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: false,
          rule: 'candidate-not-found',
          reasons: ['candidate missing'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    if (record.status === 'trusted_local') {
      return this.finalize({
        envelope,
        status: 'installed',
        ok: true,
        summary: `Candidate ${record.id} is already installed as trusted_local.`,
        details: record.targetDirPath ? [`target=${record.targetDirPath}`] : [],
        candidateId: record.id,
        record,
        mutationPlanId: record.mutationPlanId,
        approvalId,
        installed: true,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: true,
          rule: 'already-installed',
          reasons: ['record already trusted_local'],
          requiresApproval: false,
          mutationPlanId: record.mutationPlanId,
        },
        resultStatus: 'applied',
      });
    }

    if (!record.mutationPlanId || record.status !== 'waiting_approval') {
      const previewed = await this.preview(candidateId, {
        requestedBy: input.requestedBy,
        sourceSurface: input.sourceSurface || 'skill-promotion-gate',
        retest: true,
      });
      record = previewed.record;
      if (!record || !record.mutationPlanId || record.status !== 'waiting_approval') {
        return this.finalize({
          envelope: previewed.continuity,
          status: 'blocked',
          ok: false,
          summary: `Candidate ${candidateId} is not ready for approved install.`,
          details: [
            ...(previewed.details || []),
            'Preview must produce a waiting_approval mutation plan before apply.',
          ],
          candidateId,
          record,
          mutationPlanId: record?.mutationPlanId || null,
          approvalId,
          installed: false,
          evolution: previewed.evolution,
          decision: {
            source: 'mutation-plane',
            action: 'install-learned-skill',
            allowed: false,
            rule: 'not-waiting-approval',
            reasons: ['candidate not install-ready'],
            requiresApproval: true,
            mutationPlanId: record?.mutationPlanId || null,
          },
          resultStatus: 'blocked',
        });
      }
    }

    try {
      this.mutationPlane.approvePlan(record.mutationPlanId!, {
        permissionId: approvalId,
        approvedBy: input.requestedBy || null,
        scope: 'once',
      });
    } catch (error: unknown) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: `Failed to attach approval to plan ${record.mutationPlanId}.`,
        details: [error instanceof Error ? error.message : String(error)],
        candidateId: record.id,
        record,
        mutationPlanId: record.mutationPlanId,
        approvalId,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: false,
          rule: 'approval-attach-failed',
          reasons: [error instanceof Error ? error.message : String(error)],
          requiresApproval: true,
          mutationPlanId: record.mutationPlanId,
        },
        resultStatus: 'failed',
      });
    }

    const evolution = await this.evolution.apply({
      planId: record.mutationPlanId!,
      requestedBy: input.requestedBy || null,
    });

    envelope = this.continuity.correlate(envelope, {
      mutationPlanId: evolution.mutationPlan?.id || record.mutationPlanId,
    });

    if (!evolution.ok || evolution.status !== 'installed') {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: evolution.summary,
        details: evolution.details,
        candidateId: evolution.record.id,
        record: evolution.record,
        mutationPlanId: evolution.mutationPlan?.id || record.mutationPlanId,
        approvalId,
        installed: false,
        evolution,
        decision: {
          source: 'mutation-plane',
          action: 'install-learned-skill',
          allowed: false,
          rule: 'install-blocked',
          reasons: evolution.details.slice(0, 6),
          requiresApproval: true,
          mutationPlanId: evolution.mutationPlan?.id || record.mutationPlanId,
        },
        resultStatus: 'blocked',
      });
    }

    return this.finalize({
      envelope,
      status: 'installed',
      ok: true,
      summary: evolution.summary,
      details: evolution.details,
      candidateId: evolution.record.id,
      record: evolution.record,
      mutationPlanId: evolution.mutationPlan?.id || record.mutationPlanId,
      approvalId,
      installed: true,
      evolution,
      decision: {
        source: 'mutation-plane',
        action: 'install-learned-skill',
        allowed: true,
        rule: 'approved-install',
        reasons: ['approvalId provided', 'mutation plan approved', 'install applied'],
        requiresApproval: false,
        mutationPlanId: evolution.mutationPlan?.id || record.mutationPlanId,
      },
      resultStatus: 'applied',
    });
  }

  public rollback(input: {
    candidateId: string;
    requestedBy?: string | null;
    sourceSurface?: string | null;
  }): SkillPromotionGateResult {
    const candidateId = this.cleanText(input.candidateId);
    let envelope = this.beginRequest({
      surface: input.sourceSurface || 'cli',
      operation: 'skill.promotion.rollback',
      target: candidateId || '<missing-candidate>',
      actorId: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'cli',
    });

    if (!candidateId) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: 'Rollback blocked: candidateId is required.',
        details: [],
        candidateId: null,
        record: null,
        mutationPlanId: null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'rollback',
          allowed: false,
          rule: 'candidate-required',
          reasons: ['candidateId missing'],
          requiresApproval: false,
        },
        resultStatus: 'blocked',
      });
    }

    const evolution = this.evolution.rollback({
      draftId: candidateId,
      requestedBy: input.requestedBy || null,
    });

    envelope = this.continuity.correlate(envelope, {
      mutationPlanId: evolution.record.mutationPlanId,
    });

    return this.finalize({
      envelope,
      status: evolution.status === 'rolled_back' ? 'rolled_back' : 'blocked',
      ok: evolution.ok,
      summary: evolution.summary,
      details: evolution.details,
      candidateId: evolution.record.id,
      record: evolution.record,
      mutationPlanId: evolution.record.mutationPlanId,
      approvalId: null,
      installed: false,
      evolution,
      decision: {
        source: 'mutation-plane',
        action: 'rollback',
        allowed: evolution.ok,
        rule: evolution.status === 'rolled_back' ? 'rolled-back' : 'rollback-blocked',
        reasons: evolution.details.slice(0, 6),
        requiresApproval: false,
        mutationPlanId: evolution.record.mutationPlanId,
      },
      resultStatus: evolution.ok ? 'applied' : 'blocked',
    });
  }

  public async dryPreviewFromIntent(
    input: ZavorthSkillEvolutionPreviewInput,
  ): Promise<SkillPromotionGateResult> {
    const intentText = this.cleanText(input.intentText);
    let envelope = this.beginRequest({
      surface: input.sourceSurface || 'agent-run',
      operation: 'skill.promotion.dry-preview',
      target: intentText ? this.compact(intentText, 64) : '<empty-intent>',
      actorId: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'agent-run',
    });

    if (!intentText) {
      return this.finalize({
        envelope,
        status: 'blocked',
        ok: false,
        summary: 'Dry preview blocked: intentText is required.',
        details: [],
        candidateId: null,
        record: null,
        mutationPlanId: null,
        approvalId: null,
        installed: false,
        decision: {
          source: 'mutation-plane',
          action: 'dry-preview',
          allowed: false,
          rule: 'intent-required',
          reasons: ['intentText missing'],
          requiresApproval: true,
        },
        resultStatus: 'blocked',
      });
    }

    const evolution = await this.evolution.preview({
      ...input,
      intentText,
      procedureOnly: true,
      sourceSurface: input.sourceSurface || 'agent-run:complex-task',
    });

    return this.finalize({
      envelope,
      status: evolution.status === 'blocked' ? 'blocked' : 'preview-ready',
      ok: evolution.ok,
      summary: evolution.summary,
      details: [
        ...evolution.details,
        'Dry preview only (procedure_only); no install performed.',
      ],
      candidateId: evolution.record.id,
      record: evolution.record,
      mutationPlanId: evolution.record.mutationPlanId,
      approvalId: null,
      installed: false,
      evolution,
      decision: {
        source: 'mutation-plane',
        action: 'dry-preview',
        allowed: evolution.ok,
        rule: 'procedure-only-no-install',
        reasons: ['complex-task dry preview', 'silentInstallBlocked'],
        requiresApproval: true,
        mutationPlanId: evolution.record.mutationPlanId,
      },
      resultStatus: evolution.ok ? 'preview' : 'blocked',
    });
  }

  public listCandidates(options: { limit?: number } = {}): ZavorthEvolvedSkillRecord[] {
    return this.registry.listRecords(options);
  }

  private beginRequest(request: {
    surface: string;
    operation: string;
    target: string;
    actorId?: string | null;
    sourceSurface?: string | null;
    metadata?: Record<string, unknown>;
  }): OperatorContinuityEnvelope {
    let envelope = this.continuity.begin();
    envelope = this.continuity.recordRequest(envelope, {
      surface: request.surface,
      operation: request.operation,
      target: request.target,
      actorId: request.actorId,
      sourceSurface: request.sourceSurface,
      metadata: {
        silentInstallBlocked: true,
        ...(request.metadata || {}),
      },
    });
    return envelope;
  }

  private finalize(input: {
    envelope: OperatorContinuityEnvelope;
    status: SkillPromotionGateStatus;
    ok: boolean;
    summary: string;
    details: string[];
    candidateId: string | null;
    record: ZavorthEvolvedSkillRecord | null;
    mutationPlanId: string | null;
    approvalId: string | null;
    installed: boolean;
    evolution?:
      | ZavorthSkillEvolutionPreview
      | ZavorthSkillEvolutionApplyResult
      | ZavorthSkillEvolutionRollbackResult
      | null;
    decision: {
      source: string;
      action: string;
      allowed: boolean;
      rule: string;
      reasons: string[];
      requiresApproval?: boolean;
      mutationPlanId?: string | null;
    };
    resultStatus: string;
  }): SkillPromotionGateResult {
    let envelope = this.continuity.attachDecision(input.envelope, {
      source: input.decision.source,
      action: input.decision.action,
      allowed: input.decision.allowed,
      rule: input.decision.rule,
      reasons: input.decision.reasons,
      requiresApproval: input.decision.requiresApproval,
      mutationPlanId: input.decision.mutationPlanId || input.mutationPlanId,
    });
    envelope = this.continuity.attachResult(envelope, {
      ok: input.ok,
      status: input.resultStatus,
      summary: input.summary,
      data: {
        candidateId: input.candidateId,
        mutationPlanId: input.mutationPlanId,
        approvalId: input.approvalId,
        installed: input.installed,
        silentInstallBlocked: true,
        details: input.details,
      },
    });
    envelope = this.continuity.finalizeReceipt(envelope);

    return {
      generatedAt: this.now().toISOString(),
      status: input.status,
      ok: input.ok,
      summary: input.summary,
      details: input.details,
      candidateId: input.candidateId,
      record: input.record,
      mutationPlanId: input.mutationPlanId,
      approvalId: input.approvalId,
      silentInstallBlocked: true,
      installed: input.installed,
      continuity: envelope,
      evolution: input.evolution || null,
    };
  }

  private extractIntent(record: ZavorthEvolvedSkillRecord): string {
    const intentNote = record.notes.find((entry) => entry.startsWith(INTENT_NOTE_PREFIX));
    if (intentNote) {
      return intentNote.slice(INTENT_NOTE_PREFIX.length).trim();
    }
    const summary = String(record.artifact?.subject?.summary || '').trim();
    if (summary) return summary;
    return record.skillName.replace(/-/g, ' ');
  }

  private mergeNotes(existing: string[], incoming: string[]): string[] {
    const next = [...existing];
    for (const entry of incoming) {
      const text = String(entry || '').trim();
      if (!text) continue;
      if (text.startsWith(INTENT_NOTE_PREFIX)) {
        const withoutIntent = next.filter((item) => !item.startsWith(INTENT_NOTE_PREFIX));
        withoutIntent.push(text);
        next.length = 0;
        next.push(...withoutIntent);
        continue;
      }
      if (!next.includes(text)) next.push(text);
    }
    return next.slice(-40);
  }

  private normalizeSkillName(value: string): string {
    const words = String(value || 'learned skill')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]+/g, ' ')
      .split(/\s+/)
      .filter((entry) => entry.length >= 3)
      .slice(0, 6);
    return (words.join('-') || 'learned-skill')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64);
  }

  private redactSensitiveText(value: string): string {
    return String(value || '')
      .replace(/(token|secret|password|api[_ -]?key|credential)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]')
      .trim();
  }

  private hash(value: string): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private firstSentence(value: string): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .split(/[.!?]/)[0]
      .slice(0, 140)
      .trim() || 'learned local procedure';
  }

  private compact(value: string, max: number): string {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= max) return cleaned;
    return `${cleaned.slice(0, Math.max(0, max - 1))}…`;
  }

  private cleanText(value: unknown): string {
    return String(value || '').trim();
  }
}
