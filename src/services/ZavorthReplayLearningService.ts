import { PermissionService } from './PermissionService.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthLearningArtifact,
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
  ZavorthResourceImpact,
} from '../contracts/ZavorthMutationPlaneContract.js';
import type { ZavorthEvalDatasetManifest } from './ZavorthEvalControlPlaneService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import {
  ZavorthReplayLearningRegistryService,
  type DigitalTwinProfile,
  type ReplayLearningKind,
  type ReplayLearningRecord,
} from './ZavorthReplayLearningRegistryService.js';

import { TrustDecisionService, type TrustDecision } from './TrustDecisionService.js';
import { logger } from '../logger.js';

type ReplayLearningRuntime = {
  now?: () => Date;
  projectRoot?: string;
  registryService?: Pick<
    ZavorthReplayLearningRegistryService,
    'listRecords' | 'readProfile' | 'getRecord' | 'upsertRecord' | 'updateRecord' | 'saveProfile' | 'deleteRecord'
  > | null;
  mutationPlaneService?: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  > | null;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'> | null;
  permissionService?: Pick<PermissionService, 'getRequest'> | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
};

export type ReplayLearningPreviewInput = {
  replayText?: string | null;
  replayPath?: string | null;
  requestedBy?: string | null;
  sourceSurface?: string | null;
  suggestOnly?: boolean;
  limit?: number;
};

export type ReplayLearningPreview = {
  generatedAt: string;
  status: 'suggest_only' | 'waiting_approval' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  replayRef: string;
  records: ReplayLearningRecord[];
  mutationPlan: ZavorthMutationPlan | null;
  trustDecision: TrustDecision | null;
  profile: DigitalTwinProfile;
};

export type ReplayLearningApplyResult = {
  generatedAt: string;
  status: 'approved' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  records: ReplayLearningRecord[];
  mutationPlan: ZavorthMutationPlan | null;
  profile: DigitalTwinProfile;
};

export type ReplayLearningRevokeResult = {
  generatedAt: string;
  status: 'revoked' | 'blocked';
  ok: boolean;
  summary: string;
  details: string[];
  record: ReplayLearningRecord;
  profile: DigitalTwinProfile;
};

export type DigitalTwinSuggestion = {
  generatedAt: string;
  mode: 'suggest-only';
  objective: string;
  suggestions: string[];
  supportingRecordIds: string[];
  profile: DigitalTwinProfile;
};

export type ZavorthReplayLearningSnapshot = {
  generatedAt: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    timelineEvents: number;
    compareReady: boolean;
    resumeReady: boolean;
    recentArtifacts: number;
    reusableArtifacts: number;
    learningCandidates: number;
    pendingLearning: number;
    promotedLearning: number;
    memoryEntries: number;
    proceduralEntries: number;
    memoryPressure: 'low' | 'moderate' | 'high';
    approvedProfileEntries: number;
    revokedEntries: number;
    heavyRuntimesStarted: false;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  profile: DigitalTwinProfile;
  records: ReplayLearningRecord[];
  actions: Array<{
    id: string;
    label: string;
    command: string | null;
  }>;
  policy: {
    suggestOnlyDefault: true;
    rawReplayPersisted: false;
    secretsPersisted: false;
    approvalRequiredForProfile: true;
    retentionTtlMs: number;
  };
};

type ReplayProposal = {
  kind: ReplayLearningKind;
  summary: string;
  redactedEvidence: string;
  confidence: number;
  uses: string[];
};

export class ZavorthReplayLearningService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly registry: Pick<
    ZavorthReplayLearningRegistryService,
    'listRecords' | 'readProfile' | 'getRecord' | 'upsertRecord' | 'updateRecord' | 'saveProfile' | 'deleteRecord'
  >;
  private readonly mutationPlane: Pick<
    ZavorthMutationPlaneService,
    'createPlan' | 'readPlan' | 'attachApproval' | 'approvePlan' | 'markApplied' | 'markBlocked'
  >;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly permissionService: Pick<PermissionService, 'getRequest'>;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;

  constructor(runtime: ReplayLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.registry = runtime.registryService || new ZavorthReplayLearningRegistryService();
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.permissionService = runtime.permissionService || new PermissionService();
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
  }

  public buildSnapshot(input: { limit?: number; workspace?: string | null } = {}): ZavorthReplayLearningSnapshot {
    const limit = Math.max(1, Math.min(input.limit || 8, 50));
    const records = this.registry.listRecords({ limit, includeRevoked: true });
    const profile = this.registry.readProfile();
    const pending = records.filter((entry) => entry.status === 'waiting_approval').length;
    const approved = records.filter((entry) => entry.status === 'approved').length;
    const revoked = records.filter((entry) => entry.status === 'revoked').length;
    const memoryEntries = records.filter((entry) => entry.status !== 'revoked').length;
    const memoryPressure = memoryEntries > 80 ? 'high' : memoryEntries > 30 ? 'moderate' : 'low';
    const posture: ZavorthReplayLearningSnapshot['summary']['posture'] =
      memoryPressure === 'high' ? 'attention' : 'healthy';
    return {
      generatedAt: this.now().toISOString(),
      summary: {
        posture,
        timelineEvents: records.length,
        compareReady: approved > 0,
        resumeReady: pending > 0,
        recentArtifacts: records.length,
        reusableArtifacts: approved,
        learningCandidates: records.filter((entry) => entry.status === 'suggest_only' || entry.status === 'waiting_approval').length,
        pendingLearning: pending,
        promotedLearning: approved,
        memoryEntries,
        proceduralEntries: records.filter((entry) => entry.kind === 'procedure' && entry.status === 'approved').length,
        memoryPressure,
        approvedProfileEntries: profile.approvedRecordIds.length,
        revokedEntries: revoked,
        heavyRuntimesStarted: false,
      },
      narrative: {
        headline: 'Replay learning: Replay Learning and local Digital Twin',
        operatorSummary: `${records.length} learning(s) drafted, ${approved} approved, ${pending} awaiting approval.`,
        nextAction: pending > 0
          ? 'Approve or revoke pending learnings before using them in the profile.'
          : 'Import replay with ops:replay-learning -- --text or --replay.',
      },
      profile,
      records,
      actions: [
        { id: 'import-replay', label: 'Import drafted replay', command: 'npm run ops:replay-learning -- --text "<excerpt>"' },
        { id: 'suggest', label: 'Use twin in suggest-only', command: 'npm run ops:replay-learning -- --suggest "<objective>"' },
        { id: 'export-profile', label: 'Export local profile', command: 'npm run ops:replay-learning -- --export-profile' },
      ],
      policy: {
        suggestOnlyDefault: true,
        rawReplayPersisted: false,
        secretsPersisted: false,
        approvalRequiredForProfile: true,
        retentionTtlMs: 30 * 24 * 60 * 60 * 1000,
      },
    };
  }

  public async preview(input: ReplayLearningPreviewInput): Promise<ReplayLearningPreview> {
    const rawReplay = this.resolveReplayText(input);
    if (!rawReplay) {
      throw new Error('Empty replay. Use --text or --replay <file.cast>.');
    }
    const redacted = this.redactReplay(rawReplay);
    const replayRef = `replay:${this.hash(rawReplay).slice(0, 16)}`;
    const proposals = this.classifyReplay(redacted.redactedText, input.limit || 8);
    if (proposals.length === 0) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'No safe learning was extracted from the replay.',
        details: redacted.notes,
        replayRef,
        records: [],
        mutationPlan: null,
        trustDecision: null,
        profile: this.registry.readProfile(),
      };
    }

    const records = proposals.map((proposal) => this.registry.upsertRecord(this.buildRecord({
      proposal,
      replayRef,
      input,
      status: input.suggestOnly === false ? 'waiting_approval' : 'suggest_only',
      redactionNotes: redacted.notes,
      rawHash: this.hash(rawReplay),
      redactedHash: this.hash(redacted.redactedText),
    })));

    if (input.suggestOnly !== false) {
      return {
        generatedAt: this.now().toISOString(),
        status: 'suggest_only',
        ok: true,
        summary: `${records.length} learning(s) kept as suggestions, not applied to the digital twin.`,
        details: [
          'Suggest-only mode does not create a MutationPlan.',
          ...redacted.notes,
        ],
        replayRef,
        records,
        mutationPlan: null,
        trustDecision: null,
        profile: this.registry.readProfile(),
      };
    }

    const plan = this.mutationPlane.createPlan({
      domain: 'replay-learning',
      actionId: 'approve-learning',
      title: `Approve ${records.length} learning(s) for the digital twin`,
      summary: 'Replay learnings only enter the DigitalTwinProfile after approval.',
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'replay-learning',
      riskLevel: 'medium',
      approvalRequired: true,
      approvalReason: 'Persistent memory changes future behavior and requires approval.',
      resourceImpact: this.resourceImpact(records),
      readinessGates: [this.redactionGate(redacted.notes, records)],
      retentionPolicy: {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        maxBytes: 25 * 1024 * 1024,
        cleanupOnSuccess: false,
        cleanupOnBoot: false,
        notes: ['Only drafted replay, hashes and summaries are persisted.'],
      },
      validationPlan: [
        'Confirmar que rawReplayPersisted=false.',
        'Confirmar que secretsPersisted=false e redaction notes foram geradas.',
        'Apply only in local suggest-only DigitalTwinProfile.',
        'Manter revocation por record id.',
        'Do not create skill automatically; skill-candidate must pass through the skill evolution gate.',
      ],
      rollbackPlan: [
        'Revogar record ids approved.',
        'Remover referencias do DigitalTwinProfile.',
        'Keep revocation trail to explain where memory was used.',
      ],
      payload: {
        replayRef,
        recordIds: records.map((entry) => entry.id),
        rawReplayPersisted: false,
        redactedReplayHash: this.hash(redacted.redactedText),
        redactionNotes: redacted.notes,
      },
    });
    const decision = await this.trustDecision.evaluate({
      domain: 'replay-learning',
      actionId: 'approve-learning',
      planId: plan.id,
      requestedBy: input.requestedBy || null,
      sourceSurface: input.sourceSurface || 'replay-learning',
      riskLevel: 'medium',
      approvalRequired: true,
      capabilityId: 'replay-learning',
      reason: 'Persisting learning in the digital twin requires approval.',
      payload: plan.payload,
      resourceImpact: plan.resourceImpact,
    });
    const withApproval = decision.permission
      ? this.mutationPlane.attachApproval(plan.id, {
        permissionId: decision.permission.permission_id,
        status: decision.permission.status === 'approved' ? 'approved' : 'pending',
        reason: decision.reason,
      })
      : plan;
    const updated = records.map((record) => this.registry.updateRecord(record.id, (current) => ({
      ...current,
      mutationPlanId: withApproval.id,
      permissionId: decision.permission?.permission_id || withApproval.approval.permissionId || null,
    })));

    return {
      generatedAt: this.now().toISOString(),
      status: 'waiting_approval',
      ok: false,
      summary: `${updated.length} learning item(s) await approval in plan ${withApproval.id}.`,
      details: [
        decision.permission ? `Permission: ${decision.permission.permission_id}.` : 'Pending permission was not created.',
        ...redacted.notes,
      ],
      replayRef,
      records: updated,
      mutationPlan: withApproval,
      trustDecision: decision,
      profile: this.registry.readProfile(),
    };
  }

  public async apply(input: { planId: string; requestedBy?: string | null }): Promise<ReplayLearningApplyResult> {
    let plan = this.mutationPlane.readPlan(input.planId);
    if (!plan || plan.domain !== 'replay-learning') {
      throw new Error(`Replay Learning plan not found: ${input.planId || 'n/d'}.`);
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      const permission = plan.approval.permissionId
        ? await this.permissionService.getRequest(plan.approval.permissionId)
        : null;
      if (permission?.status === 'approved') {
        plan = this.mutationPlane.approvePlan(plan.id, {
          permissionId: permission.permission_id,
          approvedBy: permission.decided_by || input.requestedBy || null,
          scope: permission.scope === 'persistent' ? 'host' : permission.scope === 'session' ? 'session' : 'once',
        });
      }
    }
    if (plan.approval.required && plan.status !== 'approved' && plan.approval.status !== 'approved') {
      throw new Error(`Plan ${plan.id} is still waiting for approval.`);
    }

    const recordIds = Array.isArray(plan.payload.recordIds)
      ? plan.payload.recordIds.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const records = recordIds
      .map((id) => this.registry.getRecord(id))
      .filter((entry): entry is ReplayLearningRecord => Boolean(entry));
    if (records.length === 0) {
      const blocked = this.mutationPlane.markBlocked(plan.id, 'No record de replay-learning encontrado para aplicar.');
      return {
        generatedAt: this.now().toISOString(),
        status: 'blocked',
        ok: false,
        summary: 'No learning item found to approve.',
        details: [],
        records: [],
        mutationPlan: blocked,
        profile: this.registry.readProfile(),
      };
    }

    const approved = records.map((record) => this.registry.updateRecord(record.id, (current) => ({
      ...current,
      status: 'approved',
      artifact: {
        ...current.artifact,
        status: 'approved',
        updatedAt: this.now().toISOString(),
      },
    })));
    const profile = this.registry.saveProfile(this.mergeIntoProfile(this.registry.readProfile(), approved));
    const applied = this.mutationPlane.markApplied(plan.id, `${approved.length} learning item(s) approved in DigitalTwinProfile.`, ['digital-twin.profile-update']);
    return {
      generatedAt: this.now().toISOString(),
      status: 'approved',
      ok: true,
      summary: `${approved.length} learning item(s) approved in suggest-only mode.`,
      details: ['The digital twin suggests, but does not apply changes automatically.'],
      records: approved,
      mutationPlan: applied,
      profile,
    };
  }

  public revoke(input: { recordId: string; reason?: string | null; requestedBy?: string | null }): ReplayLearningRevokeResult {
    const record = this.registry.deleteRecord(input.recordId, input.reason || null);
    const profile = this.registry.saveProfile(this.removeFromProfile(this.registry.readProfile(), record.id));
    return {
      generatedAt: this.now().toISOString(),
      status: 'revoked',
      ok: true,
      summary: `Learning item ${record.id} revoked.`,
      details: [
        `Tipo: ${record.kind}.`,
        `Usos afetados: ${record.uses.join(', ') || 'nenhum'}.`,
      ],
      record,
      profile,
    };
  }

  public suggest(input: { objective: string }): DigitalTwinSuggestion {
    const objective = String(input.objective || '').trim();
    const profile = this.registry.readProfile();
    const entries = [
      ...profile.preferences,
      ...profile.procedures,
      ...profile.debugPatterns,
      ...profile.codingStyle,
      ...profile.skillCandidates,
    ].slice(0, 8);
    const suggestions = entries.length > 0
      ? entries.map((entry) => `Considere: ${entry.summary}`)
      : ['without memorys approved ainda; use replay-learning em modo preview before personalizar o comportamento.'];
    return {
      generatedAt: this.now().toISOString(),
      mode: 'suggest-only',
      objective,
      suggestions,
      supportingRecordIds: entries.map((entry) => entry.id),
      profile,
    };
  }

  public exportProfile(): DigitalTwinProfile {
    return this.registry.readProfile();
  }

  private buildRecord(input: {
    proposal: ReplayProposal;
    replayRef: string;
    input: ReplayLearningPreviewInput;
    status: 'suggest_only' | 'waiting_approval';
    redactionNotes: string[];
    rawHash: string;
    redactedHash: string;
  }): ReplayLearningRecord {
    const now = this.now().toISOString();
    const id = `replay-learning:${input.proposal.kind}:${this.hash([input.replayRef, input.proposal.summary]).slice(0, 12)}`;
    const evalManifest = this.buildEvalManifest(input.replayRef, input.proposal);
    const artifact: ZavorthLearningArtifact = {
      id: `learning:${id}`,
      kind: input.proposal.kind,
      status: 'previewed',
      createdAt: now,
      updatedAt: now,
      source: {
        domain: 'replay-learning',
        surface: input.input.sourceSurface || null,
        requestedBy: input.input.requestedBy || null,
        originRef: input.replayRef,
      },
      subject: {
        name: input.proposal.kind,
        version: '0.1.0',
        summary: input.proposal.summary,
        riskLevel: this.riskForKind(input.proposal.kind),
      },
      evidence: [
        {
          id: input.replayRef,
          kind: 'replay',
          status: 'passed',
          summary: input.proposal.redactedEvidence,
          ref: input.replayRef,
          metadata: {
            rawHash: input.rawHash,
            redactedHash: input.redactedHash,
          },
        },
        {
          id: `${input.replayRef}:redaction`,
          kind: 'redaction',
          status: 'passed',
          summary: input.redactionNotes.join(' '),
          ref: null,
        },
      ],
      retention: {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        maxBytes: 25 * 1024 * 1024,
        cleanupOnSuccess: false,
        cleanupOnBoot: false,
        notes: ['Raw replay is not persisted; only redacted summary, hashes, and compact evidence.'],
      },
      redaction: {
        rawTranscriptPersisted: false,
        rawSecretsPersisted: false,
        notes: input.redactionNotes,
      },
      hashes: {
        intentHash: input.rawHash,
        contentHash: input.redactedHash,
      },
    };
    return {
      id,
      kind: input.proposal.kind,
      status: input.status,
      createdAt: now,
      updatedAt: now,
      requestedBy: input.input.requestedBy || null,
      sourceSurface: input.input.sourceSurface || null,
      replayRef: input.replayRef,
      summary: input.proposal.summary,
      redactedEvidence: input.proposal.redactedEvidence,
      confidence: input.proposal.confidence,
      uses: input.proposal.uses,
      expiresAt: new Date(this.now().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      mutationPlanId: null,
      permissionId: null,
      artifact,
      evalManifest,
      linkedSkillDraftId: input.proposal.kind === 'skill-candidate' ? null : null,
      revokedAt: null,
      revokedReason: null,
    };
  }

  private classifyReplay(redactedText: string, limit: number): ReplayProposal[] {
    const lines = this.extractReplayLines(redactedText);
    const evidence = lines.find(Boolean);
    if (!evidence) {
      return [];
    }
    const proposal: ReplayProposal = {
      kind: 'procedure',
      summary: 'Replay is available for semantic review by the learning layer.',
      redactedEvidence: evidence.slice(0, 500),
      confidence: 0.55,
      uses: ['suggestion'],
    };
    return [proposal].slice(0, Math.max(1, Math.min(limit, 12)));
  }

  private extractReplayLines(text: string): string[] {
    return String(text || '')
      .split(/\r?\n/)
      .map((line) => this.parseCastLine(line))
      .map((line) => line.replace(/\x1b\[[0-9;]*m/g, '').trim())
      .filter((line) => line.length > 0)
      .slice(0, 200);
  }

  private parseCastLine(line: string): string {
    const trimmed = String(line || '').trim();
    if (!trimmed) {
      return '';
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && typeof parsed[2] === 'string') {
        return parsed[2];
      }
      if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
        return parsed.text;
      }
    } catch (error: unknown) {// plain transcript line
      logger.warn('[Zavorth Replay Learning] JSON parse failed', error);
    }
    return trimmed;
  }

  private redactReplay(raw: string): { redactedText: string; notes: string[] } {
    let redactedText = String(raw || '');
    const notes: string[] = [];
    const replace = (regex: RegExp, replacement: string, note: string) => {
      if (regex.test(redactedText)) {
        redactedText = redactedText.replace(regex, replacement);
        notes.push(note);
      }
    };
    replace(/(token|secret|password|api[_ -]...key|cnetworkntial)\s*[:=]\s*["']...[^"'\s]+["'].../gi, '$1=[REDACTED]', 'Secrets/tokens foram redigidos.');
    replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[REDACTED_EMAIL]', 'Emails foram redigidos.');
    replace(/\b(?:\d[ -]*...){13,19}\b/g, '[REDACTED_NUMBER]', 'Sequencias numericas sensitive foram redigidas.');
    replace(/-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]*?-----END [^-]+ PRIVATE KEY-----/g, '[REDACTED_PRIVATE_KEY]', 'Chaves privadas foram redigidas.');
    if (notes.length === 0) {
      notes.push('No obvious secret detected; raw replay still was not persisted.');
    }
    return { redactedText, notes };
  }

  private resolveReplayText(input: ReplayLearningPreviewInput): string {
    const inline = String(input.replayText || '').trim();
    if (inline) {
      return inline;
    }
    const replayPath = String(input.replayPath || '').trim();
    if (!replayPath) {
      return '';
    }
    const resolved = path.resolve(replayPath);
    if (!this.existsSyncImpl(resolved)) {
      throw new Error(`Replay not found: ${replayPath}`);
    }
    return this.readFileSyncImpl(resolved, 'utf8');
  }

  private redactionGate(notes: string[], records: ReplayLearningRecord[]): ZavorthReadinessGate {
    return {
      id: 'replay-learning-redaction',
      status: 'passed',
      canProceed: true,
      scope: 'digital-twin-profile',
      reasons: ['Raw replay not persisted; drafted learning is revocable.'],
      warnings: notes,
      blockers: [],
      checkedAt: this.now().toISOString(),
      evidence: records.map((record) => ({
        id: record.id,
        label: record.kind,
        status: record.status,
        summary: record.summary,
      })),
      nextActions: ['Approve, keep as suggestion or revoke record IDs.'],
    };
  }

  private buildEvalManifest(replayRef: string, proposal: ReplayProposal): ZavorthEvalDatasetManifest {
    const generatedAt = this.now().toISOString();
    const selectors = [`kind:${proposal.kind}`, `replay:${replayRef}`];
    return {
      version: 1,
      manifestHash: this.hash([replayRef, proposal.kind, proposal.summary]).slice(0, 24),
      generatedAt,
      windowHours: 24 * 30,
      scopeHash: this.hash(selectors).slice(0, 24),
      reproducible: true,
      baselineRef: `replay-learning:${proposal.kind}`,
      selectors,
      retention: {
        ttlMs: 30 * 24 * 60 * 60 * 1000,
        maxSamples: 1,
        compacted: true,
      },
      redaction: {
        mode: 'references-only',
        payloadsIncluded: false,
        secretsIncluded: false,
        notes: ['Manifest points to hash/redacted summary, not raw transcript.'],
      },
    };
  }

  private mergeIntoProfile(profile: DigitalTwinProfile, records: ReplayLearningRecord[]): DigitalTwinProfile {
    let next = this.removeManyFromProfile(profile, records.map((record) => record.id));
    for (const record of records) {
      const entry = {
        id: record.id,
        summary: record.summary,
        confidence: record.confidence,
        expiresAt: record.expiresAt,
      };
      if (record.kind === 'preference') {
        next.preferences.push(entry);
      } else if (record.kind === 'procedure') {
        next.procedures.push(entry);
      } else if (record.kind === 'debug-pattern') {
        next.debugPatterns.push(entry);
      } else if (record.kind === 'coding-style') {
        next.codingStyle.push(entry);
      } else if (record.kind === 'skill-candidate') {
        next.skillCandidates.push(entry);
      }
      next.approvedRecordIds.push(record.id);
    }
    next.approvedRecordIds = Array.from(new Set(next.approvedRecordIds));
    next.updatedAt = this.now().toISOString();
    next.notes = Array.from(new Set([
      ...next.notes,
      'DigitalTwinProfile operates in suggest-only mode; it does not apply changes automatically.',
    ]));
    return next;
  }

  private removeFromProfile(profile: DigitalTwinProfile, recordId: string): DigitalTwinProfile {
    const next = this.removeManyFromProfile(profile, [recordId]);
    next.revokedRecordIds = Array.from(new Set([...next.revokedRecordIds, recordId]));
    next.updatedAt = this.now().toISOString();
    return next;
  }

  private removeManyFromProfile(profile: DigitalTwinProfile, recordIds: string[]): DigitalTwinProfile {
    const blocked = new Set(recordIds);
    const filter = (entries: DigitalTwinProfile['preferences']) => entries.filter((entry) => !blocked.has(entry.id));
    return {
      ...profile,
      approvedRecordIds: profile.approvedRecordIds.filter((id) => !blocked.has(id)),
      preferences: filter(profile.preferences),
      procedures: filter(profile.procedures),
      debugPatterns: filter(profile.debugPatterns),
      codingStyle: filter(profile.codingStyle),
      skillCandidates: filter(profile.skillCandidates),
    };
  }

  private resourceImpact(records: ReplayLearningRecord[]): ZavorthResourceImpact {
    return {
      ramMb: 0,
      diskMb: Math.max(1, Math.ceil(records.length * 0.1)),
      processCount: 0,
      externalExposure: 'none',
      recurring: false,
      notes: [
        `records=${records.length}`,
        'Updates only local DigitalTwinProfile in suggest-only mode.',
      ],
    };
  }

  private riskForKind(kind: ReplayLearningKind): ZavorthMutationRiskLevel {
    return kind === 'skill-candidate' ? 'medium' : 'low';
  }

  private hash(value: unknown): string {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
}

export class ZavorthReplayLearningControlPlaneService extends ZavorthReplayLearningService {}
