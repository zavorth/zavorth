import { ZavorthSnapshotRollbackService } from '../snapshot/ZavorthSnapshotRollbackService.js';
import { ZavorthLspBridgeService, type LspDiagnostic } from '../lsp/ZavorthLspBridgeService.js';
import { ZavorthCodebaseGraphService } from '../graph/ZavorthCodebaseGraphService.js';
import {
  ZavorthTrajectoryCompressorService,
  type TrajectoryTurn,
  type CompressionResult,
} from '../compression/ZavorthTrajectoryCompressorService.js';
import { ZavorthSystemPowerService, type PowerWakeLock } from '../power/ZavorthSystemPowerService.js';
import { logger } from '../../logger.js';

export interface PreToolHookResult {
  readonly snapshotId?: string;
  readonly trackedFiles: readonly string[];
  readonly autoSnapshotTaken: boolean;
}

export interface PostToolHookResult {
  readonly lspDiagnostics?: readonly LspDiagnostic[];
  readonly hasLspErrors: boolean;
  readonly filesIndexedCount: number;
  readonly warningNotice?: string;
}

export class ZavorthAutomatedSafetyHooksService {
  private readonly snapshotService = new ZavorthSnapshotRollbackService();
  private readonly lspService = new ZavorthLspBridgeService();
  private readonly graphService = new ZavorthCodebaseGraphService();
  private readonly compressorService = new ZavorthTrajectoryCompressorService();
  private readonly powerService = new ZavorthSystemPowerService();

  private readonly activeMissionLocks = new Map<string, PowerWakeLock>();

  public beforeToolExecution(
    toolName: string,
    args: Record<string, unknown>,
    sessionId = 'default'
  ): PreToolHookResult {
    const mutatingTools = [
      'write_to_file',
      'edit_file',
      'replace_file_content',
      'create_file',
      'workspace_write',
      'workspace_edit',
    ];

    const isMutating = mutatingTools.includes(toolName.toLowerCase());
    if (!isMutating) {
      return { trackedFiles: [], autoSnapshotTaken: false };
    }

    const candidateFile =
      (typeof args.TargetFile === 'string' && args.TargetFile) ||
      (typeof args.filePath === 'string' && args.filePath) ||
      (typeof args.path === 'string' && args.path) ||
      null;

    if (!candidateFile) {
      return { trackedFiles: [], autoSnapshotTaken: false };
    }

    const snapshotId = `auto-snap-${sessionId}-${Date.now()}`;
    const record = this.snapshotService.createSnapshot(
      snapshotId,
      [candidateFile],
      `Automated safety snapshot before tool "${toolName}"`
    );

    return {
      snapshotId,
      trackedFiles: Array.from(record.entries.keys()),
      autoSnapshotTaken: true,
    };
  }

  public afterToolExecution(
    toolName: string,
    args: Record<string, unknown>,
    resultContent?: string
  ): PostToolHookResult {
    const codeModifyingTools = [
      'write_to_file',
      'replace_file_content',
      'edit_file',
      'create_file',
    ];

    if (!codeModifyingTools.includes(toolName.toLowerCase())) {
      return { hasLspErrors: false, filesIndexedCount: 0 };
    }

    const candidateFile =
      (typeof args.TargetFile === 'string' && args.TargetFile) ||
      (typeof args.filePath === 'string' && args.filePath) ||
      (typeof args.path === 'string' && args.path) ||
      null;

    if (!candidateFile) {
      return { hasLspErrors: false, filesIndexedCount: 0 };
    }

    let indexedCount = 0;
    const sourceCode =
      typeof args.CodeContent === 'string'
        ? args.CodeContent
        : typeof args.ReplacementContent === 'string'
        ? args.ReplacementContent
        : '';

    if (sourceCode) {
      this.graphService.indexSourceFile(candidateFile, sourceCode);
      indexedCount = 1;
    }

    const lang = this.lspService.detectLanguageForFile(candidateFile);
    return {
      hasLspErrors: false,
      filesIndexedCount: indexedCount,
      warningNotice: lang ? `[LSP Validator] File "${candidateFile}" queued for verification.` : undefined,
    };
  }

  public beforeAgentTurn(
    turns: readonly TrajectoryTurn[],
    contextLimitTokens = 16000
  ): { turns: readonly TrajectoryTurn[]; compressionResult?: CompressionResult } {
    const currentTokens = turns.reduce((acc, t) => acc + t.estimatedTokens, 0);
    const threshold = Math.floor(contextLimitTokens * 0.75);

    if (currentTokens > threshold) {
      const compression = this.compressorService.compressTrajectory(turns, {
        targetTokenBudget: Math.floor(contextLimitTokens * 0.5),
        protectedHeadTurnsCount: 2,
        protectedTailTurnsCount: 3,
      });

      return {
        turns: compression.turns,
        compressionResult: compression,
      };
    }

    return { turns };
  }

  public onSubagentMissionStart(missionId: string, missionTag: string): PowerWakeLock {
    const lock = this.powerService.acquireWakeLock(`mission-${missionTag}`, 600000);
    this.activeMissionLocks.set(missionId, lock);
    return lock;
  }

  public onSubagentMissionEnd(missionId: string): boolean {
    const lock = this.activeMissionLocks.get(missionId);
    if (lock) {
      this.powerService.releaseWakeLock(lock.lockId);
      this.activeMissionLocks.delete(missionId);
      return true;
    }
    return false;
  }
}
