import type { ProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';
import { createMinimalProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';

type ConsistencyRoute = {
  id: string;
  label: string;
  defaultModelName: string;
  website: string;
  aliases?: string[];
  authKind?: 'api_key' | 'oauth' | 'local_endpoint' | 'custom';
  mode?: 'cloud' | 'local' | 'hybrid';
  credentialRefs?: string[];
};

const CONSISTENCY_ROUTES: ConsistencyRoute[] = [
  {
    id: 'alibaba-coding-plan',
    label: 'Alibaba Coding Plan',
    defaultModelName: 'qwen-coder-plus',
    website: 'https://dashscope.aliyun.com',
    aliases: ['dashscope-coding-plan', 'qwen-coding-plan'],
  },
  {
    id: 'azure-foundry',
    label: 'Azure AI Foundry',
    defaultModelName: 'gpt-4o',
    website: 'https://ai.azure.com',
    aliases: ['azure-ai-foundry', 'microsoft-foundry-ai'],
    credentialRefs: ['AZURE_FOUNDRY_API_KEY', 'AZURE_FOUNDRY_BASE_URL', 'AZURE_AI_FOUNDRY_API_KEY', 'AZURE_AI_FOUNDRY_BASE_URL'],
  },
  {
    id: 'bedrock',
    label: 'AWS Bedrock',
    defaultModelName: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    website: 'https://aws.amazon.com/bedrock',
    aliases: ['aws-bedrock', 'amazon-bedrock'],
    credentialRefs: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'BEDROCK_BASE_URL'],
  },
  {
    id: 'copilot',
    label: 'GitHub Copilot',
    defaultModelName: 'gpt-4o',
    website: 'https://github.com/features/copilot',
    aliases: ['github-copilot'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['GITHUB_COPILOT_OAUTH_TOKEN', 'COPILOT_API_KEY', 'COPILOT_BASE_URL'],
  },
  {
    id: 'copilot-acp',
    label: 'GitHub Copilot ACP',
    defaultModelName: 'copilot-acp',
    website: 'https://github.com/features/copilot',
    aliases: ['github-copilot-acp', 'copilot-agent-client-protocol'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['COPILOT_ACP_BASE_URL', 'COPILOT_ACP_COMMAND', 'GITHUB_COPILOT_OAUTH_TOKEN'],
  },
  {
    id: 'codex',
    label: 'Codex App Server',
    defaultModelName: 'gpt-4o-codex',
    website: 'https://openai.com/codex',
    aliases: ['codex-app-server', 'codex-cli-provider', 'openai-codex-app-server'],
    authKind: 'custom',
    mode: 'hybrid',
    credentialRefs: ['CODEX_HOME', 'CODEX_APP_SERVER_URL', 'CODEX_API_KEY', 'OPENAI_API_KEY'],
  },
  {
    id: 'bedrock-mantle',
    label: 'AWS Bedrock Mantle',
    defaultModelName: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    website: 'https://aws.amazon.com/bedrock',
    aliases: ['amazon-bedrock-mantle', 'aws-bedrock-mantle'],
    mode: 'hybrid',
    credentialRefs: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION', 'BEDROCK_MANTLE_BASE_URL'],
  },
  {
    id: 'claude-max-api-proxy',
    label: 'Claude Max API Proxy',
    defaultModelName: 'claude-sonnet-4',
    website: 'https://www.npmjs.com/package/claude-max-api-proxy',
    aliases: ['claude-max-proxy', 'claude-subscription-proxy'],
    authKind: 'local_endpoint',
    mode: 'local',
    credentialRefs: ['CLAUDE_MAX_API_PROXY_BASE_URL', 'CLAUDE_MAX_API_PROXY_API_KEY'],
  },
  {
    id: 'ds4',
    label: 'ds4 Local DeepSeek',
    defaultModelName: 'deepseek-v4-flash',
    website: 'https://github.com/antirez/ds4',
    aliases: ['deepseek-v4-flash-local', 'ds4-server'],
    authKind: 'local_endpoint',
    mode: 'local',
    credentialRefs: ['DS4_BASE_URL', 'DS4_API_KEY', 'DS4_COMMAND'],
  },
  {
    id: 'inferrs',
    label: 'Inferrs Local Runtime',
    defaultModelName: 'google/gemma-4-E2B-it',
    website: 'https://github.com/ericcurtin/inferrs',
    aliases: ['inferrs-local', 'inferrs-server'],
    authKind: 'local_endpoint',
    mode: 'local',
    credentialRefs: ['INFERRS_BASE_URL', 'INFERRS_API_KEY', 'INFERRS_COMMAND'],
  },
  {
    id: 'perplexity-provider',
    label: 'Perplexity Provider',
    defaultModelName: 'sonar-pro',
    website: 'https://www.perplexity.ai',
    aliases: ['perplexity', 'perplexity-ai', 'sonar'],
    credentialRefs: ['PERPLEXITY_API_KEY', 'PERPLEXITY_BASE_URL'],
  },
  {
    id: 'synthetic',
    label: 'Synthetic',
    defaultModelName: 'hf:MiniMaxAI/MiniMax-M2.5',
    website: 'https://synthetic.new',
    aliases: ['synthetic-new', 'synthetic-anthropic'],
    credentialRefs: ['SYNTHETIC_API_KEY', 'SYNTHETIC_BASE_URL'],
  },
  {
    id: 'gmi',
    label: 'GMI Cloud',
    defaultModelName: 'auto',
    website: 'https://www.gmicloud.ai',
    aliases: ['gmi-cloud'],
  },
  {
    id: 'nous',
    label: 'Nous Portal',
    defaultModelName: 'auto',
    website: 'https://portal.nousresearch.com',
    aliases: ['nous-portal'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['NOUS_API_KEY', 'NOUS_OAUTH_TOKEN', 'NOUS_BASE_URL'],
  },
  {
    id: 'ollama-cloud',
    label: 'Ollama Cloud',
    defaultModelName: 'gpt-oss:20b',
    website: 'https://ollama.com',
    aliases: ['ollama-hosted', 'ollama-cloud-compatible'],
    credentialRefs: ['OLLAMA_CLOUD_API_KEY', 'OLLAMA_CLOUD_BASE_URL'],
  },
  {
    id: 'opencode-zen',
    label: 'OpenCode Zen',
    defaultModelName: 'opencode/minimax-m2.5-free',
    website: 'https://opencode.ai',
    aliases: ['opencodezen', 'opencode-zen-gateway'],
    credentialRefs: ['OPENCODE_ZEN_API_KEY', 'OPENCODE_ZEN_BASE_URL'],
  },
  {
    id: 'qwen-oauth',
    label: 'Qwen OAuth',
    defaultModelName: 'qwen3-coder-plus',
    website: 'https://chat.qwen.ai',
    aliases: ['qwen-cli-oauth', 'qwen-auth'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['QWEN_OAUTH_TOKEN', 'QWEN_OAUTH_CREDS_PATH', 'QWEN_BASE_URL'],
  },
  {
    id: 'google-gemini-cli',
    label: 'Google Gemini CLI OAuth',
    defaultModelName: 'gemini-2.5-flash',
    website: 'https://ai.google.dev/gemini-api/docs/cli',
    aliases: ['gemini-cli-oauth', 'google-gemini-oauth'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['GOOGLE_GEMINI_CLI_OAUTH_TOKEN', 'GEMINI_CLI_OAUTH_TOKEN', 'GEMINI_API_KEY'],
  },
  {
    id: 'kimi-coding-cn',
    label: 'Kimi Coding China',
    defaultModelName: 'kimi-k2.5',
    website: 'https://platform.moonshot.cn',
    aliases: ['moonshot-cn', 'kimi-cn'],
    credentialRefs: ['KIMI_CN_API_KEY', 'KIMI_CN_BASE_URL', 'MOONSHOT_CN_API_KEY', 'MOONSHOT_CN_BASE_URL'],
  },
  {
    id: 'minimax-cn',
    label: 'MiniMax China',
    defaultModelName: 'minimax-m2',
    website: 'https://platform.minimaxi.com',
    aliases: ['minimax-china'],
    credentialRefs: ['MINIMAX_CN_API_KEY', 'MINIMAX_CN_BASE_URL'],
  },
  {
    id: 'minimax-oauth',
    label: 'MiniMax OAuth',
    defaultModelName: 'minimax-m2',
    website: 'https://www.minimax.io',
    aliases: ['minimax-auth'],
    authKind: 'oauth',
    mode: 'hybrid',
    credentialRefs: ['MINIMAX_OAUTH_TOKEN', 'MINIMAX_API_KEY'],
  },
];

export const ZAVORTH_PROVIDER_CONSISTENCY_PACK_MANIFESTS: ProviderIntegrationManifest[] =
  CONSISTENCY_ROUTES.map(toManifest);

function toManifest(route: ConsistencyRoute): ProviderIntegrationManifest {
  const manifest = createMinimalProviderIntegrationManifest({
    id: route.id,
    label: route.label,
    vendorId: route.id,
    providerId: route.id,
    providerName: route.id,
    aliases: [route.id, ...(route.aliases || [])],
    website: route.website,
    routeKind: route.mode === 'local' ? 'local_runtime' : 'custom_compatible',
    mode: route.mode || 'cloud',
    authKind: route.authKind || 'api_key',
    credentialRefs: route.credentialRefs || [`${envPrefix(route.id)}_API_KEY`, `${envPrefix(route.id)}_BASE_URL`],
    capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'],
    modalities: ['text', 'tool'],
    defaultModelName: route.defaultModelName,
    source: 'curated',
  });

  return {
    ...manifest,
    notes: [
      'Zavorth provider readiness pack route. Catalog visibility does not imply live execution.',
      'Activation still requires credentials, compatible endpoint or typed adapter, and explicit live proof.',
    ],
    routes: manifest.routes.map((entry) => ({
      ...entry,
      limitations: [
        'Not enabled for default routing until readiness and live proof pass.',
        'OAuth and ACP-flavored routes require owner-configured local credentials or adapter commands.',
      ],
    })),
  };
}

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
