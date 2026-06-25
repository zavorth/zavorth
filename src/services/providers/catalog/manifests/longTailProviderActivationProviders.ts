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
    routeKind: 'custom_compatible',
    mode: 'cloud',
    authKind: 'api_key',
    credentialRefs: [`${envPrefix(id)}_API_KEY`, `${envPrefix(id)}_BASE_URL`],
    capabilities: ['chat', 'coding', 'reasoning', 'streaming', 'tool_use'],
    modalities: ['text', 'tool'],
    defaultModelName,
    source: 'curated',
  });

const managedGateway = (
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
    aliases: [id, `${id}-gateway`, `${id}-compatible`],
    website,
    routeKind: 'custom_compatible',
    mode: 'hybrid',
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
  website: string,
): ProviderIntegrationManifest =>
  createMinimalProviderIntegrationManifest({
    id,
    label,
    vendorId: id,
    providerId: id,
    providerName: id,
    aliases: [id, `${id}-local`],
    website,
    routeKind: 'local_runtime',
    mode: 'local',
    authKind: 'local_endpoint',
    credentialRefs: [`${envPrefix(id)}_BASE_URL`],
    capabilities: ['chat', 'coding', 'streaming', 'local'],
    modalities: ['text'],
    defaultModelName,
    source: 'curated',
  });

const embedding = (
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
    capabilities: ['embedding'],
    modalities: ['embedding'],
    defaultModelName,
    source: 'curated',
  });

export const LONG_TAIL_PROVIDER_ACTIVATION_MANIFESTS: ProviderIntegrationManifest[] = [
  compatible('alibaba', 'Alibaba DashScope Compatible', 'qwen-plus', 'https://dashscope.aliyun.com'),
  managedGateway('amazon-bedrock', 'Amazon Bedrock Gateway', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'https://aws.amazon.com/bedrock'),
  managedGateway('amazon-bedrock-mantle', 'Amazon Bedrock Mantle Gateway', 'anthropic.claude-3-5-sonnet-20241022-v2:0', 'https://aws.amazon.com/bedrock'),
  managedGateway('anthropic-vertex', 'Anthropic Vertex Gateway', 'claude-3-5-sonnet-latest', 'https://cloud.google.com/vertex-ai'),
  compatible('arcee', 'Arcee AI', 'auto', 'https://www.arcee.ai'),
  compatible('cerebras', 'Cerebras Inference', 'llama-3.3-70b', 'https://cloud.cerebras.ai'),
  compatible('chutes', 'Chutes AI', 'deepseek-ai/DeepSeek-V3', 'https://chutes.ai'),
  compatible('byteplus', 'BytePlus ModelArk', 'doubao-seed-1-6', 'https://www.byteplus.com/en/product/modelark'),
  local('comfy', 'ComfyUI OpenAI-compatible Runtime', 'local-model', 'https://www.comfy.org'),
  managedGateway('cloudflare-ai-gateway', 'Cloudflare AI Gateway', 'gemini-2.5-flash', 'https://developers.cloudflare.com/ai-gateway'),
  managedGateway('copilot-proxy', 'Copilot Proxy', 'gpt-4o', 'https://github.com/features/copilot'),
  managedGateway('github-copilot', 'GitHub Copilot Compatible', 'gpt-4o', 'https://github.com/features/copilot'),
  compatible('gradium', 'Gradium', 'auto', 'https://gradium.ai'),
  managedGateway('kilocode', 'Kilo Code Gateway', 'auto', 'https://kilocode.ai'),
  compatible('kimi-coding', 'Kimi Coding', 'kimi-k2-0711-preview', 'https://platform.moonshot.ai'),
  managedGateway('litellm', 'LiteLLM Gateway', 'gpt-4o-mini', 'https://litellm.ai'),
  managedGateway('azure-openai', 'Azure OpenAI', 'gpt-4o', 'https://azure.microsoft.com/products/ai-services/openai-service'),
  managedGateway('microsoft', 'Microsoft AI Gateway', 'gpt-4o', 'https://ai.azure.com'),
  managedGateway('microsoft-foundry', 'Microsoft Foundry Gateway', 'gpt-4o', 'https://ai.azure.com'),
  compatible('moonshot', 'Moonshot AI', 'moonshot-v1-128k', 'https://platform.moonshot.ai'),
  compatible('nvidia', 'NVIDIA NIM', 'meta/llama-3.1-70b-instruct', 'https://build.nvidia.com'),
  compatible('opencode', 'OpenCode', 'opencode/minimax-m2.5-free', 'https://opencode.ai'),
  managedGateway('opencode-go', 'OpenCode Go Gateway', 'opencode/minimax-m2.5-free', 'https://opencode.ai'),
  compatible('qianfan', 'Baidu Qianfan', 'ernie-4.0-turbo-8k', 'https://cloud.baidu.com/product/wenxinworkshop'),
  local('sglang', 'SGLang Local Runtime', 'local-model', 'https://docs.sglang.ai'),
  compatible('stepfun', 'StepFun', 'step-2-mini', 'https://platform.stepfun.com'),
  compatible('tencent', 'Tencent Hunyuan', 'hunyuan-turbos-latest', 'https://cloud.tencent.com/product/hunyuan'),
  compatible('tokenjuice', 'TokenJuice', 'auto', 'https://tokenjuice.ai'),
  compatible('venice', 'Venice AI', 'llama-3.3-70b', 'https://venice.ai'),
  embedding('voyage', 'Voyage AI Embeddings', 'voyage-3-large', 'https://www.voyageai.com'),
  compatible('xiaomi', 'Xiaomi MiLM Compatible', 'auto', 'https://www.mi.com'),
  compatible('zai', 'Z.ai GLM Compatible', 'glm-4.5', 'https://z.ai'),
];

function envPrefix(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
