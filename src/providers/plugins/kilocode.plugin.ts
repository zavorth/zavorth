import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const kilocodePlugin: ProviderPlugin = {
  manifest: {
    name: 'kilocode',
    aliases: ['kilocode-ai', 'kilocode_ai'],
    description: 'Kilocode',
    authType: 'api_key',
    envVars: ['KILOCODE_API_KEY'],
    baseUrl: 'https://api.kilocode.ai/v1',
  },
  create: (target) => new GatewayProvider({
    name: 'kilocode',
    baseURL: target.baseUrl || 'https://api.kilocode.ai/v1',
    apiKey: target.apiKey || 'kilocode-api-key',
    modelName: target.modelName,
  }),
};

export default kilocodePlugin;
