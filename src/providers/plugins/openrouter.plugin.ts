import { OpenRouterProvider } from '../OpenRouterProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const openrouterPlugin: ProviderPlugin = {
  manifest: {
    name: 'openrouter',
    description: 'OpenRouter',
    authType: 'api_key',
    envVars: ['OPENROUTER_API_KEY'],
    defaultModel: 'openrouter/auto',
  },
  create: () => new OpenRouterProvider(),
};

export default openrouterPlugin;
