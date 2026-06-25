import { CerebrasProvider } from '../CerebrasProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const cerebrasPlugin: ProviderPlugin = {
  manifest: {
    name: 'cerebras',
    description: 'Cerebras',
    authType: 'api_key',
    envVars: ['CEREBRAS_API_KEY'],
    baseUrl: 'https://api.cerebras.ai/v1',
    defaultModel: 'llama-3.3-70b',
  },
  create: () => new CerebrasProvider(),
};

export default cerebrasPlugin;
