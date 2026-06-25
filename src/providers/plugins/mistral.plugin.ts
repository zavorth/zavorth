import { MistralProvider } from '../MistralProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const mistralPlugin: ProviderPlugin = {
  manifest: {
    name: 'mistral',
    description: 'Mistral AI',
    authType: 'api_key',
    envVars: ['MISTRAL_API_KEY'],
    baseUrl: 'https://api.mistral.ai/v1',
    defaultModel: 'mistral-large-latest',
  },
  create: () => new MistralProvider(),
};

export default mistralPlugin;
