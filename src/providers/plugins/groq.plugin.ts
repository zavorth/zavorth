import { GroqProvider } from '../GroqProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const groqPlugin: ProviderPlugin = {
  manifest: {
    name: 'groq',
    description: 'Groq',
    authType: 'api_key',
    envVars: ['GROQ_API_KEY'],
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  create: () => new GroqProvider(),
};

export default groqPlugin;
