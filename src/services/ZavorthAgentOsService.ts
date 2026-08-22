import {
  AGENT_OS_CONTRACT_VERSION,
  type AgentOsZavorthControlSnapshot,
  type AgentOsSnapshot,
  type AgentOsWorkspaceWrite,
  type AgentOsZavorthControlProjection,
} from '../contracts/AgentOsContract.js';
import type { IntelligenceFabricInput, IntelligenceFabricSnapshot } from '../contracts/native/IntelligenceFabricContract.js';
import { AgentImmuneSystemService } from './AgentImmuneSystemService.js';
import { ArchitectureDecisionRecorder } from './ArchitectureDecisionRecorder.js';
import { FutureComparatorService } from './FutureComparatorService.js';
import { ImpactSimulatorService } from './ImpactSimulatorService.js';
import { PermissionBrokerService } from './PermissionBrokerService.js';
import { ProjectDigitalTwinService } from './ProjectDigitalTwinService.js';
import {
  ReputationScoreboardService,
  type AgentOsReputationEval,
} from './ReputationScoreboardService.js';
import { TransactionalExecutionService } from './TransactionalExecutionService.js';

import { ZavorthIntelligenceFabricService } from './ZavorthIntelligencePipelineService.js';

type AgentOsRuntime = {
  now?: () => Date;
  fabric?: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'> | null;
  projectTwin?: ProjectDigitalTwinService | null;
  impactSimulator?: ImpactSimulatorService | null;
  permissionBroker?: PermissionBrokerService | null;
  transactionRuntime?: TransactionalExecutionService | null;
  futureComparator?: FutureComparatorService | null;
  immuneSystem?: AgentImmuneSystemService | null;
  reputation?: ReputationScoreboardService | null;
  adr?: ArchitectureDecisionRecorder | null;
};

export class ZavorthAgentOsService {
  private readonly now: () => Date;
  private readonly fabric: Pick<ZavorthIntelligenceFabricService, 'buildShadowSnapshot'>;
  private readonly projectTwin: ProjectDigitalTwinService;
  private readonly impactSimulator: ImpactSimulatorService;
  private readonly permissionBroker: PermissionBrokerService;
  private readonly transactionRuntime: TransactionalExecutionService;
  private readonly futureComparator: FutureComparatorService;
  private readonly immuneSystem: AgentImmuneSystemService;
  private readonly reputation: ReputationScoreboardService;
  private readonly adr: ArchitectureDecisionRecorder;

  constructor(runtime: AgentOsRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.fabric = runtime.fabric || new ZavorthIntelligenceFabricService({ now: this.now });
    this.projectTwin = runtime.projectTwin || new ProjectDigitalTwinService({ now: this.now });
    this.impactSimulator = runtime.impactSimulator || new ImpactSimulatorService();
    this.permissionBroker = runtime.permissionBroker || new PermissionBrokerService();
    this.transactionRuntime = runtime.transactionRuntime || new TransactionalExecutionService({ now: this.now });
    this.futureComparator = runtime.futureComparator || new FutureComparatorService();
    this.immuneSystem = runtime.immuneSystem || new AgentImmuneSystemService();
    this.reputation = runtime.reputation || new ReputationScoreboardService();
    this.adr = runtime.adr || new ArchitectureDecisionRecorder();
  }

  public buildSnapshot(input: IntelligenceFabricInput & {
    persistTransactionPlan?: boolean;
    reputationEvals?: AgentOsReputationEval[] | null;
    workspaceWrites?: AgentOsWorkspaceWrite[] | null;
  }): AgentOsSnapshot {
    const fabric = this.fabric.buildShadowSnapshot(input);
    const projectTwin = this.projectTwin.buildSnapshot({ workspaceRoot: input.workspaceRoot || null });
    const dryRun = this.impactSimulator.simulate({
      proposal: fabric.executionProposal,
      twin: projectTwin,
    });
    const permissionLease = this.permissionBroker.createLease({
      taskId: fabric.taskEval.taskId,
      proposal: fabric.executionProposal,
      now: this.now(),
    });
    const transaction = this.transactionRuntime.prepare({
      proposal: fabric.executionProposal,
      dryRun,
      permissionLease,
      requestedBy: input.userRole || null,
      surface: input.surface || null,
      workspaceRoot: input.workspaceRoot || null,
      workspaceWrites: input.workspaceWrites || null,
      persistMutationPlan: input.persistTransactionPlan === true,
    });
    const futureComparison = this.futureComparator.compare({
      classification: fabric.classification,
      dryRun,
      twin: projectTwin,
    });
    const immuneSystem = this.immuneSystem.inspect({
      proposal: fabric.executionProposal,
      dryRun,
      lease: permissionLease,
      twin: projectTwin,
    });
    const reputation = this.reputation.buildSnapshot({
      evals: input.reputationEvals || this.defaultEval(fabric),
    });
    const architectureDecision = this.adr.createDraft({
      title: `${fabric.classification.taskKind} via Agent OS`,
      decision: fabric.executionProposal.summary,
      alternatives: futureComparison.candidates.map((candidate) => `${candidate.title}: ${candidate.summary}`),
      consequences: [
        'Every relevant action goes through dry run before commit.',
        'Rollback ou approval explicit e exigido when houver impacto real.',
      ],
    });
    const controlData = this.zavorthControl({
      transactionStatus: transaction.status,
      twinFiles: projectTwin.fileSummary.totalIndexed,
      immuneStatus: immuneSystem.status,
      reputationScores: reputation.scores.length,
      rollbackPrepared: transaction.rollbackPrepared,
    });
    const zavorthControl = this.zavorthControlProjection(controlData);
    return {
      contractVersion: AGENT_OS_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      fabric: {
        classification: fabric.classification,
        executionProposal: fabric.executionProposal,
        riskGate: fabric.riskGate,
      },
      projectTwin,
      transaction,
      futureComparison,
      immuneSystem,
      reputation,
      architectureDecision,
      zavorthControl,
      safety: {
        thinkingBlocked: false,
        dryRunHasSideEffects: false,
        rawSecretsSerialized: false,
        shadowDoesNotMutateRuntime: true,
        dangerousImpactRequiresGate: true,
      },
      receipts: [
        'agent-os-above-intelligence-fabric',
        'agent-os-no-parallel-runtime',
        'agent-os-simulate-before-impact',
        'agent-os-rollback-or-approval',
      ],
    };
  }

  private defaultEval(fabric: IntelligenceFabricSnapshot): AgentOsReputationEval[] {
    return [{
      subjectType: 'model',
      subjectId: fabric.modelRouting.selectedModelId || 'unrouted-model',
      taskKind: fabric.classification.taskKind,
      success: fabric.verifier.status !== 'blocked',
      latencyMs: fabric.taskEval.latencyMs,
      securityIssuesFound: fabric.verifier.status === 'blocked',
      rollbackUsed: false,
    }];
  }

  private zavorthControl(input: {
    transactionStatus: string;
    twinFiles: number;
    immuneStatus: string;
    reputationScores: number;
    rollbackPrepared: boolean;
  }): AgentOsZavorthControlSnapshot {
    const blocked = input.transactionStatus === 'blocked' || input.immuneStatus === 'blocked';
    return {
      source: 'AgentOsZavorthControlProjection',
      title: 'Agent OS',
      status: blocked ? 'blocked' : input.immuneStatus === 'warning' ? 'warning' : 'passed',
      cards: [
        { id: 'project-twin', label: 'Digital Twin', value: `${input.twinFiles} indexed file(s)`, tone: input.twinFiles > 0 ? 'ok' : 'warn' },
        { id: 'transaction', label: 'Transaction', value: input.transactionStatus, tone: blocked ? 'danger' : 'info' },
        { id: 'immune', label: 'Immune System', value: input.immuneStatus, tone: input.immuneStatus === 'blocked' ? 'danger' : input.immuneStatus === 'warning' ? 'warn' : 'ok' },
        { id: 'reputation', label: 'Reputation', value: `${input.reputationScores} score(s)`, tone: 'info' },
      ],
      actions: [
        { id: 'agent-os.refresh-twin', label: 'Refresh project map', enabled: true, reason: 'Read-only.' },
        { id: 'agent-os.apply-transaction', label: 'Apply transaction', enabled: input.rollbackPrepared && !blocked, reason: input.rollbackPrepared ? 'Rollback prepared.' : 'Rollback is not prepared yet.' },
        { id: 'agent-os.rollback', label: 'Revert transaction', enabled: input.rollbackPrepared, reason: 'Available when a rollback artifact exists.' },
      ],
    };
  }

  private zavorthControlProjection(zavorthControl: AgentOsZavorthControlSnapshot): AgentOsZavorthControlProjection {
    return {
      source: 'AgentOsZavorthControlProjection',
      title: 'Agent OS details',
      status: zavorthControl.status,
      detailsHiddenByDefault: true,
      liveActionApplied: false,
      cards: zavorthControl.cards,
      actions: zavorthControl.actions,
    };
  }
}
