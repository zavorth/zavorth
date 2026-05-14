import type { ProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';
import { createMinimalProviderIntegrationManifest } from '../ProviderIntegrationManifest.js';

const compatible = (
  id: string,
  label: string,
  defaultModelName: string,
  website: string,
): ProviderIntegrationManifest =>
  createMinimalProviderIntegrationManifest({
    id,
    label,
    vendorId: id,
    providerId: id,
    providerName: id,
    aliases: [id],
    website,
    routeKind: 'official',
    mode: 'cloud',
    authKind: 'api_key',
    credentialRefs: [`${envPrefix(id)}_API_KEY`, `${envPrefix(id)}_BASE_URL`],
    capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'],
    modalities: ['text', 'tool'],
    defaultModelName,
    source: 'curated',
  });

const local = (
  id: string,
  label: string,
  defaultModelName: string,
): ProviderIntegrationManifest =>
  createMinimalProviderIntegrationManifest({
    id,
    label,
    vendorId: id,
    providerId: id,
    providerName: id,
    aliases: [id, `${id}-local`],
    routeKind: 'local_runtime',
    mode: 'local',
    authKind: 'local_endpoint',
    credentialRefs: [`${envPrefix(id)}_BASE_URL`],
    capabilities: ['chat', 'coding', 'streaming', 'local'],
    modalities: ['text'],
    defaultModelName,
    source: 'curated',
  });

export const P0_PROVIDER_ACTIVATION_MANIFESTS: ProviderIntegrationManifest[] = [
  compatible('mistral', 'Mistral', 'mistral-large-latest', 'https://console.mistral.ai'),
  compatible('groq', 'Groq', 'llama-3.3-70b-versatile', 'https://console.groq.com'),
  compatible('together', 'Together AI', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'https://api.together.ai'),
  compatible('perplexity', 'Perplexity', 'sonar-pro', 'https://www.perplexity.ai'),
  compatible('xai', 'xAI', 'grok-4', 'https://console.x.ai'),
  compatible('huggingface', 'Hugging Face Inference', 'meta-llama/Llama-3.1-8B-Instruct', 'https://huggingface.co'),
  compatible('fireworks', 'Fireworks AI', 'accounts/fireworks/models/llama-v3p1-70b-instruct', 'https://fireworks.ai'),
  compatible('deepinfra', 'DeepInfra', 'meta-llama/Meta-Llama-3.1-70B-Instruct', 'https://deepinfra.com'),
  local('lmstudio', 'LM Studio', 'local-model'),
  local('vllm', 'vLLM', 'local-model'),
  createMinimalProviderIntegrationManifest({
    id: 'vercel-ai-gateway',
    label: 'Vercel AI Gateway',
    vendorId: 'vercel',
    providerId: 'vercel-ai-gateway',
    providerName: 'vercel-ai-gateway',
    aliases: ['vercel-ai-gateway', 'vercel-gateway'],
    website: 'https://vercel.com/ai-gateway',
    routeKind: 'custom_compatible',
    mode: 'cloud',
    authKind: 'api_key',
    credentialRefs: ['VERCEL_AI_GATEWAY_API_KEY', 'VERCEL_AI_GATEWAY_BASE_URL'],
    capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'],
    modalities: ['text', 'tool'],
    defaultModelName: 'openai/gpt-5.2',
    source: 'curated',
  }),
];

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
