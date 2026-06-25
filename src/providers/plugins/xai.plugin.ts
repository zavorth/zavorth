import { XaiProvider } from '../XaiProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const xaiPlugin: ProviderPlugin = {
  manifest: {
    name: 'xai',
    description: 'xAI (Grok)',
    authType: 'api_key',
    envVars: ['XAI_API_KEY'],
    baseUrl: 'https://api.x.ai/v1',
    defaultModel: 'grok-4',
  },
  create: () => new XaiProvider(),
};

export default xaiPlugin;
