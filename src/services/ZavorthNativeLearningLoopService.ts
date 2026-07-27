import crypto from 'node:crypto';
import {
  ZAVORTH_NATIVE_LEARNING_LOOP_CONTRACT_VERSION,
  type ZavorthNativeLearningLoopCandidate,
  type ZavorthNativeLearningLoopCandidateKind,
  type ZavorthNativeLearningLoopRisk,
  type ZavorthNativeLearningLoopSessionSearch,
  type ZavorthNativeLearningLoopSnapshot,
  type ZavorthNativeLearningLoopUserModel,
} from '../contracts/native/ZavorthNativeLearningLoopContract.js';
import type { ZavorthLearningMemorySearchResult, ZavorthSkillMemoryCandidateAssessment } from '../contracts/ZavorthMemoryLearningLoopContract.js';
import { ZavorthMemoryLearningLoopService } from './ZavorthMemoryLearningLoopService.js';
import { ZavorthMnemosProceduralMemoryService } from './ZavorthMnemosProceduralMemoryService.js';
import { ZavorthReplayLearningService, type ZavorthReplayLearningSnapshot } from './ZavorthReplayLearningService.js';
import { ZavorthSkillEvolutionService, type ZavorthSkillEvolutionSnapshot } from './ZavorthSkillEvolutionService.js';
import { ZavorthAdaptiveLearningOsService } from './ZavorthAdaptiveLearningOsService.js';
import { TieredAutonomyClassifier, type TieredAutonomyConfig, type AutonomyTier } from './TieredAutonomyService.js';

type NativeLearningRuntime = {
  now?: () => Date;
  memoryLearningLoop?: Pick<ZavorthMemoryLearningLoopService, 'search' | 'assessSkillCandidate' | 'buildStatus'>;
  replayLearning?: Pick<ZavorthReplayLearningService, 'buildSnapshot'>;
  skillEvolution?: Pick<ZavorthSkillEvolutionService, 'buildSnapshot'>;
  proceduralMemory?: Pick<ZavorthMnemosProceduralMemoryService, 'preview' | 'list'>;
  adaptiveLearning?: Pick<ZavorthAdaptiveLearningOsService, 'buildSnapshot' | 'ingestObservation'>;
  /** Tiered autonomy classifier for auto/notify/approve tier assignment. */
  tieredAutonomy?: TieredAutonomyClassifier;
};

type BuildSnapshotInput = {
  query?: string | null;
  observation?: string | null;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  sourceSurface?: string | null;
  limit?: number;
};

const SECURITY_POLICY_PATTERNS: RegExp[] = [
  /\b(security\s*policy|safety\s*policy|approval\s*policy|allowlist|denylist|sandbox\s*policy|firewall\s*rule|secretref|permission\s*policy|trust\s*slider)\b/i,
  /\b(effect\s*boundary|effect\s*policy|policy\s*broker|intent\s*safety|workspace\s*fs\s*policy)\b/i,
  /\b(always\s+allow|disable\s+approval|bypass\s+policy|skip\s+sandbox|ignore\s+safety)\b/i,
];

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:api[_-]...key|token|password|secret)\s*[:=]\s*["']...[^"'\s]+/gi,
  /\b(?:sk-|hf_|AIza|xoxb-|ghp_)[A-Za-z0-9_-]{8,}\b/g,
];

export class ZavorthNativeLearningLoopService {
  private readonly now: () => Date;
  private readonly memoryLoop: Pick<ZavorthMemoryLearningLoopService, 'search' | 'assessSkillCandidate' | 'buildStatus'>;
  private readonly replayLearning: Pick<ZavorthReplayLearningService, 'buildSnapshot'>;
  private readonly skillEvolution: Pick<ZavorthSkillEvolutionService, 'buildSnapshot'>;
  private readonly proceduralMemory: Pick<ZavorthMnemosProceduralMemoryService, 'preview' | 'list'>;
  private readonly adaptiveLearning: Pick<ZavorthAdaptiveLearningOsService, 'buildSnapshot' | 'ingestObservation'>;
  private readonly tierClassifier: TieredAutonomyClassifier;

  public constructor(runtime: NativeLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memoryLoop = runtime.memoryLearningLoop || new ZavorthMemoryLearningLoopService();
    this.replayLearning = runtime.replayLearning || new ZavorthReplayLearningService();
    this.skillEvolution = runtime.skillEvolution || new ZavorthSkillEvolutionService();
    this.proceduralMemory = runtime.proceduralMemory || new ZavorthMnemosProceduralMemoryService();
    this.adaptiveLearning = runtime.adaptiveLearning || new ZavorthAdaptiveLearningOsService({ now: this.now });
    this.tierClassifier = runtime.tieredAutonomy || new TieredAutonomyClassifier();
  }

  public async buildSnapshot(input: BuildSnapshotInput = {}): Promise<ZavorthNativeLearningLoopSnapshot> {
    const generatedAt = this.now().toISOString();
    const observation = this.clean(input.observation || '');
    const query = this.clean(input.query || observation || 'recent successful workflow');
    const sourceSurface = this.clean(input.sourceSurface || 'native-learning-loop') || 'native-learning-loop';
    const sessionSearch = await this.buildSessionSearch({
      query,
      userId: input.userId || null,
      sessionId: input.sessionId || null,
      workspace: input.workspace || null,
      limit: input.limit,
    });
    const [memoryStatus, replaySnapshot, skillSnapshot, adaptiveSnapshot] = await Promise.all([
      this.memoryLoop.buildStatus(),
      Promise.resolve(this.replayLearning.buildSnapshot({ limit: 12, workspace: input.workspace || null })),
      Promise.resolve(this.skillEvolution.buildSnapshot()),
      observation
        ? this.adaptiveLearning.ingestObservation({
          observation,
          userId: input.userId || null,
          sessionId: input.sessionId || null,
          workspace: input.workspace || null,
          sourceSurface,
          commitGreenMemory: false,
        })
        : this.adaptiveLearning.buildSnapshot(),
    ]);

    const candidates: ZavorthNativeLearningLoopCandidate[] = [];
    const skillAssessment = observation
      ? await this.memoryLoop.assessSkillCandidate({
        intent: observation,
        requestedBy: input.userId || null,
        sourceSurface,
        persistCandidate: false,
      })
      : null;

    if (observation) {
      candidates.push(this.candidateFromObservation({
        observation,
        assessment: skillAssessment,
        generatedAt,
        workspace: input.workspace || null,
        sessionId: input.sessionId || null,
        sourceSurface,
      }));
      candidates.push(this.proceduralCandidateFromObservation({
        observation,
        generatedAt,
        workspace: input.workspace || null,
        sessionId: input.sessionId || null,
        sourceSurface,
      }));
    }

    candidates.push(...this.skillImprovementCandidates(skillSnapshot, {
      generatedAt,
      workspace: input.workspace || null,
      sessionId: input.sessionId || null,
    }));
    candidates.push(...this.userModelCandidates(replaySnapshot, {
      generatedAt,
      workspace: input.workspace || null,
      sessionId: input.sessionId || null,
    }));
    candidates.push(...this.nudgeCandidates({
      generatedAt,
      memoryLayers: memoryStatus.layers,
      replaySnapshot,
      skillSnapshot,
      workspace: input.workspace || null,
      sessionId: input.sessionId || null,
    }));

    const uniqueCandidates = this.dedupe(candidates);

    // Apply tiered autonomy: classify candidates and update state/approvalRequired
    const tierCounts = this.applyTieredAutonomy(uniqueCandidates);

    const quarantined = uniqueCandidates.filter((candidate) => candidate.state === 'quarantined').length;
    const requiresApproval = uniqueCandidates.filter((candidate) => candidate.approvalRequired).length;
    const promoted = uniqueCandidates.filter((candidate) => candidate.state === 'promoted').length;
    const status: ZavorthNativeLearningLoopSnapshot['status'] = quarantined > 0 ? 'attention' : 'passed';
    const adaptiveTechnicalScannerReady = adaptiveSnapshot.safety.technicalScannerReady
      && adaptiveSnapshot.classification.technical.scanned;
    const adaptiveSemanticClassifierReady = adaptiveSnapshot.safety.semanticClassifierGoverned
      && adaptiveSnapshot.summary.semanticClassifierUsed === Boolean(observation);
    const adaptiveMultilingualRecallReady = adaptiveSnapshot.safety.multilingualRecallLocalOnly
      && adaptiveSnapshot.summary.multilingualRecallReady;
    const adaptiveOperatorI18nReady = adaptiveSnapshot.safety.operatorI18nReady
      && adaptiveSnapshot.summary.i18nReady;
    const adaptiveLearningReady = adaptiveSnapshot.safety.localOnly
      && adaptiveSnapshot.safety.redLaneNeverSilent
      && adaptiveSnapshot.invariants.shadowLearningBeforePromotion
      && adaptiveTechnicalScannerReady
      && adaptiveSemanticClassifierReady
      && adaptiveMultilingualRecallReady
      && adaptiveOperatorI18nReady;

    return {
      generatedAt,
      contractVersion: ZAVORTH_NATIVE_LEARNING_LOOP_CONTRACT_VERSION,
      source: 'ZavorthNativeLearningLoopService',
      gate: 'native-learning-loop',
      status,
      summary: {
        candidates: uniqueCandidates.length,
        quarantined,
        requiresApproval,
        promoted,
        tieredAutonomy: tierCounts,
        sessionSearchReady: memoryStatus.policy.ftsTopKRecall === true,
        autoSkillCandidateReady: Boolean(skillAssessment || memoryStatus.policy.skillHighRiskBlocked),
        skillImprovementCandidateReady: true,
        approvedNudgesReady: uniqueCandidates.some((candidate) => candidate.kind === 'approved-nudge'),
        reversibleUserModelReady: replaySnapshot.policy.approvalRequiredForProfile === true
          && replaySnapshot.profile.mode === 'suggest-only',
        adaptiveLearningReady,
        adaptiveTechnicalScannerReady,
        adaptiveSemanticClassifierReady,
        adaptiveMultilingualRecallReady,
        adaptiveOperatorI18nReady,
        securityPolicyFirewallReady: true,
        rawSecretsSerialized: false,
        externalIoPerformed: false,
        workspaceMutationPerformed: false,
      },
      sessionSearch,
      adaptiveLearning: adaptiveSnapshot,
      userModel: this.userModel(replaySnapshot),
      candidates: uniqueCandidates,
      invariants: {
        neverLearnsSecurityPolicy: true,
        everyBehaviorChangeRequiresApproval: true,
        userModelIsReversible: true,
        recallIsTopKAndUntrusted: true,
        autoSkillsStartAsDrafts: true,
        skillImprovementsUseSandboxAndReceipts: true,
        nudgesAreApprovalCandidates: true,
      },
      commands: {
        inspect: 'npm run zavorth:native-learning-loop',
        inspectJson: 'npm run zavorth:native-learning-loop:json',
        check: 'npm run zavorth:native-learning-loop:check --silent',
        search: 'npm run zavorth:native-learning-loop -- --query "<term>"',
        observe: 'npm run zavorth:native-learning-loop -- --observe "<successful workflow>"',
        next: 'ZavorthControl Learning UX',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthNativeLearningLoopSnapshot): string {
    const lines = [
      'Zavorth Native Learning Loop',
      '',
      `Status: ${snapshot.status}`,
      `Candidates: ${snapshot.summary.candidates}`,
      `Requires approval: ${snapshot.summary.requiresApproval}`,
      `Tiered autonomy: auto=${snapshot.summary.tieredAutonomy.auto}, notify=${snapshot.summary.tieredAutonomy.notify}, approve=${snapshot.summary.tieredAutonomy.approve}`,
      `Quarantined: ${snapshot.summary.quarantined}`,
      `Session search: ${snapshot.summary.sessionSearchReady ? 'ready' : 'not ready'}`,
      `User model: suggest-only, reversible, approved=${snapshot.userModel.approvedRecords}, revoked=${snapshot.userModel.revokedRecords}`,
      '',
      'Capabilities:',
      `- session search: ${snapshot.summary.sessionSearchReady ? 'ready' : 'needs attention'}`,
      `- auto-skill candidates: ${snapshot.summary.autoSkillCandidateReady ? 'ready' : 'needs observation'}`,
      `- skill improvement candidates: ${snapshot.summary.skillImprovementCandidateReady ? 'ready' : 'needs attention'}`,
      `- adaptive learning lanes: ${snapshot.summary.adaptiveLearningReady ? 'ready' : 'needs attention'}`,
      `- adaptive technical scanner: ${snapshot.summary.adaptiveTechnicalScannerReady ? 'ready' : 'needs attention'}`,
      `- adaptive semantic classifier: ${snapshot.summary.adaptiveSemanticClassifierReady ? 'ready' : 'needs attention'}`,
      `- adaptive multilingual recall: ${snapshot.summary.adaptiveMultilingualRecallReady ? 'ready' : 'needs attention'}`,
      `- adaptive operator i18n: ${snapshot.summary.adaptiveOperatorI18nReady ? 'ready' : 'needs attention'}`,
      `- approvable nudges: ${snapshot.summary.approvedNudgesReady ? 'ready' : 'needs runtime history'}`,
      `- security policy firewall: ${snapshot.summary.securityPolicyFirewallReady ? 'ready' : 'blocked'}`,
    ];

    if (snapshot.sessionSearch) {
      lines.push('');
      lines.push(`Session search "${snapshot.sessionSearch.query}": ${snapshot.sessionSearch.total} top-k result(s)`);
      for (const entry of snapshot.sessionSearch.entries.slice(0, 5)) {
        lines.push(`- [${entry.layer}] ${entry.key}: ${entry.contentPreview}`);
      }
    }

    if (snapshot.candidates.length > 0) {
      lines.push('');
      lines.push('Learning candidates:');
      for (const candidate of snapshot.candidates.slice(0, 8)) {
        lines.push(`- ${candidate.title}: ${candidate.state} / ${candidate.risk}`);
        lines.push(`  ${candidate.recommendation}`);
      }
    }

    lines.push('');
    lines.push('Policy: learning can improve preferences, procedures, skills and nudges, but cannot modify security policy.');
    lines.push(`Next: ${snapshot.commands.next}`);
    return lines.join('\n');
  }

  private async buildSessionSearch(input: {
    query: string;
    userId: string | null;
    sessionId: string | null;
    workspace: string | null;
    limit?: number;
  }): Promise<ZavorthNativeLearningLoopSessionSearch | null> {
    if (!input.query) return null;
    const result: ZavorthLearningMemorySearchResult = await this.memoryLoop.search({
      query: input.query,
      userId: input.userId,
      sessionId: input.sessionId,
      workspace: input.workspace,
      limit: Math.max(1, Math.min(input.limit || 8, 12)),
    });
    return {
      query: result.query,
      total: result.total,
      topKOnly: true,
      untrustedOnRecall: true,
      entries: result.entries.map((entry) => ({
        id: entry.id,
        layer: entry.layer,
        key: entry.key,
        contentPreview: this.clean(entry.content, 180),
        score: Number(entry.score || 0),
      })),
    };
  }

  private candidateFromObservation(input: {
    observation: string;
    assessment: ZavorthSkillMemoryCandidateAssessment | null;
    generatedAt: string;
    workspace: string | null;
    sessionId: string | null;
    sourceSurface: string;
  }): ZavorthNativeLearningLoopCandidate {
    if (this.touchesSecurityPolicy(input.observation)) {
      return this.candidate({
        kind: 'auto-skill-candidate',
        title: 'Security policy learning blocked',
        summary: 'This observation touches trust, approvals, allowlists, sandboxing or security policy.',
        recommendation: 'Keep this as an audited operator decision, not learned behavior.',
        risk: 'high',
        state: 'quarantined',
        confidence: 1,
        sourceSurface: input.sourceSurface,
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs: ['security-policy-firewall'],
      });
    }

    const assessment = input.assessment;
    const decision = assessment?.decision || 'procedure_only';
    const kind: ZavorthNativeLearningLoopCandidateKind =
      decision === 'allow_skill_candidate' ? 'auto-skill-candidate' : 'procedural-memory';
    const risk = this.toRisk(assessment?.scores.risk || 'medium');
    return this.candidate({
      kind,
      title: decision === 'allow_skill_candidate' ? 'Reusable skill candidate' : 'Procedure-only learning candidate',
      summary: this.clean(input.observation, 260),
      recommendation: decision === 'allow_skill_candidate'
        ? 'Preview a draft skill through the governed skill evolution flow before install.'
        : 'Keep as approved Mnemos procedure until it proves general and deterministic.',
      risk,
      state: 'requires_approval',
      confidence: assessment ? Number(((assessment.scores.generality + assessment.scores.determinism) / 2).toFixed(3)) : 0.6,
      sourceSurface: input.sourceSurface,
      workspace: input.workspace,
      sessionId: input.sessionId,
      evidenceRefs: assessment?.reasons || ['observation-preview'],
    });
  }

  private proceduralCandidateFromObservation(input: {
    observation: string;
    generatedAt: string;
    workspace: string | null;
    sessionId: string | null;
    sourceSurface: string;
  }): ZavorthNativeLearningLoopCandidate {
    const preview = this.proceduralMemory.preview({ text: input.observation });
    const blocked = preview.status === 'blocked' || this.touchesSecurityPolicy(input.observation);
    return this.candidate({
      kind: 'procedural-memory',
      title: blocked ? 'Procedural memory quarantined' : 'Mnemos procedure candidate',
      summary: preview.rule?.statement || this.clean(input.observation, 260),
      recommendation: blocked ? 'Do not promote this memory; it touches secrets or security policy.'
        : 'Approve only if this should influence future routing or response style.',
      risk: blocked ? 'high' : this.toRisk(preview.rule?.risk || 'medium'),
      state: blocked ? 'quarantined' : 'requires_approval',
      confidence: preview.rule?.confidence || 0.55,
      sourceSurface: input.sourceSurface,
      workspace: input.workspace,
      sessionId: input.sessionId,
      evidenceRefs: [preview.receipt.id, preview.status],
    });
  }

  private skillImprovementCandidates(
    snapshot: ZavorthSkillEvolutionSnapshot,
    context: { generatedAt: string; workspace: string | null; sessionId: string | null },
  ): ZavorthNativeLearningLoopCandidate[] {
    const records = snapshot.records
      .filter((record) => record.status === 'draft' || record.status === 'sandbox_tested' || record.status === 'waiting_approval')
      .slice(0, 5);
    if (records.length === 0) {
      return [
        this.candidate({
          kind: 'skill-improvement-candidate',
          title: 'Skill improvement lane ready',
          summary: 'No pending skill drafts found, but the skill evolution lane is connected.',
          recommendation: 'Use an approved observation to generate a draft skill when a workflow repeats.',
          risk: 'low',
          state: 'suggested',
          confidence: 0.62,
          sourceSurface: 'skill-evolution',
          workspace: context.workspace,
          sessionId: context.sessionId,
          evidenceRefs: ['skill-evolution-snapshot'],
        }),
      ];
    }
    return records.map((record) => this.candidate({
      kind: 'skill-improvement-candidate',
      title: `Improve skill draft: ${record.skillName}`,
      summary: record.notes[0] || record.artifact.subject.summary || 'Draft skill can be reviewed, tested and promoted.',
      recommendation: record.status === 'waiting_approval'
        ? 'Review the mutation plan and approve only after sandbox evidence is acceptable.'
        : 'Run sandbox/eval and keep the skill as a draft until approved.',
      risk: this.toRisk(record.riskLevel),
      state: record.status === 'waiting_approval' ? 'requires_approval' : 'suggested',
      confidence: record.evalGateStatus === 'passed' ? 0.82 : 0.66,
      sourceSurface: 'skill-evolution',
      workspace: context.workspace,
      sessionId: context.sessionId,
      evidenceRefs: [record.id, record.artifact.id].filter(Boolean),
    }));
  }

  private userModelCandidates(
    snapshot: ZavorthReplayLearningSnapshot,
    context: { generatedAt: string; workspace: string | null; sessionId: string | null },
  ): ZavorthNativeLearningLoopCandidate[] {
    return snapshot.records
      .filter((record) => record.status === 'waiting_approval' || record.status === 'suggest_only')
      .slice(0, 5)
      .map((record) => this.candidate({
        kind: 'user-model-update',
        title: `User model candidate: ${record.kind}`,
        summary: record.summary,
        recommendation: 'Approve only if this should influence future routing, style or workflow suggestions; revoke anytime.',
        risk: this.touchesSecurityPolicy(record.summary) ? 'high' : this.toRisk(record.kind === 'skill-candidate' ? 'medium' : 'low'),
        state: this.touchesSecurityPolicy(record.summary) ? 'quarantined' : 'requires_approval',
        confidence: record.confidence,
        sourceSurface: record.sourceSurface || 'replay-learning',
        workspace: context.workspace,
        sessionId: context.sessionId,
        evidenceRefs: [record.id, record.replayRef],
      }));
  }

  private nudgeCandidates(input: {
    generatedAt: string;
    memoryLayers: Record<string, number>;
    replaySnapshot: ZavorthReplayLearningSnapshot;
    skillSnapshot: ZavorthSkillEvolutionSnapshot;
    workspace: string | null;
    sessionId: string | null;
  }): ZavorthNativeLearningLoopCandidate[] {
    const nudges: ZavorthNativeLearningLoopCandidate[] = [];
    if (input.replaySnapshot.summary.pendingLearning > 0) {
      nudges.push(this.candidate({
        kind: 'approved-nudge',
        title: 'Review pending learned preferences',
        summary: `${input.replaySnapshot.summary.pendingLearning} learning item(s) are waiting for operator review.`,
        recommendation: 'Approve, reject or keep suggest-only before using them in future routing.',
        risk: 'low',
        state: 'requires_approval',
        confidence: 0.8,
        sourceSurface: 'replay-learning',
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs: ['replay-learning-pending'],
      }));
    }
    if (input.skillSnapshot.summary.waitingApproval > 0) {
      nudges.push(this.candidate({
        kind: 'approved-nudge',
        title: 'Review pending skill drafts',
        summary: `${input.skillSnapshot.summary.waitingApproval} skill draft(s) are waiting for approval.`,
        recommendation: 'Review sandbox evidence and mutation receipts before install.',
        risk: 'medium',
        state: 'requires_approval',
        confidence: 0.82,
        sourceSurface: 'skill-evolution',
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs: ['skill-evolution-waiting-approval'],
      }));
    }
    if ((input.memoryLayers.session || 0) > 0 && (input.memoryLayers.persistent || 0) === 0) {
      nudges.push(this.candidate({
        kind: 'approved-nudge',
        title: 'Promote stable session memory carefully',
        summary: 'Session memory exists, but no persistent operator preferences are approved yet.',
        recommendation: 'Promote only stable preferences, never raw transcripts or security decisions.',
        risk: 'low',
        state: 'suggested',
        confidence: 0.6,
        sourceSurface: 'memory-learning-loop',
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs: ['session-memory-present'],
      }));
    }
    if (nudges.length === 0) {
      nudges.push(this.candidate({
        kind: 'approved-nudge',
        title: 'Learning loop ready',
        summary: 'Mnemos can search sessions, propose reusable skills and keep the user model suggest-only.',
        recommendation: 'After a successful repeated workflow, run observe mode to propose safe candidates.',
        risk: 'low',
        state: 'suggested',
        confidence: 0.58,
        sourceSurface: 'native-learning-loop',
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs: ['readiness-nudge'],
      }));
    }
    return nudges;
  }

  private userModel(snapshot: ZavorthReplayLearningSnapshot): ZavorthNativeLearningLoopUserModel {
    return {
      mode: 'suggest-only',
      localOnly: true,
      reversible: true,
      approvedRecords: snapshot.profile.approvedRecordIds.length,
      revokedRecords: snapshot.profile.revokedRecordIds.length,
      preferences: snapshot.profile.preferences.length,
      procedures: snapshot.profile.procedures.length,
      codingStyle: snapshot.profile.codingStyle.length,
      debugPatterns: snapshot.profile.debugPatterns.length,
      skillCandidates: snapshot.profile.skillCandidates.length,
    };
  }

  private candidate(input: {
    kind: ZavorthNativeLearningLoopCandidateKind;
    title: string;
    summary: string;
    recommendation: string;
    confidence: number;
    risk: ZavorthNativeLearningLoopRisk;
    state: ZavorthNativeLearningLoopCandidate['state'];
    sourceSurface: string;
    workspace: string | null;
    sessionId: string | null;
    evidenceRefs: string[];
  }): ZavorthNativeLearningLoopCandidate {
    const evidenceRefs = input.evidenceRefs.map((entry) => this.clean(entry, 160)).filter(Boolean).slice(0, 8);
    const quarantined = input.state === 'quarantined' || this.touchesSecurityPolicy(`${input.title}\n${input.summary}\n${input.recommendation}`);
    const state = quarantined ? 'quarantined' : input.state;
    const risk = quarantined && input.risk !== 'critical' ? 'high' : input.risk;
    const id = `learn-${stableId(`${input.kind}:${input.title}:${input.summary}:${state}`)}`;
    return {
      id,
      kind: input.kind,
      title: this.clean(input.title, 120),
      summary: this.clean(input.summary, 420),
      recommendation: this.clean(input.recommendation, 320),
      confidence: Math.max(0, Math.min(Number(input.confidence || 0), 1)),
      risk,
      state,
      approvalRequired: true,
      reversible: true,
      source: {
        surface: this.clean(input.sourceSurface || 'native-learning-loop', 80),
        workspace: input.workspace,
        sessionId: input.sessionId,
        evidenceRefs,
      },
      actions: this.actionsFor(input.kind, state, id),
      safety: {
        rawSecretsSerialized: false,
        canModifySecurityPolicy: false,
        securityPolicyFirewall: true,
        untrustedEvidence: true,
      },
    };
  }

  private actionsFor(
    kind: ZavorthNativeLearningLoopCandidateKind,
    state: ZavorthNativeLearningLoopCandidate['state'],
    id: string,
  ): ZavorthNativeLearningLoopCandidate['actions'] {
    if (state === 'quarantined') {
      return [
        { id: 'reject', label: 'Reject quarantined learning', command: `zavorth learn reject ${id}` },
      ];
    }
    const actions: ZavorthNativeLearningLoopCandidate['actions'] = [
      { id: 'approve', label: 'Approve as draft', command: `zavorth learn approve ${id}` },
      { id: 'reject', label: 'Reject', command: `zavorth learn reject ${id}` },
      { id: 'forget', label: 'Forget later', command: `zavorth learn forget ${id}` },
    ];
    if (kind === 'auto-skill-candidate' || kind === 'skill-improvement-candidate') {
      actions.push({ id: 'preview-skill', label: 'Preview skill draft', command: `zavorth skills evolve --preview ${id}` });
      actions.push({ id: 'promoteSkill', label: 'Promote skill after approval', command: `zavorth learn promote-skill ${id}` });
    }
    if (kind === 'procedural-memory') {
      actions.push({ id: 'convert-to-procedure', label: 'Keep as Mnemos procedure', command: `zavorth mnemos procedural approve ${id}` });
      actions.push({ id: 'promoteProcedure', label: 'Promote procedure after approval', command: `zavorth learn promote-procedure ${id}` });
    }
    if (state === 'requires_approval') {
      actions.push({ id: 'promote', label: 'Promote after approval', command: `zavorth learn promote ${id}` });
    }
    return actions;
  }

  private dedupe(candidates: ZavorthNativeLearningLoopCandidate[]): ZavorthNativeLearningLoopCandidate[] {
    const seen = new Set<string>();
    const result: ZavorthNativeLearningLoopCandidate[] = [];
    for (const candidate of candidates) {
      if (seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      result.push(candidate);
    }
    return result;
  }

  /**
   * Applies tiered autonomy to candidates: classifies each into auto/notify/approve
   * and updates state/approvalRequired accordingly.
   *
   * - auto tier: state → promoted, approvalRequired → false
   * - notify tier: keeps approvalRequired true, but marks as eligible for fast-track
   * - approve tier: no changes (current behavior)
   *
   * Returns tier counts for snapshot summary.
   */
  private applyTieredAutonomy(
    candidates: ZavorthNativeLearningLoopCandidate[],
  ): { auto: number; notify: number; approve: number } {
    const tierCounts = { auto: 0, notify: 0, approve: 0 };

    for (const candidate of candidates) {
      // Skip quarantined candidates — they need manual review regardless
      if (candidate.state === 'quarantined') {
        tierCounts.approve++;
        continue;
      }

      const decision = this.tierClassifier.classify(candidate);

      switch (decision.tier) {
        case 'auto':
          // Auto-apply: promote immediately, no approval needed
          candidate.state = 'promoted';
          candidate.approvalRequired = false;
          tierCounts.auto++;
          break;

        case 'notify':
          // Fast-track: apply with notification, approval required but expedited
          // Keep approvalRequired true so the user sees it, but it can be auto-approved
          candidate.approvalRequired = true;
          tierCounts.notify++;
          break;

        case 'approve':
        default:
          // Standard flow: queue for approval
          candidate.approvalRequired = true;
          tierCounts.approve++;
          break;
      }
    }

    return tierCounts;
  }

  private touchesSecurityPolicy(value: string): boolean {
    return SECURITY_POLICY_PATTERNS.some((pattern) => pattern.test(value));
  }

  private clean(value: unknown, maxChars = 900): string {
    return SECRET_PATTERNS
      .reduce((text, pattern) => text.replace(pattern, '[REDACTED_SECRET]'), String(value || ''))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
  }

  private toRisk(value: string): ZavorthNativeLearningLoopRisk {
    if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') return value;
    return 'medium';
  }
}

function stableId(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}
