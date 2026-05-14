import { ExecutionRequest, ExecutionResult } from '../../contracts/ExecutionContract.js';

export type StitchDeviceType = 'DEVICE_TYPE_UNSPECIFIED' | 'MOBILE' | 'DESKTOP' | 'TABLET' | 'AGNOSTIC';
export type StitchModelId = 'MODEL_ID_UNSPECIFIED' | 'GEMINI_3_PRO' | 'GEMINI_3_FLASH';

export type StitchAuthConfig =
  | { apiKey: string; accessToken?: never; projectId?: never }
  | { apiKey?: never; accessToken: string; projectId: string };

export type StitchGeneratedScreen = {
  id?: string;
  name?: string;
  htmlCode?: { downloadUrl?: string | null } | null;
  screenshot?: { downloadUrl?: string | null } | null;
};

export type StitchSdkModule = {
  Stitch: new (client: any) => {
    createProject(title: string): Promise<any>;
    projects(): Promise<any>;
  };
  StitchToolClient: new (options: Record<string, unknown>) => {
    callTool(name: string, payload: Record<string, unknown>): Promise<any>;
    close(): Promise<void>;
  };
};

export type StitchClassifiedError = {
  code: string;
  message: string;
  stderr: string | null;
  suggestion?: string;
};

export type StitchDownloadResult = {
  path: string;
  mimeType: string;
};

export type StitchSuccessSummaryInput = {
  projectId: string;
  screenId: string;
  deviceType: StitchDeviceType;
  modelId: StitchModelId | null;
  imageUrl: string | null;
  htmlUrl: string | null;
  downloadedImagePath: string | null;
  downloadedHtmlPath: string | null;
};

export type StitchPersistArtifactsInput = {
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
  downloadArtifact: (
    artifactUrl: string,
    artifactDir: string,
    baseName: string,
    authConfig: StitchAuthConfig,
  ) => Promise<StitchDownloadResult>;
};

export type StitchPersistArtifactsResult = {
  artifacts: any[];
  metadata: Record<string, any>;
  downloadedImage: StitchDownloadResult | null;
  downloadedHtml: StitchDownloadResult | null;
  manifestPath: string;
};

export type StitchRetryInput = {
  projectId: string;
  prompt: string;
  generationPrompt: string;
  deviceType: StitchDeviceType;
  modelId: StitchModelId | null;
  request: ExecutionRequest;
  result: ExecutionResult;
};
