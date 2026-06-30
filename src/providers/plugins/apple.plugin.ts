import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const applePlugin: ProviderPlugin = {
  manifest: {
    name: 'apple',
    aliases: ['apple-intelligence', 'apple_intelligence'],
    description: 'Apple Intelligence',
    authType: 'oauth',
    envVars: ['APPLE_INTELLIGENCE_CLIENT_ID', 'APPLE_INTELLIGENCE_CLIENT_SECRET'],
    baseUrl: 'https://apple-intelligence.googleapis.com/v1',
    defaultModel: 'apple-intelligence-chat',
  },
  create: (target) => new GatewayProvider({
    name: 'apple',
    baseURL: target.baseUrl || 'https://apple-intelligence.googleapis.com/v1',
    apiKey: target.apiKey || process.env.APPLE_INTELLIGENCE_CLIENT_ID || 'apple-intelligence-api-key',
    modelName: target.modelName,
  }),
};

export default applePlugin;
