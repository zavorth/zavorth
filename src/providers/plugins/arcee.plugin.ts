import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const arceePlugin: ProviderPlugin = {
  manifest: {
    name: 'arcee',
    aliases: ['arcee-ai', 'arcee_ai'],
    description: 'Arcee AI',
    authType: 'api_key',
    envVars: ['ARCEE_API_KEY'],
    baseUrl: 'https://api.arcee.ai/v2',
  },
  create: (target) => new GatewayProvider({
    name: 'arcee',
    baseURL: target.baseUrl || 'https://api.arcee.ai/v2',
    apiKey: target.apiKey || 'arcee-api-key',
    modelName: target.modelName,
  }),
};

export default arceePlugin;
