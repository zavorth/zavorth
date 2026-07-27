import { ExecutionRequest, ExecutionResult } from '../../contracts/ExecutionContract.js';
import {
  StitchAuthConfig,
  StitchClassifiedError,
  StitchDeviceType,
  StitchGeneratedScreen,
  StitchModelId,
  StitchPersistArtifactsResult,
  StitchRetryInput,
  StitchSdkModule,
  StitchSuccessSummaryInput,
} from './stitchExecutorTypes.js';
type ExecuteStitchSdkRouteInput = {
  request: ExecutionRequest;
  result: ExecutionResult;
  prompt: string;
  generationPrompt: string;
  artifactDir: string;
  authConfig: StitchAuthConfig;
  timeoutMs: number;
  stitchHost: string;
  deviceType: StitchDeviceType;
  modelId: StitchModelId | null;
  loadSdk: () => Promise<StitchSdkModule>;
  buildClientOptions: (
    authConfig: StitchAuthConfig,
    baseUrl: string,
    timeout: number,
  ) => Record<string, unknown>;
  buildProjectTitle: (prompt: string, taskId: string) => string;
  resolveProjectId: (project: any) => string;
  generateScreenWithRetry: (client: any, input: StitchRetryInput) => Promise<any>;
  extractGeneratedScreen: (raw: any) => StitchGeneratedScreen | null;
  resolveScreenId: (screen: StitchGeneratedScreen | null) => string;
  extractDownloadUrl: (value: any) => string | null;
  persistArtifacts: (input: {
    artifactDir: string;
    prompt: string;
    generationPrompt: string;
    projectId: string;
    screenId: string;
    deviceType: StitchDeviceType;
    modelId: StitchModelId | null;
    imageUrl: string | null;
    htmlUrl: string | null;
    authConfig: StitchAuthConfig;
  }) => Promise<StitchPersistArtifactsResult>;
  formatSuccessSummary: (input: StitchSuccessSummaryInput) => string;
  classifyError: (error: unknown) => StitchClassifiedError;
};

type ProbeStitchSdkConnectionInput = {
  authConfig: StitchAuthConfig;
  stitchHost: string;
  timeoutMs: number;
  loadSdk: () => Promise<StitchSdkModule>;
  buildClientOptions: (
    authConfig: StitchAuthConfig,
    baseUrl: string,
    timeout: number,
  ) => Record<string, unknown>;
  classifyError: (error: unknown) => StitchClassifiedError;
};

type GenerateStitchScreenWithRetryInput = {
  client: any;
  input: StitchRetryInput;
  isRetriableGenerationError: (error: unknown) => boolean;
  buildTimeoutFallbackPrompt: (prompt: string, currentPrompt: string, request: ExecutionRequest) => string;
};

export async function loadStitchSdkModule(): Promise<StitchSdkModule> {
  return (await import('@google/stitch-sdk')) as StitchSdkModule;
}

export async function executeStitchSdkRoute(
  input: ExecuteStitchSdkRouteInput,
): Promise<ExecutionResult> {
  const sdkModule = await input.loadSdk().catch(() => null);
  if (!sdkModule) {
    input.result.error_code = 'STITCH_SDK_UNAVAILABLE';
    input.result.error_message = 'The Stitch SDK did not load correctly on this host.';
    input.result.finished_at = new Date().toISOString();
    return input.result;
  }

  const { Stitch, StitchToolClient } = sdkModule;
  const client = new StitchToolClient(
    input.buildClientOptions(input.authConfig, input.stitchHost, input.timeoutMs),
  );
  const sdk = new Stitch(client);

  try {
    const projectTitle = input.buildProjectTitle(input.prompt, input.request.task_id);
    const project = await sdk.createProject(projectTitle);
    const projectId = input.resolveProjectId(project);
    input.result.actions_executed.push(`[Stitch] Projeto created: ${projectId}`);

    const generationResponse = await input.generateScreenWithRetry(client, {
      projectId,
      prompt: input.prompt,
      generationPrompt: input.generationPrompt,
      deviceType: input.deviceType,
      modelId: input.modelId,
      request: input.request,
      result: input.result,
    });
    const generatedScreen = input.extractGeneratedScreen(generationResponse);
    const screenId = input.resolveScreenId(generatedScreen);

    if (!generatedScreen || !screenId) {
      throw new Error('Stitch did not return a valid screen in generate_screen_from_text.');
    }

    input.result.actions_executed.push(`[Stitch] Screen generated: ${screenId}`);

    const { imageUrl, htmlUrl } = await resolveStitchRemoteArtifacts({
      client,
      projectId,
      screenId,
      generatedScreen,
      extractDownloadUrl: input.extractDownloadUrl,
    });

    const persisted = await input.persistArtifacts({
      artifactDir: input.artifactDir,
      prompt: input.prompt,
      generationPrompt: input.generationPrompt,
      projectId,
      screenId,
      deviceType: input.deviceType,
      modelId: input.modelId,
      imageUrl,
      htmlUrl,
      authConfig: input.authConfig,
    });

    if (persisted.downloadedImage?.path) {
      input.result.files_written.push(persisted.downloadedImage.path);
    }
    if (persisted.downloadedHtml?.path) {
      input.result.files_written.push(persisted.downloadedHtml.path);
    }
    input.result.files_written.push(persisted.manifestPath);

    input.result.success = true;
    input.result.artifacts = persisted.artifacts;
    input.result.metadata = persisted.metadata;
    input.result.metadata.stitch_prompt_length = input.prompt.length;
    input.result.metadata.stitch_generation_prompt_length = input.generationPrompt.length;
    input.result.stdout = input.formatSuccessSummary({
      projectId,
      screenId,
      deviceType: input.deviceType,
      modelId: input.modelId,
      imageUrl,
      htmlUrl,
      downloadedImagePath: persisted.downloadedImage?.path || null,
      downloadedHtmlPath: persisted.downloadedHtml?.path || null,
    });
  } catch (error: unknown) {const classified = input.classifyError(error);
    input.result.error_code = classified.code;
    input.result.error_message = classified.message;
    input.result.stderr = classified.stderr;
    input.result.metadata = {
      ...(input.result.metadata || {}),
      stitch_failure_kind: classified.code,
      suggestion: classified.suggestion || null,
    };
    input.result.actions_executed.push(`[Stitch] Failure: ${classified.message}`);
  } finally {
    await client.close().catch(() => undefined);
    input.result.finished_at = new Date().toISOString();
  }

  return input.result;
}

export async function probeStitchSdkConnection(
  input: ProbeStitchSdkConnectionInput,
): Promise<{ ok: boolean; message: string }> {
  const sdkModule = await input.loadSdk().catch(() => null);
  if (!sdkModule) {
    return {
      ok: false,
      message: 'The Stitch SDK did not load correctly on this host.',
    };
  }

  const { Stitch, StitchToolClient } = sdkModule;
  const client = new StitchToolClient(
    input.buildClientOptions(input.authConfig, input.stitchHost, input.timeoutMs),
  );
  const sdk = new Stitch(client);

  try {
    await sdk.projects();
    return {
      ok: true,
      message: 'SDK loaded and authentication validated with Stitch.',
    };
  } catch (error: unknown) {const classified = input.classifyError(error);
    return {
      ok: false,
      message: classified.message,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function generateStitchScreenWithRetry(
  input: GenerateStitchScreenWithRetryInput,
): Promise<any> {
  const primaryPayload = {
    projectId: input.input.projectId,
    prompt: input.input.generationPrompt,
    deviceType: input.input.deviceType,
    ...(input.input.modelId ? { modelId: input.input.modelId } : {}),
  };

  try {
    return await input.client.callTool('generate_screen_from_text', primaryPayload);
  } catch (error: unknown) {if (!input.isRetriableGenerationError(error)) {
      throw error;
    }

    const fallbackPrompt = input.buildTimeoutFallbackPrompt(
      input.input.prompt,
      input.input.generationPrompt,
      input.input.request,
    );
    if (!fallbackPrompt || fallbackPrompt === input.input.generationPrompt) {
      throw error;
    }

    input.input.result.actions_executed.push(
      '[Stitch] Timeout detectado; tentando again com um briefing mais curto.',
    );
    return input.client.callTool('generate_screen_from_text', {
      ...primaryPayload,
      prompt: fallbackPrompt,
    });
  }
}

async function resolveStitchRemoteArtifacts(input: {
  client: any;
  projectId: string;
  screenId: string;
  generatedScreen: StitchGeneratedScreen;
  extractDownloadUrl: (value: any) => string | null;
}): Promise<{ imageUrl: string | null; htmlUrl: string | null }> {
  let imageUrl = input.extractDownloadUrl(input.generatedScreen.screenshot);
  let htmlUrl = input.extractDownloadUrl(input.generatedScreen.htmlCode);

  if (!imageUrl || !htmlUrl) {
    const screenDetails = await input.client
      .callTool('get_screen', {
        projectId: input.projectId,
        screenId: input.screenId,
        name: `projects/${input.projectId}/screens/${input.screenId}`,
      })
      .catch(() => null);
    imageUrl = imageUrl || input.extractDownloadUrl(screenDetails?.screenshot);
    htmlUrl = htmlUrl || input.extractDownloadUrl(screenDetails?.htmlCode);
  }

  return { imageUrl, htmlUrl };
}
