import { GeminiInteractionsProviderAdapter } from '../GeminiInteractionsProviderAdapter.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const geminiInteractionsPlugin: ProviderPlugin = {
  manifest: {
    name: 'gemini-interactions',
    aliases: ['google-interactions-api', 'interactions-api'],
    description: 'Gemini Interactions API (Beta)',
    authType: 'api_key',
    envVars: ['GEMINI_INTERACTIONS_API_KEY', 'GEMINI_API_KEY'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.5-flash',
  },
  create: (target) => new GeminiInteractionsProviderAdapter({
    apiKey: target.apiKey,
    baseUrl: target.baseUrl,
    modelName: target.modelName,
  }),
};

export default geminiInteractionsPlugin;
