import { AI21Provider } from '../AI21Provider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const ai21Plugin: ProviderPlugin = {
  manifest: {
    name: 'ai21',
    description: 'AI21 Labs',
    authType: 'api_key',
    envVars: ['AI21_API_KEY'],
    baseUrl: 'https://api.ai21.com/studio/v1',
    defaultModel: 'jamba-1.5-large',
  },
  create: () => new AI21Provider(),
};

export default ai21Plugin;
