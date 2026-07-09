import { CanonicalExecutionPipelineService } from '../../../services/CanonicalExecutionPipelineService.js';
import { RuntimeArtifactMaintenanceService } from '../../../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../../../services/RuntimeLogMaintenanceService.js';
import { SelfModificationCommandService } from '../../../services/SelfModificationCommandService.js';
import {
  ArchitectureRefactorScorecardService,
  type ArchitectureRefactorSnapshot,
} from '../../../observability/ArchitectureRefactorScorecardService.js';type MaintenanceAutomationPort = {
  triggerNow: (updatedBy?: string | null, note?: string | null) => { lastActionId?: string | null; note?: string | null };
};

type HousekeepingOperationStatus = 'completed' | 'skipped' | 'failed';

export type AutonomousHousekeepingOperation = {
  id: string;
  label: string;
  status: HousekeepingOperationStatus;
  summary: string;
  command: string | null;
  artifactId: string | null;
};

export type AutonomousHousekeepingSnapshot = {
  generatedAt: string;
  posture: 'healthy' | 'attention' | 'critical';
  traceId: string;
  runId: string;
  sessionId: string | null;
  operations: AutonomousHousekeepingOperation[];
  architecture: {
    posture: ArchitectureRefactorSnapshot['summary']['posture'];
    gate: ArchitectureRefactorSnapshot['gate']['status'];
    summary: string;
    nextAction: string;
  };
  summary: string;
  execution_lifecycle: unknown[];
};

export class AutonomousHousekeepingAgentService {
  private readonly canonicalExecution: CanonicalExecutionPipelineService;
  private readonly architectureScorecard: Pick<ArchitectureRefactorScorecardService, 'buildSnapshot'>;
  private readonly logMaintenance: Pick<RuntimeLogMaintenanceService, 'rotateOversizedLogs'>;
  private readonly artifactMaintenance: Pick<RuntimeArtifactMaintenanceService, 'cleanupVisualSmokeProfiles'>;
  private readonly maintenanceAutomation: MaintenanceAutomationPort | null;
  private readonly selfmodService: Pick<SelfModificationCommandService, 'createGoalPreview'> | null;
  private readonly now: () => Date;

  constructor(options: {
    canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
    architectureScorecard?: Pick<ArchitectureRefactorScorecardService, 'buildSnapshot'>;
    logMaintenanceService?: Pick<RuntimeLogMaintenanceService, 'rotateOversizedLogs'>;
    artifactMaintenanceService?: Pick<RuntimeArtifactMaintenanceService, 'cleanupVisualSmokeProfiles'>;
    maintenanceAutomationService?: MaintenanceAutomationPort | null;
    selfModificationCommandService?: Pick<SelfModificationCommandService, 'createGoalPreview'> | null;
    now?: () => Date;
  } = {}) {
    this.canonicalExecution = options.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    this.architectureScorecard = options.architectureScorecard || new ArchitectureRefactorScorecardService();
    this.logMaintenance = options.logMaintenanceService || new RuntimeLogMaintenanceService();
    this.artifactMaintenance = options.artifactMaintenanceService || new RuntimeArtifactMaintenanceService();
    this.maintenanceAutomation = options.maintenanceAutomationService || null;
    this.selfmodService = options.selfModificationCommandService || null;
    this.now = options.now || (() => new Date());
  }

  public async runCycle(input: {
    requestedBy?: string | null;
    triggerMaintenance?: boolean;
    prepareRefactorPreview?: boolean;
    refactorGoal?: string | null;
  } = {}): Promise<AutonomousHousekeepingSnapshot> {
    const requestedBy = String(input.requestedBy || '').trim() || 'housekeeping-agent';
    const architecture = this.architectureScorecard.buildSnapshot();
    const operations: AutonomousHousekeepingOperation[] = [];

    const logRotation = this.logMaintenance.rotateOversizedLogs();
    const rotated = logRotation.filter((entry) => entry.rotated).length;
    operations.push({
      id: 'log-rotation',
      label: 'Log Rotation',
      status: 'completed',
      summary: rotated > 0
        ? `${rotated} log(s) rotacionado(s) na manutencao autonoma.`
        : 'Nenhum log excedeu o limite configurado.',
      command: 'npm run ops:maintain',
      artifactId: null,
    });

    const artifactCleanup = this.artifactMaintenance.cleanupVisualSmokeProfiles();
    operations.push({
      id: 'artifact-cleanup',
      label: 'Artifact Cleanup',
      status: 'completed',
      summary: artifactCleanup.deletedEntries > 0
        ? `${artifactCleanup.deletedEntries} perfil(is) de visual smoke removido(s), liberando ${artifactCleanup.freedBytes} bytes.`
        : 'Nenhum artefato de visual smoke precisou ser removido.',
      command: 'npm run ops:maintain',
      artifactId: null,
    });

    if (input.triggerMaintenance !== false && this.maintenanceAutomation) {
      const status = this.maintenanceAutomation.triggerNow(
        requestedBy,
        'Housekeeping autonomo disparou manutencao supervisionada.',
      );
      operations.push({
        id: 'scheduled-maintenance',
        label: 'Maintenance Trigger',
        status: 'completed',
        summary: status.lastActionId
          ? `Manutencao supervisionada disparada via ${status.lastActionId}.`
          : (status.note || 'Manutencao supervisionada disparada.'),
        command: 'npm run ops:maintain:scheduled',
        artifactId: status.lastActionId || null,
      });
    } else {
      operations.push({
        id: 'scheduled-maintenance',
        label: 'Maintenance Trigger',
        status: 'skipped',
        summary: 'Manutencao supervisionada nao foi disparada nesta rodada.',
        command: 'npm run ops:maintain:scheduled',
        artifactId: null,
      });
    }

    if (input.prepareRefactorPreview !== false && this.selfmodService) {
      const goal = String(input.refactorGoal || '').trim() || this.deriveRefactorGoal(architecture);
      try {
        const preview = await this.selfmodService.createGoalPreview(goal, requestedBy);
        operations.push({
          id: 'refactor-preview',
          label: 'Refactor Preview',
          status: preview.success ? 'completed' : 'failed',
          summary: preview.summary || 'Preview de refactor concluida.',
          command: 'npm run qa:selfmod-optimization',
          artifactId: preview.previewId || preview.artifactId || null,
        });
      } catch (error: unknown) {operations.push({
          id: 'refactor-preview',
          label: 'Refactor Preview',
          status: 'skipped',
          summary: error?.message || 'Preview de refactor indisponivel neste host.',
          command: 'npm run qa:selfmod-optimization',
          artifactId: null,
        });
      }
    } else {
      operations.push({
        id: 'refactor-preview',
        label: 'Refactor Preview',
        status: 'skipped',
        summary: 'Preview de refactor nao foi solicitada nesta rodada.',
        command: 'npm run qa:selfmod-optimization',
        artifactId: null,
      });
    }

    const posture = this.resolvePosture(architecture, operations);
    const link = this.canonicalExecution.buildLink([
      {
        engine: 'automation',
        kind: 'plan',
        status: 'planned',
        id: `housekeeping-${this.now().toISOString()}`,
        objective: 'Rodar housekeeping autonomo supervisionado.',
        summary: 'Housekeeping autonomo planejado.',
        requestedBy,
        surface: 'housekeeping-agent',
      },
      {
        engine: 'automation',
        kind: 'run',
        status: posture === 'critical' ? 'failed' : 'completed',
        objective: 'Rodar housekeeping autonomo supervisionado.',
        summary: this.buildSummary(architecture, operations),
        requestedBy,
        surface: 'housekeeping-agent',
        metadata: {
          architecturePosture: architecture.summary.posture,
          completedOperations: operations.filter((entry) => entry.status === 'completed').length,
          skippedOperations: operations.filter((entry) => entry.status === 'skipped').length,
          failedOperations: operations.filter((entry) => entry.status === 'failed').length,
        },
      },
    ]);

    return {
      generatedAt: this.now().toISOString(),
      posture,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      operations,
      architecture: {
        posture: architecture.summary.posture,
        gate: architecture.gate.status,
        summary: architecture.narrative.operatorSummary,
        nextAction: architecture.narrative.nextAction,
      },
      summary: this.buildSummary(architecture, operations),
      execution_lifecycle: link.lifecycle,
    };
  }

  private deriveRefactorGoal(architecture: ArchitectureRefactorSnapshot): string {
    const mostUrgentAction = architecture.actions[0];
    if (mostUrgentAction) {
      return `Preparar refactor supervisionado para: ${mostUrgentAction.label}. Motivo: ${mostUrgentAction.reason}`;
    }
    return 'Preparar uma rodada pequena de limpeza arquitetural supervisionada no Zavorth.';
  }

  private resolvePosture(
    architecture: ArchitectureRefactorSnapshot,
    operations: AutonomousHousekeepingOperation[],
  ): AutonomousHousekeepingSnapshot['posture'] {
    if (architecture.summary.posture === 'critical' || operations.some((entry) => entry.status === 'failed')) {
      return 'critical';
    }
    if (architecture.summary.posture === 'attention' || operations.some((entry) => entry.status === 'skipped')) {
      return 'attention';
    }
    return 'healthy';
  }

  private buildSummary(
    architecture: ArchitectureRefactorSnapshot,
    operations: AutonomousHousekeepingOperation[],
  ): string {
    const completed = operations.filter((entry) => entry.status === 'completed').length;
    const skipped = operations.filter((entry) => entry.status === 'skipped').length;
    const failed = operations.filter((entry) => entry.status === 'failed').length;
    return [
      `Housekeeping autonomo executou ${completed} operacao(oes), ${skipped} skip(s) e ${failed} falha(s).`,
      `Arquitetura segue em postura ${architecture.summary.posture} com gate ${architecture.gate.status}.`,
    ].join(' ');
  }
}
