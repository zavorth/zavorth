
import crypto from 'crypto';
import fs from 'fs';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { SelfmodPatternMemory } from '../SelfmodPatternMemory.js';
import { logger } from '../../logger.js';
import {
PREVIEW_TTL_MS,
  type AppliedChangeRecord,
  type AppliedChangeSetRecord,
  type ChangeSetManifest,
  type FilePreviewArtifact,
  type PreviewArtifact,
  type SelfModificationApplyResult,
  type SelfModificationRollbackResult,
} from './SelfModificationCommandTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';

type SelfModificationApplySupportOptions = {
  safeModificationService: Pick<SafeModificationService, 'safeApply' | 'validateCandidate'>;
  selfmodPatternMemory: Pick<SelfmodPatternMemory, 'rememberApply' | 'rememberRollback'>;
  readPreviewArtifact: (previewId: string) => PreviewArtifact | null;
  deletePreviewArtifact: (previewId: string, kind: 'file' | 'goal') => void;
  tryDeletePreviewArtifact: (previewId: string, kind: 'file' | 'goal') => void;
  getHistoryArtifactPath: (changeId: string) => string;
  hashContent: (content: string) => string;
  tryGenerateDiff: (oldContent: string, newContent: string, fileName: string) => string | undefined;
};

export class SelfModificationApplySupport {
  constructor(private readonly options: SelfModificationApplySupportOptions) {}

  public async applyPreview(
    previewId: string,
    requestedBy: string,
  ): Promise<SelfModificationApplyResult> {
    try {
      const artifact = this.options.readPreviewArtifact(previewId);
      if (!artifact) {
        return {
          success: false,
          mode: 'file',
          previewId,
          summary: 'Nao encontrei esse preview. Gere um novo antes de aplicar.',
        };
      }

      if (artifact.requestedBy && artifact.requestedBy !== requestedBy) {
        return {
          success: false,
          mode: artifact.kind,
          previewId,
          relativePath: artifact.kind === 'file' ? artifact.relativePath : undefined,
          summary: 'Esse preview foi gerado por outro usuario autorizado e nao pode ser aplicado aqui.',
        };
      }

      if (Date.now() - new Date(artifact.createdAt).getTime() > PREVIEW_TTL_MS) {
        this.options.deletePreviewArtifact(previewId, artifact.kind);
        return {
          success: false,
          mode: artifact.kind,
          previewId,
          relativePath: artifact.kind === 'file' ? artifact.relativePath : undefined,
          summary: 'Esse preview expirou. Gere um novo antes de aplicar.',
        };
      }

      if (artifact.kind === 'file') {
        return this.applyFilePreview(artifact, requestedBy);
      }

      return this.applyGoalPreview(artifact, requestedBy);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Apply] operation failed', error);
    return {
        success: false,
        mode: 'file',
        previewId,
        summary: `Nao consegui aplicar esse preview.\n\nMotivo: ${err.message}`,
      };
  }
  }

  public async rollbackChangeSet(
    changeId: string,
    requestedBy: string,
  ): Promise<SelfModificationRollbackResult> {
    const historyPath = this.options.getHistoryArtifactPath(changeId);
    if (!fs.existsSync(historyPath)) {
      return {
        success: false,
        changeId,
        restoredFiles: 0,
        summary: 'Nao encontrei esse change_id para rollback.',
      };
    }

    try {
      const record = JSON.parse(fs.readFileSync(historyPath, 'utf8')) as AppliedChangeSetRecord;
      if (record.requestedBy && record.requestedBy !== requestedBy) {
        return {
          success: false,
          changeId,
          restoredFiles: 0,
          summary: 'Esse change_id foi aplicado por outro usuario autorizado e nao pode ser revertido aqui.',
        };
      }

      let restoredFiles = 0;
      for (const change of [...record.changes].reverse()) {
        if (!change.originalExists) {
          if (fs.existsSync(change.absolutePath)) {
            fs.rmSync(change.absolutePath, { force: true });
          }
          restoredFiles += 1;
          continue;
        }

        const restoreResult = await this.options.safeModificationService.safeApply(
          change.absolutePath,
          change.previousContent,
        );
        if (!restoreResult.success) {
          return {
            success: false,
            changeId,
            restoredFiles,
            summary: `Rollback interrompido em ${change.relativePath}: ${restoreResult.reason}`,
          };
        }
        restoredFiles += 1;
      }
      this.options.selfmodPatternMemory.rememberRollback({
        goal: record.goal,
        relativePaths: record.changes.map((change) => change.relativePath),
        analysis: record.optimizationAnalysis || null,
      });

      return {
        success: true,
        changeId,
        restoredFiles,
        summary: `Rollback concluido para ${restoredFiles} arquivo(s).`,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Apply] array operation failed', error);
    return {
        success: false,
        changeId,
        restoredFiles: 0,
        summary: `Nao consegui concluir o rollback.\n\nMotivo: ${err.message || error}`,
      };
  }
  }

  private async applyFilePreview(
    artifact: FilePreviewArtifact,
    requestedBy: string,
  ): Promise<SelfModificationApplyResult> {
    const currentContent = fs.existsSync(artifact.absolutePath)
      ? fs.readFileSync(artifact.absolutePath, 'utf8')
      : '';
    if (this.options.hashContent(currentContent) !== artifact.originalHash) {
      return {
        success: false,
        mode: 'file',
        previewId: artifact.previewId,
        relativePath: artifact.relativePath,
        summary:
          'O arquivo mudou desde que o preview foi gerado. Para evitar aplicar um patch obsoleto, gere um preview novo.',
      };
    }

    const result = await this.options.safeModificationService.safeApply(
      artifact.absolutePath,
      artifact.generatedContent,
    );

    if (!result.success) {
      return {
        success: false,
        mode: 'file',
        previewId: artifact.previewId,
        relativePath: artifact.relativePath,
        summary: result.reason,
        diffSummary: this.options.tryGenerateDiff(
          currentContent,
          artifact.generatedContent,
          artifact.relativePath,
        ),
      };
    }

    this.options.tryDeletePreviewArtifact(artifact.previewId, artifact.kind);
    const changeId = crypto.randomUUID();
    const historyRecord: AppliedChangeSetRecord = {
      changeId,
      previewId: artifact.previewId,
      goal: `file:${artifact.relativePath}`,
      summary: artifact.summary,
      requestedBy: artifact.requestedBy || requestedBy,
      appliedAt: new Date().toISOString(),
      changes: [
        {
          relativePath: artifact.relativePath,
          absolutePath: artifact.absolutePath,
          previousContent: currentContent,
          nextContent: artifact.generatedContent,
          originalHash: artifact.originalHash,
          originalExists: artifact.originalExists,
          diffSummary: this.options.tryGenerateDiff(
            currentContent,
            artifact.generatedContent,
            artifact.relativePath,
          ),
        },
      ],
    };
    this.options.selfmodPatternMemory.rememberApply({
      goal: `file:${artifact.relativePath}`,
      relativePaths: [artifact.relativePath],
      analysis: null,
    });
    fs.writeFileSync(
      this.options.getHistoryArtifactPath(changeId),
      `${JSON.stringify(historyRecord, null, 2)}\n`,
      'utf8',
    );

    return {
      success: true,
      mode: 'file',
      previewId: artifact.previewId,
      relativePath: artifact.relativePath,
      changeId,
      summary: `${artifact.summary}\n\n${result.reason}`,
      diffSummary: this.options.tryGenerateDiff(
        currentContent,
        artifact.generatedContent,
        artifact.relativePath,
      ),
    };
  }

  private async applyGoalPreview(
    artifact: ChangeSetManifest,
    requestedBy: string,
  ): Promise<SelfModificationApplyResult> {
    const applied: AppliedChangeRecord[] = [];

    try {
      for (const change of artifact.changes) {
        const currentContent = fs.existsSync(change.absolutePath)
          ? fs.readFileSync(change.absolutePath, 'utf8')
          : '';
        if (this.options.hashContent(currentContent) !== change.originalHash) {
          return {
            success: false,
            mode: 'goal',
            previewId: artifact.previewId,
            summary:
              `O arquivo ${change.relativePath} mudou desde que o preview foi gerado. Gere um novo changeset antes de aplicar.`,
            diffSummary: change.diffSummary,
          };
        }

        const validation = this.options.safeModificationService.validateCandidate(
          change.absolutePath,
          change.generatedContent,
        );
        if (!validation.passes) {
          return {
            success: false,
            mode: 'goal',
            previewId: artifact.previewId,
            summary: `A validacao falhou novamente em ${change.relativePath}. O apply foi bloqueado.`,
            diffSummary: change.diffSummary,
          };
        }

        const applyResult = await this.options.safeModificationService.safeApply(
          change.absolutePath,
          change.generatedContent,
        );
        if (!applyResult.success) {
          await this.rollbackPartialApply(applied);
          return {
            success: false,
            mode: 'goal',
            previewId: artifact.previewId,
            summary: `Falha ao aplicar ${change.relativePath}. O Zavorth executou rollback automatico do changeset parcial.`,
            diffSummary: change.diffSummary,
          };
        }

        applied.push({
          relativePath: change.relativePath,
          absolutePath: change.absolutePath,
          previousContent: currentContent,
          nextContent: change.generatedContent,
          originalHash: change.originalHash,
          originalExists: change.originalExists,
          diffSummary: change.diffSummary,
        });
      }

      const changeId = crypto.randomUUID();
      const historyRecord: AppliedChangeSetRecord = {
        changeId,
        previewId: artifact.previewId,
        goal: artifact.goal,
        summary: artifact.summary,
        requestedBy,
        appliedAt: new Date().toISOString(),
        changes: applied,
        optimizationAnalysis: artifact.optimizationAnalysis,
      };
      this.options.selfmodPatternMemory.rememberApply({
        goal: artifact.goal,
        relativePaths: applied.map((entry) => entry.relativePath),
        analysis: artifact.optimizationAnalysis || null,
      });
      fs.writeFileSync(
        this.options.getHistoryArtifactPath(changeId),
        `${JSON.stringify(historyRecord, null, 2)}\n`,
        'utf8',
      );
      this.options.tryDeletePreviewArtifact(artifact.previewId, artifact.kind);

      return {
        success: true,
        mode: 'goal',
        previewId: artifact.previewId,
        changeId,
        changeCount: applied.length,
        summary: `${artifact.summary}\n\nChangeSet aplicado com sucesso em ${applied.length} arquivo(s).`,
        diffSummary: applied
          .map((entry) => entry.diffSummary)
          .filter(Boolean)
          .join('\n\n'),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      await this.rollbackPartialApply(applied);
      return {
        success: false,
        mode: 'goal',
        previewId: artifact.previewId,
        summary: `Falha ao aplicar o changeset. Rollback automatico executado.\n\nMotivo: ${err.message || error}`,
      };
    }
  }

  private async rollbackPartialApply(applied: AppliedChangeRecord[]): Promise<void> {
    for (const change of [...applied].reverse()) {
      if (!change.originalExists) {
        if (fs.existsSync(change.absolutePath)) {
          fs.rmSync(change.absolutePath, { force: true });
        }
        continue;
      }

      await this.options.safeModificationService.safeApply(change.absolutePath, change.previousContent);
    }
  }
}
