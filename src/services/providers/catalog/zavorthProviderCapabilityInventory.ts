import type {
  ModelCapabilityKind,
  ModelModality,
  ProviderRouteKind,
} from './ProviderCatalogContracts.js';
import type {
  ModelCatalogProviderInput,
  AggregatedModelType,
} from './ModelCatalogAggregationService.js';

export const ZAVORTH_PROVIDER_CAPABILITY_CATALOG_VERSION =
  '2026-05-17.provider-capability-catalog.v1' as const;

export type ZavorthProviderCapabilityModality =
  | 'llm-chat'
  | 'image'
  | 'video'
  | 'music'
  | 'tts'
  | 'transcription'
  | 'embedding'
  | 'local-runtime'
  | 'web-search';

export type ZavorthProviderCatalogRow = {
  providerId: string;
  label: string;
  models: string[];
  modalities: ZavorthProviderCapabilityModality[];
  website?: string;
  routeKind?: ProviderRouteKind;
  credentialRefs?: string[];
  local?: boolean;
};

export type ZavorthMediaProviderRow = {
  providerId: string;
  label: string;
  modality: ZavorthProviderCapabilityModality;
  defaultModel: string;
  models: string[];
  credentialRefs: string[];
};

export const ZAVORTH_PROVIDER_CAPABILITY_COUNTS = {
  extensionPackageJsonCount: 122,
  providerLikeExtensionCount: 65,
  providerDirectoryEntries: 52,
  staticCatalogProviderCount: 26,
  staticCatalogModelCount: 260,
  imageProviderCount: 10,
  videoProviderCount: 16,
  musicProviderCount: 3,
  ttsProviderCount: 15,
  transcriptionProviderCount: 6,
} as const;

export const ZAVORTH_PROVIDER_DOCUMENTED_IDS = [
  'alibaba',
  'amazon-bedrock',
  'amazon-bedrock-mantle',
  'anthropic',
  'arcee',
  'azure-speech',
  'byteplus',
  'cerebras',
  'chutes',
  'cloudflare-ai-gateway',
  'comfy',
  'deepseek',
  'ds4',
  'elevenlabs',
  'fal',
  'fireworks',
  'github-copilot',
  'glm',
  'google',
  'gradium',
  'groq',
  'huggingface',
  'inferrs',
  'kilocode',
  'litellm',
  'lmstudio',
  'minimax',
  'mistral',
  'moonshot',
  'nvidia',
  'ollama',
  'openai',
  'opencode',
  'opencode-go',
  'openrouter',
  'perplexity',
  'qianfan',
  'qwen',
  'runway',
  'senseaudio',
  'sglang',
  'stepfun',
  'synthetic',
  'tencent',
  'together',
  'venice',
  'vercel-ai-gateway',
  'vllm',
  'volcengine',
  'vydra',
  'xai',
  'xiaomi',
  'zai',
] as const;

export const ZAVORTH_STATIC_PROVIDER_CATALOGS: ZavorthProviderCatalogRow[] = [
  row('byteplus', 'BytePlus', ['seed-1-8-251228', 'kimi-k2-5-260127', 'glm-4-7-251222'], ['llm-chat']),
  row('byteplus-plan', 'BytePlus Plan', ['ark-code-latest', 'doubao-seed-code', 'glm-4.7', 'kimi-k2-thinking', 'kimi-k2.5'], ['llm-chat']),
  row('cerebras', 'Cerebras', ['zai-glm-4.7', 'gpt-oss-120b', 'qwen-3-235b-a22b-instruct-2507', 'llama3.1-8b'], ['llm-chat']),
  row('chutes', 'Chutes', [
    'Qwen/Qwen3-32B',
    'unsloth/Mistral-Nemo-Instruct-2407',
    'deepseek-ai/DeepSeek-V3-0324-TEE',
    'Qwen/Qwen3-235B-A22B-Instruct-2507-TEE',
    'openai/gpt-oss-120b-TEE',
    'chutesai/Mistral-Small-3.1-24B-Instruct-2503',
    'deepseek-ai/DeepSeek-V3.2-TEE',
    'zai-org/GLM-4.7-TEE',
    'moonshotai/Kimi-K2.5-TEE',
    'unsloth/gemma-3-27b-it',
    'XiaomiMiMo/MiMo-V2-Flash-TEE',
    'chutesai/Mistral-Small-3.2-24B-Instruct-2506',
    'deepseek-ai/DeepSeek-R1-0528-TEE',
    'zai-org/GLM-5-TEE',
    'deepseek-ai/DeepSeek-V3.1-TEE',
    'deepseek-ai/DeepSeek-V3.1-Terminus-TEE',
    'unsloth/gemma-3-4b-it',
    'MiniMaxAI/MiniMax-M2.5-TEE',
    'tngtech/DeepSeek-TNG-R1T2-Chimera',
    'Qwen/Qwen3-Coder-Next-TEE',
    'NousResearch/Hermes-4-405B-FP8-TEE',
    'deepseek-ai/DeepSeek-V3',
    'openai/gpt-oss-20b',
    'unsloth/Llama-3.2-3B-Instruct',
    'unsloth/Mistral-Small-24B-Instruct-2501',
    'zai-org/GLM-4.7-FP8',
    'zai-org/GLM-4.6-TEE',
    'Qwen/Qwen3.5-397B-A17B-TEE',
    'Qwen/Qwen2.5-72B-Instruct',
    'NousResearch/DeepHermes-3-Mistral-24B-Preview',
    'Qwen/Qwen3-Next-80B-A3B-Instruct',
    'zai-org/GLM-4.6-FP8',
    'Qwen/Qwen3-235B-A22B-Thinking-2507',
    'deepseek-ai/DeepSeek-R1-Distill-Llama-70B',
    'tngtech/R1T2-Chimera-Speed',
    'zai-org/GLM-4.6V',
    'Qwen/Qwen2.5-VL-32B-Instruct',
    'Qwen/Qwen3-VL-235B-A22B-Instruct',
    'Qwen/Qwen3-14B',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
    'Qwen/Qwen3-30B-A3B',
    'unsloth/gemma-3-12b-it',
    'unsloth/Llama-3.2-1B-Instruct',
    'nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16-TEE',
    'NousResearch/Hermes-4-14B',
    'Qwen/Qwen3Guard-Gen-0.6B',
    'rednote-hilab/dots.ocr',
  ], ['llm-chat']),
  row('deepinfra', 'DeepInfra', ['deepseek-ai/DeepSeek-V3.2', 'zai-org/GLM-5.1', 'stepfun-ai/Step-3.5-Flash', 'MiniMaxAI/MiniMax-M2.5', 'moonshotai/Kimi-K2.5', 'nvidia/NVIDIA-Nemotron-3-Super-120B-A12B', 'meta-llama/Llama-3.3-70B-Instruct-Turbo'], ['llm-chat']),
  row('deepseek', 'DeepSeek', ['deepseek-v4-flash', 'deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'], ['llm-chat']),
  row('fireworks', 'Fireworks', ['accounts/fireworks/models/kimi-k2p6', 'accounts/fireworks/routers/kimi-k2p5-turbo'], ['llm-chat']),
  row('github-copilot', 'GitHub Copilot', ['claude-haiku-4.5', 'claude-opus-4.5', 'claude-opus-4.6', 'claude-opus-4.7', 'claude-sonnet-4', 'claude-sonnet-4.5', 'claude-sonnet-4.6', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3.1-pro', 'gpt-4.1', 'gpt-5-mini', 'gpt-5.2', 'gpt-5.2-codex', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.5', 'gpt-5.4-mini', 'gpt-5.4-nano', 'grok-code-fast-1', 'raptor-mini', 'goldeneye'], ['llm-chat']),
  row('groq', 'Groq', ['deepseek-r1-distill-llama-70b', 'gemma2-9b-it', 'groq/compound', 'groq/compound-mini', 'llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama3-70b-8192', 'llama3-8b-8192', 'meta-llama/llama-4-maverick-17b-128e-instruct', 'meta-llama/llama-4-scout-17b-16e-instruct', 'mistral-saba-24b', 'moonshotai/kimi-k2-instruct', 'moonshotai/kimi-k2-instruct-0905', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'openai/gpt-oss-safeguard-20b', 'qwen-qwq-32b', 'qwen/qwen3-32b'], ['llm-chat']),
  row('kilocode', 'Kilo Code', ['kilo/auto'], ['llm-chat']),
  row('mistral', 'Mistral', ['codestral-latest', 'devstral-medium-latest', 'magistral-small', 'mistral-large-latest', 'mistral-medium-2508', 'mistral-medium-3-5', 'mistral-small-latest', 'pixtral-large-latest'], ['llm-chat']),
  row('moonshot', 'Moonshot', ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo', 'kimi-k2-turbo'], ['llm-chat']),
  row('nvidia', 'NVIDIA', ['nvidia/nemotron-3-super-120b-a12b', 'moonshotai/kimi-k2.5', 'minimaxai/minimax-m2.5', 'z-ai/glm5'], ['llm-chat']),
  row('openai', 'OpenAI', ['gpt-4', 'gpt-4-turbo', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-2024-05-13', 'gpt-4o-2024-08-06', 'gpt-4o-2024-11-20', 'gpt-4o-mini', 'gpt-5', 'gpt-5-chat-latest', 'gpt-5-codex', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro', 'gpt-5.1', 'gpt-5.1-chat-latest', 'gpt-5.1-codex', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini', 'gpt-5.2', 'gpt-5.2-chat-latest', 'gpt-5.2-codex', 'gpt-5.2-pro', 'gpt-5.3-chat-latest', 'gpt-5.3-codex', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5.4-pro', 'gpt-5.5', 'o1', 'o1-pro', 'o3', 'o3-deep-research', 'o3-mini', 'o3-pro', 'o4-mini', 'o4-mini-deep-research', 'gpt-5.5-pro'], ['llm-chat']),
  row('openai-codex', 'OpenAI Codex', ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-5.5-pro'], ['llm-chat']),
  row('opencode-go', 'OpenCode Go', ['deepseek-v4-pro', 'deepseek-v4-flash'], ['llm-chat']),
  row('qianfan', 'Qianfan', ['deepseek-v3.2', 'ernie-5.0-thinking-preview'], ['llm-chat']),
  row('stepfun', 'StepFun', ['step-3.5-flash'], ['llm-chat']),
  row('stepfun-plan', 'StepFun Plan', ['step-3.5-flash', 'step-3.5-flash-2603'], ['llm-chat']),
  row('tencent-tokenhub', 'Tencent TokenHub', ['hy3-preview'], ['llm-chat']),
  row('together', 'Together AI', ['zai-org/GLM-4.7', 'moonshotai/Kimi-K2.5', 'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-4-Scout-17B-16E-Instruct', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', 'deepseek-ai/DeepSeek-V3.1', 'deepseek-ai/DeepSeek-R1', 'moonshotai/Kimi-K2-Instruct-0905'], ['llm-chat']),
  row('venice', 'Venice', ['llama-3.3-70b', 'llama-3.2-3b', 'hermes-3-llama-3.1-405b', 'qwen3-235b-a22b-thinking-2507', 'qwen3-235b-a22b-instruct-2507', 'qwen3-coder-480b-a35b-instruct', 'qwen3-coder-480b-a35b-instruct-turbo', 'qwen3-5-35b-a3b', 'qwen3-next-80b', 'qwen3-vl-235b-a22b', 'qwen3-4b', 'deepseek-v3.2', 'venice-uncensored', 'mistral-31-24b', 'google-gemma-3-27b-it', 'openai-gpt-oss-120b', 'nvidia-nemotron-3-nano-30b-a3b', 'olafangensan-glm-4.7-flash-heretic', 'zai-org-glm-4.6', 'zai-org-glm-4.7', 'zai-org-glm-4.7-flash', 'zai-org-glm-5', 'kimi-k2-5', 'kimi-k2-thinking', 'minimax-m21', 'minimax-m25', 'claude-opus-4-5', 'claude-opus-4-6', 'claude-sonnet-4-5', 'claude-sonnet-4-6', 'openai-gpt-52', 'openai-gpt-52-codex', 'openai-gpt-53-codex', 'openai-gpt-54', 'openai-gpt-4o-2024-11-20', 'openai-gpt-4o-mini-2024-07-18', 'gemini-3-pro-preview', 'gemini-3-1-pro-preview', 'gemini-3-flash-preview', 'grok-41-fast', 'grok-code-fast-1'], ['llm-chat']),
  row('volcengine', 'Volcengine', ['doubao-seed-code-preview-251028', 'doubao-seed-1-8-251228', 'kimi-k2-5-260127', 'glm-4-7-251222', 'deepseek-v3-2-251201'], ['llm-chat']),
  row('volcengine-plan', 'Volcengine Plan', ['ark-code-latest', 'doubao-seed-code', 'glm-4.7', 'kimi-k2-thinking', 'kimi-k2.5', 'doubao-seed-code-preview-251028'], ['llm-chat']),
  row('xiaomi', 'Xiaomi', ['mimo-v2-flash', 'mimo-v2-pro', 'mimo-v2-omni'], ['llm-chat', 'tts']),
  row('zai', 'Z.AI', ['glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-5v-turbo', 'glm-4.7', 'glm-4.7-flash', 'glm-4.7-flashx', 'glm-4.6', 'glm-4.6v', 'glm-4.5', 'glm-4.5-air', 'glm-4.5-flash', 'glm-4.5v'], ['llm-chat']),
  row('qwen', 'Qwen', ['qwen3.5-plus', 'qwen3.6-plus', 'qwen3-max-2026-01-23', 'qwen3-coder-next', 'qwen3-coder-plus', 'MiniMax-M2.5', 'glm-5', 'glm-4.7', 'kimi-k2.5'], ['llm-chat', 'video']),
  row('kimi-coding', 'Kimi Coding', ['kimi-for-coding', 'kimi-code', 'k2p5'], ['llm-chat']),
  row('xai', 'xAI', ['grok-4.3', 'grok-4.20-beta-latest-reasoning', 'grok-4.20-beta-latest-non-reasoning', 'grok-4', 'grok-4-fast', 'grok-code-fast-1'], ['llm-chat', 'image', 'video', 'tts', 'transcription']),
  row('minimax', 'MiniMax', ['MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-Hailuo-2.3', 'image-01', 'music-2.6', 'speech-2.8-hd'], ['llm-chat', 'image', 'video', 'music', 'tts']),
  row('google', 'Google Gemini Media', ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'veo-3.1-fast-generate-preview', 'lyria-3-clip-preview', 'gemini-tts'], ['image', 'video', 'music', 'tts']),
  row('openrouter', 'OpenRouter Media', ['google/gemini-3.1-flash-image-preview', 'google/veo-3.1-fast', 'hexgrad/kokoro-82m'], ['llm-chat', 'image', 'video', 'tts']),
  row('openai', 'OpenAI Media', ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini', 'sora-2', 'sora-2-pro', 'gpt-4o-mini-tts', 'gpt-4o-transcribe', 'text-embedding-3-small'], ['image', 'video', 'tts', 'transcription', 'embedding']),
];

export const ZAVORTH_MEDIA_PROVIDER_ROWS: ZavorthMediaProviderRow[] = [
  media('comfy', 'ComfyUI', 'image', 'workflow', ['workflow'], ['COMFY_API_KEY', 'COMFY_CLOUD_API_KEY']),
  media('deepinfra', 'DeepInfra Image', 'image', 'black-forest-labs/FLUX-1-schnell', ['black-forest-labs/FLUX-1-schnell'], ['DEEPINFRA_API_KEY']),
  media('fal', 'fal', 'image', 'fal-ai/flux/dev', ['fal-ai/flux/dev'], ['FAL_KEY']),
  media('google', 'Google Image', 'image', 'gemini-3.1-flash-image-preview', ['gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'], ['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
  media('litellm', 'LiteLLM Image', 'image', 'gpt-image-2', ['gpt-image-2'], ['LITELLM_API_KEY']),
  media('minimax', 'MiniMax Image', 'image', 'image-01', ['image-01'], ['MINIMAX_API_KEY']),
  media('openai', 'OpenAI Image', 'image', 'gpt-image-2', ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1', 'gpt-image-1-mini'], ['OPENAI_API_KEY']),
  media('openrouter', 'OpenRouter Image', 'image', 'google/gemini-3.1-flash-image-preview', ['google/gemini-3.1-flash-image-preview'], ['OPENROUTER_API_KEY']),
  media('vydra', 'Vydra Image', 'image', 'grok-imagine', ['grok-imagine'], ['VYDRA_API_KEY']),
  media('xai', 'xAI Image', 'image', 'grok-imagine-image', ['grok-imagine-image'], ['XAI_API_KEY']),
  media('alibaba', 'Alibaba Video', 'video', 'wan2.6-t2v', ['wan2.6-t2v'], ['MODELSTUDIO_API_KEY']),
  media('byteplus', 'BytePlus Video', 'video', 'dreamina-seedance-2-0-260128', ['seedance-1-0-pro-250528', 'seedance-1-5-pro-251215', 'dreamina-seedance-2-0-260128'], ['BYTEPLUS_API_KEY']),
  media('byteplus-seedance-1-0', 'BytePlus Seedance 1.0 Video', 'video', 'seedance-1-0-pro-250528', ['seedance-1-0-pro-250528'], ['BYTEPLUS_API_KEY']),
  media('byteplus-seedance-1-5', 'BytePlus Seedance 1.5 Video', 'video', 'seedance-1-5-pro-251215', ['seedance-1-5-pro-251215'], ['BYTEPLUS_API_KEY']),
  media('byteplus-seedance-2-0', 'BytePlus Seedance 2.0 Video', 'video', 'dreamina-seedance-2-0-260128', ['dreamina-seedance-2-0-260128'], ['BYTEPLUS_API_KEY']),
  media('comfy', 'ComfyUI Video', 'video', 'workflow', ['workflow'], ['COMFY_API_KEY', 'COMFY_CLOUD_API_KEY']),
  media('deepinfra', 'DeepInfra Video', 'video', 'Pixverse/Pixverse-T2V', ['Pixverse/Pixverse-T2V'], ['DEEPINFRA_API_KEY']),
  media('fal', 'fal Video', 'video', 'fal-ai/minimax/video-01-live', ['fal-ai/minimax/video-01-live', 'fal-ai/heygen/v2/video-agent', 'fal-ai/bytedance/seedance/v2/text-to-video', 'fal-ai/bytedance/seedance/v2/image-to-video', 'fal-ai/bytedance/seedance/v2/reference-to-video'], ['FAL_KEY']),
  media('google', 'Google Video', 'video', 'veo-3.1-fast-generate-preview', ['veo-3.1-fast-generate-preview'], ['GEMINI_API_KEY']),
  media('minimax', 'MiniMax Video', 'video', 'MiniMax-Hailuo-2.3', ['MiniMax-Hailuo-2.3'], ['MINIMAX_API_KEY']),
  media('openai', 'OpenAI Video', 'video', 'sora-2', ['sora-2', 'sora-2-pro'], ['OPENAI_API_KEY']),
  media('openrouter', 'OpenRouter Video', 'video', 'google/veo-3.1-fast', ['google/veo-3.1-fast'], ['OPENROUTER_API_KEY']),
  media('qwen', 'Qwen Video', 'video', 'wan2.6-t2v', ['wan2.6-t2v'], ['QWEN_API_KEY']),
  media('runway', 'Runway Video', 'video', 'gen4.5', ['gen4.5', 'gen4_turbo', 'gen4_aleph', 'gen3a_turbo', 'veo3.1', 'veo3.1_fast', 'veo3'], ['RUNWAYML_API_SECRET']),
  media('together', 'Together Video', 'video', 'Wan-AI/Wan2.2-T2V-A14B', ['Wan-AI/Wan2.2-T2V-A14B'], ['TOGETHER_API_KEY']),
  media('vydra', 'Vydra Video', 'video', 'veo3', ['veo3', 'kling'], ['VYDRA_API_KEY']),
  media('xai', 'xAI Video', 'video', 'grok-imagine-video', ['grok-imagine-video'], ['XAI_API_KEY']),
  media('comfy', 'ComfyUI Music', 'music', 'workflow', ['workflow'], ['COMFY_API_KEY', 'COMFY_CLOUD_API_KEY']),
  media('google', 'Google Music', 'music', 'lyria-3-clip-preview', ['lyria-3-clip-preview'], ['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
  media('minimax', 'MiniMax Music', 'music', 'music-2.6', ['music-2.6'], ['MINIMAX_API_KEY']),
  media('azure-speech', 'Azure Speech TTS', 'tts', 'azure-neural-tts', ['azure-neural-tts'], ['AZURE_SPEECH_KEY', 'AZURE_SPEECH_REGION']),
  media('deepinfra', 'DeepInfra TTS', 'tts', 'hexgrad/Kokoro-82M', ['hexgrad/Kokoro-82M'], ['DEEPINFRA_API_KEY']),
  media('elevenlabs', 'ElevenLabs TTS', 'tts', 'eleven_multilingual_v2', ['eleven_multilingual_v2', 'eleven_flash_v2_5'], ['ELEVENLABS_API_KEY', 'XI_API_KEY']),
  media('google', 'Google Gemini TTS', 'tts', 'gemini-tts', ['gemini-tts'], ['GEMINI_API_KEY', 'GOOGLE_API_KEY']),
  media('gradium', 'Gradium TTS', 'tts', 'gradium-tts', ['gradium-tts'], ['GRADIUM_API_KEY']),
  media('inworld', 'Inworld TTS', 'tts', 'inworld-tts', ['inworld-tts'], ['INWORLD_API_KEY']),
  media('tts-local-cli', 'Local CLI TTS', 'tts', 'local-tts-command', ['local-tts-command'], []),
  media('microsoft', 'Microsoft Edge TTS', 'tts', 'edge-neural-tts', ['edge-neural-tts'], []),
  media('minimax', 'MiniMax TTS', 'tts', 'speech-2.8-hd', ['speech-2.8-hd'], ['MINIMAX_API_KEY']),
  media('openai', 'OpenAI TTS', 'tts', 'gpt-4o-mini-tts', ['gpt-4o-mini-tts'], ['OPENAI_API_KEY']),
  media('openrouter', 'OpenRouter TTS', 'tts', 'hexgrad/kokoro-82m', ['hexgrad/kokoro-82m'], ['OPENROUTER_API_KEY']),
  media('volcengine', 'Volcengine TTS', 'tts', 'byteplus-seed-speech', ['byteplus-seed-speech'], ['VOLCENGINE_TTS_API_KEY', 'BYTEPLUS_SEED_SPEECH_API_KEY']),
  media('vydra', 'Vydra Speech', 'tts', 'vydra-tts', ['vydra-tts'], ['VYDRA_API_KEY']),
  media('xai', 'xAI TTS', 'tts', 'xai-tts', ['xai-tts'], ['XAI_API_KEY']),
  media('xiaomi', 'Xiaomi MiMo TTS', 'tts', 'mimo-tts', ['mimo-tts'], ['XIAOMI_API_KEY']),
  media('deepgram', 'Deepgram Transcription', 'transcription', 'nova-3', ['nova-3', 'nova-2'], ['DEEPGRAM_API_KEY']),
  media('elevenlabs', 'ElevenLabs Transcription', 'transcription', 'scribe_v1', ['scribe_v1'], ['ELEVENLABS_API_KEY', 'XI_API_KEY']),
  media('mistral', 'Mistral Transcription', 'transcription', 'voxtral-mini-latest', ['voxtral-mini-latest'], ['MISTRAL_API_KEY']),
  media('openai', 'OpenAI Transcription', 'transcription', 'gpt-4o-transcribe', ['gpt-4o-transcribe', 'whisper-1'], ['OPENAI_API_KEY']),
  media('senseaudio', 'SenseAudio Transcription', 'transcription', 'sensevoice-small', ['sensevoice-small'], ['SENSEAUDIO_API_KEY']),
  media('xai', 'xAI Transcription', 'transcription', 'xai-transcribe', ['xai-transcribe'], ['XAI_API_KEY']),
];

export const ZAVORTH_PROVIDER_MODEL_CATALOGS: ModelCatalogProviderInput[] =
  normalizeProviderCatalogs([
    ...ZAVORTH_STATIC_PROVIDER_CATALOGS.map((provider) => toModelCatalog(provider)),
    ...ZAVORTH_MEDIA_PROVIDER_ROWS.map((provider) => toMediaModelCatalog(provider)),
  ]);

export function modalityToModelModality(modality: ZavorthProviderCapabilityModality): ModelModality {
  switch (modality) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'music':
    case 'tts':
    case 'transcription':
      return 'audio';
    case 'embedding':
      return 'embedding';
    default:
      return 'text';
  }
}

export function modalityToCapabilities(
  modalities: ZavorthProviderCapabilityModality[],
): ModelCapabilityKind[] {
  const result: ModelCapabilityKind[] = ['streaming'];
  if (modalities.includes('llm-chat')) {
    result.push('chat', 'coding', 'reasoning', 'tool_use');
  }
  if (modalities.includes('image')) {
    result.push('vision', 'multimodal');
  }
  if (modalities.includes('video') || modalities.includes('music')) {
    result.push('multimodal');
  }
  if (modalities.includes('tts') || modalities.includes('transcription')) {
    result.push('audio');
  }
  if (modalities.includes('embedding')) {
    result.push('embedding');
  }
  if (modalities.includes('local-runtime')) {
    result.push('local');
  }
  return unique(result);
}

export function modalityToModelType(modality: ZavorthProviderCapabilityModality): AggregatedModelType {
  switch (modality) {
    case 'image':
      return 'image';
    case 'video':
      return 'video';
    case 'music':
      return 'music';
    case 'tts':
    case 'transcription':
      return 'audio';
    case 'embedding':
      return 'embedding';
    default:
      return 'chat';
  }
}

function row(
  providerId: string,
  label: string,
  models: string[],
  modalities: ZavorthProviderCapabilityModality[],
  options: Partial<Pick<ZavorthProviderCatalogRow, 'website' | 'routeKind' | 'credentialRefs' | 'local'>> = {},
): ZavorthProviderCatalogRow {
  return {
    providerId,
    label,
    models,
    modalities,
    ...options,
  };
}

function media(
  providerId: string,
  label: string,
  modality: ZavorthProviderCapabilityModality,
  defaultModel: string,
  models: string[],
  credentialRefs: string[],
): ZavorthMediaProviderRow {
  return {
    providerId,
    label,
    modality,
    defaultModel,
    models: unique([defaultModel, ...models]),
    credentialRefs,
  };
}

function toModelCatalog(row: ZavorthProviderCatalogRow): ModelCatalogProviderInput {
  const primaryModality = row.modalities[0] || 'llm-chat';
  return {
    providerId: row.providerId,
    label: row.label,
    source: 'provider_catalog',
    models: unique(row.models).map((id) => ({
      id,
      name: id,
      source: 'provider_catalog',
      type: modalityToModelType(primaryModality),
      modalities: unique(row.modalities.map(modalityToModelModality)),
      capabilities: toCapabilityRecord(modalityToCapabilities(row.modalities)),
      raw: {
        zavorthProviderCatalog: true,
        modalities: row.modalities,
      },
    })),
  };
}

function toMediaModelCatalog(row: ZavorthMediaProviderRow): ModelCatalogProviderInput {
  return {
    providerId: row.providerId,
    label: row.label,
    source: 'provider_catalog',
    models: unique(row.models).map((id) => ({
      id,
      name: id,
      source: 'provider_catalog',
      type: modalityToModelType(row.modality),
      modalities: [modalityToModelModality(row.modality)],
      capabilities: toCapabilityRecord(modalityToCapabilities([row.modality])),
      raw: {
        zavorthProviderCatalog: true,
        modality: row.modality,
      },
    })),
  };
}

function normalizeProviderCatalogs(catalogs: ModelCatalogProviderInput[]): ModelCatalogProviderInput[] {
  const byProvider = new Map<string, ModelCatalogProviderInput>();
  for (const catalog of catalogs) {
    const providerId = catalog.providerId.toLowerCase();
    const existing = byProvider.get(providerId);
    if (!existing) {
      byProvider.set(providerId, {
        ...catalog,
        models: [...catalog.models],
      });
      continue;
    }
    const existingModels = new Set(existing.models.map((model) => model.id));
    for (const model of catalog.models) {
      if (!existingModels.has(model.id)) {
        existing.models.push(model);
        existingModels.add(model.id);
      }
    }
  }
  return Array.from(byProvider.values()).sort((left, right) => left.providerId.localeCompare(right.providerId));
}

function toCapabilityRecord(capabilities: ModelCapabilityKind[]): Partial<Record<ModelCapabilityKind, boolean>> {
  return capabilities.reduce<Partial<Record<ModelCapabilityKind, boolean>>>((acc, capability) => {
    acc[capability] = true;
    return acc;
  }, {});
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values.filter(Boolean)));
}
