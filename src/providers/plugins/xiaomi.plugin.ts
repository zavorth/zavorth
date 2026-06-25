import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const xiaomiPlugin: ProviderPlugin = {
  manifest: {
    name: 'xiaomi',
    aliases: ['xiaomi-mimo', 'xiaomi_mimo', 'mimo'],
    description: 'Xiaomi MiMo',
    authType: 'api_key',
    envVars: ['XIAOMI_API_KEY'],
    baseUrl: 'https://api.xiaomimimo.com/v1',
  },
  create: (target) => new GatewayProvider({
    name: 'xiaomi',
    baseURL: target.baseUrl || 'https://api.xiaomimimo.com/v1',
    apiKey: target.apiKey || 'xiaomi-api-key',
    modelName: target.modelName,
  }),
};

export default xiaomiPlugin;
