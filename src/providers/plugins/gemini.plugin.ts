import { GeminiProvider } from '../GeminiProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const geminiPlugin: ProviderPlugin = {
  manifest: {
    name: 'gemini',
    description: 'Google Gemini',
    authType: 'api_key',
    envVars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    defaultModel: 'gemini-2.5-flash',
  },
  create: () => new GeminiProvider(),
};

export default geminiPlugin;
