import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const nousPlugin: ProviderPlugin = {
  manifest: {
    name: 'nous',
    aliases: ['nous-research', 'nous_research'],
    description: 'Nous Research',
    authType: 'api_key',
    envVars: ['NOUS_API_KEY'],
    baseUrl: 'https://api.nousresearch.com/v1',
  },
  create: (target) => new GatewayProvider({
    name: 'nous',
    baseURL: target.baseUrl || 'https://api.nousresearch.com/v1',
    apiKey: target.apiKey || 'nous-api-key',
    modelName: target.modelName,
  }),
};

export default nousPlugin;
