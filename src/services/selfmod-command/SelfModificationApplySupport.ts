import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { SelfmodPatternMemory } from '../SelfmodPatternMemory.js';
import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';
import {
  PREVIEW_TTL_MS,
  type AppliedChangeRecord,
  type AppliedChangeSetRecord,
  type ChangeSetManifest,
  type FilePreviewArtifact,
  type PreviewArtifact,
  type SelfModificationApplyResult,
  type SelfModificationRollbackResult,
  type SelfmodValidationReport,
} from './SelfModificationCommandTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';

type SelfModificationApplySupportOptions = {
  projectRoot: string;
  safeModificationService: Pick<SafeModificationService, 'safeApply' | 'validateCandidate'>;
  selfmodPatternMemory: Pick<SelfmodPatternMemory, 'rememberApply' | 'rememberRollback'>;
  readPreviewArtifact: (previewId: string) => PreviewArtifact | null;
  deletePreviewArtifact: (previewId: string, kind: 'file' | 'goal' | 'multi') => void;
  tryDeletePreviewArtifact: (previewId: string, kind: 'file' | 'goal' | 'multi') => void;
  getHistoryArtifactPath: (changeId: string) => string;
  hashContent: (content: string) => string;
  tryGenerateDiff: (oldContent: string, newContent: string, fileName: string) => string | undefined;
  /** Policy-level validation commands (always merged when require flag set). */
  policyValidationCommands?: () => string[];
  requirePolicyValidationOnApply?: () => boolean;
  promoteHintEnabled?: () => boolean;
};

export class SelfModificationApplySupport {
  constructor(private readonly options: SelfModificationApplySupportOptions) {}

  public async applyPreview(previewId: string, requestedBy: string): Promise<SelfModificationApplyResult> {
    try {
      const artifact = this.options.readPreviewArtifact(previewId);
      if (!artifact) {
        return {
          success: false,
          mode: 'file',
          previewId,
          summary: 'Preview not found. Generate a new one before applying.',
        };
      }

      if (artifact.requestedBy && artifact.requestedBy !== requestedBy) {
        return {
          success: false,
          mode: artifact.kind,
          previewId,
          relativePath: artifact.kind === 'file' ? artifact.relativePath : undefined,
          summary: 'This preview was created by another authorized user and cannot be applied here.',
        };
      }

      if (Date.now() - new Date(artifact.createdAt).getTime() > PREVIEW_TTL_MS) {
        this.options.deletePreviewArtifact(previewId, artifact.kind);
        return {
          success: false,
          mode: artifact.kind,
          previewId,
          relativePath: artifact.kind === 'file' ? artifact.relativePath : undefined,
          summary: 'This preview expired. Generate a new one before applying.',
        };
      }

      if (artifact.kind === 'file') {
        return this.applyFilePreview(artifact, requestedBy);
      }

      // goal | multi share multi-file apply + atomic rollback
      return this.applyChangeSetPreview(artifact, requestedBy);
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Apply] operation failed', error);
      return {
        success: false,
        mode: 'file',
        previewId,
        summary: `Could not apply this preview.\n\nReason: ${err.message}`,
      };
    }
  }

  public async rollbackChangeSet(changeId: string, requestedBy: string): Promise<SelfModificationRollbackResult> {
    const historyPath = this.options.getHistoryArtifactPath(changeId);
    if (!fs.existsSync(historyPath)) {
      return {
        success: false,
        changeId,
        restoredFiles: 0,
        summary: tService('selfmod.apply.change_id_not_found'),
      };
    }

    try {
      const record = JSON.parse(fs.readFileSync(historyPath, 'utf8')) as AppliedChangeSetRecord;
      if (record.requestedBy && record.requestedBy !== requestedBy) {
        return {
          success: false,
          changeId,
          restoredFiles: 0,
          summary: tService('selfmod.apply.change_id_other_user'),
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
            summary: tService('selfmod.apply.rollback_interrupted', {
              path: change.relativePath,
              reason: restoreResult.reason,
            }),
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
        summary: tService('selfmod.apply.rollback_completed', { count: String(restoredFiles) }),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Apply] array operation failed', error);
      return {
        success: false,
        changeId,
        restoredFiles: 0,
        summary: `Could not complete the rollback.\n\nReason: ${err.message || error}`,
      };
    }
  }

  private async applyFilePreview(
    artifact: FilePreviewArtifact,
    requestedBy: string,
  ): Promise<SelfModificationApplyResult> {
    const currentContent = fs.existsSync(artifact.absolutePath) ? fs.readFileSync(artifact.absolutePath, 'utf8') : '';
    if (this.options.hashContent(currentContent) !== artifact.originalHash) {
      return {
        success: false,
        mode: 'file',
        previewId: artifact.previewId,
        relativePath: artifact.relativePath,
        summary:
          'The file changed since the preview was generated. Generate a new preview to avoid applying a stale patch.',
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
        diffSummary: this.options.tryGenerateDiff(currentContent, artifact.generatedContent, artifact.relativePath),
      };
    }

    this.options.tryDeletePreviewArtifact(artifact.previewId, artifact.kind);
    const changeId = crypto.randomUUID();
    const historyPath = this.options.getHistoryArtifactPath(changeId);
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
          diffSummary: this.options.tryGenerateDiff(currentContent, artifact.generatedContent, artifact.relativePath),
        },
      ],
    };
    this.options.selfmodPatternMemory.rememberApply({
      goal: `file:${artifact.relativePath}`,
      relativePaths: [artifact.relativePath],
      analysis: null,
    });
    fs.writeFileSync(historyPath, `${JSON.stringify(historyRecord, null, 2)}\n`, 'utf8');

    const promoteHint = this.buildPromoteHint([artifact.relativePath]);

    return {
      success: true,
      mode: 'file',
      previewId: artifact.previewId,
      relativePath: artifact.relativePath,
      changeId,
      receiptPath: historyPath,
      promoteHint,
      summary: [`${artifact.summary}`, result.reason, promoteHint || null].filter(Boolean).join('\n\n'),
      diffSummary: this.options.tryGenerateDiff(currentContent, artifact.generatedContent, artifact.relativePath),
    };
  }

  private async applyChangeSetPreview(
    artifact: ChangeSetManifest,
    requestedBy: string,
  ): Promise<SelfModificationApplyResult> {
    const mode = artifact.kind === 'multi' ? 'multi' : 'goal';
    const applied: AppliedChangeRecord[] = [];

    // optional validation gate before any disk mutation
    const gate = this.runApplyValidationGate(artifact);
    if (!gate.ok) {
      return {
        success: false,
        mode,
        previewId: artifact.previewId,
        summary: `Apply blocked by validation gate.\n\n${gate.reports.map((r) => `[${r.filePath}] ${r.output}`).join('\n')}`,
        validationReports: gate.reports,
      };
    }

    try {
      for (const change of artifact.changes) {
        const currentContent = fs.existsSync(change.absolutePath) ? fs.readFileSync(change.absolutePath, 'utf8') : '';
        if (this.options.hashContent(currentContent) !== change.originalHash) {
          return {
            success: false,
            mode,
            previewId: artifact.previewId,
            summary: tService('selfmod.apply.file_changed', { path: change.relativePath }),
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
            mode,
            previewId: artifact.previewId,
            summary: tService('selfmod.apply.validation_failed_again', { path: change.relativePath }),
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
            mode,
            previewId: artifact.previewId,
            summary: tService('selfmod.apply.apply_failed_rollback', { path: change.relativePath }),
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
      const historyPath = this.options.getHistoryArtifactPath(changeId);
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
      fs.writeFileSync(historyPath, `${JSON.stringify(historyRecord, null, 2)}\n`, 'utf8');
      this.options.tryDeletePreviewArtifact(artifact.previewId, artifact.kind);

      const paths = applied.map((e) => e.relativePath);
      const promoteHint = this.buildPromoteHint(paths);

      return {
        success: true,
        mode,
        previewId: artifact.previewId,
        changeId,
        changeCount: applied.length,
        receiptPath: historyPath,
        promoteHint,
        validationReports: gate.reports,
        summary: [
          `${artifact.summary}`,
          tService('selfmod.apply.changeset_applied', { count: String(applied.length) }),
          promoteHint || null,
        ]
          .filter(Boolean)
          .join('\n\n'),
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
        mode,
        previewId: artifact.previewId,
        summary: tService('selfmod.apply.changeset_failed') + (err.message ? `\n\n${err.message}` : ''),
      };
    }
  }

  private runApplyValidationGate(artifact: ChangeSetManifest): {
    ok: boolean;
    reports: SelfmodValidationReport[];
  } {
    const fromArtifact = Array.isArray(artifact.validationCommands)
      ? artifact.validationCommands.map(String).filter(Boolean)
      : [];
    const fromPolicy = this.options.policyValidationCommands?.() || [];
    const require =
      artifact.requireValidationCommandsOnApply === true || this.options.requirePolicyValidationOnApply?.() === true;
    const commands = [...fromArtifact];
    if (require || fromArtifact.length) {
      for (const c of fromPolicy) {
        if (!commands.includes(c)) commands.push(c);
      }
    }
    if (!commands.length) {
      return { ok: true, reports: [] };
    }

    const reports: SelfmodValidationReport[] = [];
    const root = this.options.projectRoot;
    for (const command of commands) {
      const report = runShellValidationCommand(root, command);
      reports.push(report);
    }
    const ok = reports.every((r) => r.passes);
    return { ok, reports };
  }

  private buildPromoteHint(relativePaths: string[]): string | null {
    if (this.options.promoteHintEnabled && this.options.promoteHintEnabled() === false) {
      return null;
    }
    const skillHit = relativePaths.some((p) => p.replace(/\\/g, '/').startsWith('skills/'));
    const pluginHit = relativePaths.some((p) => p.replace(/\\/g, '/').startsWith('plugins/'));
    if (!skillHit && !pluginHit) return null;
    if (skillHit) {
      return 'Promote hint: if this is a learned workflow, run `zavorth learn promote <id> --kind skill` (never auto-promote).';
    }
    return 'Promote hint: enable with `zavorth plugins enable <id> --yes` after review (never auto-enable).';
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

/**
 * Run a single validation command (shell). Allowlist: node/npm/npx/pnpm/yarn only for safety.
 */
function runShellValidationCommand(projectRoot: string, command: string): SelfmodValidationReport {
  const raw = String(command || '').trim();
  if (!raw) {
    return { filePath: 'validation:empty', passes: true, output: 'empty command skipped' };
  }
  const parts = raw.split(/\s+/);
  const bin = parts[0].toLowerCase();
  const allowed = new Set(['node', 'npm', 'npx', 'pnpm', 'yarn', 'node.exe', 'npm.cmd', 'npx.cmd']);
  if (!allowed.has(bin) && !allowed.has(path.basename(bin))) {
    return {
      filePath: `validation:${raw.slice(0, 40)}`,
      passes: false,
      output: `Validation command blocked (only node/npm/npx/pnpm/yarn allowed): ${bin}`,
    };
  }
  const executable =
    process.platform === 'win32' && bin === 'npm'
      ? 'npm.cmd'
      : process.platform === 'win32' && bin === 'npx'
        ? 'npx.cmd'
        : parts[0];
  const result = spawnSync(executable, parts.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120_000,
    shell: false,
  });
  const output =
    `${String(result.stdout || '')}\n${String(result.stderr || '')}`.trim() ||
    (result.error ? result.error.message : 'validation finished');
  return {
    filePath: `validation:${raw.slice(0, 80)}`,
    passes: result.status === 0,
    output: output.slice(0, 4000),
  };
}
