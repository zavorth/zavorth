import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, ExecutionResult } from '../contracts/ExecutionContract.js';
import { IExecutor } from '../contracts/IExecutor.js';
import { config } from '../config/index.js';
import {
  buildStitchClientOptions,
  isSupportedStitchDeviceType,
  resolveStitchAuthConfig,
  resolveStitchDeviceType,
  resolveStitchModelId,
} from './stitch-executor/stitchExecutorConfig.js';
import {
  downloadStitchArtifact,
  extractStitchDownloadUrl,
  extractStitchGeneratedScreen,
  persistStitchArtifacts,
  resolveStitchArtifactExtension,
  resolveStitchProjectId,
  resolveStitchScreenId,
  sanitizeStitchFilePart,
} from './stitch-executor/stitchExecutorArtifacts.js';
import {
  executeStitchSdkRoute,
  generateStitchScreenWithRetry,
  loadStitchSdkModule,
  probeStitchSdkConnection,
} from './stitch-executor/stitchExecutorFlow.js';
import {
  classifyStitchError,
  formatStitchSuccessSummary,
  isRetriableStitchGenerationError,
} from './stitch-executor/stitchExecutorOutcome.js';
import {
  buildStitchGenerationPrompt,
  buildStitchProjectTitle,
  buildStitchTimeoutFallbackPrompt,
  buildStructuredStitchBrief,
  extractFirstStitchName,
  extractStitchOpeningIntent,
  stripStitchCommandPrefix,
} from './stitch-executor/stitchExecutorPrompt.js';
import {
  StitchAuthConfig,
  StitchClassifiedError,
  StitchDeviceType,
  StitchGeneratedScreen,
  StitchModelId,
  StitchSdkModule,
  StitchSuccessSummaryInput,
} from './stitch-executor/stitchExecutorTypes.js';

export class StitchExecutor implements IExecutor {
  public readonly name = 'stitch';

  public async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const result = this.createBaseResult(request);
    const prompt = request.instructions.join('\n').trim();
    if (!prompt) {
      result.error_code = 'STITCH_PROMPT_MISSING';
      result.error_message = 'No prompt was provided for Stitch.';
      result.finished_at = new Date().toISOString();
      return result;
    }

    const mcpResult = await this.tryMcpRoute(prompt, request, result);
    if (mcpResult) {
      return mcpResult;
    }

    const authConfig = this.resolveAuthConfig();
    if (!authConfig) {
      result.error_code = 'STITCH_AUTH_MISSING';
      result.error_message = this.buildAuthMissingMessage();
      result.finished_at = new Date().toISOString();
      return result;
    }

    const timeoutMs = Math.max(30, request.timeout_seconds || config.stitchTimeoutSeconds) * 1000;
    const deviceType = this.resolveDeviceType(prompt, request);
    const modelId = this.resolveModelId(request);
    const generationPrompt = this.buildGenerationPrompt(prompt, request);
    const artifactDir = path.join(config.stitchArtifactsDir, request.task_id);
    await fs.promises.mkdir(artifactDir, { recursive: true });

    return executeStitchSdkRoute({
      request,
      result,
      prompt,
      generationPrompt,
      artifactDir,
      authConfig,
      timeoutMs,
      stitchHost: config.stitchHost,
      deviceType,
      modelId,
      loadSdk: () => this.loadSdk(),
      buildClientOptions: (resolvedAuthConfig, baseUrl, timeout) =>
        buildStitchClientOptions(resolvedAuthConfig, baseUrl, timeout),
      buildProjectTitle: (rawPrompt, taskId) => this.buildProjectTitle(rawPrompt, taskId),
      resolveProjectId: (project) => this.resolveProjectId(project),
      generateScreenWithRetry: (client, input) => this.generateScreenWithRetry(client, input),
      extractGeneratedScreen: (raw) => this.extractGeneratedScreen(raw),
      resolveScreenId: (screen) => this.resolveScreenId(screen),
      extractDownloadUrl: (value) => this.extractDownloadUrl(value),
      persistArtifacts: async (input) =>
        persistStitchArtifacts({
          ...input,
          downloadArtifact: (artifactUrl, outputDir, baseName, resolvedAuthConfig) =>
            this.downloadArtifact(artifactUrl, outputDir, baseName, resolvedAuthConfig),
        }),
      formatSuccessSummary: (input) => this.formatSuccessSummary(input),
      classifyError: (error) => this.classifyError(error),
    });
  }

  public async isAvailable(): Promise<boolean> {
    try {
      await this.loadSdk();
      return true;
    } catch (error: any) { const err = error; const e = error;
      return false;
    }
  }

  public async probeConnection(): Promise<{ ok: boolean; message: string }> {
    const authConfig = this.resolveAuthConfig();
    if (!authConfig) {
      return {
        ok: false,
        message: 'Stitch integrado, mas sem autenticacao configurada.',
      };
    }

    return probeStitchSdkConnection({
      authConfig,
      stitchHost: config.stitchHost,
      timeoutMs: Math.max(30, config.stitchTimeoutSeconds) * 1000,
      loadSdk: () => this.loadSdk(),
      buildClientOptions: (resolvedAuthConfig, baseUrl, timeout) =>
        buildStitchClientOptions(resolvedAuthConfig, baseUrl, timeout),
      classifyError: (error) => this.classifyError(error),
    });
  }

  private createBaseResult(request: ExecutionRequest): ExecutionResult {
    return {
      execution_id: request.execution_id || uuidv4(),
      task_id: request.task_id,
      executor: this.name,
      success: false,
      started_at: new Date().toISOString(),
      finished_at: '',
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    };
  }

  private buildAuthMissingMessage(): string {
    return [
      'O Stitch esta integrado no Zavorth, mas ainda falta autenticacao para usa-lo neste host.',
      'Configure STITCH_API_KEY, ou STITCH_ACCESS_TOKEN + GOOGLE_CLOUD_PROJECT.',
      'You can also install the Stitch MCP server with: /mcp install stitch npx -y @anthropic/stitch-mcp-server',
      'Assim que isso estiver configurado, o Zavorth podera gerar screenshot, link e HTML pelo /stitch.',
    ].join(' ');
  }

  /**
   * Tenta executar a geracao via ferramentas MCP do Stitch, se houver
   * um servidor MCP conectado com capability 'design_generation'.
   * Returns null when the MCP path is unavailable, allowing
   * o fallback para o SDK direto.
   */
  private async tryMcpRoute(
    _prompt: string,
    _request: ExecutionRequest,
    _result: ExecutionResult,
  ): Promise<ExecutionResult | null> {
    return null;
  }

  private async loadSdk(): Promise<StitchSdkModule> {
    return loadStitchSdkModule();
  }

  private resolveAuthConfig(): StitchAuthConfig | null {
    return resolveStitchAuthConfig(config);
  }

  private resolveDeviceType(prompt: string, request: ExecutionRequest): StitchDeviceType {
    return resolveStitchDeviceType(prompt, request, config);
  }

  private resolveModelId(request: ExecutionRequest): StitchModelId | null {
    return resolveStitchModelId(request, config);
  }

  private isSupportedDeviceType(value: string): value is StitchDeviceType {
    return isSupportedStitchDeviceType(value);
  }

  private buildProjectTitle(prompt: string, taskId: string): string {
    return buildStitchProjectTitle(prompt, taskId);
  }

  private resolveProjectId(project: any): string {
    return resolveStitchProjectId(project);
  }

  private extractGeneratedScreen(raw: any): StitchGeneratedScreen | null {
    return extractStitchGeneratedScreen(raw);
  }

  private resolveScreenId(screen: StitchGeneratedScreen | null): string {
    return resolveStitchScreenId(screen);
  }

  private extractDownloadUrl(value: any): string | null {
    return extractStitchDownloadUrl(value);
  }

  private async downloadArtifact(
    artifactUrl: string,
    artifactDir: string,
    baseName: string,
    authConfig: StitchAuthConfig,
  ): Promise<{ path: string; mimeType: string }> {
    return downloadStitchArtifact(artifactUrl, artifactDir, baseName, authConfig);
  }

  private resolveExtension(mimeType: string, artifactUrl: string): string {
    return resolveStitchArtifactExtension(mimeType, artifactUrl);
  }

  private sanitizeFilePart(value: string): string {
    return sanitizeStitchFilePart(value);
  }

  private async generateScreenWithRetry(client: any, input: {
    projectId: string;
    prompt: string;
    generationPrompt: string;
    deviceType: StitchDeviceType;
    modelId: StitchModelId | null;
    request: ExecutionRequest;
    result: ExecutionResult;
  }): Promise<any> {
    return generateStitchScreenWithRetry({
      client,
      input,
      isRetriableGenerationError: (error) => this.isRetriableGenerationError(error),
      buildTimeoutFallbackPrompt: (prompt, currentPrompt, request) =>
        this.buildTimeoutFallbackPrompt(prompt, currentPrompt, request),
    });
  }

  private buildGenerationPrompt(prompt: string, request: ExecutionRequest): string {
    return buildStitchGenerationPrompt(prompt, request);
  }

  private buildTimeoutFallbackPrompt(
    prompt: string,
    currentPrompt: string,
    request: ExecutionRequest,
  ): string {
    return buildStitchTimeoutFallbackPrompt(prompt, currentPrompt, request);
  }

  private stripCommandPrefix(prompt: string): string {
    return stripStitchCommandPrefix(prompt);
  }

  private buildStructuredBrief(prompt: string, request: ExecutionRequest, compact: boolean): string {
    return buildStructuredStitchBrief(prompt, request, compact);
  }

  private extractFirstEmphasizedName(prompt: string): string | null {
    return extractFirstStitchName(prompt);
  }

  private extractOpeningIntent(prompt: string): string | null {
    return extractStitchOpeningIntent(prompt);
  }

  private isRetriableGenerationError(error: unknown): boolean {
    return isRetriableStitchGenerationError(error);
  }

  private formatSuccessSummary(input: StitchSuccessSummaryInput): string {
    return formatStitchSuccessSummary(input);
  }

  private classifyError(error: unknown): StitchClassifiedError {
    return classifyStitchError(error);
  }
}
