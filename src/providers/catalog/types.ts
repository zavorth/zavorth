export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface ModelCatalog {
  readonly providerId: string;
  getStaticModels(): ModelInfo[];
  fetchModels?(apiKey: string, baseUrl: string): Promise<ModelInfo[]>;
  findModel(modelId: string): ModelInfo | undefined;
  findModelByCapability(capability: string): ModelInfo[];
}
