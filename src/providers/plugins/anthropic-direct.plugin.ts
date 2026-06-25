import { AnthropicDirectProviderAdapter } from '../../adapters/providers/AnthropicDirectProviderAdapter.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const anthropicDirectPlugin: ProviderPlugin = {
  manifest: {
    name: 'anthropic-direct',
    aliases: ['anthropic', 'claude-direct', 'anthropic_direct', 'anthropic-sdk'],
    description: 'Anthropic (Direct SDK)',
    authType: 'api_key',
    envVars: ['ANTHROPIC_API_KEY'],
    defaultModel: 'claude-sonnet-4-6',
  },
  create: (target) => new AnthropicDirectProviderAdapter({
    apiKey: target.apiKey,
    baseUrl: target.baseUrl,
    modelName: target.modelName,
  }),
};

export default anthropicDirectPlugin;
