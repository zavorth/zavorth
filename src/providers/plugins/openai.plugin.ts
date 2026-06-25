import { OpenAIProvider } from '../OpenAIProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const openaiPlugin: ProviderPlugin = {
  manifest: {
    name: 'openai',
    description: 'OpenAI',
    authType: 'api_key',
    envVars: ['OPENAI_API_KEY'],
    defaultModel: 'gpt-4o',
  },
  create: () => new OpenAIProvider(),
};

export default openaiPlugin;
