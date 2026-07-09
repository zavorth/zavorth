import fs from 'fs';
import { config } from '../../config/index.js';
import type { SelfModificationPreviewResult, SelfModificationService } from '../SelfModificationService.js';
import type { SafeModificationService } from '../SafeModificationService.js';
import type { AutoRepairValidationService } from './AutoRepairValidationService.js';
import type { AutoRepairAttempt, AutoRepairPlan } from './AutoRepairTypes.js';
import { normalizeAutoRepairError, trimAutoRepairOutput } from './AutoRepairTextUtils.js';
import { logger } from '../../logger.js';

export type AutoRepairCodeAttemptRunnerDependencies = {
  selfModificationService: Pick<SelfModificationService, 'previewModification'>;
  safeModificationService: Pick<SafeModificationService, 'safeApply' | 'validateCandidate'>;
  validationService: Pick<AutoRepairValidationService, 'runValidationSuite' | 'validateTarget'>;
  now: () => Date;
  existsSync: typeof fs.existsSync;
  unlinkSync: typeof fs.unlinkSync;
};

export class AutoRepairCodeAttemptRunner {
  constructor(private readonly dependencies: AutoRepairCodeAttemptRunnerDependencies) {}

  public async execute(attemptNumber: number, plan: AutoRepairPlan): Promise<AutoRepairAttempt> {
    const plannedAt = this.dependencies.now().toISOString();
    const attempt: AutoRepairAttempt = {
      attemptNumber,
      plannedAt,
      targetFile: plan.targetFile,
      instruction: plan.instruction,
      plannerSummary: plan.summary,
      plannerConfidence: plan.confidence,
      validation: [],
      status: 'planned',
    };

    if (!plan.needsCodeChange || !plan.targetFile) {
      attempt.status = 'failed';
      attempt.error = 'O planejador nao indicou um arquivo seguro para editar.';
      return attempt;
    }

    const targetValidation = this.dependencies.validationService.validateTarget(plan.targetFile);
    if (!targetValidation.allowed) {
      attempt.status = 'failed';
      attempt.error = targetValidation.reason;
      return attempt;
    }

    if (plan.confidence < config.autoRepairPlannerConfidenceThreshold) {
      attempt.status = 'failed';
      attempt.error = `O plano ficou abaixo da confianca minima (${plan.confidence.toFixed(2)} < ${config.autoRepairPlannerConfidenceThreshold.toFixed(2)}).`;
      return attempt;
    }

    let preview: SelfModificationPreviewResult;
    try {
      preview = await this.dependencies.selfModificationService.previewModification({
        filePath: plan.targetFile,
        instruction: plan.instruction,
      });
    } catch (error: unknown) {attempt.status = 'failed';
      attempt.error = `Falha ao gerar preview de autoreparo: ${normalizeAutoRepairError(error)}`;
      return attempt;
    }

    attempt.previewSummary = preview.summary;
    attempt.previewWarnings = preview.warnings;

    if (!preview.success) {
      attempt.status = 'failed';
      attempt.error = preview.reason;
      return attempt;
    }

    if (preview.currentContent === preview.proposedContent) {
      attempt.status = 'failed';
      attempt.error = 'O preview retornou o mesmo conteudo atual; nao houve correcao real para aplicar.';
      return attempt;
    }

    const candidateValidation = this.dependencies.safeModificationService.validateCandidate(
      preview.absolutePath,
      preview.proposedContent,
    );
    if (!candidateValidation.passes) {
      attempt.status = 'failed';
      attempt.error = `A proposta de autoreparo falhou na validacao sintatica inicial.\n${trimAutoRepairOutput(candidateValidation.output)}`;
      return attempt;
    }

    const originalExists = this.dependencies.existsSync(preview.absolutePath);
    const originalContent = preview.currentContent;
    const applyResult = await this.dependencies.safeModificationService.safeApply(
      preview.absolutePath,
      preview.proposedContent,
    );
    attempt.applyReason = applyResult.reason;
    if (!applyResult.success) {
      attempt.status = 'failed';
      attempt.error = applyResult.reason;
      return attempt;
    }

    attempt.status = 'applied';
    const validationSteps = await this.dependencies.validationService.runValidationSuite(
      plan.targetFile,
      plan.validationHints,
    );
    attempt.validation = validationSteps;
    const failedValidation = validationSteps.find((step) => step.status === 'failed');
    if (failedValidation) {
      const rollback = await this.rollbackFile(preview.absolutePath, originalExists, originalContent);
      attempt.rollbackStatus = rollback.status;
      attempt.rollbackReason = rollback.reason;
      attempt.status = rollback.status === 'failed' ? 'failed' : 'rolled_back';
      attempt.error = `A validacao falhou em ${failedValidation.label}. ${failedValidation.output || ''}`.trim();
      return attempt;
    }

    attempt.status = 'validated';
    return attempt;
  }

  private async rollbackFile(
    absolutePath: string,
    originalExists: boolean,
    originalContent: string,
  ): Promise<{ status: 'restored' | 'deleted-new-file' | 'failed'; reason: string }> {
    if (!originalExists) {
      try {
        if (this.dependencies.existsSync(absolutePath)) {
          this.dependencies.unlinkSync(absolutePath);
        }
        return {
          status: 'deleted-new-file',
          reason: 'Arquivo novo removido durante o rollback.',
        };
      } catch (error: unknown) {logger.warn('[Auto Repair Code Attempt Runner] file cleanup failed', error);
    return {
          status: 'failed',
          reason: `Falha ao remover o arquivo novo durante o rollback: ${normalizeAutoRepairError(error)}`,
        };
  }
    }

    const rollbackResult = await this.dependencies.safeModificationService.safeApply(absolutePath, originalContent);
    if (!rollbackResult.success) {
      return {
        status: 'failed',
        reason: rollbackResult.reason,
      };
    }

    return {
      status: 'restored',
      reason: rollbackResult.reason,
    };
  }
}
