import { InflectionProvider } from '../InflectionProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const inflectionPlugin: ProviderPlugin = {
  manifest: {
    name: 'inflection',
    description: 'Inflection AI',
    authType: 'api_key',
    envVars: ['INFLECTION_API_KEY'],
    baseUrl: 'https://api.inflection.ai/v1',
    defaultModel: 'inflection-3',
  },
  create: () => new InflectionProvider(),
};

export default inflectionPlugin;
