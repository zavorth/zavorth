import crypto from 'node:crypto';
import {
  ZAVORTH_ADAPTIVE_LEARNING_OS_CONTRACT_VERSION,
  type ZavorthAdaptiveLearningDecision,
  type ZavorthAdaptiveLearningLaneId,
  type ZavorthAdaptiveLearningLaneSnapshot,
  type ZavorthAdaptiveLearningLedgerEntry,
  type ZavorthAdaptiveMultilingualRecallInput,
  type ZavorthAdaptiveMultilingualRecallResult,
  type ZavorthAdaptiveLearningSensitivity,
  type ZavorthAdaptiveLearningSnapshot,
  type ZavorthAdaptiveProcedureDraft,
  type ZavorthAdaptiveShadowSkillDraft,
  type ZavorthAdaptiveTechnicalScan,
  type ZavorthAdaptiveUserModelRecord,
  type ZavorthUserModelUse,
} from '../contracts/native/ZavorthAdaptiveLearningOsContract.js';
import type {
  ZavorthAdaptiveSemanticClassification,
  ZavorthAdaptiveSemanticClassifier,
  ZavorthAdaptiveSemanticLlmGate,
} from '../contracts/native/ZavorthAdaptiveLearningSemanticContract.js';
import type {
  ZavorthLearningMemoryReceipt,
  ZavorthLearningMemoryRisk,
} from '../contracts/ZavorthMemoryLearningLoopContract.js';
import { ZavorthMemoryLearningLoopService } from './ZavorthMemoryLearningLoopService.js';
import { ZavorthAdaptiveMultilingualRecallService } from './ZavorthAdaptiveMultilingualRecallService.js';

import {
  ZavorthAdaptiveLearningI18nService,
  type ZavorthAdaptiveLearningRenderOptions,
} from './ZavorthAdaptiveLearningI18nService.js';

import { ZavorthAdaptiveSemanticClassifierService } from './ZavorthAdaptiveSemanticClassifierService.js';
import { ZavorthAdaptiveTechnicalSafetyScannerService } from './ZavorthAdaptiveTechnicalSafetyScannerService.js';

type AdaptiveLearningRuntime = {
  now?: () => Date;
  memoryLearningLoop?: Pick<ZavorthMemoryLearningLoopService, 'remember' | 'assessSkillCandidate' | 'search'>;
  technicalScanner?: Pick<ZavorthAdaptiveTechnicalSafetyScannerService, 'scan' | 'redact' | 'normalizeForPolicy'>;
  semanticClassifier?: ZavorthAdaptiveSemanticClassifier;
  semanticLlmGate?: ZavorthAdaptiveSemanticLlmGate | null;
  i18n?: Pick<ZavorthAdaptiveLearningI18nService, 'render'>;
  multilingualRecall?: Pick<ZavorthAdaptiveMultilingualRecallService, 'search'>;
};

type IngestObservationInput = {
  observation: string;
  userId?: string | null;
  sessionId?: string | null;
  workspace?: string | null;
  sourceSurface?: string | null;
  commitGreenMemory?: boolean;
};

const SENSITIVE_USER_MODEL_PATTERNS: RegExp[] = [
  /\b(depressed|depression|trauma|traumatized|psychological|psychiatric|fragile|vulnerable)\b/i,
  /\b(anxiety|anxious|bipolar|adhd|autism|ptsd|suicid|mental\s+health)\b/i,
  /\b(diagnos(?:is|e)|personality\s+disorder|clinical)\b/i,
  /\b(deprimido|depressao|depressivo|ansiedade|ansioso|traumatizado|psicologico|psiquiatrico|fragil|vulneravel|suicida|saude\s+mental)\b/i,
  /\b(deprimido|depresion|depresivo|ansiedad|ansioso|traumatizado|psicologico|psiquiatrico|fragil|vulnerable|suicida|salud\s+mental)\b/i,
  /\b(depression|anxiete|anxieux|traumatise|psychologique|psychiatrique|fragile|vulnerable|suicidaire|sante\s+mentale)\b/i,
  /\b(depressiv|depression|angst|traumatisiert|psychologisch|psychiatrisch|suizid|psychische\s+gesundheit)\b/i,
  /\b(depresso|depressione|ansia|ansioso|traumatizzato|psicologico|psichiatrico|suicida|salute\s+mentale)\b/i,
];

const SECURITY_POLICY_PATTERNS: RegExp[] = [
  /\b(disable|bypass|skip|ignore)\s+(approval|policy|sandbox|security)\b/i,
  /\b(always\s+allow|allowlist|denylist|secretref|permission\s+policy)\b/i,
  /\b(desativar|desative|desabilitar|burlar|ignorar|pular|permitir\s+sempre|sempre\s+permitir)\b.*\b(aprovacao|politica|seguranca|sandbox|shell|comando|permissao)\b/i,
  /\b(desactivar|desactiva|deshabilitar|omitir|saltar|ignorar|permitir\s+siempre|siempre\s+permitir)\b.*\b(aprobacion|politica|seguridad|sandbox|shell|comando|permiso)\b/i,
  /\b(desactiver|ignorer|contourner|autoriser\s+toujours)\b.*\b(approbation|politique|securite|sandbox|shell|commande|permission)\b/i,
  /\b(deaktivieren|umgehen|ignorieren|immer\s+erlauben)\b.*\b(genehmigung|richtlinie|sicherheit|sandbox|shell|befehl|berechtigung)\b/i,
];

const SKILL_SIGNAL_PATTERNS: RegExp[] = [
  /\b(after successful runs|repeat(?:ed|able)? workflow|workflow|github|pull request|\bpr\b|changed files|test gaps|summari[sz]e)\b/i,
  /\b(create a skill|turn this into a skill|procedure|playbook|checklist)\b/i,
];

export class ZavorthAdaptiveLearningOsService {
  private readonly now: () => Date;
  private readonly memoryLoop: Pick<ZavorthMemoryLearningLoopService, 'remember' | 'assessSkillCandidate' | 'search'>;
  private readonly technicalScanner: Pick<ZavorthAdaptiveTechnicalSafetyScannerService, 'scan' | 'redact' | 'normalizeForPolicy'>;
  private readonly semanticClassifier: ZavorthAdaptiveSemanticClassifier;
  private readonly i18n: Pick<ZavorthAdaptiveLearningI18nService, 'render'>;
  private readonly multilingualRecall: Pick<ZavorthAdaptiveMultilingualRecallService, 'search'>;

  public constructor(runtime: AdaptiveLearningRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memoryLoop = runtime.memoryLearningLoop || new ZavorthMemoryLearningLoopService();
    this.technicalScanner = runtime.technicalScanner || new ZavorthAdaptiveTechnicalSafetyScannerService();
    this.semanticClassifier = runtime.semanticClassifier || new ZavorthAdaptiveSemanticClassifierService({
      llmGate: runtime.semanticLlmGate || null,
    });
    this.i18n = runtime.i18n || new ZavorthAdaptiveLearningI18nService();
    this.multilingualRecall = runtime.multilingualRecall || new ZavorthAdaptiveMultilingualRecallService({
      now: this.now,
      memoryLearningLoop: this.memoryLoop,
    });
  }

  public async buildSnapshot(): Promise<ZavorthAdaptiveLearningSnapshot> {
    return this.snapshot({
      generatedAt: this.now().toISOString(),
      records: [],
      memoryWrites: [],
      shadowSkills: [],
      procedures: [],
      ledger: [],
      technicalScan: this.technicalScanner.scan(''),
      semanticClassification: null,
    });
  }

  public async ingestObservation(input: IngestObservationInput): Promise<ZavorthAdaptiveLearningSnapshot> {
    const generatedAt = this.now().toISOString();
    const observation = this.clean(input.observation);
    const technicalScan = this.technicalScanner.scan(observation);
    if (!observation) {
      return this.snapshot({
        generatedAt,
        records: [],
        memoryWrites: [],
        shadowSkills: [],
        procedures: [],
        ledger: [this.ledger({
          generatedAt,
          type: 'observation',
          lane: 'yellow',
          decision: 'staged_for_digest',
          risk: 'low',
          summary: 'Empty observation skipped.',
          evidenceRefs: [],
        })],
        technicalScan,
        semanticClassification: null,
      });
    }

    const semanticClassification = technicalScan.blocked
      ? null
      : await this.semanticClassifier.classify({
        text: observation,
        redactedText: technicalScan.redactedText,
        technicalFindings: technicalScan.findings,
        userId: input.userId || null,
        sessionId: input.sessionId || null,
        workspace: input.workspace || null,
        sourceSurface: input.sourceSurface || null,
      });
    const records = [this.userModelRecord(observation, generatedAt, technicalScan, semanticClassification)];
    const memoryWrites: ZavorthLearningMemoryReceipt[] = [];
    const ledger: ZavorthAdaptiveLearningLedgerEntry[] = [];
    const shadowSkills: ZavorthAdaptiveShadowSkillDraft[] = [];
    const procedures: ZavorthAdaptiveProcedureDraft[] = [];

    ledger.push(this.ledger({
      generatedAt,
      type: 'observation',
      lane: records[0].lane,
      decision: this.decisionForRecord(records[0]),
      risk: this.riskForRecord(records[0], technicalScan, semanticClassification),
      summary: `Observation classified for ${records[0].lane} lane.`,
      evidenceRefs: records[0].evidence,
    }));

    if (records[0].status === 'auto_accepted' && records[0].lane === 'green' && input.commitGreenMemory !== false) {
      const receipt = await this.memoryLoop.remember({
        layer: 'persistent',
        key: 'user-preference:response-style',
        content: records[0].claim,
        userId: input.userId || null,
        sessionId: input.sessionId || null,
        workspace: input.workspace || null,
        source: input.sourceSurface || 'adaptive-learning-os',
        confidence: records[0].confidence,
        risk: 'low',
        metadata: {
          adaptiveLearningLane: 'green',
          usedFor: records[0].usedFor,
          evidence: records[0].evidence,
        },
      });
      memoryWrites.push(receipt);
      ledger.push(this.ledger({
        generatedAt,
        type: 'memory',
        lane: 'green',
        decision: receipt.decision === 'accepted' ? 'auto_applied' : 'staged_for_digest',
        risk: 'low',
        summary: receipt.summary,
        evidenceRefs: [receipt.id],
      }));
    } else {
      ledger.push(this.ledger({
        generatedAt,
        type: 'user_model',
        lane: records[0].lane,
        decision: this.decisionForRecord(records[0]),
        risk: this.riskForRecord(records[0], technicalScan, semanticClassification),
        summary: 'User-model inference staged without memory persistence.',
        evidenceRefs: records[0].evidence,
      }));
    }

    if (!technicalScan.promptInjection && !technicalScan.policyChange && this.looksLikeSkillOrProcedure(observation)) {
      const assessment = await this.memoryLoop.assessSkillCandidate({
        intent: this.redact(observation),
        requestedBy: input.userId || null,
        sourceSurface: input.sourceSurface || 'adaptive-learning-os',
        persistCandidate: false,
      });
      const shadowSkill = this.shadowSkill(observation, generatedAt, assessment.decision);
      const procedure = this.procedureDraft(observation, generatedAt);
      shadowSkills.push(shadowSkill);
      procedures.push(procedure);
      ledger.push(this.ledger({
        generatedAt,
        type: 'skill',
        lane: 'yellow',
        decision: 'staged_for_digest',
        risk: assessment.scores.risk,
        summary: `Skill candidate drafted as ${assessment.decision}; install remains blocked.`,
        evidenceRefs: shadowSkill.evidence,
      }));
      ledger.push(this.ledger({
        generatedAt,
        type: 'procedure',
        lane: 'yellow',
        decision: 'staged_for_digest',
        risk: 'low',
        summary: 'Procedure draft created for review before promotion.',
        evidenceRefs: procedure.evidence,
      }));
    }

    if (technicalScan.policyChange) {
      ledger.push(this.ledger({
        generatedAt,
        type: 'observation',
        lane: 'red',
        decision: 'rejected',
        risk: 'high',
        summary: 'Security-policy learning is blocked by the adaptive learning firewall.',
        evidenceRefs: ['security-policy-pattern'],
      }));
    }

    return this.snapshot({
      generatedAt,
      records,
      memoryWrites,
      shadowSkills,
      procedures,
      ledger,
      technicalScan,
      semanticClassification,
    });
  }

  public async recallMemory(
    input: ZavorthAdaptiveMultilingualRecallInput,
  ): Promise<ZavorthAdaptiveMultilingualRecallResult> {
    return this.multilingualRecall.search(input);
  }

  public renderText(
    snapshot: ZavorthAdaptiveLearningSnapshot,
    options: ZavorthAdaptiveLearningRenderOptions = {},
  ): string {
    return this.i18n.render(snapshot, options);
  }

  private snapshot(input: {
    generatedAt: string;
    records: ZavorthAdaptiveUserModelRecord[];
    memoryWrites: ZavorthLearningMemoryReceipt[];
    shadowSkills: ZavorthAdaptiveShadowSkillDraft[];
    procedures: ZavorthAdaptiveProcedureDraft[];
    ledger: ZavorthAdaptiveLearningLedgerEntry[];
    technicalScan: ZavorthAdaptiveTechnicalScan;
    semanticClassification: ZavorthAdaptiveSemanticClassification | null;
  }): ZavorthAdaptiveLearningSnapshot {
    const redApprovalRequired = input.ledger.filter((entry) => entry.lane === 'red'
      && entry.decision === 'requires_approval').length;
    const rejected = input.ledger.filter((entry) => entry.decision === 'rejected').length;
    const greenAutoApplied = input.ledger.filter((entry) => entry.lane === 'green'
      && entry.decision === 'auto_applied').length;
    const yellowDigestItems = input.ledger.filter((entry) => entry.lane === 'yellow').length;
    const status: ZavorthAdaptiveLearningSnapshot['status'] = rejected > 0
      ? 'blocked'
      : redApprovalRequired > 0
        ? 'attention'
        : 'ready';

    return {
      contractVersion: ZAVORTH_ADAPTIVE_LEARNING_OS_CONTRACT_VERSION,
      generatedAt: input.generatedAt,
      source: 'ZavorthAdaptiveLearningOsService',
      status,
      summary: {
        greenAutoApplied,
        yellowDigestItems,
        redApprovalRequired,
        userModelRecords: input.records.length,
        shadowSkillDrafts: input.shadowSkills.length,
        procedureDrafts: input.procedures.length,
        technicalScannerFindings: input.technicalScan.findings.length,
        semanticClassifierUsed: Boolean(input.semanticClassification),
        multilingualRecallReady: true,
        i18nReady: true,
      },
      lanes: {
        green: this.lane('green', input.ledger),
        yellow: this.lane('yellow', input.ledger),
        red: this.lane('red', input.ledger),
      },
      userModel: {
        mode: 'evidence-bound',
        localOnly: true,
        userEditable: true,
        records: input.records,
      },
      memoryWrites: input.memoryWrites,
      shadowSkills: input.shadowSkills,
      procedures: input.procedures,
      classification: {
        technical: input.technicalScan,
        semantic: input.semanticClassification,
      },
      ledger: {
        entries: input.ledger,
        appendOnly: true,
        canForget: true,
        canCorrect: true,
      },
      safety: {
        localOnly: true,
        rawPsychologicalDiagnosisBlocked: true,
        sensitiveInferencesNeedApproval: true,
        securityPolicyLearningBlocked: true,
        redLaneNeverSilent: true,
        technicalScannerReady: true,
        semanticClassifierGoverned: true,
        multilingualRecallLocalOnly: true,
        operatorI18nReady: true,
        noExternalIoPerformed: true,
        noWorkspaceMutationPerformed: true,
      },
      invariants: {
        everyDurableBehaviorChangeRequiresApproval: true,
        userModelClaimsCarryEvidence: true,
        userCanEditOrForgetClaims: true,
        autoSkillsStartAsDrafts: true,
        shadowLearningBeforePromotion: true,
        greenLaneLimitedToLowRiskReversibleLearning: true,
      },
      commands: {
        inspect: 'npm run zavorth:adaptive-learning-os',
        inspectJson: 'npm run zavorth:adaptive-learning-os:json',
        observe: 'npm run zavorth:adaptive-learning-os -- --observe "<observation>"',
        check: 'npm run zavorth:adaptive-learning-os:check --silent',
      },
    };
  }

  private lane(
    id: ZavorthAdaptiveLearningLaneId,
    ledger: ZavorthAdaptiveLearningLedgerEntry[],
  ): ZavorthAdaptiveLearningLaneSnapshot {
    const entries = ledger.filter((entry) => entry.lane === id);
    const labels: Record<ZavorthAdaptiveLearningLaneId, ZavorthAdaptiveLearningLaneSnapshot['label']> = {
      green: 'Green Lane',
      yellow: 'Yellow Lane',
      red: 'Red Lane',
    };
    const modes: Record<ZavorthAdaptiveLearningLaneId, ZavorthAdaptiveLearningLaneSnapshot['mode']> = {
      green: 'silent',
      yellow: 'digest',
      red: 'approval',
    };
    const actions: Record<ZavorthAdaptiveLearningLaneId, string[]> = {
      green: ['auto-apply-low-risk-memory', 'write-receipt', 'allow-forget-correct'],
      yellow: ['stage-draft', 'sandbox-before-promotion', 'summarize-in-digest'],
      red: ['require-explicit-approval', 'block-diagnosis', 'block-policy-learning'],
    };
    return {
      id,
      label: labels[id],
      mode: modes[id],
      decisions: Array.from(new Set(entries.map((entry) => entry.decision))),
      items: entries.length,
      allowedActions: actions[id],
    };
  }

  private userModelRecord(
    observation: string,
    generatedAt: string,
    technicalScan: ZavorthAdaptiveTechnicalScan,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
  ): ZavorthAdaptiveUserModelRecord {
    const sensitivity = this.sensitivity(technicalScan, semanticClassification);
    const lane = this.laneForClassification(technicalScan, semanticClassification, sensitivity);
    const usedFor = this.usedFor(observation, sensitivity, semanticClassification);
    const status = sensitivity === 'blocked'
      ? 'rejected'
      : lane === 'green'
        ? 'auto_accepted'
        : 'requires_review';
    return {
      id: this.id('user-model', observation),
      claim: this.claimFor(observation, sensitivity, semanticClassification),
      evidence: [
        this.evidenceRef(observation),
        ...technicalScan.evidence,
        ...(semanticClassification?.evidence || []),
      ],
      confidence: semanticClassification?.confidence ?? (sensitivity === 'normal' ? 0.82 : 0.42),
      sensitivity,
      expiresAt: sensitivity === 'normal' && lane === 'green'
        ? new Date(new Date(generatedAt).getTime() + 180 * 24 * 60 * 60 * 1000).toISOString()
        : null,
      userEditable: true,
      usedFor,
      status,
      lane,
    };
  }

  private shadowSkill(
    observation: string,
    generatedAt: string,
    assessmentDecision: string,
  ): ZavorthAdaptiveShadowSkillDraft {
    return {
      id: this.id('shadow-skill', observation),
      title: this.titleFromObservation('Shadow skill', observation),
      lane: 'yellow',
      state: 'drafted',
      intent: this.redact(observation),
      installBlocked: true,
      sandboxRequired: true,
      promotionRequiresApproval: true,
      evidence: [this.evidenceRef(observation), `skill-assessment:${assessmentDecision}`, `created-at:${generatedAt}`],
    };
  }

  private procedureDraft(observation: string, generatedAt: string): ZavorthAdaptiveProcedureDraft {
    return {
      id: this.id('procedure', observation),
      title: this.titleFromObservation('Procedure', observation),
      lane: 'yellow',
      status: 'draft',
      summary: `Draft procedure from observed workflow: ${this.redact(observation, 180)}`,
      promotionRequiresApproval: true,
      evidence: [this.evidenceRef(observation), `created-at:${generatedAt}`],
    };
  }

  private decisionForRecord(record: ZavorthAdaptiveUserModelRecord): ZavorthAdaptiveLearningDecision {
    if (record.status === 'auto_accepted') return 'auto_applied';
    if (record.lane === 'yellow') return 'staged_for_digest';
    if (record.status === 'requires_review') return 'requires_approval';
    return 'rejected';
  }

  private ledger(input: {
    generatedAt: string;
    type: ZavorthAdaptiveLearningLedgerEntry['type'];
    lane: ZavorthAdaptiveLearningLaneId;
    decision: ZavorthAdaptiveLearningDecision;
    risk: ZavorthLearningMemoryRisk;
    summary: string;
    evidenceRefs: string[];
  }): ZavorthAdaptiveLearningLedgerEntry {
    return {
      id: this.id('ledger', `${input.generatedAt}:${input.type}:${input.lane}:${input.summary}`),
      generatedAt: input.generatedAt,
      type: input.type,
      lane: input.lane,
      decision: input.decision,
      risk: input.risk,
      summary: input.summary,
      evidenceRefs: input.evidenceRefs,
      reversible: true,
      rollbackRef: input.decision === 'auto_applied' ? `rollback:${this.id('rollback', input.summary)}` : null,
    };
  }

  private sensitivity(
    technicalScan: ZavorthAdaptiveTechnicalScan,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
  ): ZavorthAdaptiveLearningSensitivity {
    if (technicalScan.sensitivity !== 'normal') return technicalScan.sensitivity;
    if (!semanticClassification) return 'normal';
    if (semanticClassification.sensitivity === 'blocked' || semanticClassification.risk === 'high') return 'blocked';
    if (semanticClassification.sensitivity === 'sensitive' || semanticClassification.recommendedLane === 'red') return 'sensitive';
    return 'normal';
  }

  private laneForClassification(
    technicalScan: ZavorthAdaptiveTechnicalScan,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
    sensitivity: ZavorthAdaptiveLearningSensitivity,
  ): ZavorthAdaptiveLearningLaneId {
    if (technicalScan.sensitivity !== 'normal') return technicalScan.lane;
    if (sensitivity !== 'normal') return 'red';
    if (!semanticClassification) return 'green';
    if (semanticClassification.recommendedLane === 'yellow' || semanticClassification.confidence < 0.75) return 'yellow';
    return semanticClassification.recommendedLane;
  }

  private usedFor(
    observation: string,
    sensitivity: ZavorthAdaptiveLearningSensitivity,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
  ): ZavorthUserModelUse[] {
    if (sensitivity !== 'normal') return ['safety_only'];
    if (semanticClassification?.usedFor.length) {
      return Array.from(new Set(semanticClassification.usedFor));
    }
    const uses = new Set<ZavorthUserModelUse>(['memory_recall']);
    const normalized = this.normalizeForPolicy(observation);
    if (/\b(direct|direto|direta|concise|conciso|portuguese|portugues|respostas?|answers?|evidence|evidencia|tradeoffs?)\b/i.test(normalized)) {
      uses.add('response_style');
      uses.add('planning_depth');
    }
    if (this.looksLikeSkillOrProcedure(observation)) {
      uses.add('skill_recommendation');
      uses.add('tool_routing');
    }
    return Array.from(uses);
  }

  private claimFor(
    observation: string,
    sensitivity: ZavorthAdaptiveLearningSensitivity,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
  ): string {
    if (semanticClassification?.claim) {
      return this.redact(semanticClassification.claim, 260);
    }
    if (sensitivity === 'blocked') {
      return this.containsSecret(observation)
        ? 'Blocked raw secret from adaptive learning.'
        : 'Blocked attempt to teach security-policy behavior.';
    }
    if (sensitivity === 'sensitive') {
      return 'Sensitive user-state inference detected; keep as review-only safety context, not a durable profile belief.';
    }
    const normalized = this.normalizeForPolicy(observation);
    if (/\b(portuguese|portugues|evidence|evidencia|direct|direto|direta|concise|conciso|tradeoffs?)\b/i.test(normalized)) {
      return 'The user prefers direct Portuguese answers with evidence and concise tradeoffs.';
    }
    if (this.looksLikeSkillOrProcedure(observation)) {
      return 'The user benefits from reusable workflow drafts when a successful task pattern repeats.';
    }
    return `The user showed a low-risk work preference: ${this.redact(observation, 220)}`;
  }

  private riskForRecord(
    record: ZavorthAdaptiveUserModelRecord,
    technicalScan: ZavorthAdaptiveTechnicalScan,
    semanticClassification: ZavorthAdaptiveSemanticClassification | null,
  ): ZavorthLearningMemoryRisk {
    if (technicalScan.risk === 'high') return 'high';
    if (record.sensitivity === 'blocked') return 'high';
    if (record.sensitivity === 'sensitive') return 'medium';
    if (semanticClassification?.risk) return semanticClassification.risk;
    return 'low';
  }

  private looksLikeSkillOrProcedure(observation: string): boolean {
    const normalized = this.normalizeForPolicy(observation);
    return SKILL_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  private touchesSecurityPolicy(observation: string): boolean {
    return this.technicalScanner.scan(observation).policyChange;
  }

  private titleFromObservation(prefix: string, observation: string): string {
    const words = this.redact(observation, 80)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .join(' ');
    return `${prefix}: ${words || 'adaptive learning draft'}`;
  }

  private evidenceRef(observation: string): string {
    return `observation:${this.id('evidence', observation)}`;
  }

  private id(prefix: string, value: string): string {
    const hash = crypto.createHash('sha256')
      .update(value)
      .digest('hex')
      .slice(0, 16);
    return `${prefix}:${hash}`;
  }

  private clean(value: unknown, maxChars = 1200): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxChars);
  }

  private normalizeForPolicy(value: unknown): string {
    return this.technicalScanner.normalizeForPolicy(value);
  }

  private containsSecret(value: unknown): boolean {
    return this.technicalScanner.scan(value).containsSecret;
  }

  private redact(value: unknown, maxChars = 1200): string {
    return this.technicalScanner.redact(value, maxChars);
  }
}
