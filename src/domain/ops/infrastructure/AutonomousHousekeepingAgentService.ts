import { CanonicalExecutionPipelineService } from '../../../services/CanonicalExecutionPipelineService.js';
import { RuntimeArtifactMaintenanceService } from '../../../services/RuntimeArtifactMaintenanceService.js';
import { RuntimeLogMaintenanceService } from '../../../services/RuntimeLogMaintenanceService.js';
import { SelfModificationCommandService } from '../../../services/SelfModificationCommandService.js';
import { errorMessage } from '../../../utils/errorLike.js';
import {
  ArchitectureRefactorScorecardService,
  type ArchitectureRefactorSnapshot,
} from '../../../observability/ArchitectureRefactorScorecardService.js';

type MaintenanceAutomationPort = {
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
        ? `${rotated} log(s) rotated during autonomous maintenance.`
        : 'No log exceeded the configured limit.',
      command: 'npm run ops:maintain',
      artifactId: null,
    });

    const artifactCleanup = this.artifactMaintenance.cleanupVisualSmokeProfiles();
    operations.push({
      id: 'artifact-cleanup',
      label: 'Artifact Cleanup',
      status: 'completed',
      summary: artifactCleanup.deletedEntries > 0
        ? `${artifactCleanup.deletedEntries} visual smoke profile(s) removed, freeing ${artifactCleanup.freedBytes} bytes.`
        : 'No visual smoke artifacts needed to be removed.',
      command: 'npm run ops:maintain',
      artifactId: null,
    });

    if (input.triggerMaintenance !== false && this.maintenanceAutomation) {
      const status = this.maintenanceAutomation.triggerNow(
        requestedBy,
        'Autonomous housekeeping triggered supervised maintenance.',
      );
      operations.push({
        id: 'scheduled-maintenance',
        label: 'Maintenance Trigger',
        status: 'completed',
        summary: status.lastActionId ? `Supervised maintenance triggered via ${status.lastActionId}.`
          : (status.note || 'Supervised maintenance triggered.'),
        command: 'npm run ops:maintain:scheduled',
        artifactId: status.lastActionId || null,
      });
    } else {
      operations.push({
        id: 'scheduled-maintenance',
        label: 'Maintenance Trigger',
        status: 'skipped',
        summary: 'Supervised maintenance was not triggered in this run.',
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
          summary: preview.summary || 'Refactor preview completed.',
          command: 'npm run qa:selfmod-optimization',
          artifactId: preview.previewId || preview.artifactId || null,
        });
      } catch (error: unknown) {operations.push({
          id: 'refactor-preview',
          label: 'Refactor Preview',
          status: 'skipped',
          summary: errorMessage(error, 'Refactor preview unavailable on this host.'),
          command: 'npm run qa:selfmod-optimization',
          artifactId: null,
        });
      }
    } else {
      operations.push({
        id: 'refactor-preview',
        label: 'Refactor Preview',
        status: 'skipped',
        summary: 'Refactor preview was not requested in this run.',
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
        objective: 'Run supervised autonomous housekeeping.',
        summary: 'Autonomous housekeeping planned.',
        requestedBy,
        surface: 'housekeeping-agent',
      },
      {
        engine: 'automation',
        kind: 'run',
        status: posture === 'critical' ? 'failed' : 'completed',
        objective: 'Run supervised autonomous housekeeping.',
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
      return `Prepare supervised refactor for: ${mostUrgentAction.label}. Reason: ${mostUrgentAction.reason}`;
    }
    return 'Prepare a small round of supervised architectural cleanup in Zavorth.';
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
      `Autonomous housekeeping executed ${completed} operation(s), ${skipped} skip(s), and ${failed} failure(s).`,
      `Architecture remains in ${architecture.summary.posture} posture with gate ${architecture.gate.status}.`,
    ].join(' ');
  }
}
