import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const novitaPlugin: ProviderPlugin = {
  manifest: {
    name: 'novita',
    aliases: ['novita-ai', 'novita_ai'],
    description: 'Novita AI',
    authType: 'api_key',
    envVars: ['NOVITA_API_KEY'],
    baseUrl: 'https://api.novita.ai/v3/openai',
  },
  create: (target) => new GatewayProvider({
    name: 'novita',
    baseURL: target.baseUrl || 'https://api.novita.ai/v3/openai',
    apiKey: target.apiKey || 'novita-api-key',
    modelName: target.modelName,
  }),
};

export default novitaPlugin;
