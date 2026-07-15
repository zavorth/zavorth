import path from 'path';
import { config } from '../config/index.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';
import type { ILlmProvider } from '../providers/ILlmProvider.js';
import { SafeModificationService } from './SafeModificationService.js';
import { SelfModificationService } from './SelfModificationService.js';
import { SelfmodImpactAnalyzer } from './SelfmodImpactAnalyzer.js';
import { SelfmodOptimizationCatalog } from './SelfmodOptimizationCatalog.js';
import { SelfmodPatternMemory } from './SelfmodPatternMemory.js';
import { SelfmodRuntimeGuard } from './SelfmodRuntimeGuard.js';
import {
  type GoalPlannerResult,
  type GoalPreviewChange,
  type MultiFilePreviewInput,
  type PreviewArtifact,
  type SelfModificationApplyResult,
  type SelfModificationPreviewResult,
  type SelfModificationRollbackResult,
  type SelfmodValidationReport,
  type StagedValidationChange,
} from './selfmod-command/SelfModificationCommandTypes.js';
import { SelfModificationApplySupport } from './selfmod-command/SelfModificationApplySupport.js';

import { SelfModificationArtifactStore } from './selfmod-command/SelfModificationArtifactStore.js';
import { SelfModificationGoalPlanner } from './selfmod-command/SelfModificationGoalPlanner.js';
import { SelfModificationPreviewSupport } from './selfmod-command/SelfModificationPreviewSupport.js';
import { SelfModificationValidationSupport } from './selfmod-command/SelfModificationValidationSupport.js';
import {
  SelfModificationPathPolicyService,
  type SelfmodPathCheckContext,
} from './selfmod-command/SelfModificationPathPolicyService.js';
import { CanonicalExecutionPipelineService } from './CanonicalExecutionPipelineService.js';
import {
  findSelfModificationProjectRoot,
  formatSelfModificationResourceImpact,
  hashSelfModificationContent,
  toSelfModificationRelativePath,
  tryGenerateSelfModificationDiff,
  validateSelfModificationTarget,
} from './selfmod-command/SelfModificationCommandUtils.js';

export type {
  ChangeSetManifest,
  MultiFilePreviewInput,
  SelfModificationApplyResult,
  SelfModificationPreviewResult,
  SelfModificationRollbackResult,
  SelfmodValidationReport,
} from './selfmod-command/SelfModificationCommandTypes.js';
export { SelfModificationPathPolicyService } from './selfmod-command/SelfModificationPathPolicyService.js';

export class SelfModificationCommandService {
  private readonly projectRoot: string;
  private readonly engine: SelfModificationService;
  private readonly safeModificationService: SafeModificationService;
  private readonly selfmodPatternMemory: SelfmodPatternMemory;
  private readonly selfmodImpactAnalyzer: SelfmodImpactAnalyzer;
  private readonly artifactStore: SelfModificationArtifactStore;
  private readonly goalPlanner: SelfModificationGoalPlanner;
  private readonly validationSupport: SelfModificationValidationSupport;
  private readonly previewSupport: SelfModificationPreviewSupport;
  private readonly applySupport: SelfModificationApplySupport;
  private readonly pathPolicy: SelfModificationPathPolicyService;
  private readonly canonicalExecution: CanonicalExecutionPipelineService;
  private provider?: ILlmProvider;

  constructor(options?: {
    projectRoot?: string;
    previewDir?: string;
    goalPreviewDir?: string;
    historyDir?: string;
    shadowWorkspaceDir?: string;
    engine?: SelfModificationService;
    safeModificationService?: SafeModificationService;
    provider?: ILlmProvider;
    patternMemoryFile?: string;
    selfmodPatternMemory?: SelfmodPatternMemory;
    selfmodImpactAnalyzer?: SelfmodImpactAnalyzer;
    selfmodOptimizationCatalog?: SelfmodOptimizationCatalog;
    selfmodRuntimeGuard?: SelfmodRuntimeGuard;
    canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
    pathPolicy?: SelfModificationPathPolicyService;
  }) {
    this.projectRoot = options?.projectRoot || findSelfModificationProjectRoot();
    const previewDir = options?.previewDir || config.selfmodPreviewDir;
    const goalPreviewDir = options?.goalPreviewDir || config.selfmodGoalPreviewDir;
    const historyDir = options?.historyDir || config.selfmodHistoryDir;
    const shadowWorkspaceDir = options?.shadowWorkspaceDir || config.selfmodShadowWorkspaceDir;
    this.pathPolicy = options?.pathPolicy || new SelfModificationPathPolicyService({ projectRoot: this.projectRoot });

    this.safeModificationService = options?.safeModificationService || new SafeModificationService(this.projectRoot);
    this.engine =
      options?.engine ||
      new SelfModificationService({
        projectRoot: this.projectRoot,
        safeModificationService: this.safeModificationService,
      });
    this.provider = options?.provider;

    const patternMemoryFile =
      options?.patternMemoryFile ||
      (options?.projectRoot
        ? path.resolve(this.projectRoot, 'data', 'runtime', 'selfmod-pattern-memory.json')
        : config.selfmodPatternMemoryFile);
    this.selfmodPatternMemory =
      options?.selfmodPatternMemory ||
      new SelfmodPatternMemory({
        filePath: patternMemoryFile,
      });
    this.selfmodImpactAnalyzer =
      options?.selfmodImpactAnalyzer ||
      new SelfmodImpactAnalyzer({
        runtimeGuard: options?.selfmodRuntimeGuard || new SelfmodRuntimeGuard(),
        optimizationCatalog: options?.selfmodOptimizationCatalog || new SelfmodOptimizationCatalog(),
        patternMemory: this.selfmodPatternMemory,
      });
    this.artifactStore = new SelfModificationArtifactStore({
      previewDir,
      goalPreviewDir,
      historyDir,
    });
    this.goalPlanner = new SelfModificationGoalPlanner({
      projectRoot: this.projectRoot,
      getProvider: () => this.getProvider(),
      toRelativePath: (targetPath) => this.toRelativePath(targetPath),
    });
    this.validationSupport = new SelfModificationValidationSupport(this.projectRoot);
    this.previewSupport = new SelfModificationPreviewSupport({
      engine: this.engine,
      safeModificationService: this.safeModificationService,
      selfmodPatternMemory: this.selfmodPatternMemory,
      selfmodImpactAnalyzer: this.selfmodImpactAnalyzer,
      shadowWorkspaceDir,
      projectRoot: this.projectRoot,
      validateCommandTarget: (rawFilePath, context) => this.validateCommandTarget(rawFilePath, context),
      planGoalChanges: (goal) => this.planGoalChanges(goal),
      writeShadowWorkspace: (workspaceDir, changes) => this.writeShadowWorkspace(workspaceDir, changes),
      writePreviewArtifact: (artifact) => this.writePreviewArtifact(artifact),
      toRelativePath: (targetPath) => this.toRelativePath(targetPath),
      hashContent: (content) => this.hashContent(content),
      tryGenerateDiff: (oldContent, newContent, fileName) => this.tryGenerateDiff(oldContent, newContent, fileName),
      defaultValidationPlan: (relativePaths) => this.defaultValidationPlan(relativePaths),
      runDeepValidation: (relativePaths, stagedChanges) => this.runDeepValidation(relativePaths, stagedChanges),
      formatResourceImpact: (resourceImpact) => this.formatResourceImpact(resourceImpact),
      shouldSkipDeepBuild: (relativePaths) => this.shouldSkipDeepBuild(relativePaths),
    });
    this.applySupport = new SelfModificationApplySupport({
      projectRoot: this.projectRoot,
      safeModificationService: this.safeModificationService,
      selfmodPatternMemory: this.selfmodPatternMemory,
      readPreviewArtifact: (previewId) => this.readPreviewArtifact(previewId),
      deletePreviewArtifact: (previewId, kind) => this.deletePreviewArtifact(previewId, kind),
      tryDeletePreviewArtifact: (previewId, kind) => this.tryDeletePreviewArtifact(previewId, kind),
      getHistoryArtifactPath: (changeId) => this.getHistoryArtifactPath(changeId),
      hashContent: (content) => this.hashContent(content),
      tryGenerateDiff: (oldContent, newContent, fileName) => this.tryGenerateDiff(oldContent, newContent, fileName),
      policyValidationCommands: () => this.pathPolicy.getValidationCommands(),
      requirePolicyValidationOnApply: () => this.pathPolicy.requireValidationOnApply(),
      promoteHintEnabled: () => this.pathPolicy.promoteHintEnabled(),
    });
    this.canonicalExecution = options?.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();

    this.artifactStore.ensureDirectories([shadowWorkspaceDir]);
  }

  public async createPreview(
    rawFilePath: string,
    instruction: string,
    requestedBy: string,
  ): Promise<SelfModificationPreviewResult> {
    const result = await this.previewSupport.createPreview(rawFilePath, instruction, requestedBy);
    return this.withSelfModificationLifecycle(result, {
      operation: 'preview',
      requestedBy,
      objective: instruction,
      id: result.previewId || rawFilePath,
      artifactId: result.previewId || null,
    });
  }

  public async createGoalPreview(goal: string, requestedBy: string): Promise<SelfModificationPreviewResult> {
    const result = await this.previewSupport.createGoalPreview(goal, requestedBy);
    return this.withSelfModificationLifecycle(result, {
      operation: 'preview',
      requestedBy,
      objective: goal,
      id: result.previewId || 'selfmod-goal-preview',
      artifactId: result.previewId || null,
    });
  }

  /**
   * Multi-file structured preview under one preview_id.
   * Explicit contents only — free-text chat never writes.
   */
  public async createMultiFilePreview(input: MultiFilePreviewInput): Promise<SelfModificationPreviewResult> {
    const result = await this.previewSupport.createMultiFilePreview(input);
    return this.withSelfModificationLifecycle(result, {
      operation: 'preview',
      requestedBy: input.requestedBy,
      objective: input.summary || `multi-file selfmod (${input.files?.length || 0})`,
      id: result.previewId || 'selfmod-multi-preview',
      artifactId: result.previewId || null,
    });
  }

  public getPathPolicy(): SelfModificationPathPolicyService {
    return this.pathPolicy;
  }

  public async applyPreview(previewId: string, requestedBy: string): Promise<SelfModificationApplyResult> {
    const result = await this.applySupport.applyPreview(previewId, requestedBy);
    return this.withSelfModificationLifecycle(result, {
      operation: 'apply',
      requestedBy,
      objective: `Apply selfmod preview ${previewId}.`,
      id: result.changeId || previewId,
      artifactId: result.changeId || previewId,
    });
  }

  public async rollbackChangeSet(changeId: string, requestedBy: string): Promise<SelfModificationRollbackResult> {
    const result = await this.applySupport.rollbackChangeSet(changeId, requestedBy);
    return this.withSelfModificationLifecycle(result, {
      operation: 'rollback',
      requestedBy,
      objective: `Rollback selfmod change ${changeId}.`,
      id: changeId,
      artifactId: changeId,
    });
  }

  private withSelfModificationLifecycle<
    TResult extends {
      success: boolean;
      summary: string;
      traceId?: string | null;
      runId?: string | null;
      sessionId?: string | null;
      approvalId?: string | null;
      artifactId?: string | null;
      execution_lifecycle?: unknown;
    },
  >(
    result: TResult,
    input: {
      operation: 'preview' | 'apply' | 'rollback';
      requestedBy: string;
      objective: string;
      id: string;
      artifactId?: string | null;
    },
  ): TResult {
    const link = this.canonicalExecution.buildLink({
      engine: 'selfmod',
      kind: input.operation === 'preview' ? 'plan' : 'execution',
      id: input.id,
      status: this.canonicalExecution.mapSelfModificationStatus(result.success, input.operation),
      summary: result.summary,
      objective: input.objective,
      requestedBy: input.requestedBy,
      surface: 'selfmod',
      traceId: result.traceId || input.id,
      runId: result.runId || input.id,
      sessionId: result.sessionId || null,
      approvalId: result.approvalId || null,
      artifactId: result.artifactId || input.artifactId || null,
      metadata: {
        operation: input.operation,
        projectRoot: this.projectRoot,
      },
    });
    return {
      ...result,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      approvalId: link.approvalId,
      artifactId: link.artifactId,
      execution_lifecycle: this.canonicalExecution.mergeLifecycle(result.execution_lifecycle, link.lifecycle),
    };
  }

  private async planGoalChanges(goal: string): Promise<GoalPlannerResult> {
    return this.goalPlanner.planGoalChanges(goal);
  }

  private validateCommandTarget(
    rawFilePath: string,
    context: SelfmodPathCheckContext = {},
  ): { allowed: boolean; reason: string; tier?: string } {
    return validateSelfModificationTarget(rawFilePath, context, this.pathPolicy);
  }

  private shouldSkipDeepBuild(relativePaths: string[]): boolean {
    if (!relativePaths.length) return false;
    return relativePaths.every((p) => {
      const check = this.pathPolicy.check(p);
      return check.allowed && this.pathPolicy.shouldSkipDeepBuild(check.tier);
    });
  }

  private writeShadowWorkspace(shadowWorkspaceDir: string, changes: GoalPreviewChange[]): void {
    this.artifactStore.writeShadowWorkspace(shadowWorkspaceDir, changes);
  }

  private writePreviewArtifact(artifact: PreviewArtifact): void {
    this.artifactStore.writePreviewArtifact(artifact);
  }

  private readPreviewArtifact(previewId: string): PreviewArtifact | null {
    return this.artifactStore.readPreviewArtifact(previewId);
  }

  private deletePreviewArtifact(previewId: string, kind: 'file' | 'goal' | 'multi'): void {
    this.artifactStore.deletePreviewArtifact(previewId, kind);
  }

  private tryDeletePreviewArtifact(previewId: string, kind: 'file' | 'goal' | 'multi'): void {
    this.artifactStore.tryDeletePreviewArtifact(previewId, kind);
  }

  private getHistoryArtifactPath(changeId: string): string {
    return this.artifactStore.getHistoryArtifactPath(changeId);
  }

  private hashContent(content: string): string {
    return hashSelfModificationContent(content);
  }

  private toRelativePath(targetPath: string): string {
    return toSelfModificationRelativePath(this.projectRoot, targetPath);
  }

  private tryGenerateDiff(oldContent: string, newContent: string, fileName: string): string | undefined {
    return tryGenerateSelfModificationDiff(oldContent, newContent, fileName);
  }

  private formatResourceImpact(resourceImpact: {
    ramIdleMb: number;
    diskMb: number;
    processCount: number;
    notes?: string;
  }): string {
    return formatSelfModificationResourceImpact(resourceImpact);
  }

  private getProvider(): ILlmProvider {
    if (!this.provider) {
      this.provider = ProviderFactory.create(config.llmProvider || '');
    }
    return this.provider;
  }

  private defaultValidationPlan(relativePaths: string[]): string[] {
    return this.validationSupport.defaultValidationPlan(relativePaths);
  }

  private runDeepValidation(
    relativePaths: string[],
    stagedChanges: StagedValidationChange[],
  ): SelfmodValidationReport[] {
    return this.validationSupport.runDeepValidation(relativePaths, stagedChanges);
  }

  private runBuildValidation(stagedChanges: StagedValidationChange[]): SelfmodValidationReport {
    return this.validationSupport.runBuildValidation(stagedChanges);
  }

  private runLauncherDryRunValidation(): SelfmodValidationReport {
    return this.validationSupport.runLauncherDryRunValidation();
  }

  private shouldDryRunLauncher(relativePaths: string[]): boolean {
    return this.validationSupport.shouldDryRunLauncher(relativePaths);
  }
}
