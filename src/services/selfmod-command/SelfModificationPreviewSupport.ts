import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { SelfModificationService } from '../SelfModificationService.js';
import type { SelfmodImpactAnalyzer } from '../SelfmodImpactAnalyzer.js';
import type { SelfmodPatternMemory } from '../SelfmodPatternMemory.js';
import { logger } from '../../logger.js';
import type {
FilePreviewArtifact,
  GoalPlannerResult,
  GoalPreviewChange,
  PreviewArtifact,
  SelfModificationPreviewResult,
  SelfmodResourceImpact,
  SelfmodValidationReport,
  StagedValidationChange,
} from './SelfModificationCommandTypes.js';

type SelfModificationPreviewSupportOptions = {
  engine: Pick<SelfModificationService, 'previewModification'>;
  safeModificationService: Pick<SafeModificationService, 'validateCandidate'>;
  selfmodPatternMemory: Pick<SelfmodPatternMemory, 'rememberPreview'>;
  selfmodImpactAnalyzer: Pick<SelfmodImpactAnalyzer, 'analyzeGoalPreview'>;
  shadowWorkspaceDir: string;
  validateCommandTarget: (rawFilePath: string) => { allowed: boolean; reason: string };
  planGoalChanges: (goal: string) => Promise<GoalPlannerResult>;
  writeShadowWorkspace: (shadowWorkspaceDir: string, changes: GoalPreviewChange[]) => void;
  writePreviewArtifact: (artifact: PreviewArtifact) => void;
  toRelativePath: (targetPath: string) => string;
  hashContent: (content: string) => string;
  tryGenerateDiff: (oldContent: string, newContent: string, fileName: string) => string | undefined;
  defaultValidationPlan: (relativePaths: string[]) => string[];
  runDeepValidation: (
    relativePaths: string[],
    stagedChanges: StagedValidationChange[],
  ) => SelfmodValidationReport[];
  formatResourceImpact: (resourceImpact: SelfmodResourceImpact) => string;
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
          summary:
            'A proposta de auto-modificacao foi rejeitada porque a validacao de sintaxe falhou.',
          validationOutput: validation.output,
        };
      }

      const relativePath = this.options.toRelativePath(preview.absolutePath);
      const deepValidations = this.options.runDeepValidation(
        [relativePath],
        [{
          absolutePath: preview.absolutePath,
          previousContent: preview.currentContent,
          nextContent: preview.proposedContent,
          originalExists: fs.existsSync(preview.absolutePath),
        }],
      );
      const failedDeepValidation = deepValidations.find((entry) => !entry.passes);
      if (failedDeepValidation) {
        return {
          success: false,
          mode: 'file',
          relativePath,
          summary: `A validacao ampliada bloqueou o preview em ${failedDeepValidation.filePath}.`,
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
        diffSummary: this.options.tryGenerateDiff(
          preview.currentContent,
          preview.proposedContent,
          relativePath,
        ),
        validationPlan: this.options.defaultValidationPlan([relativePath]),
      };
    } catch (error: any) {
    logger.warn('[Self Modification Preview] validation failed', error);
    return {
        success: false,
        mode: 'file',
        summary: `Nao consegui montar o preview de auto-modificacao.\n\nMotivo: ${error.message}`,
      };
  }
  }

  public async createGoalPreview(
    goal: string,
    requestedBy: string,
  ): Promise<SelfModificationPreviewResult> {
    const normalizedGoal = String(goal || '').trim();
    if (!normalizedGoal) {
      return {
        success: false,
        mode: 'goal',
        summary: 'Informe um objetivo para /selfmod goal -- <objetivo>.',
      };
    }

    try {
      const previewId = crypto.randomUUID();
      const plan = await this.options.planGoalChanges(normalizedGoal);
      if (!plan.changes.length) {
        return {
          success: false,
          mode: 'goal',
          summary: 'Nao encontrei um conjunto seguro de arquivos para esse objetivo. Tente ser mais especifico.',
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
            summary: `Mudanca bloqueada para ${plannedChange.filePath}: ${targetValidation.reason}`,
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
            summary: `A validacao do changeset falhou em ${relativePath}.`,
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
          diffSummary: this.options.tryGenerateDiff(
            preview.currentContent,
            preview.proposedContent,
            relativePath,
          ),
          validationOutput: validation.output,
        });
      }

      const deepValidations = this.options.runDeepValidation(
        changes.map((change) => change.relativePath),
        changes.map((change) => ({
          absolutePath: change.absolutePath,
          previousContent: change.currentContent,
          nextContent: change.generatedContent,
          originalExists: change.originalExists,
        })),
      );
      validations.push(...deepValidations);
      const failedDeepValidation = deepValidations.find((entry) => !entry.passes);
      if (failedDeepValidation) {
        return {
          success: false,
          mode: 'goal',
          summary: `A validacao ampliada bloqueou o changeset em ${failedDeepValidation.filePath}.`,
          validationOutput: validations.map((entry) => `[${entry.filePath}] ${entry.output}`).join('\n\n'),
        };
      }

      const shadowWorkspaceDir = path.join(this.options.shadowWorkspaceDir, previewId);
      this.options.writeShadowWorkspace(shadowWorkspaceDir, changes);
      const optimizationAnalysis = this.options.selfmodImpactAnalyzer.analyzeGoalPreview({
        goal: normalizedGoal,
        relativePaths: changes.map((change) => change.relativePath),
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
        validationPlan: Array.from(new Set([
          ...plan.validationPlan,
          ...this.options.defaultValidationPlan(changes.map((change) => change.relativePath)),
        ])),
        resourceImpact: this.options.formatResourceImpact(plan.resourceImpact),
        optimizationAnalysis,
      };
    } catch (error: any) {
    logger.warn('[Self Modification Preview] validation failed', error);
    return {
        success: false,
        mode: 'goal',
        summary: `Nao consegui montar o changeset do objetivo.\n\nMotivo: ${error.message || error}`,
      };
  }
  }
}
