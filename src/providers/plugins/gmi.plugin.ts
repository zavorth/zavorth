import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const gmiPlugin: ProviderPlugin = {
  manifest: {
    name: 'gmi',
    aliases: ['gmi-cloud', 'gmi_cloud'],
    description: 'GMI Cloud',
    authType: 'api_key',
    envVars: ['GMI_API_KEY'],
    baseUrl: 'https://api.gmi.cloud/v1',
  },
  create: (target) => new GatewayProvider({
    name: 'gmi',
    baseURL: target.baseUrl || 'https://api.gmi.cloud/v1',
    apiKey: target.apiKey || 'gmi-api-key',
    modelName: target.modelName,
  }),
};

export default gmiPlugin;
