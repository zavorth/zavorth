import { OpenCodeProvider } from '../OpenCodeProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const opencodePlugin: ProviderPlugin = {
  manifest: {
    name: 'opencode',
    description: 'OpenCode',
    authType: 'api_key',
    envVars: ['OPENCODE_API_KEY'],
    baseUrl: 'https://opencode.ai/zen/v1',
  },
  create: () => new OpenCodeProvider(),
};

export default opencodePlugin;
