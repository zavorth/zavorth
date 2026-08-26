/**
 * Provider catalog entry — describes a single AI provider or service.
 *
 * Categories:
 * - `cloud`: Major cloud AI providers (OpenAI, Anthropic, Azure, etc.)
 * - `silicon`: Specialized AI chip/cloud providers (Cerebras, Groq, etc.)
 * - `asian_global`: Asian-origin AI providers (DeepSeek, Qwen, etc.)
 * - `search_rag`: Embedding/reranking/search providers (Voyage, Jina, etc.)
 * - `local`: Local inference engines (Ollama, LM Studio, etc.)
 * - `aggregator`: Multi-provider routers (OpenRouter, Portkey, etc.)
 *
 * Note: Some entries like Render, Fly.io, Railway are hosting platforms that
 * support AI workloads. They are categorized as `cloud` for convenience but
 * are not AI-native providers.
 */
export interface ProviderCatalogEntry {
  id: string;
  name: string;
  category: 'cloud' | 'silicon' | 'asian_global' | 'search_rag' | 'local' | 'aggregator';
  envKey: string;
  defaultModel?: string;
  protocol: 'openai_compatible' | 'anthropic' | 'gemini_native' | 'claude_native' | 'ollama_native';
  runtimeSupported: boolean;
}

export const UNIVERSAL_PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { id: 'openai', name: 'OpenAI', category: 'cloud', envKey: 'OPENAI_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'anthropic', name: 'Anthropic', category: 'cloud', envKey: 'ANTHROPIC_API_KEY', defaultModel: 'claude-3-5-sonnet-latest', protocol: 'claude_native', runtimeSupported: true },
  { id: 'gemini', name: 'Gemini', category: 'cloud', envKey: 'GEMINI_API_KEY', defaultModel: 'gemini-2.5-flash', protocol: 'gemini_native', runtimeSupported: true },
  { id: 'perplexity', name: 'Perplexity', category: 'cloud', envKey: 'PERPLEXITY_API_KEY', defaultModel: 'sonar-pro', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'together', name: 'Together AI', category: 'cloud', envKey: 'TOGETHER_API_KEY', defaultModel: 'meta-llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'fireworks', name: 'Fireworks AI', category: 'cloud', envKey: 'FIREWORKS_API_KEY', defaultModel: 'accounts/fireworks/models/llama-v3p1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'deepseek', name: 'DeepSeek', category: 'asian_global', envKey: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek-chat', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'mistral', name: 'Mistral AI', category: 'cloud', envKey: 'MISTRAL_API_KEY', defaultModel: 'mistral-large-latest', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'cohere', name: 'Cohere', category: 'cloud', envKey: 'COHERE_API_KEY', defaultModel: 'command-r-plus', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'xai', name: 'xAI', category: 'cloud', envKey: 'XAI_API_KEY', defaultModel: 'grok-2-latest', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'openrouter', name: 'OpenRouter', category: 'aggregator', envKey: 'OPENROUTER_API_KEY', defaultModel: 'auto', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'portkey', name: 'Portkey', category: 'aggregator', envKey: 'PORTKEY_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'liteLLM', name: 'liteLLM', category: 'aggregator', envKey: 'LITELLM_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'cerebras', name: 'Cerebras', category: 'silicon', envKey: 'CEREBRAS_API_KEY', defaultModel: 'llama-3.1-8b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'sambanova', name: 'SambaNova', category: 'silicon', envKey: 'SAMBANOVA_API_KEY', defaultModel: 'meta-llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'kimi', name: 'Kimi', category: 'asian_global', envKey: 'KIMI_API_KEY', defaultModel: 'kimi-k2', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'zhipu', name: 'Zhipu AI', category: 'asian_global', envKey: 'ZHIPU_API_KEY', defaultModel: 'glm-4-plus', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'baichuan', name: 'Baichuan', category: 'asian_global', envKey: 'BAICHUAN_API_KEY', defaultModel: 'baichuan-4', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'minimax', name: 'MiniMax', category: 'asian_global', envKey: 'MINIMAX_API_KEY', defaultModel: 'MiniMax-Text-01', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'qwen', name: 'Qwen', category: 'asian_global', envKey: 'QWEN_API_KEY', defaultModel: 'qwen-max', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'ollama', name: 'Ollama', category: 'local', envKey: 'OLLAMA_API_KEY', defaultModel: 'llama3.2', protocol: 'ollama_native', runtimeSupported: true },
  { id: 'lmstudio', name: 'LM Studio', category: 'local', envKey: 'LMSTUDIO_API_KEY', defaultModel: 'qwen2.5-7b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'jan', name: 'Jan', category: 'local', envKey: 'JAN_API_KEY', defaultModel: 'llama3.2', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'gpt4all', name: 'GPT4All', category: 'local', envKey: 'GPT4ALL_API_KEY', defaultModel: 'gpt4all-j', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'llama.cpp', name: 'llama.cpp', category: 'local', envKey: 'LLAMACPP_API_KEY', defaultModel: 'llama-3.2-1b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'voyage', name: 'Voyage AI', category: 'search_rag', envKey: 'VOYAGE_API_KEY', defaultModel: 'voyage-3', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'jina', name: 'Jina AI', category: 'search_rag', envKey: 'JINA_API_KEY', defaultModel: 'jina-embeddings-v3', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'cohere_embedding', name: 'Cohere Embedding', category: 'search_rag', envKey: 'COHERE_API_KEY', defaultModel: 'embed-english-v3.0', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'google_embedding', name: 'Google Embedding', category: 'search_rag', envKey: 'GOOGLE_API_KEY', defaultModel: 'text-embedding-004', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'mixedbread', name: 'Mixedbread AI', category: 'search_rag', envKey: 'MIXEDBREAD_API_KEY', defaultModel: 'mxbai-embed-large', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'bge', name: 'BGE', category: 'search_rag', envKey: 'BGE_API_KEY', defaultModel: 'bge-m3', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'e5', name: 'E5', category: 'search_rag', envKey: 'E5_API_KEY', defaultModel: 'e5-large', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'instructor', name: 'Instructor', category: 'search_rag', envKey: 'INSTRUCTOR_API_KEY', defaultModel: 'instructor-xl', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'jina_reranker', name: 'Jina Reranker', category: 'search_rag', envKey: 'JINA_API_KEY', defaultModel: 'jina-reranker-v2', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'cohere_rerank', name: 'Cohere Rerank', category: 'search_rag', envKey: 'COHERE_API_KEY', defaultModel: 'rerank-english-v3.0', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'cross_encoder', name: 'Cross Encoder', category: 'search_rag', envKey: 'CROSS_ENCODER_API_KEY', defaultModel: 'cross-encoder-ms-marco', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'ai21', name: 'AI21 Labs', category: 'cloud', envKey: 'AI21_API_KEY', defaultModel: 'jamba-1.5-large', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'aleph_alpha', name: 'Aleph Alpha', category: 'cloud', envKey: 'ALEPH_ALPHA_API_KEY', defaultModel: 'luminous-supreme', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'nvidia', name: 'NVIDIA', category: 'cloud', envKey: 'NVIDIA_API_KEY', defaultModel: 'meta/llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'databricks', name: 'Databricks', category: 'cloud', envKey: 'DATABRICKS_API_KEY', defaultModel: 'databricks-meta-llama-3-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'replicate', name: 'Replicate', category: 'cloud', envKey: 'REPLICATE_API_KEY', defaultModel: 'meta/meta-llama-3-70b-instruct', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'huggingface', name: 'Hugging Face', category: 'cloud', envKey: 'HUGGINGFACE_API_KEY', defaultModel: 'meta-llama/Meta-Llama-3-70B-Instruct', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'scaleway', name: 'Scaleway', category: 'cloud', envKey: 'SCALEWAY_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'ovhcloud', name: 'OVHcloud', category: 'cloud', envKey: 'OVHCLOUD_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'azure', name: 'Azure OpenAI', category: 'cloud', envKey: 'AZURE_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'vertex', name: 'Google Vertex AI', category: 'cloud', envKey: 'GOOGLE_API_KEY', defaultModel: 'gemini-2.5-flash', protocol: 'gemini_native', runtimeSupported: true },
  { id: 'aws', name: 'AWS', category: 'cloud', envKey: 'AWS_API_KEY', defaultModel: 'amazon.titan-text-express-v1', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'ibm', name: 'IBM', category: 'cloud', envKey: 'IBM_API_KEY', defaultModel: 'ibm/granite-3-8b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'oracle', name: 'Oracle', category: 'cloud', envKey: 'ORACLE_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'cloudflare', name: 'Cloudflare', category: 'cloud', envKey: 'CLOUDFLARE_API_KEY', defaultModel: '@cf/meta/llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'vercel', name: 'Vercel', category: 'cloud', envKey: 'VERCEL_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'render', name: 'Render', category: 'cloud', envKey: 'RENDER_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'fly', name: 'Fly.io', category: 'cloud', envKey: 'FLY_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'railway', name: 'Railway', category: 'cloud', envKey: 'RAILWAY_API_KEY', defaultModel: 'llama-3.1-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'palm', name: 'Google PaLM', category: 'cloud', envKey: 'PALM_API_KEY', defaultModel: 'text-bison-002', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'titan', name: 'Amazon Titan', category: 'cloud', envKey: 'TITAN_API_KEY', defaultModel: 'amazon.titan-text-express-v1', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'sagemaker', name: 'AWS SageMaker', category: 'cloud', envKey: 'SAGEMAKER_API_KEY', defaultModel: 'meta-llama-3-8b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'watsonx', name: 'IBM watsonx', category: 'cloud', envKey: 'WATSONX_API_KEY', defaultModel: 'ibm/granite-3-8b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'phi', name: 'Microsoft Phi', category: 'cloud', envKey: 'PHI_API_KEY', defaultModel: 'phi-3-medium', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'gemma', name: 'Google Gemma', category: 'cloud', envKey: 'GEMMA_API_KEY', defaultModel: 'gemma-2-27b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'command', name: 'Cohere Command', category: 'cloud', envKey: 'COMMAND_API_KEY', defaultModel: 'command-r-plus', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'groq', name: 'Groq', category: 'silicon', envKey: 'GROQ_API_KEY', defaultModel: 'llama-3.3-70b', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'aigateway', name: 'AIGateway', category: 'local', envKey: 'AIGATEWAY_API_KEY', defaultModel: 'gpt-4o', protocol: 'openai_compatible', runtimeSupported: true },
  { id: 'embedding3', name: 'OpenAI Embedding 3', category: 'search_rag', envKey: 'OPENAI_API_KEY', defaultModel: 'text-embedding-3-large', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'tts', name: 'OpenAI TTS', category: 'cloud', envKey: 'OPENAI_API_KEY', defaultModel: 'tts-1', protocol: 'openai_compatible', runtimeSupported: false },
  { id: 'whisper', name: 'Whisper', category: 'cloud', envKey: 'OPENAI_API_KEY', defaultModel: 'whisper-1', protocol: 'openai_compatible', runtimeSupported: false },
];

/** Resolve a provider identifier (id or name) to its canonical catalog entry. */
export function findCatalogProvider(identifier: string): ProviderCatalogEntry | null {
  const id = String(identifier ?? '').trim().toLowerCase();
  if (!id) {
    return null;
  }
  return UNIVERSAL_PROVIDER_CATALOG.find(
    (entry) => entry.id.toLowerCase() === id || entry.name.toLowerCase() === id,
  ) ?? null;
}
