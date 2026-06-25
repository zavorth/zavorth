import { LocalLlamaProvider } from '../LocalLlamaProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const ollamaPlugin: ProviderPlugin = {
  manifest: {
    name: 'ollama',
    aliases: ['local-llama', 'local_llama', 'localllama'],
    description: 'Ollama (local models)',
    authType: 'none',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'gemma2:2b',
  },
  create: (target) => new LocalLlamaProvider({
    baseUrl: target.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelName: target.modelName || process.env.OLLAMA_MODEL || 'gemma2:2b',
  }),
};

export default ollamaPlugin;
