import { GatewayProvider } from '../GatewayProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const aigatewayPlugin: ProviderPlugin = {
  manifest: {
    name: 'aigateway',
    aliases: ['ai-gateway', 'ai_gateway'],
    description: 'AI Gateway (OpenAI-compatible proxy)',
    authType: 'api_key',
    envVars: ['AIGATEWAY_API_KEY', 'AIGateway_API_KEY'],
  },
  create: () => new GatewayProvider(),
};

export default aigatewayPlugin;
