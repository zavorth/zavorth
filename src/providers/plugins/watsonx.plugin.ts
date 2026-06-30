import type { ProviderPlugin } from './ProviderPluginManifest.js';

const watsonxPlugin: ProviderPlugin = {
  manifest: {
    name: 'watsonx',
    description: 'IBM watsonx',
    authType: 'api_key',
    envVars: ['WATSONX_API_KEY', 'WATSONX_PROJECT_ID'],
    baseUrl: 'https://us-south.ml.cloud.ibm.com/ml/v1',
    defaultModel: 'meta-llama/llama-3-70b-instruct',
  },
  create: () => {
    throw new Error(
      'IBM watsonx provider not yet implemented.'
    );
  },
};

export default watsonxPlugin;
