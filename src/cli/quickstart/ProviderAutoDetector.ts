export type DetectedProvider = {
  provider: string;
  envKey: string;
  apiKey: string;
  defaultModel: string;
};

const PROVIDER_ENV_MAP: Array<{
  provider: string;
  envKeys: string[];
  defaultModel: string;
}> = [
  { provider: 'openai', envKeys: ['OPENAI_API_KEY'], defaultModel: 'gpt-4.1' },
  { provider: 'anthropic', envKeys: ['ANTHROPIC_API_KEY'], defaultModel: 'claude-sonnet-4-20250514' },
  { provider: 'google', envKeys: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'], defaultModel: 'gemini-2.5-flash' },
  { provider: 'groq', envKeys: ['GROQ_API_KEY'], defaultModel: 'llama-3.3-70b-versatile' },
  { provider: 'deepseek', envKeys: ['DEEPSEEK_API_KEY'], defaultModel: 'deepseek-chat' },
  { provider: 'mistral', envKeys: ['MISTRAL_API_KEY'], defaultModel: 'mistral-large-latest' },
  { provider: 'together', envKeys: ['TOGETHER_API_KEY'], defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  { provider: 'xai', envKeys: ['XAI_API_KEY'], defaultModel: 'grok-3' },
  { provider: 'cerebras', envKeys: ['CEREBRAS_API_KEY'], defaultModel: 'llama-3.3-70b' },
  { provider: 'novita', envKeys: ['NOVITA_API_KEY'], defaultModel: 'meta-llama/llama-3.3-70b-instruct' },
  { provider: 'nvidia', envKeys: ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'], defaultModel: 'meta/llama-3.3-70b-instruct' },
  { provider: 'fireworks', envKeys: ['FIREWORKS_API_KEY'], defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
  { provider: 'cohere', envKeys: ['COHERE_API_KEY', 'CO_API_KEY'], defaultModel: 'command-r-plus' },
  { provider: 'huggingface', envKeys: ['HUGGINGFACE_API_KEY', 'HF_TOKEN'], defaultModel: 'meta-llama/Llama-3.3-70B-Instruct' },
  { provider: 'perplexity', envKeys: ['PERPLEXITY_API_KEY'], defaultModel: 'sonar-pro' },
  { provider: 'sambanova', envKeys: ['SAMBANOVA_API_KEY'], defaultModel: 'Meta-Llama-3.3-70B-Instruct' },
  { provider: 'deepinfra', envKeys: ['DEEPINFRA_API_KEY'], defaultModel: 'meta-llama/Meta-Llama-3.3-70B-Instruct' },
  { provider: 'voyage', envKeys: ['VOYAGE_API_KEY'], defaultModel: 'voyage-3' },
  { provider: 'arcee', envKeys: ['ARCEE_API_KEY'], defaultModel: 'Arcee-V2' },
  { provider: 'stepfun', envKeys: ['STEPFUN_API_KEY'], defaultModel: 'step-2-16k' },
  { provider: 'minimax', envKeys: ['MINIMAX_API_KEY'], defaultModel: 'abab6.5s-chat' },
  { provider: 'xiaomi', envKeys: ['XIAOMI_API_KEY'], defaultModel: 'MiMo-7B-RL' },
  { provider: 'nous', envKeys: ['NOUS_API_KEY'], defaultModel: 'nous-hermes-3-llama-3.1-405b' },
  { provider: 'alibaba', envKeys: ['ALIBABA_API_KEY', 'DASHSCOPE_API_KEY'], defaultModel: 'qwen-max' },
  { provider: 'moonshot', envKeys: ['MOONSHOT_API_KEY'], defaultModel: 'moonshot-v1-auto' },
  { provider: 'zai', envKeys: ['ZAI_API_KEY', 'BIGMODEL_API_KEY'], defaultModel: 'glm-4-plus' },
  { provider: 'kimi-coding', envKeys: ['KIMI_API_KEY'], defaultModel: 'moonshot-v1-128k' },
  { provider: 'kilocode', envKeys: ['KILOCODE_API_KEY'], defaultModel: 'default' },
  { provider: 'gmi', envKeys: ['GMI_API_KEY'], defaultModel: 'default' },
  { provider: 'openrouter', envKeys: ['OPENROUTER_API_KEY'], defaultModel: 'auto' },
];

function readEnvKey(...keys: string[]): string | null {
  for (const key of keys) {
    const normalized = key.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    const value = process.env[normalized] || process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

export function detectAvailableProviders(): DetectedProvider[] {
  const detected: DetectedProvider[] = [];
  for (const entry of PROVIDER_ENV_MAP) {
    const apiKey = readEnvKey(...entry.envKeys);
    if (apiKey) {
      const matchedKey = entry.envKeys.find((k) => {
        const normalized = k.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
        return process.env[normalized] || process.env[k];
      }) || entry.envKeys[0];
      detected.push({
        provider: entry.provider,
        envKey: matchedKey,
        apiKey,
        defaultModel: entry.defaultModel,
      });
    }
  }
  return detected;
}

export function getDefaultModelForProvider(provider: string): string {
  const entry = PROVIDER_ENV_MAP.find((e) => e.provider === provider);
  return entry?.defaultModel || 'default';
}
