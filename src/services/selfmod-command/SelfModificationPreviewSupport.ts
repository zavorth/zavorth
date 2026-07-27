import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { SelfModificationService } from '../SelfModificationService.js';
import type { SelfmodImpactAnalyzer } from '../SelfmodImpactAnalyzer.js';
import type { SelfmodPatternMemory } from '../SelfmodPatternMemory.js';
import { logger } from '../../logger.js';
import { tService } from '../../i18n/services.js';
import type {
  FilePreviewArtifact,
  GoalPlannerResult,
  GoalPreviewChange,
  MultiFilePreviewInput,
  PreviewArtifact,
  SelfModificationPreviewResult,
  SelfmodResourceImpact,
  SelfmodValidationReport,
  StagedValidationChange,
} from './SelfModificationCommandTypes.js';
import { asErrorLike } from '../../utils/errorLike.js';
import type { SelfmodPathCheckContext } from './SelfModificationPathPolicyService.js';

type SelfModificationPreviewSupportOptions = {
  engine: Pick<SelfModificationService, 'previewModification'>;
  safeModificationService: Pick<SafeModificationService, 'validateCandidate'>;
  selfmodPatternMemory: Pick<SelfmodPatternMemory, 'rememberPreview'>;
  selfmodImpactAnalyzer: Pick<SelfmodImpactAnalyzer, 'analyzeGoalPreview'>;
  shadowWorkspaceDir: string;
  projectRoot: string;
  validateCommandTarget: (
    rawFilePath: string,
    context?: SelfmodPathCheckContext,
  ) => { allowed: boolean; reason: string; tier?: string };
  planGoalChanges: (goal: string) => Promise<GoalPlannerResult>;
  writeShadowWorkspace: (shadowWorkspaceDir: string, changes: GoalPreviewChange[]) => void;
  writePreviewArtifact: (artifact: PreviewArtifact) => void;
  toRelativePath: (targetPath: string) => string;
  hashContent: (content: string) => string;
  tryGenerateDiff: (oldContent: string, newContent: string, fileName: string) => string | undefined;
  defaultValidationPlan: (relativePaths: string[]) => string[];
  runDeepValidation: (relativePaths: string[], stagedChanges: StagedValidationChange[]) => SelfmodValidationReport[];
  formatResourceImpact: (resourceImpact: SelfmodResourceImpact) => string;
  /** When true, skip project:build deep validation (standard-tier skill/plugin packs). */
  shouldSkipDeepBuild?: (relativePaths: string[]) => boolean;
};

export class SelfModificationPreviewSupport {
  constructor(private readonly options: SelfModificationPreviewSupportOptions) {}

  public async createPreview(
    rawFilePath: string,
    instruction: string,
    requestedBy: string,
  ): Promise<SelfModificationPreviewResult> {
    try {
      const commandValidation = this.options.validateCommandTarget(rawFilePath);
      if (!commandValidation.allowed) {
        return {
          success: false,
          mode: 'file',
          summary: commandValidation.reason,
        };
      }

      const preview = await this.options.engine.previewModification({
        filePath: rawFilePath,
        instruction,
      });

      if (!preview.success) {
        return {
          success: false,
          mode: 'file',
          relativePath: this.options.toRelativePath(preview.absolutePath || rawFilePath),
          summary: preview.summary || preview.reason,
        };
      }

      const validation = this.options.safeModificationService.validateCandidate(
        preview.absolutePath,
        preview.proposedContent,
      );
      if (!validation.passes) {
        return {
          success: false,
          mode: 'file',
          relativePath: this.options.toRelativePath(preview.absolutePath),
          summary: 'A proposta de auto-modification foi rejected porque a validation de sintaxe failed.',
          validationOutput: validation.output,
        };
      }

      const relativePath = this.options.toRelativePath(preview.absolutePath);
      const staged = [
        {
          absolutePath: preview.absolutePath,
          previousContent: preview.currentContent,
          nextContent: preview.proposedContent,
          originalExists: fs.existsSync(preview.absolutePath),
        },
      ];
      const deepValidations = this.options.shouldSkipDeepBuild?.([relativePath])
        ? []
        : this.options.runDeepValidation([relativePath], staged);
      const failedDeepValidation = deepValidations.find((entry) => !entry.passes);
      if (failedDeepValidation) {
        return {
          success: false,
          mode: 'file',
          relativePath,
          summary: `A validation ampliada bloqueou o preview em ${failedDeepValidation.filePath}.`,
          validationOutput: deepValidations.map((entry) => `[${entry.filePath}] ${entry.output}`).join('\n\n'),
        };
      }

      const previewId = crypto.randomUUID();
      const artifact: FilePreviewArtifact = {
        kind: 'file',
        previewId,
        absolutePath: preview.absolutePath,
        relativePath,
        instruction: instruction.trim(),
        summary: preview.summary,
        generatedContent: preview.proposedContent,
        originalHash: this.options.hashContent(preview.currentContent),
        originalExists: fs.existsSync(preview.absolutePath),
        createdAt: new Date().toISOString(),
        requestedBy,
      };

      this.options.writePreviewArtifact(artifact);

      return {
        success: true,
        mode: 'file',
        previewId,
        relativePath,
        summary: preview.summary,
        diffSummary: this.options.tryGenerateDiff(preview.currentContent, preview.proposedContent, relativePath),
        validationPlan: this.options.defaultValidationPlan([relativePath]),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Preview] validation failed', error);
      return {
        success: false,
        mode: 'file',
        summary: tService('selfmod.preview.build_failed', { reason: err.message }),
      };
    }
  }

  public async createGoalPreview(goal: string, requestedBy: string): Promise<SelfModificationPreviewResult> {
    const normalizedGoal = String(goal || '').trim();
    if (!normalizedGoal) {
      return {
        success: false,
        mode: 'goal',
        summary: tService('selfmod.preview.inform_goal'),
      };
    }

    try {
      const previewId = crypto.randomUUID();
      const plan = await this.options.planGoalChanges(normalizedGoal);
      if (!plan.changes.length) {
        return {
          success: false,
          mode: 'goal',
          summary: tService('selfmod.preview.no_safe_files'),
        };
      }

      const changes: GoalPreviewChange[] = [];
      const validations: SelfmodValidationReport[] = [];

      for (const plannedChange of plan.changes.slice(0, 6)) {
        const targetValidation = this.options.validateCommandTarget(plannedChange.filePath);
        if (!targetValidation.allowed) {
          return {
            success: false,
            mode: 'goal',
            summary: tService('selfmod.preview.change_blocked', {
              path: plannedChange.filePath,
              reason: targetValidation.reason,
            }),
          };
        }

        const preview = await this.options.engine.previewModification({
          filePath: plannedChange.filePath,
          instruction: plannedChange.instruction,
        });

        if (!preview.success) {
          return {
            success: false,
            mode: 'goal',
            summary: preview.summary || preview.reason,
            relativePath: this.options.toRelativePath(preview.absolutePath || plannedChange.filePath),
          };
        }

        const validation = this.options.safeModificationService.validateCandidate(
          preview.absolutePath,
          preview.proposedContent,
        );
        const relativePath = this.options.toRelativePath(preview.absolutePath);
        validations.push({
          filePath: relativePath,
          passes: validation.passes,
          output: validation.output,
        });
        if (!validation.passes) {
          return {
            success: false,
            mode: 'goal',
            relativePath,
            summary: tService('selfmod.preview.changeset_validation_failed', { path: relativePath }),
            validationOutput: validation.output,
          };
        }

        changes.push({
          relativePath,
          absolutePath: preview.absolutePath,
          instruction: plannedChange.instruction,
          summary: preview.summary,
          generatedContent: preview.proposedContent,
          currentContent: preview.currentContent,
          originalHash: this.options.hashContent(preview.currentContent),
          originalExists: fs.existsSync(preview.absolutePath),
          diffSummary: this.options.tryGenerateDiff(preview.currentContent, preview.proposedContent, relativePath),
          validationOutput: validation.output,
        });
      }

      const relativePaths = changes.map((change) => change.relativePath);
      const staged = changes.map((change) => ({
        absolutePath: change.absolutePath,
        previousContent: change.currentContent,
        nextContent: change.generatedContent,
        originalExists: change.originalExists,
      }));
      const deepValidations = this.options.shouldSkipDeepBuild?.(relativePaths)
        ? []
        : this.options.runDeepValidation(relativePaths, staged);
      validations.push(...deepValidations);
      const failedDeepValidation = deepValidations.find((entry) => !entry.passes);
      if (failedDeepValidation) {
        return {
          success: false,
          mode: 'goal',
          summary: tService('selfmod.preview.deep_validation_blocked', { path: failedDeepValidation.filePath }),
          validationOutput: validations.map((entry) => `[${entry.filePath}] ${entry.output}`).join('\n\n'),
        };
      }

      const shadowWorkspaceDir = path.join(this.options.shadowWorkspaceDir, previewId);
      this.options.writeShadowWorkspace(shadowWorkspaceDir, changes);
      const optimizationAnalysis = this.options.selfmodImpactAnalyzer.analyzeGoalPreview({
        goal: normalizedGoal,
        relativePaths,
        resourceImpact: plan.resourceImpact,
        changeCount: changes.length,
      });

      const artifact: PreviewArtifact = {
        kind: 'goal',
        previewId,
        goal: normalizedGoal,
        summary: plan.summary,
        createdAt: new Date().toISOString(),
        requestedBy,
        resourceImpact: plan.resourceImpact,
        validationPlan: plan.validationPlan,
        shadowWorkspaceDir,
        changes,
        validations,
        optimizationAnalysis,
        rollbackPlan: changes.map((c) => ({
          relativePath: c.relativePath,
          originalExists: c.originalExists,
        })),
      };
      this.options.selfmodPatternMemory.rememberPreview({
        goal: normalizedGoal,
        relativePaths: changes.map((change) => change.relativePath),
        analysis: optimizationAnalysis,
      });
      this.options.writePreviewArtifact(artifact);

      return {
        success: true,
        mode: 'goal',
        previewId,
        summary: plan.summary,
        diffSummary: changes
          .map((change) => change.diffSummary)
          .filter(Boolean)
          .join('\n\n'),
        changeCount: changes.length,
        validationPlan: Array.from(
          new Set([
            ...plan.validationPlan,
            ...this.options.defaultValidationPlan(changes.map((change) => change.relativePath)),
          ]),
        ),
        resourceImpact: this.options.formatResourceImpact(plan.resourceImpact),
        optimizationAnalysis,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Preview] validation failed', error);
      return {
        success: false,
        mode: 'goal',
        summary: `Could not build the objective changeset.\n\nReason: ${err.message || error}`,
      };
    }
  }

  /**
   * Structured multi-file / multi-hunk preview under one preview_id.
   * Content is provided explicitly — no free-text auto-write.
   */
  public async createMultiFilePreview(input: MultiFilePreviewInput): Promise<SelfModificationPreviewResult> {
    const files = Array.isArray(input.files) ? input.files : [];
    if (!files.length) {
      return {
        success: false,
        mode: 'multi',
        summary: 'Provide at least one file with relativePath + content for multi-file preview.',
      };
    }
    if (files.length > 40) {
      return {
        success: false,
        mode: 'multi',
        summary: 'Multi-file preview limited to 40 files per preview_id.',
      };
    }

    const pathContext: SelfmodPathCheckContext = {
      buildMode: input.buildMode,
      ownerOrTrusted: input.ownerOrTrusted,
    };
    const changes: GoalPreviewChange[] = [];
    const validations: SelfmodValidationReport[] = [];

    try {
      for (const file of files) {
        const relativePath = String(file.relativePath || '')
          .trim()
          .replace(/\\/g, '/');
        const targetValidation = this.options.validateCommandTarget(relativePath, pathContext);
        if (!targetValidation.allowed) {
          return {
            success: false,
            mode: 'multi',
            summary: `Path blocked: ${relativePath} — ${targetValidation.reason}`,
            relativePath,
          };
        }

        const absolutePath = path.resolve(this.options.projectRoot, relativePath);
        if (!absolutePath.startsWith(path.resolve(this.options.projectRoot))) {
          return {
            success: false,
            mode: 'multi',
            summary: `Path escapes workspace: ${relativePath}`,
          };
        }

        const originalExists = fs.existsSync(absolutePath);
        const currentContent = originalExists ? fs.readFileSync(absolutePath, 'utf8') : '';
        const generatedContent = String(file.content ?? '');
        const instruction = String(file.instruction || 'structured multi-file hunk').trim();

        const syntax = this.options.safeModificationService.validateCandidate(absolutePath, generatedContent);
        if (!syntax.passes) {
          return {
            success: false,
            mode: 'multi',
            relativePath,
            summary: `Syntax validation failed for ${relativePath}.`,
            validationOutput: syntax.output,
          };
        }

        changes.push({
          relativePath,
          absolutePath,
          instruction,
          summary: instruction,
          generatedContent,
          currentContent,
          originalHash: this.options.hashContent(currentContent),
          originalExists,
          diffSummary: this.options.tryGenerateDiff(currentContent, generatedContent, relativePath),
        });
      }

      const relativePaths = changes.map((c) => c.relativePath);
      const staged = changes.map((c) => ({
        absolutePath: c.absolutePath,
        previousContent: c.currentContent,
        nextContent: c.generatedContent,
        originalExists: c.originalExists,
      }));
      const deepValidations = this.options.shouldSkipDeepBuild?.(relativePaths)
        ? []
        : this.options.runDeepValidation(relativePaths, staged);
      validations.push(...deepValidations);
      const failedDeep = deepValidations.find((e) => !e.passes);
      if (failedDeep) {
        return {
          success: false,
          mode: 'multi',
          summary: `Deep validation blocked ${failedDeep.filePath}.`,
          validationOutput: deepValidations.map((e) => `[${e.filePath}] ${e.output}`).join('\n\n'),
        };
      }

      const previewId = crypto.randomUUID();
      const shadowWorkspaceDir = path.join(this.options.shadowWorkspaceDir, previewId);
      this.options.writeShadowWorkspace(shadowWorkspaceDir, changes);

      const resourceImpact: SelfmodResourceImpact = {
        ramIdleMb: 0,
        diskMb: Math.max(
          1,
          Math.round(changes.reduce((n, c) => n + Buffer.byteLength(c.generatedContent, 'utf8'), 0) / (1024 * 1024)),
        ),
        processCount: 0,
        notes: 'multi-file structured preview',
      };
      const summary = String(input.summary || '').trim() || `Multi-file selfmod preview (${changes.length} file(s))`;

      const validationCommands = Array.isArray(input.validationCommands)
        ? input.validationCommands.map(String).filter(Boolean)
        : [];

      const artifact: PreviewArtifact = {
        kind: 'multi',
        previewId,
        goal: `multi-file:${changes.length}`,
        summary,
        createdAt: new Date().toISOString(),
        requestedBy: input.requestedBy,
        resourceImpact,
        validationPlan: [
          ...this.options.defaultValidationPlan(relativePaths),
          ...(validationCommands.length ? validationCommands.map((c) => `Apply gate: ${c}`) : []),
        ],
        validationCommands,
        requireValidationCommandsOnApply:
          input.requireValidationCommandsOnApply === true || validationCommands.length > 0,
        shadowWorkspaceDir,
        changes,
        validations,
        rollbackPlan: changes.map((c) => ({
          relativePath: c.relativePath,
          originalExists: c.originalExists,
        })),
      };

      this.options.writePreviewArtifact(artifact);
      this.options.selfmodPatternMemory.rememberPreview({
        goal: artifact.goal,
        relativePaths,
        analysis: {
          resourceDelta: {
            ramIdleMb: 0,
            diskMb: 0,
            processCount: 0,
            summary: 'multi-file preview',
            notes: [],
          },
          runtimeRisk: {
            level: 'low',
            score: 0,
            reasons: [],
            requiresRestart: false,
            requiresSupervisorAttention: false,
            launcherTouch: false,
          },
          companionImpact: {
            level: 'none',
            companionIds: [],
            summary: 'none',
            notes: [],
            recommendedActions: [],
          },
          rollbackConfidence: 0.7,
          rollbackConfidenceLabel: 'medium',
          opportunities: [],
          patternSignals: [],
        },
      });

      return {
        success: true,
        mode: 'multi',
        previewId,
        summary,
        changeCount: changes.length,
        relativePaths,
        rollbackPlan: artifact.rollbackPlan,
        validationPlan: artifact.validationPlan,
        diffSummary: changes
          .map((c) => c.diffSummary)
          .filter(Boolean)
          .join('\n\n'),
        resourceImpact: this.options.formatResourceImpact(resourceImpact),
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Self Modification Preview] multi-file failed', error);
      return {
        success: false,
        mode: 'multi',
        summary: `Could not build multi-file preview.\n\nReason: ${err.message || error}`,
      };
    }
  }
}
