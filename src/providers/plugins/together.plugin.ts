import { TogetherProvider } from '../TogetherProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const togetherPlugin: ProviderPlugin = {
  manifest: {
    name: 'together',
    description: 'Together AI',
    authType: 'api_key',
    envVars: ['TOGETHER_API_KEY'],
    baseUrl: 'https://api.together.xyz/v1',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  create: () => new TogetherProvider(),
};

export default togetherPlugin;
