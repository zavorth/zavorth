import type { ProviderPlugin } from './ProviderPluginManifest.js';

const replicatePlugin: ProviderPlugin = {
  manifest: {
    name: 'replicate',
    description: 'Replicate',
    authType: 'api_key',
    envVars: ['REPLICATE_API_TOKEN'],
    baseUrl: 'https://api.replicate.com/v1',
    defaultModel: 'meta/llama-3.1-405b-instruct',
  },
  create: () => {
    throw new Error(
      'Replicate provider not yet implemented. Use zavorth_replicate tool directly.'
    );
  },
};

export default replicatePlugin;
