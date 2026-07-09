import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type {
  ZavorthMutationPlan,
  ZavorthMutationRiskLevel,
  ZavorthReadinessGate,
} from '../contracts/ZavorthMutationPlaneContract.js';
import { ZavorthAutomationControlPlaneService } from './ZavorthAutomationControlPlaneService.js';
import { ZavorthFederatedMeshControlPlaneService } from './ZavorthFederatedMeshControlPlaneService.js';
import { ZavorthHardwareActionPlaneService } from './ZavorthHardwareActionPlaneService.js';
import { ZavorthMutationPlaneService } from './ZavorthMutationPlaneService.js';
import { ZavorthReplayLearningService } from './ZavorthReplayLearningService.js';
import { ZavorthRolloutReadinessControlPlaneService } from './ZavorthRolloutReadinessControlPlaneService.js';
import { ZavorthSandboxControlPlaneService } from './ZavorthSandboxControlPlaneService.js';
import { ZavorthSkillEvolutionService } from './ZavorthSkillEvolutionService.js';
import { TrustDecisionService } from './TrustDecisionService.js';
import { TrustPlanePolicyLedgerService } from './TrustPlanePolicyLedgerService.js';
import { CanvasWorkspaceService } from './CanvasWorkspaceService.js';
import type {
  AutonomousMissionCheckpoint,
  AutonomousMissionDelegateInput,
  AutonomousMissionDelegateResult,
  AutonomousMissionEvidence,
  AutonomousMissionProgressInput,
  AutonomousMissionProgressResult,
  AutonomousMissionRecord,
  AutonomousMissionStatus,
  AutonomousMissionUsage,
  AutonomousPartnerAuditEntry,
  AutonomousPartnerSnapshot,
  AutonomousPartnerSourceHealth,
  AutonomousPartnerState,
  AutonomousMissionPolicy,
  ZavorthAutonomyBudget,
  ZavorthAutonomyLevel,
} from '../contracts/AutonomousEngineeringPartnerContract.js';
import { logger } from '../logger.js';
import {
AUTONOMY_LEVELS,
  buildAuditId,
  buildEvidenceId,
  buildMissionId,
  cleanText,
  gateStatusToCheckpoint,
  infersMutableMission,
  nonNegative,
  normalizeAutonomyLevel,
  normalizeBudgetScope,
  normalizeCheckpointStatus,
  normalizeEvidenceKind,
  normalizeEvidenceStatus,
  normalizeId,
  normalizeList,
  normalizeMissionStatus,
  normalizeRisk,
  normalizeSuccessCriteria,
  nullableText,
  positiveNumber,
  riskRank,
  statusFromPosture,
} from './autonomous-partner/AutonomousPartnerUtils.js';

export type {
  AutonomousMissionCheckpoint,
  AutonomousMissionDelegateInput,
  AutonomousMissionDelegateResult,
  AutonomousMissionEvidence,
  AutonomousMissionProgressInput,
  AutonomousMissionProgressResult,
  AutonomousMissionRecord,
  AutonomousMissionStatus,
  AutonomousMissionUsage,
  AutonomousPartnerAuditEntry,
  AutonomousPartnerSnapshot,
  AutonomousPartnerSourceHealth,
  AutonomousPartnerState,
  ZavorthAutonomyBudget,
  ZavorthAutonomyLevel,
} from '../contracts/AutonomousEngineeringPartnerContract.js';

interface ControlPlaneSnapshot {
  unavailable?: boolean;
  error?: string;
  summary?: {
    posture?: string;
    gateStatus?: string;
    canProceed?: boolean;
    untrustedExecutionReady?: boolean;
    infrastructureState?: string;
    emergencyStopActive?: boolean;
  };
  narrative?: {
    operatorSummary?: string;
    headline?: string;
  };
  regressionGate?: {
    canProceed?: boolean;
    rolloutBlocked?: boolean;
  };
  actions?: any[];
}

type SnapshotLike = {
  buildSnapshot: (input?: Record<string, unknown>) => ControlPlaneSnapshot | Promise<ControlPlaneSnapshot>;
};

type MutationPlaneLike = Pick<
  ZavorthMutationPlaneService,
  'createPlan' | 'listPlans' | 'readPlan' | 'approvePlan' | 'attachApproval' | 'markApplied' | 'markBlocked'
>;

type AutonomousPartnerRuntime = {
  now?: () => Date;
  workspaceRoot?: string | null;
  stateFile?: string | null;
  rolloutReadinessService?: SnapshotLike | null;
  sandboxControlPlaneService?: SnapshotLike | null;
  federatedMeshService?: SnapshotLike | null;
  canvasWorkspaceService?: SnapshotLike | null;
  automationControlPlaneService?: SnapshotLike | null;
  evalControlPlaneService?: SnapshotLike | null;
  replayLearningService?: SnapshotLike | null;
  skillEvolutionService?: SnapshotLike | null;
  hardwareActionPlaneService?: SnapshotLike | null;
  mutationPlaneService?: MutationPlaneLike | null;
  trustDecisionService?: Pick<TrustDecisionService, 'evaluate'> | null;
  policyLedgerService?: Pick<TrustPlanePolicyLedgerService, 'append' | 'summarize'> | null;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type AutonomousPartnerSources = {
  rollout: ControlPlaneSnapshot | null;
  sandbox: ControlPlaneSnapshot | null;
  federatedMesh: ControlPlaneSnapshot | null;
  canvas: ControlPlaneSnapshot | null;
  automation: ControlPlaneSnapshot | null;
  evals: ControlPlaneSnapshot | null;
  replayLearning: ControlPlaneSnapshot | null;
  skillEvolution: ControlPlaneSnapshot | null;
  hardware: ControlPlaneSnapshot | null;
};

const DEFAULT_USAGE: AutonomousMissionUsage = {
  actions: 0,
  mutableActions: 0,
  cost: 0,
  durationMs: 0,
  networkCalls: 0,
  filesystemWrites: 0,
  externalDeliveries: 0,
  failures: 0,
};

export class ZavorthAutonomousEngineeringPartnerService {
  private readonly now: () => Date;
  private readonly workspaceRoot: string;
  private readonly stateFile: string;
  private readonly rolloutReadiness: SnapshotLike | null;
  private readonly sandboxControlPlane: SnapshotLike | null;
  private readonly federatedMesh: SnapshotLike | null;
  private readonly canvasWorkspace: SnapshotLike | null;
  private readonly automationControlPlane: SnapshotLike | null;
  private readonly evalControlPlane: SnapshotLike | null;
  private readonly replayLearning: SnapshotLike | null;
  private readonly skillEvolution: SnapshotLike | null;
  private readonly hardwareActionPlane: SnapshotLike | null;
  private readonly mutationPlane: MutationPlaneLike;
  private readonly trustDecision: Pick<TrustDecisionService, 'evaluate'>;
  private readonly policyLedger: Pick<TrustPlanePolicyLedgerService, 'append' | 'summarize'>;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly mkdirSync: typeof fs.mkdirSync;

  constructor(runtime: AutonomousPartnerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspaceRoot = String(runtime.workspaceRoot || config.projectRoot || process.cwd()).trim();
    this.stateFile = String(
      runtime.stateFile
      || path.join(this.workspaceRoot, 'data', 'runtime', 'autonomous-partner', 'missions.json'),
    );
    this.rolloutReadiness = runtime.rolloutReadinessService === null
      ? null
      : runtime.rolloutReadinessService || new ZavorthRolloutReadinessControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.sandboxControlPlane = runtime.sandboxControlPlaneService === null
      ? null
      : runtime.sandboxControlPlaneService || new ZavorthSandboxControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.federatedMesh = runtime.federatedMeshService === null
      ? null
      : runtime.federatedMeshService || new ZavorthFederatedMeshControlPlaneService({ now: this.now });
    this.canvasWorkspace = runtime.canvasWorkspaceService === null
      ? null
      : runtime.canvasWorkspaceService || new CanvasWorkspaceService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.automationControlPlane = runtime.automationControlPlaneService === null
      ? null
      : runtime.automationControlPlaneService || new ZavorthAutomationControlPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.evalControlPlane = runtime.evalControlPlaneService === null
      ? null
      : runtime.evalControlPlaneService || null;
    this.replayLearning = runtime.replayLearningService === null
      ? null
      : runtime.replayLearningService || new ZavorthReplayLearningService({ now: this.now, projectRoot: this.workspaceRoot });
    this.skillEvolution = runtime.skillEvolutionService === null
      ? null
      : runtime.skillEvolutionService || new ZavorthSkillEvolutionService({ now: this.now, projectRoot: this.workspaceRoot });
    this.hardwareActionPlane = runtime.hardwareActionPlaneService === null
      ? null
      : runtime.hardwareActionPlaneService || new ZavorthHardwareActionPlaneService({ now: this.now, workspaceRoot: this.workspaceRoot });
    this.mutationPlane = runtime.mutationPlaneService || new ZavorthMutationPlaneService();
    this.trustDecision = runtime.trustDecisionService || new TrustDecisionService();
    this.policyLedger = runtime.policyLedgerService || new TrustPlanePolicyLedgerService();
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSync = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSync = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public async buildSnapshot(input: { limit?: number; includeSources?: boolean } = {}): Promise<AutonomousPartnerSnapshot> {
    const limit = Math.max(1, Math.min(Number(input.limit || 12), 50));
    const state = this.readState();
    const sources = await this.readSources();
    const sourceHealth = this.buildSourceHealth(sources);
    const pendingPlans = this.listPendingMissionPlans(limit);
    const missions = Object.values(state.missions)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, limit);
    const activeMissions = missions.filter((entry) => entry.status === 'running' || entry.status === 'planned').length;
    const pausedMissions = missions.filter((entry) => entry.status === 'paused').length;
    const blockedMissions = missions.filter((entry) => entry.status === 'blocked' || entry.status === 'failed').length;
    const completedMissions = missions.filter((entry) => entry.status === 'completed').length;
    const pendingMissionApprovals = missions.filter((entry) => entry.status === 'waiting_approval').length + pendingPlans.length;
    const unavailableSourcePlanes = sourceHealth.filter((entry) => entry.status === 'unavailable').length;
    const summary = {
      posture: this.resolveSnapshotPosture({
        pausedMissions,
        blockedMissions,
        pendingMissionApprovals,
        unavailableSourcePlanes,
        sourceHealth,
      }),
      missions: missions.length,
      activeMissions,
      pausedMissions,
      blockedMissions,
      completedMissions,
      pendingMissionApprovals,
      sourcePlanes: sourceHealth.length,
      unavailableSourcePlanes,
      heavyRuntimesStarted: false as const,
      coreIdle: activeMissions === 0,
    };
    const actions = this.buildSuggestedActions(summary, missions);
    return {
      generatedAt: this.now().toISOString(),
      workspaceRoot: this.workspaceRoot,
      summary,
      autonomyLevels: this.describeAutonomyLevels(),
      policy: {
        missionControlOnly: true,
        directExecutionOnRead: false,
        mutableMissionsCreateMutationPlan: true,
        budgetPauseRequired: true,
        evidenceRequiredForCompletion: true,
        trustPlaneDomain: 'autonomous-partner',
        controlPlanes: [
          'rollout-readiness',
          'sandbox',
          'federated-mesh',
          'workspace-canvas',
          'automations',
          'evals',
          'replay-learning',
          'skill-evolution',
          'hardware',
        ],
      },
      missions,
      sourceHealth,
      pendingPlans,
      audit: state.audit.slice(0, limit),
      actions,
      narrative: {
        headline: 'Etapa 24: Autonomous Engineering Partner',
        operatorSummary:
          `${missions.length} missao(oes), ${activeMissions} ativa(s), ${pausedMissions} pausada(s), `
          + `${pendingMissionApprovals} approval(s) pendente(s), core idle=${summary.coreIdle ? 'sim' : 'nao'}, `
          + `runtime pesado iniciado=${summary.heavyRuntimesStarted ? 'sim' : 'nao'}.`,
        nextAction: actions[0]?.label || 'Delegar uma missao com budget explicito e revisar os checkpoints antes de aplicar.',
      },
    };
  }

  public async delegateMission(input: AutonomousMissionDelegateInput): Promise<AutonomousMissionDelegateResult> {
    const objective = cleanText(input.objective, '');
    if (!objective) {
      throw new Error('objective obrigatorio para delegar missao autonoma.');
    }
    const sources = await this.readSources();
    const autonomyLevel = normalizeAutonomyLevel(input.autonomyLevel);
    const riskLevel = normalizeRisk(input.riskLevel);
    const successCriteria = normalizeSuccessCriteria(input.successCriteria);
    const budget = this.normalizeBudget(input.budget, autonomyLevel, riskLevel);
    const policy = this.buildMissionPolicy({
      objective,
      autonomyLevel,
      riskLevel,
      mutable: input.mutable,
    });
    const checkpoints = this.buildCheckpoints({ objective, policy, budget, sources });
    const readinessGate = this.buildReadinessGate(objective, budget, checkpoints);
    const planSteps = this.buildMissionPlan({ objective, policy, checkpoints });
    const createdAt = this.now().toISOString();
    const mission: AutonomousMissionRecord = {
      id: buildMissionId(objective, this.now),
      objective,
      context: nullableText(input.context),
      autonomyLevel,
      riskLevel,
      status: readinessGate.canProceed ? 'planned' : 'blocked',
      createdAt,
      updatedAt: createdAt,
      requestedBy: nullableText(input.requestedBy),
      sourceSurface: nullableText(input.sourceSurface) || 'autonomous-partner',
      successCriteria,
      budget,
      usage: { ...DEFAULT_USAGE },
      policy,
      plan: planSteps,
      checkpoints,
      evidence: this.evidenceFromCheckpoints(checkpoints),
      mutationPlanId: null,
      trustDecision: null,
      pauseReason: readinessGate.canProceed ? null : readinessGate.blockers[0] || 'Readiness gate bloqueou a missao.',
      result: null,
    };
    const mutationPlan = this.mutationPlane.createPlan({
      domain: 'autonomous-partner',
      actionId: 'mission.delegate',
      title: `Missao: ${objective.slice(0, 80)}`,
      summary: `Delegar missao ${autonomyLevel} com budget e checkpoints supervisionados.`,
      requestedBy: mission.requestedBy,
      sourceSurface: mission.sourceSurface,
      riskLevel,
      approvalRequired: policy.approvalRequired,
      approvalReason: policy.approvalReason,
      resourceImpact: {
        ramMb: 96,
        diskMb: 32,
        processCount: 0,
        externalExposure: policy.meshRoutingAllowed || policy.hardwareActionsAllowed ? 'local' : 'none',
        recurring: policy.automationAllowed,
        notes: [
          `autonomy=${autonomyLevel}`,
          `budget.maxActions=${budget.maxActions}`,
          `budget.maxDurationMs=${budget.maxDurationMs}`,
          'delegation does not start heavy runtimes',
        ],
      },
      readinessGates: [readinessGate],
      validationPlan: [
        'Verificar checkpoints de rollout, sandbox, eval e policy antes de qualquer apply.',
        'Registrar evidencias de testes, diffs, logs e rollback.',
        'Pausar automaticamente se budget, risco, custo, tempo ou falhas excederem limites.',
      ],
      rollbackPlan: [
        'Parar a missao e bloquear novos applies.',
        'Usar rollback do Mutation Plane/action plane especifico quando houver.',
        'Preservar evidencias compactas para auditoria.',
      ],
      payload: {
        missionId: mission.id,
        objective,
        autonomyLevel,
        riskLevel,
        budget,
        policy,
        checkpoints: checkpoints.map((entry) => ({
          id: entry.id,
          status: entry.status,
          required: entry.required,
          plane: entry.plane,
        })),
      },
      ttlMs: 12 * 60 * 60 * 1000,
    });
    mission.mutationPlanId = mutationPlan.id;
    let linkedPlan = mutationPlan;
    const trustDecision = await this.trustDecision.evaluate({
      domain: 'autonomous-partner',
      actionId: 'mission.delegate',
      planId: mutationPlan.id,
      requestedBy: mission.requestedBy,
      sourceSurface: mission.sourceSurface,
      riskLevel,
      approvalRequired: policy.approvalRequired,
      capabilityId: `autonomous-partner.${autonomyLevel}`,
      reason: policy.approvalReason,
      payload: {
        missionId: mission.id,
        autonomyLevel,
        objective,
      },
      resourceImpact: mutationPlan.resourceImpact,
      approvalScope: autonomyLevel === 'autonomous-with-budget' ? 'once' : 'session',
    });
    mission.trustDecision = trustDecision;
    if (trustDecision.permission) {
      linkedPlan = this.mutationPlane.attachApproval(mutationPlan.id, {
        permissionId: trustDecision.permission.permission_id,
        status: trustDecision.decision === 'requires_approval' ? 'pending' : 'approved',
        reason: trustDecision.reason,
      });
    }
    if (!readinessGate.canProceed || trustDecision.decision === 'blocked') {
      linkedPlan = this.mutationPlane.markBlocked(
        linkedPlan.id,
        trustDecision.decision === 'blocked' ? trustDecision.reason : readinessGate.blockers[0] || 'Mission readiness blocked.',
      );
      mission.status = 'blocked';
      mission.pauseReason = linkedPlan.audit.at(-1)?.message || mission.pauseReason;
    } else if (linkedPlan.status === 'waiting_approval') {
      mission.status = 'waiting_approval';
    }
    this.upsertMission(mission, `Missao ${mission.id} delegada como ${mission.status}.`);
    this.appendLedger({
      status: mission.status === 'blocked' ? 'blocked' : 'previewed',
      mission,
      planId: linkedPlan.id,
      summary: trustDecision.reason,
    });
    return {
      generatedAt: this.now().toISOString(),
      status: mission.status,
      ok: mission.status !== 'blocked',
      summary: trustDecision.reason,
      mission,
      mutationPlan: linkedPlan,
      trustDecision,
      readinessGate,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async approveMission(input: {
    missionId: string;
    approvedBy?: string | null;
    scope?: 'once' | 'session' | 'host' | null;
  }): Promise<AutonomousMissionProgressResult> {
    const state = this.readState();
    const mission = state.missions[normalizeId(input.missionId)];
    if (!mission) {
      return this.progressBlocked('Missao nao encontrada para approval.', null);
    }
    if (!mission.mutationPlanId) {
      return this.progressBlocked('Missao nao possui MutationPlan associado.', mission);
    }
    const plan = this.mutationPlane.approvePlan(mission.mutationPlanId, {
      approvedBy: input.approvedBy || null,
      scope: input.scope || 'once',
    });
    mission.status = mission.status === 'waiting_approval' ? 'running' : mission.status;
    mission.updatedAt = this.now().toISOString();
    mission.evidence.unshift(this.buildEvidence({
      kind: 'approval',
      status: 'passed',
      summary: `MutationPlan ${plan.id} aprovado.`,
      ref: `mutation-plan:${plan.id}`,
    }));
    this.writeMission(state, mission, `Missao ${mission.id} aprovada.`);
    return {
      generatedAt: this.now().toISOString(),
      status: mission.status,
      ok: true,
      summary: `Missao ${mission.id} aprovada e pronta para execucao supervisionada.`,
      blockers: [],
      mission,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async recordProgress(input: AutonomousMissionProgressInput): Promise<AutonomousMissionProgressResult> {
    const state = this.readState();
    const mission = state.missions[normalizeId(input.missionId)];
    if (!mission) {
      return this.progressBlocked('Missao nao encontrada para progresso.', null);
    }
    mission.usage = this.mergeUsage(mission.usage, input);
    if (input.evidence) {
      mission.evidence.unshift(this.buildEvidence(input.evidence));
    }
    if (input.status) {
      mission.status = normalizeMissionStatus(input.status);
    } else if (mission.status === 'planned' || mission.status === 'waiting_approval') {
      mission.status = mission.status === 'waiting_approval' ? 'waiting_approval' : 'running';
    }
    const blockers = this.evaluateBudget(mission, input.riskLevel);
    if (blockers.length > 0) {
      mission.status = 'paused';
      mission.pauseReason = blockers[0];
      mission.evidence.unshift(this.buildEvidence({
        kind: 'log',
        status: 'warning',
        summary: `Missao pausada: ${blockers[0]}`,
        ref: null,
      }));
    }
    mission.updatedAt = this.now().toISOString();
    this.writeMission(state, mission, cleanText(input.summary, `Progresso registrado para ${mission.id}.`));
    return {
      generatedAt: this.now().toISOString(),
      status: mission.status,
      ok: blockers.length === 0,
      summary: blockers[0] || 'Progresso registrado dentro do budget.',
      blockers,
      mission,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async pauseMission(input: {
    missionId: string;
    reason?: string | null;
    requestedBy?: string | null;
  }): Promise<AutonomousMissionProgressResult> {
    const state = this.readState();
    const mission = state.missions[normalizeId(input.missionId)];
    if (!mission) {
      return this.progressBlocked('Missao nao encontrada para pausa.', null);
    }
    mission.status = 'paused';
    mission.pauseReason = cleanText(input.reason, 'Pausa manual solicitada.');
    mission.updatedAt = this.now().toISOString();
    mission.evidence.unshift(this.buildEvidence({
      kind: 'log',
      status: 'warning',
      summary: mission.pauseReason,
      ref: null,
    }));
    this.writeMission(state, mission, `Missao ${mission.id} pausada.`);
    return {
      generatedAt: this.now().toISOString(),
      status: mission.status,
      ok: true,
      summary: mission.pauseReason,
      blockers: [],
      mission,
      snapshot: await this.buildSnapshot(),
    };
  }

  public async completeMission(input: {
    missionId: string;
    summary?: string | null;
    tests?: string[] | string | null;
    diffs?: string[] | string | null;
    logs?: string[] | string | null;
    rollbackAvailable?: boolean;
    rollbackPlan?: string[] | string | null;
  }): Promise<AutonomousMissionProgressResult> {
    const state = this.readState();
    const mission = state.missions[normalizeId(input.missionId)];
    if (!mission) {
      return this.progressBlocked('Missao nao encontrada para conclusao.', null);
    }
    const blockers = this.evaluateBudget(mission, null);
    if (blockers.length > 0) {
      mission.status = 'paused';
      mission.pauseReason = blockers[0];
      mission.updatedAt = this.now().toISOString();
      this.writeMission(state, mission, `Conclusao bloqueada para ${mission.id}.`);
      return {
        generatedAt: this.now().toISOString(),
        status: mission.status,
        ok: false,
        summary: blockers[0],
        blockers,
        mission,
        snapshot: await this.buildSnapshot(),
      };
    }
    const tests = normalizeList(input.tests);
    const diffs = normalizeList(input.diffs);
    const logs = normalizeList(input.logs);
    const rollbackPlan = normalizeList(input.rollbackPlan);
    mission.status = 'completed';
    mission.updatedAt = this.now().toISOString();
    mission.result = {
      status: 'completed',
      summary: cleanText(input.summary, 'Missao concluida com evidencias compactas.'),
      evidenceRefs: mission.evidence.map((entry) => entry.id).slice(0, 20),
      tests,
      diffs,
      logs,
      rollbackAvailable: input.rollbackAvailable === true,
      rollbackPlan,
      completedAt: this.now().toISOString(),
    };
    mission.evidence.unshift(this.buildEvidence({
      kind: 'checkpoint',
      status: 'passed',
      summary: mission.result.summary,
      ref: `mission:${mission.id}:result`,
    }));
    if (mission.mutationPlanId) {
      try {
        this.mutationPlane.markApplied(mission.mutationPlanId, mission.result.summary, ['mission.complete']);
      } catch (error: any) {
      // Completion evidence should survive even if the mutation plan was already expired or applied.
      logger.warn('[Zavorth Autonomous Engineering Partner] creation failed', error);
    }
    }
    this.writeMission(state, mission, `Missao ${mission.id} concluida.`);
    this.appendLedger({
      status: 'applied',
      mission,
      planId: mission.mutationPlanId,
      summary: mission.result.summary,
    });
    return {
      generatedAt: this.now().toISOString(),
      status: mission.status,
      ok: true,
      summary: mission.result.summary,
      blockers: [],
      mission,
      snapshot: await this.buildSnapshot(),
    };
  }

  public readMission(missionId: string): AutonomousMissionRecord | null {
    return this.readState().missions[normalizeId(missionId)] || null;
  }

  private async readSources(): Promise<AutonomousPartnerSources> {
    const [
      rollout,
      sandbox,
      federatedMesh,
      canvas,
      automation,
      evals,
      replayLearning,
      skillEvolution,
      hardware,
    ] = await Promise.all([
      this.safeSnapshot(this.rolloutReadiness, { scope: 'local', includeSources: false }),
      this.safeSnapshot(this.sandboxControlPlane, {}),
      this.safeSnapshot(this.federatedMesh, {}),
      this.safeSnapshot(this.canvasWorkspace, { limit: 8 }),
      this.safeSnapshot(this.automationControlPlane, { limit: 8 }),
      this.safeSnapshot(this.evalControlPlane, { sourceSurface: 'autonomous-partner' }),
      this.safeSnapshot(this.replayLearning, { limit: 8 }),
      this.safeSnapshot(this.skillEvolution, {}),
      this.safeSnapshot(this.hardwareActionPlane, {}),
    ]);
    return {
      rollout,
      sandbox,
      federatedMesh,
      canvas,
      automation,
      evals,
      replayLearning,
      skillEvolution,
      hardware,
    };
  }

  private async safeSnapshot(service: SnapshotLike | null, input: Record<string, unknown>): Promise<ControlPlaneSnapshot | null> {
    if (!service) {
      return null;
    }
    try {
      return await Promise.resolve(service.buildSnapshot(input));
    } catch (error: any) {
    logger.warn('[Zavorth Autonomous Engineering Partner] creation failed', error);
    return {
        unavailable: true,
        error: error instanceof Error ? error.message : String(error),
      };
  }
  }

  private buildMissionPolicy(input: {
    objective: string;
    autonomyLevel: ZavorthAutonomyLevel;
    riskLevel: ZavorthMutationRiskLevel;
    mutable?: boolean | null;
  }): AutonomousMissionPolicy {
    const text = input.objective.toLowerCase();
    const mutable = input.mutable === true || infersMutableMission(text);
    const rolloutGateRequired = mutable || /\b(deploy|release|production|prod|beta|rollback|publicar|lancar)\b/u.test(text);
    const sandboxRequired = /\b(codigo|code|script|patch|dependency|npm|python|powershell|unknown|internet|sandbox)\b/u.test(text);
    const meshRoutingAllowed = /\b(remote|remoto|server|servidor|gpu|node|fleet|celular|mobile)\b/u.test(text);
    const automationAllowed = /\b(automacao|automation|schedule|recorrente|todo dia|cron|outbox)\b/u.test(text);
    const hardwareActionsAllowed = /\b(hardware|iot|domotica|luz|sensor|mqtt|home assistant|device|dispositivo)\b/u.test(text);
    const learningAllowed = /\b(aprenda|learn|replay|skill|gêmeo|gemeo|style|estilo)\b/u.test(text);
    const approvalRequired =
      mutable
      || input.autonomyLevel === 'supervised'
      || input.autonomyLevel === 'delegated'
      || input.autonomyLevel === 'autonomous-with-budget'
      || riskRank(input.riskLevel) >= riskRank('high');
    return {
      approvalRequired,
      approvalReason: approvalRequired
        ? 'Missao autonoma ou mutavel exige approval, budget e checkpoints antes de execucao.'
        : 'Missao de assistencia/draft permanece em preview sem aplicar mutacoes.',
      applyMode: input.autonomyLevel === 'assist' || input.autonomyLevel === 'draft'
        ? 'preview-only'
        : input.autonomyLevel === 'autonomous-with-budget' ? 'budgeted-supervised' : 'approval-gated',
      rolloutGateRequired,
      sandboxRequired,
      meshRoutingAllowed,
      canvasReviewRequired: true,
      automationAllowed,
      evalRegressionGateRequired: rolloutGateRequired || mutable,
      replayLearningAllowed: learningAllowed,
      skillEvolutionAllowed: learningAllowed,
      hardwareActionsAllowed,
      trustPlaneDomain: 'autonomous-partner',
    };
  }

  private buildCheckpoints(input: {
    objective: string;
    policy: AutonomousMissionPolicy;
    budget: ZavorthAutonomyBudget;
    sources: AutonomousPartnerSources;
  }): AutonomousMissionCheckpoint[] {
    const checkpoints: AutonomousMissionCheckpoint[] = [
      this.checkpoint({
        id: 'mission-budget',
        label: 'Budget canonico',
        plane: 'autonomous-partner',
        required: true,
        status: 'passed',
        summary: `${input.budget.maxActions} action(s), ${input.budget.maxMutableActions} mutavel(eis), ${input.budget.maxDurationMs}ms.`,
        command: 'npm run ops:partner',
      }),
      this.checkpoint({
        id: 'canvas-review',
        label: 'Canvas para revisao',
        plane: 'workspace-canvas',
        required: input.policy.canvasReviewRequired,
        status: input.sources.canvas ? statusFromPosture(input.sources.canvas?.summary?.posture) : 'warning',
        summary: input.sources.canvas?.narrative?.operatorSummary || 'Canvas indisponivel; fallback CLI permanece valido.',
        command: 'npm run ops:canvas',
      }),
    ];
    if (input.policy.rolloutGateRequired) {
      checkpoints.push(this.checkpoint({
        id: 'rollout-readiness',
        label: 'Rollout readiness',
        plane: 'rollout-readiness',
        required: true,
        status: gateStatusToCheckpoint(input.sources.rollout?.summary?.gateStatus, input.sources.rollout?.summary?.canProceed),
        summary: input.sources.rollout?.narrative?.operatorSummary || 'Rollout gate indisponivel.',
        command: 'npm run ops:rollout-readiness',
      }));
    }
    if (input.policy.sandboxRequired) {
      const ready = input.sources.sandbox?.summary?.untrustedExecutionReady === true;
      checkpoints.push(this.checkpoint({
        id: 'sandbox-envelope',
        label: 'Sandbox para codigo desconhecido',
        plane: 'sandbox',
        required: false,
        status: ready ? 'passed' : 'warning',
        summary: ready
          ? 'Sandbox forte disponivel para trechos desconhecidos.'
          : 'Sandbox forte nao esta pronto; missao deve manter apply em preview/dry-run.',
        command: 'npm run ops:sandbox',
      }));
    }
    if (input.policy.meshRoutingAllowed) {
      const infra = String(input.sources.federatedMesh?.summary?.infrastructureState || 'dormant');
      checkpoints.push(this.checkpoint({
        id: 'federated-runtime-route',
        label: 'Escolha de runtime federado',
        plane: 'federated-mesh',
        required: false,
        status: infra === 'mesh_online' ? 'passed' : 'warning',
        summary: input.sources.federatedMesh?.narrative?.operatorSummary || 'Mesh dormente; fallback local deve existir.',
        command: 'npm run ops:federated-mesh',
      }));
    }
    if (input.policy.automationAllowed) {
      checkpoints.push(this.checkpoint({
        id: 'automation-outbox',
        label: 'Automation budget/outbox',
        plane: 'automations',
        required: false,
        status: statusFromPosture(input.sources.automation?.summary?.posture),
        summary: input.sources.automation?.narrative?.operatorSummary || 'Automations indisponivel; recorrencia deve ficar em draft.',
        command: 'npm run ops:automations',
      }));
    }
    if (input.policy.evalRegressionGateRequired) {
      const canProceed = input.sources.evals?.regressionGate?.canProceed !== false && input.sources.evals?.regressionGate?.rolloutBlocked !== true;
      checkpoints.push(this.checkpoint({
        id: 'eval-regression-gate',
        label: 'Eval regression gate',
        plane: 'evals',
        required: true,
        status: canProceed ? statusFromPosture(input.sources.evals?.summary?.posture) : 'blocked',
        summary: input.sources.evals?.narrative?.operatorSummary || 'Eval indisponivel; manter como draft ate haver evidencia.',
        command: 'npm run ops:evals',
      }));
    }
    if (input.policy.replayLearningAllowed) {
      checkpoints.push(this.checkpoint({
        id: 'replay-learning-suggest-only',
        label: 'Replay learning suggest-only',
        plane: 'replay-learning',
        required: false,
        status: statusFromPosture(input.sources.replayLearning?.summary?.posture),
        summary: input.sources.replayLearning?.narrative?.operatorSummary || 'Replay learning indisponivel.',
        command: 'npm run ops:replay-learning',
      }));
    }
    if (input.policy.skillEvolutionAllowed) {
      checkpoints.push(this.checkpoint({
        id: 'skill-evolution-draft-first',
        label: 'Skill evolution draft-first',
        plane: 'skill-evolution',
        required: false,
        status: statusFromPosture(input.sources.skillEvolution?.summary?.posture),
        summary: input.sources.skillEvolution?.actions?.[0] || 'Skill evolution deve ficar draft/sandbox/eval antes de install.',
        command: 'npm run ops:skill-evolution',
      }));
    }
    if (input.policy.hardwareActionsAllowed) {
      const blocked = input.sources.hardware?.summary?.emergencyStopActive === true;
      checkpoints.push(this.checkpoint({
        id: 'hardware-emergency-stop',
        label: 'Hardware emergency stop',
        plane: 'hardware',
        required: true,
        status: blocked ? 'blocked' : statusFromPosture(input.sources.hardware?.summary?.posture),
        summary: input.sources.hardware?.narrative?.operatorSummary || 'Hardware action plane indisponivel.',
        command: 'npm run ops:hardware',
      }));
    }
    checkpoints.push(this.checkpoint({
      id: 'final-evidence-pack',
      label: 'Evidence pack final',
      plane: 'autonomous-partner',
      required: true,
      status: 'pending',
      summary: 'Resultado deve incluir evidencias, testes, diffs, logs e rollback quando possivel.',
      command: 'npm run ops:partner',
    }));
    return checkpoints;
  }

  private buildReadinessGate(
    objective: string,
    budget: ZavorthAutonomyBudget,
    checkpoints: AutonomousMissionCheckpoint[],
  ): ZavorthReadinessGate {
    const requiredBlocked = checkpoints.filter((entry) => entry.required && entry.status === 'blocked');
    const warnings = checkpoints
      .filter((entry) => entry.status === 'warning')
      .map((entry) => `${entry.label}: ${entry.summary}`);
    const blockers = requiredBlocked.map((entry) => `${entry.label}: ${entry.summary}`);
    const status: ZavorthReadinessGate['status'] = blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed';
    return {
      id: 'autonomous-mission-readiness',
      status,
      canProceed: blockers.length === 0,
      scope: 'mission',
      reasons: [
        `Objetivo: ${objective}`,
        `${checkpoints.length} checkpoint(s) derivados dos control planes.`,
      ],
      warnings,
      blockers,
      checkedAt: this.now().toISOString(),
      budgets: { ...budget },
      evidence: checkpoints.map((entry) => ({
        id: entry.id,
        label: entry.label,
        status: entry.status,
        summary: entry.summary,
        command: entry.command,
        updatedAt: this.now().toISOString(),
      })),
      nextActions: checkpoints
        .filter((entry) => entry.status === 'blocked' || entry.status === 'warning')
        .map((entry) => entry.command)
        .filter((entry): entry is string => Boolean(entry)),
    };
  }

  private buildMissionPlan(input: {
    objective: string;
    policy: AutonomousMissionPolicy;
    checkpoints: AutonomousMissionCheckpoint[];
  }): string[] {
    const steps = [
      `Confirmar objetivo e criterio de sucesso: ${input.objective}`,
      'Projetar plano no Canvas ou fallback CLI.',
      'Consultar Trust Plane e Mutation Plane antes de mutacoes.',
    ];
    for (const checkpoint of input.checkpoints.filter((entry) => entry.id !== 'final-evidence-pack')) {
      steps.push(`Verificar ${checkpoint.label}: ${checkpoint.command || checkpoint.plane}.`);
    }
    if (input.policy.sandboxRequired) {
      steps.push('Executar codigo desconhecido em sandbox/dry-run antes de tocar no host real.');
    }
    if (input.policy.evalRegressionGateRequired) {
      steps.push('Rodar eval/regression gate antes de concluir ou promover.');
    }
    steps.push('Publicar pacote final com evidencias, testes, diffs, logs e rollback quando possivel.');
    return steps;
  }

  private evidenceFromCheckpoints(checkpoints: AutonomousMissionCheckpoint[]): AutonomousMissionEvidence[] {
    return checkpoints.map((entry) => this.buildEvidence({
      kind: 'checkpoint',
      status: entry.status === 'passed' ? 'passed' : entry.status === 'blocked' ? 'failed' : entry.status === 'skipped' ? 'skipped' : 'warning',
      summary: `${entry.label}: ${entry.summary}`,
      ref: entry.command || entry.sourceRef,
    }));
  }

  private checkpoint(input: Omit<AutonomousMissionCheckpoint, 'sourceRef' | 'evidenceRefs'> & {
    sourceRef?: string | null;
    evidenceRefs?: string[];
  }): AutonomousMissionCheckpoint {
    return {
      ...input,
      sourceRef: input.sourceRef || null,
      evidenceRefs: input.evidenceRefs || [],
    };
  }

  private buildEvidence(input: Partial<AutonomousMissionEvidence>): AutonomousMissionEvidence {
    return {
      id: cleanText(input.id, buildEvidenceId(input.kind || 'log', this.now)),
      kind: normalizeEvidenceKind(input.kind),
      status: normalizeEvidenceStatus(input.status),
      summary: cleanText(input.summary, 'Evidencia registrada.'),
      ref: nullableText(input.ref),
      createdAt: cleanText(input.createdAt, this.now().toISOString()),
    };
  }

  private buildSourceHealth(sources: AutonomousPartnerSources): AutonomousPartnerSourceHealth[] {
    return [
      this.sourceHealth('rollout-readiness', sources.rollout, 'npm run ops:rollout-readiness'),
      this.sourceHealth('sandbox', sources.sandbox, 'npm run ops:sandbox'),
      this.sourceHealth('federated-mesh', sources.federatedMesh, 'npm run ops:federated-mesh'),
      this.sourceHealth('workspace-canvas', sources.canvas, 'npm run ops:canvas'),
      this.sourceHealth('automations', sources.automation, 'npm run ops:automations'),
      this.sourceHealth('evals', sources.evals, 'npm run ops:evals'),
      this.sourceHealth('replay-learning', sources.replayLearning, 'npm run ops:replay-learning'),
      this.sourceHealth('skill-evolution', sources.skillEvolution, 'npm run ops:skill-evolution'),
      this.sourceHealth('hardware', sources.hardware, 'npm run ops:hardware'),
    ];
  }

  private sourceHealth(plane: string, snapshot: ControlPlaneSnapshot | null, command: string): AutonomousPartnerSourceHealth {
    if (!snapshot || snapshot.unavailable) {
      return {
        plane,
        status: 'unavailable',
        summary: snapshot?.error || `${plane} indisponivel neste runtime.`,
        command,
      };
    }
    const posture = statusFromPosture(snapshot?.summary?.posture);
    return {
      plane,
      status: posture === 'blocked' ? 'critical' : posture === 'warning' ? 'attention' : 'healthy',
      summary: snapshot?.narrative?.operatorSummary || snapshot?.summary?.posture || `${plane} respondeu snapshot leve.`,
      command,
    };
  }

  private listPendingMissionPlans(limit: number): ZavorthMutationPlan[] {
    try {
      return this.mutationPlane.listPlans({ limit: Math.max(limit, 20), includeExpired: false })
        .filter((entry) => entry.domain === 'autonomous-partner' && (entry.status === 'waiting_approval' || entry.status === 'approved' || entry.status === 'draft'))
        .slice(0, limit);
    } catch (error: any) { logger.warn('[Zavorth Autonomous Engineering Partner] filesystem check failed', error); return []; }
  }

  private describeAutonomyLevels(): AutonomousPartnerSnapshot['autonomyLevels'] {
    return [
      {
        id: 'assist',
        label: 'Assist',
        mutableByDefault: false,
        approvalRequired: false,
        summary: 'Ajuda e analise sem aplicar mudancas.',
      },
      {
        id: 'draft',
        label: 'Draft',
        mutableByDefault: false,
        approvalRequired: false,
        summary: 'Produz plano, patch ou proposta em preview.',
      },
      {
        id: 'supervised',
        label: 'Supervised',
        mutableByDefault: true,
        approvalRequired: true,
        summary: 'Executa sob aprovacao e checkpoints.',
      },
      {
        id: 'delegated',
        label: 'Delegated',
        mutableByDefault: true,
        approvalRequired: true,
        summary: 'Assume fluxo maior com pausas automaticas.',
      },
      {
        id: 'autonomous-with-budget',
        label: 'Autonomous With Budget',
        mutableByDefault: true,
        approvalRequired: true,
        summary: 'Opera dentro de budget explicito e para ao exceder limites.',
      },
    ];
  }

  private buildSuggestedActions(
    summary: AutonomousPartnerSnapshot['summary'],
    missions: AutonomousMissionRecord[],
  ): AutonomousPartnerSnapshot['actions'] {
    const actions: AutonomousPartnerSnapshot['actions'] = [];
    if (summary.pausedMissions > 0) {
      actions.push({
        id: 'review-paused-missions',
        label: 'Revisar missoes pausadas',
        command: 'npm run ops:partner:json',
        severity: 'critical',
        reason: 'Ha missoes pausadas por budget, risco, tempo, custo ou falhas.',
      });
    }
    if (summary.pendingMissionApprovals > 0) {
      actions.push({
        id: 'review-mission-approvals',
        label: 'Revisar approvals de missao',
        command: 'npm run ops:partner:json',
        severity: 'warn',
        reason: 'Missoes autonomas aguardam approval canonico.',
      });
    }
    if (missions.length === 0) {
      actions.push({
        id: 'delegate-first-mission',
        label: 'Delegar primeira missao com budget',
        command: 'npm run partner:mission -- "corrigir bug e validar testes" --level supervised --max-actions 12',
        severity: 'info',
        reason: 'Nenhuma missao autonoma foi registrada ainda.',
      });
    }
    if (!summary.coreIdle) {
      actions.push({
        id: 'watch-active-missions',
        label: 'Acompanhar missoes ativas',
        command: 'npm run ops:partner',
        severity: 'info',
        reason: 'Mission control tem missoes planejadas ou rodando.',
      });
    }
    return actions.slice(0, 6);
  }

  private resolveSnapshotPosture(input: {
    pausedMissions: number;
    blockedMissions: number;
    pendingMissionApprovals: number;
    unavailableSourcePlanes: number;
    sourceHealth: AutonomousPartnerSourceHealth[];
  }): AutonomousPartnerSnapshot['summary']['posture'] {
    if (input.pausedMissions > 0 || input.blockedMissions > 0) {
      return 'critical';
    }
    if (input.pendingMissionApprovals > 0 || input.unavailableSourcePlanes > 2 || input.sourceHealth.some((entry) => entry.status === 'critical')) {
      return 'attention';
    }
    return 'healthy';
  }

  private normalizeBudget(
    input: Partial<ZavorthAutonomyBudget> | null | undefined,
    level: ZavorthAutonomyLevel,
    riskLevel: ZavorthMutationRiskLevel,
  ): ZavorthAutonomyBudget {
    const defaults = this.defaultBudgetFor(level, riskLevel);
    const maxDurationMs = positiveNumber(input?.maxDurationMs, defaults.maxDurationMs, 60_000, 24 * 60 * 60 * 1000);
    return {
      scope: normalizeBudgetScope(input?.scope, defaults.scope),
      maxActions: positiveNumber(input?.maxActions, defaults.maxActions, 1, 500),
      maxMutableActions: positiveNumber(input?.maxMutableActions, defaults.maxMutableActions, 0, 100),
      maxCost: positiveNumber(input?.maxCost, defaults.maxCost, 0, 10_000),
      maxDurationMs,
      maxNetworkCalls: positiveNumber(input?.maxNetworkCalls, defaults.maxNetworkCalls, 0, 10_000),
      maxFilesystemWrites: positiveNumber(input?.maxFilesystemWrites, defaults.maxFilesystemWrites, 0, 10_000),
      maxExternalDeliveries: positiveNumber(input?.maxExternalDeliveries, defaults.maxExternalDeliveries, 0, 1000),
      pauseOnFailureCount: positiveNumber(input?.pauseOnFailureCount, defaults.pauseOnFailureCount, 1, 20),
      requiresHumanReviewAboveRisk: normalizeRisk(input?.requiresHumanReviewAboveRisk || defaults.requiresHumanReviewAboveRisk),
      expiresAt: cleanText(input?.expiresAt, new Date(this.now().getTime() + maxDurationMs).toISOString()),
    };
  }

  private defaultBudgetFor(level: ZavorthAutonomyLevel, riskLevel: ZavorthMutationRiskLevel): ZavorthAutonomyBudget {
    const base: Record<ZavorthAutonomyLevel, Omit<ZavorthAutonomyBudget, 'expiresAt' | 'requiresHumanReviewAboveRisk'>> = {
      assist: {
        scope: 'run',
        maxActions: 4,
        maxMutableActions: 0,
        maxCost: 0,
        maxDurationMs: 30 * 60 * 1000,
        maxNetworkCalls: 2,
        maxFilesystemWrites: 0,
        maxExternalDeliveries: 0,
        pauseOnFailureCount: 1,
      },
      draft: {
        scope: 'run',
        maxActions: 8,
        maxMutableActions: 1,
        maxCost: 1,
        maxDurationMs: 60 * 60 * 1000,
        maxNetworkCalls: 5,
        maxFilesystemWrites: 5,
        maxExternalDeliveries: 0,
        pauseOnFailureCount: 2,
      },
      supervised: {
        scope: 'session',
        maxActions: 16,
        maxMutableActions: 4,
        maxCost: 5,
        maxDurationMs: 2 * 60 * 60 * 1000,
        maxNetworkCalls: 20,
        maxFilesystemWrites: 25,
        maxExternalDeliveries: 2,
        pauseOnFailureCount: 3,
      },
      delegated: {
        scope: 'session',
        maxActions: 32,
        maxMutableActions: 8,
        maxCost: 10,
        maxDurationMs: 4 * 60 * 60 * 1000,
        maxNetworkCalls: 50,
        maxFilesystemWrites: 80,
        maxExternalDeliveries: 5,
        pauseOnFailureCount: 3,
      },
      'autonomous-with-budget': {
        scope: 'run',
        maxActions: 64,
        maxMutableActions: 12,
        maxCost: 20,
        maxDurationMs: 8 * 60 * 60 * 1000,
        maxNetworkCalls: 100,
        maxFilesystemWrites: 150,
        maxExternalDeliveries: 8,
        pauseOnFailureCount: 2,
      },
    };
    const reviewRisk: ZavorthMutationRiskLevel = riskRank(riskLevel) >= riskRank('high') ? 'medium' : 'high';
    return {
      ...base[level],
      requiresHumanReviewAboveRisk: reviewRisk,
      expiresAt: new Date(this.now().getTime() + base[level].maxDurationMs).toISOString(),
    };
  }

  private evaluateBudget(mission: AutonomousMissionRecord, observedRisk?: ZavorthMutationRiskLevel | string | null): string[] {
    const blockers: string[] = [];
    const usage = mission.usage;
    const budget = mission.budget;
    if (usage.actions > budget.maxActions) {
      blockers.push(`Budget de actions excedido: ${usage.actions}/${budget.maxActions}.`);
    }
    if (usage.mutableActions > budget.maxMutableActions) {
      blockers.push(`Budget de mutacoes excedido: ${usage.mutableActions}/${budget.maxMutableActions}.`);
    }
    if (usage.cost > budget.maxCost) {
      blockers.push(`Budget de custo excedido: ${usage.cost}/${budget.maxCost}.`);
    }
    if (usage.durationMs > budget.maxDurationMs) {
      blockers.push(`Budget de duracao excedido: ${usage.durationMs}/${budget.maxDurationMs}ms.`);
    }
    if (usage.networkCalls > budget.maxNetworkCalls) {
      blockers.push(`Budget de rede excedido: ${usage.networkCalls}/${budget.maxNetworkCalls}.`);
    }
    if (usage.filesystemWrites > budget.maxFilesystemWrites) {
      blockers.push(`Budget de filesystem writes excedido: ${usage.filesystemWrites}/${budget.maxFilesystemWrites}.`);
    }
    if (usage.externalDeliveries > budget.maxExternalDeliveries) {
      blockers.push(`Budget de entregas externas excedido: ${usage.externalDeliveries}/${budget.maxExternalDeliveries}.`);
    }
    if (usage.failures >= budget.pauseOnFailureCount) {
      blockers.push(`Falhas repetidas atingiram limite: ${usage.failures}/${budget.pauseOnFailureCount}.`);
    }
    const risk = observedRisk ? normalizeRisk(observedRisk) : mission.riskLevel;
    if (riskRank(risk) > riskRank(budget.requiresHumanReviewAboveRisk) && mission.status !== 'waiting_approval') {
      blockers.push(`Risco ${risk} excede review threshold ${budget.requiresHumanReviewAboveRisk}.`);
    }
    const expiresAtMs = Date.parse(budget.expiresAt);
    if (Number.isFinite(expiresAtMs) && expiresAtMs < this.now().getTime()) {
      blockers.push('Budget expirou antes da conclusao.');
    }
    return blockers;
  }

  private mergeUsage(current: AutonomousMissionUsage, input: Partial<AutonomousMissionUsage>): AutonomousMissionUsage {
    return {
      actions: current.actions + nonNegative(input.actions),
      mutableActions: current.mutableActions + nonNegative(input.mutableActions),
      cost: current.cost + nonNegative(input.cost),
      durationMs: current.durationMs + nonNegative(input.durationMs),
      networkCalls: current.networkCalls + nonNegative(input.networkCalls),
      filesystemWrites: current.filesystemWrites + nonNegative(input.filesystemWrites),
      externalDeliveries: current.externalDeliveries + nonNegative(input.externalDeliveries),
      failures: current.failures + nonNegative(input.failures),
    };
  }

  private readState(): AutonomousPartnerState {
    if (!this.existsSync(this.stateFile)) {
      return this.defaultState();
    }
    try {
      const parsed = JSON.parse(String(this.readFileSync(this.stateFile, 'utf8') || '{}')) as Partial<AutonomousPartnerState>;
      return this.normalizeState(parsed);
    } catch (error: any) {
    logger.warn('[Zavorth Autonomous Engineering Partner] JSON parse failed', error);
    return this.defaultState();
  }
  }

  private writeMission(state: AutonomousPartnerState, mission: AutonomousMissionRecord, summary: string): void {
    const normalized = this.normalizeMission(mission);
    if (!normalized) {
      throw new Error(`Missao invalida: ${mission.id || 'n/d'}.`);
    }
    state.missions[mission.id] = normalized;
    state.audit = [this.buildAudit({
      missionId: mission.id,
      event: 'mission.updated',
      status: mission.status,
      requestedBy: mission.requestedBy,
      summary,
    }), ...state.audit].slice(0, 200);
    this.writeState(state);
  }

  private upsertMission(mission: AutonomousMissionRecord, summary: string): void {
    const state = this.readState();
    this.writeMission(state, mission, summary);
  }

  private writeState(state: AutonomousPartnerState): void {
    const normalized = this.normalizeState({
      ...state,
      updatedAt: this.now().toISOString(),
    });
    this.mkdirSync(path.dirname(this.stateFile), { recursive: true });
    this.writeFileSync(this.stateFile, JSON.stringify(normalized, null, 2), 'utf8');
  }

  private defaultState(): AutonomousPartnerState {
    return {
      version: 1,
      updatedAt: null,
      missions: {},
      audit: [],
    };
  }

  private normalizeState(input: Partial<AutonomousPartnerState>): AutonomousPartnerState {
    const missions = Object.fromEntries(
      Object.values(input.missions || {})
        .map((entry) => this.normalizeMission(entry))
        .filter((entry): entry is AutonomousMissionRecord => Boolean(entry))
        .map((entry) => [entry.id, entry]),
    );
    return {
      version: 1,
      updatedAt: nullableText(input.updatedAt),
      missions,
      audit: Array.isArray(input.audit)
        ? input.audit.map((entry) => this.normalizeAudit(entry)).filter((entry): entry is AutonomousPartnerAuditEntry => Boolean(entry)).slice(0, 200)
        : [],
    };
  }

  private normalizeMission(entry: unknown): AutonomousMissionRecord | null {
    const raw = entry as Partial<AutonomousMissionRecord>;
    const id = normalizeId(raw?.id);
    const objective = cleanText(raw?.objective, '');
    if (!id || !objective) {
      return null;
    }
    const autonomyLevel = normalizeAutonomyLevel(raw.autonomyLevel);
    const riskLevel = normalizeRisk(raw.riskLevel);
    const createdAt = cleanText(raw.createdAt, this.now().toISOString());
    return {
      id,
      objective,
      context: nullableText(raw.context),
      autonomyLevel,
      riskLevel,
      status: normalizeMissionStatus(raw.status),
      createdAt,
      updatedAt: cleanText(raw.updatedAt, createdAt),
      requestedBy: nullableText(raw.requestedBy),
      sourceSurface: nullableText(raw.sourceSurface),
      successCriteria: normalizeSuccessCriteria(raw.successCriteria),
      budget: this.normalizeBudget(raw.budget, autonomyLevel, riskLevel),
      usage: {
        actions: nonNegative(raw.usage?.actions),
        mutableActions: nonNegative(raw.usage?.mutableActions),
        cost: nonNegative(raw.usage?.cost),
        durationMs: nonNegative(raw.usage?.durationMs),
        networkCalls: nonNegative(raw.usage?.networkCalls),
        filesystemWrites: nonNegative(raw.usage?.filesystemWrites),
        externalDeliveries: nonNegative(raw.usage?.externalDeliveries),
        failures: nonNegative(raw.usage?.failures),
      },
      policy: raw.policy || this.buildMissionPolicy({
        objective,
        autonomyLevel,
        riskLevel,
        mutable: null,
      }),
      plan: normalizeList(raw.plan),
      checkpoints: Array.isArray(raw.checkpoints)
        ? raw.checkpoints.map((item) => this.normalizeCheckpoint(item)).filter((item): item is AutonomousMissionCheckpoint => Boolean(item))
        : [],
      evidence: Array.isArray(raw.evidence) ? raw.evidence.map((item) => this.buildEvidence(item)).slice(0, 100) : [],
      mutationPlanId: nullableText(raw.mutationPlanId),
      trustDecision: raw.trustDecision || null,
      pauseReason: nullableText(raw.pauseReason),
      result: raw.result || null,
    };
  }

  private normalizeCheckpoint(entry: unknown): AutonomousMissionCheckpoint | null {
    const raw = entry as Partial<AutonomousMissionCheckpoint>;
    const id = normalizeId(raw?.id);
    if (!id) {
      return null;
    }
    return {
      id,
      label: cleanText(raw.label, id),
      plane: cleanText(raw.plane, 'autonomous-partner'),
      status: normalizeCheckpointStatus(raw.status),
      required: raw.required === true,
      summary: cleanText(raw.summary, id),
      sourceRef: nullableText(raw.sourceRef),
      command: nullableText(raw.command),
      evidenceRefs: normalizeList(raw.evidenceRefs),
    };
  }

  private normalizeAudit(entry: unknown): AutonomousPartnerAuditEntry | null {
    const raw = entry as Partial<AutonomousPartnerAuditEntry>;
    const event = cleanText(raw?.event, '');
    if (!event) {
      return null;
    }
    return {
      id: cleanText(raw.id, buildAuditId(event, this.now)),
      at: cleanText(raw.at, this.now().toISOString()),
      missionId: nullableText(raw.missionId),
      event,
      status: raw.status === 'noop' ? 'noop' : normalizeMissionStatus(raw.status),
      requestedBy: nullableText(raw.requestedBy),
      summary: cleanText(raw.summary, event),
    };
  }

  private buildAudit(input: Omit<AutonomousPartnerAuditEntry, 'id' | 'at'>): AutonomousPartnerAuditEntry {
    return {
      id: buildAuditId(input.event, this.now),
      at: this.now().toISOString(),
      missionId: nullableText(input.missionId),
      event: cleanText(input.event, 'mission.event'),
      status: input.status,
      requestedBy: nullableText(input.requestedBy),
      summary: cleanText(input.summary, input.event),
    };
  }

  private appendLedger(input: {
    status: 'previewed' | 'applied' | 'blocked';
    mission: AutonomousMissionRecord;
    planId: string | null;
    summary: string;
  }): void {
    try {
      this.policyLedger.append({
        domain: 'autonomous-partner',
        actionId: 'mission.delegate',
        requestedBy: input.mission.requestedBy,
        sourceSurface: input.mission.sourceSurface,
        status: input.status,
        riskLevel: input.mission.riskLevel,
        approvalScope: input.mission.autonomyLevel === 'autonomous-with-budget' ? 'once' : 'session',
        planId: input.planId,
        permissionId: input.mission.trustDecision?.permission?.permission_id || null,
        summary: input.summary,
        diff: [
          {
            path: `autonomous-partner.missions.${input.mission.id}`,
            before: 'none',
            after: input.mission.status,
            summary: input.mission.objective,
            riskLevel: input.mission.riskLevel,
            reversible: input.mission.result?.rollbackAvailable === true,
          },
        ],
        rollback: {
          available: input.mission.result?.rollbackAvailable === true,
          reason: input.mission.result?.rollbackAvailable ? 'Rollback declarado no evidence pack.' : 'Rollback depende dos action planes usados pela missao.',
        },
        result: input.summary,
      });
    } catch (error: any) {
      // O mission control nao deve falhar por indisponibilidade do ledger.
      logger.warn('[Zavorth Autonomous Engineering Partner] operation failed', error);
    }
  }

  private progressBlocked(summary: string, mission: AutonomousMissionRecord | null): AutonomousMissionProgressResult {
    return {
      generatedAt: this.now().toISOString(),
      status: mission?.status || 'blocked',
      ok: false,
      summary,
      blockers: [summary],
      mission,
      snapshot: {
        generatedAt: this.now().toISOString(),
        workspaceRoot: this.workspaceRoot,
        summary: {
          posture: 'critical',
          missions: mission ? 1 : 0,
          activeMissions: 0,
          pausedMissions: 0,
          blockedMissions: mission ? 1 : 0,
          completedMissions: 0,
          pendingMissionApprovals: 0,
          sourcePlanes: 0,
          unavailableSourcePlanes: 0,
          heavyRuntimesStarted: false,
          coreIdle: true,
        },
        autonomyLevels: this.describeAutonomyLevels(),
        policy: {
          missionControlOnly: true,
          directExecutionOnRead: false,
          mutableMissionsCreateMutationPlan: true,
          budgetPauseRequired: true,
          evidenceRequiredForCompletion: true,
          trustPlaneDomain: 'autonomous-partner',
          controlPlanes: [],
        },
        missions: mission ? [mission] : [],
        sourceHealth: [],
        pendingPlans: [],
        audit: [],
        actions: [],
        narrative: {
          headline: 'Etapa 24: Autonomous Engineering Partner',
          operatorSummary: summary,
          nextAction: 'Verificar o missionId informado.',
        },
      },
    };
  }

}
