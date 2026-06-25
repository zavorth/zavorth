import { MiniMaxProvider } from '../MiniMaxProvider.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const minimaxPlugin: ProviderPlugin = {
  manifest: {
    name: 'minimax',
    description: 'MiniMax',
    authType: 'api_key',
    envVars: ['MINIMAX_API_KEY'],
  },
  create: () => new MiniMaxProvider(),
};

export default minimaxPlugin;
