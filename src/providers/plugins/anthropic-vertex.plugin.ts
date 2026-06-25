import { AnthropicVertexProviderAdapter } from '../../adapters/providers/AnthropicVertexProviderAdapter.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const anthropicVertexPlugin: ProviderPlugin = {
  manifest: {
    name: 'anthropic-vertex',
    aliases: ['anthropic_vertex', 'claude-vertex', 'vertex-claude'],
    description: 'Anthropic via Google Cloud Vertex',
    authType: 'oauth',
    envVars: ['ANTHROPIC_VERTEX_MODEL'],
    defaultModel: 'claude-sonnet-4-6',
  },
  create: (target) => new AnthropicVertexProviderAdapter({
    modelName: target.modelName,
  }),
};

export default anthropicVertexPlugin;
