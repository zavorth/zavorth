import { BedrockClaudeProviderAdapter } from '../../adapters/providers/BedrockClaudeProviderAdapter.js';
import type { ProviderPlugin } from './ProviderPluginManifest.js';

const bedrockClaudePlugin: ProviderPlugin = {
  manifest: {
    name: 'bedrock-claude',
    aliases: ['amazon-bedrock', 'amazon_bedrock', 'aws-bedrock', 'bedrock', 'bedrock_claude'],
    description: 'AWS Bedrock Claude',
    authType: 'aws_credentials',
    envVars: ['BEDROCK_CLAUDE_MODEL'],
    defaultModel: 'anthropic.claude-3-5-sonnet-latest-20250929-v1:0',
  },
  create: (target) => new BedrockClaudeProviderAdapter({
    modelName: target.modelName,
  }),
};

export default bedrockClaudePlugin;
