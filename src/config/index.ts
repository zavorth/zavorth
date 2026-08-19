import { buildZavorthConfig } from './sections/configFactory';
export type { ZavorthConfig } from './sections/configFactory';
export {
  getLiveProviderDefaults,
  getFirstClassProvidersSet,
  getAnthropicRouteIdsSet,
  getOpenAiCompatibleRouteIdsSet,
  getModelForProvider,
} from './sections/modelsConfig';
export type {
  LiveProviderFamily,
  LiveProviderDefaults,
  ProviderModelsConfig,
} from './sections/modelsConfig';

export const config = buildZavorthConfig();
