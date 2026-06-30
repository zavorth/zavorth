import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const samsungPlugin: ProviderPlugin = {
  manifest: {
    name: 'samsung',
    aliases: ['samsung-gauss', 'samsung_gauss'],
    description: 'Samsung Gauss',
    authType: 'api_key',
    envVars: ['SAMSUNG_GAUSS_API_KEY'],
    baseUrl: 'https://api.samsung.com/gauss/v1',
    defaultModel: 'samsung-gauss-chat',
  },
  create: (target) => new GatewayProvider({
    name: 'samsung',
    baseURL: target.baseUrl || 'https://api.samsung.com/gauss/v1',
    apiKey: target.apiKey || process.env.SAMSUNG_GAUSS_API_KEY || 'samsung-api-key',
    modelName: target.modelName,
  }),
};

export default samsungPlugin;
