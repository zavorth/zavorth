import { GoogleGenAiProviderAdapter } from '../../adapters/providers/GoogleGenAiProviderAdapter.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const googleGenaiPlugin: ProviderPlugin = {
  manifest: {
    name: 'google-genai',
    aliases: ['genai', 'google_genai', 'google-ai'],
    description: 'Google GenAI SDK',
    authType: 'api_key',
    envVars: ['GOOGLE_GENAI_API_KEY', 'GEMINI_API_KEY'],
    defaultModel: 'gemini-2.5-flash',
  },
  create: (target) => new GoogleGenAiProviderAdapter({
    apiKey: target.apiKey,
    modelName: target.modelName,
  }),
};

export default googleGenaiPlugin;
