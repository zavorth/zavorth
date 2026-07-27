import { ModelCatalog, ModelInfo } from './types.js';

export class StaticCatalog implements ModelCatalog {
  readonly providerId: string;
  private models: Map<string, ModelInfo> = new Map();

  constructor(providerId: string, models: ModelInfo[]) {
    this.providerId = providerId;
    for (const model of models) {
      this.models.set(model.id, model);
    }
  }

  getStaticModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  findModel(modelId: string): ModelInfo | undefined {
    return this.models.get(modelId);
  }

  findModelByCapability(capability: string): ModelInfo[] {
    const allModels = Array.from(this.models.values());
    return allModels.filter((model) => {
      switch (capability) {
        case 'thinking':
          return model.supportsThinking;
        case 'vision':
          return model.supportsVision;
        case 'tools':
          return model.supportsTools;
        default:
          return false;
      }
    });
  }
}
