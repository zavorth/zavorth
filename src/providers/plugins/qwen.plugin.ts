import { QwenProvider } from '../QwenProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const qwenPlugin: ProviderPlugin = {
  manifest: {
    name: 'qwen',
    aliases: ['puter'],
    description: 'Qwen (Alibaba)',
    authType: 'api_key',
    envVars: ['QWEN_API_KEY', 'ALIBABA_API_KEY'],
  },
  create: () => new QwenProvider(),
};

export default qwenPlugin;
