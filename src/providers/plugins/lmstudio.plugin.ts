import { LocalLlamaProvider } from '../LocalLlamaProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const lmstudioPlugin: ProviderPlugin = {
  manifest: {
    name: 'lmstudio',
    aliases: ['lm-studio', 'lm_studio'],
    description: 'LM Studio (local)',
    authType: 'none',
    baseUrl: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  create: (target) => new LocalLlamaProvider({
    baseUrl: target.baseUrl || 'http://localhost:1234/v1',
    modelName: target.modelName || 'local-model',
  }),
};

export default lmstudioPlugin;
