import { DeepSeekProvider } from '../DeepSeekProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const deepseekPlugin: ProviderPlugin = {
  manifest: {
    name: 'deepseek',
    description: 'DeepSeek',
    authType: 'api_key',
    envVars: ['DEEPSEEK_API_KEY'],
    defaultModel: 'deepseek-chat',
  },
  create: () => new DeepSeekProvider(),
};

export default deepseekPlugin;
