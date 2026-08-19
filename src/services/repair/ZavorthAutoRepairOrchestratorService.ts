import { ZavorthKanbanBoardService, type KanbanTask } from '../kanban/ZavorthKanbanBoardService.js';
import { ZavorthCodebaseGraphService, type SymbolImpactReport } from '../graph/ZavorthCodebaseGraphService.js';
import { ZavorthSnapshotRollbackService } from '../snapshot/ZavorthSnapshotRollbackService.js';
import { ZavorthLspBridgeService } from '../lsp/ZavorthLspBridgeService.js';
import { logger } from '../../logger.js';

export interface RepairIncidentRequest {
  readonly taskId?: string;
  readonly targetFile: string;
  readonly errorMessage: string;
  readonly failedSymbolName?: string;
  readonly patchGenerator: (impact: SymbolImpactReport | null, attempt: number) => Promise<string | null>;
  readonly verificationRunner: (patchedFile: string, candidateCode: string) => Promise<{ success: boolean; output: string }>;
  readonly maxAttempts?: number;
}

export interface RepairExecutionResult {
  readonly resolved: boolean;
  readonly attemptsCount: number;
  readonly finalStatus: 'DONE' | 'AUTO_REPAIR_FAILED';
  readonly targetFile: string;
  readonly incidentLog: string;
  readonly appliedPatch?: string;
  readonly rollbackExecuted: boolean;
  readonly task?: KanbanTask;
}

export class ZavorthAutoRepairOrchestratorService {
  private readonly kanbanService: ZavorthKanbanBoardService;
  private readonly graphService: ZavorthCodebaseGraphService;
  private readonly snapshotService: ZavorthSnapshotRollbackService;
  private readonly lspService: ZavorthLspBridgeService;

  constructor(dependencies?: {
    kanbanService?: ZavorthKanbanBoardService;
    graphService?: ZavorthCodebaseGraphService;
    snapshotService?: ZavorthSnapshotRollbackService;
    lspService?: ZavorthLspBridgeService;
  }) {
    this.kanbanService = dependencies?.kanbanService || new ZavorthKanbanBoardService();
    this.graphService = dependencies?.graphService || new ZavorthCodebaseGraphService();
    this.snapshotService = dependencies?.snapshotService || new ZavorthSnapshotRollbackService();
    this.lspService = dependencies?.lspService || new ZavorthLspBridgeService();
  }

  public async orchestrateRepair(request: RepairIncidentRequest): Promise<RepairExecutionResult> {
    const maxAttempts = request.maxAttempts ?? 3;
    let currentAttempt = 0;
    let rollbackExecuted = false;

    // 1. Move task into AUTO_REPAIR lane if taskId is provided
    let task: KanbanTask | undefined;
    if (request.taskId) {
      const repairRes = this.kanbanService.triggerAutoRepair(request.taskId, request.errorMessage);
      if (repairRes.success) {
        task = repairRes.task;
      }
    }

    // 2. Query AST Codebase Graph for broken symbol context
    let impact: SymbolImpactReport | null = null;
    if (request.failedSymbolName) {
      impact = this.graphService.getImpactAnalysis(request.targetFile, request.failedSymbolName);
    }

    // 3. Take safety shadow snapshot before any patch attempts
    const snapshotId = `auto-repair-snap-${Date.now()}`;
    this.snapshotService.createSnapshot(
      snapshotId,
      [request.targetFile],
      `Pre-repair safety snapshot for ${request.targetFile}`
    );

    while (currentAttempt < maxAttempts) {
      currentAttempt++;
      try {
        const patchCandidate = await request.patchGenerator(impact, currentAttempt);
        if (!patchCandidate) {
          continue;
        }

        // Validate patch candidate via test/verification runner
        const verifyRes = await request.verificationRunner(request.targetFile, patchCandidate);

        if (verifyRes.success) {
          // Re-index updated file into Code Graph
          this.graphService.indexSourceFile(request.targetFile, patchCandidate);

          // If task exists, move to DONE
          if (task) {
            const moveRes = this.kanbanService.moveTask(task.id, 'DONE');
            if (moveRes.success) {
              task = moveRes.task;
            }
          }

          return {
            resolved: true,
            attemptsCount: currentAttempt,
            finalStatus: 'DONE',
            targetFile: request.targetFile,
            incidentLog: `Resolved successfully on attempt ${currentAttempt}. Output: ${verifyRes.output}`,
            appliedPatch: patchCandidate,
            rollbackExecuted: false,
            task,
          };
        }
      } catch (err: unknown) {
        logger.warn(`[AutoRepair] Attempt ${currentAttempt} failed:`, { error: err });
      }
    }

    // If all attempts failed, execute surgical rollback to pre-repair state
    this.snapshotService.rollbackSpecificFiles(snapshotId, [request.targetFile]);
    rollbackExecuted = true;

    return {
      resolved: false,
      attemptsCount: currentAttempt,
      finalStatus: 'AUTO_REPAIR_FAILED',
      targetFile: request.targetFile,
      incidentLog: `Failed after ${currentAttempt} attempts. Restored file to original state. Error: ${request.errorMessage}`,
      rollbackExecuted,
      task,
    };
  }
}
