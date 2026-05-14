export type Modality = "image" | "video" | "music" | "speech" | "transcription";

export type GenerationResult = {
  type: Modality;
  data: any;
  timestamp: number;
  audioUrl?: string;
};

export type ProviderModel = {
  id: string;
  name: string;
};

export type VoicePreset = {
  id: string;
  label: string;
};

export type ProviderModelGroup = {
  id: string;
  name: string;
  models: ProviderModel[];
};

export type ModalityConfig = {
  icon: string;
  endpoint: string;
  label: string;
  placeholder?: string;
  color: string;
  textLabel?: string;
  needsCredentials: string[];
};

export const MAX_TRANSCRIPTION_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4 GB
export const LOCAL_PROVIDERS = ["sdwebui", "comfyui"];

export const MODALITY_CONFIG: Record<Modality, ModalityConfig> = {
  image: {
    icon: "image",
    endpoint: "/api/v1/images/generations",
    label: "Image Generation",
    placeholder: "A serene landscape with mountains at sunset...",
    color: "from-purple-500 to-pink-500",
    needsCredentials: ["openai", "xai", "fireworks", "nebius", "hyperbolic"],
  },
  video: {
    icon: "videocam",
    endpoint: "/api/v1/videos/generations",
    label: "Video Generation",
    placeholder: "A timelapse of a flower blooming...",
    color: "from-blue-500 to-cyan-500",
    needsCredentials: [],
  },
  music: {
    icon: "music_note",
    endpoint: "/api/v1/music/generations",
    label: "Music Generation",
    placeholder: "Upbeat electronic music with synth pads...",
    color: "from-orange-500 to-yellow-500",
    needsCredentials: [],
  },
  speech: {
    icon: "record_voice_over",
    endpoint: "/api/v1/audio/speech",
    label: "Text to Speech",
    placeholder: "Hello! Welcome to ZavorthGateway, your intelligent AI gateway...",
    color: "from-green-500 to-teal-500",
    textLabel: "Text",
    needsCredentials: ["openai", "elevenlabs", "deepgram"],
  },
  transcription: {
    icon: "mic",
    endpoint: "/api/v1/audio/transcriptions",
    label: "Transcription",
    placeholder: "Upload an audio file to transcribe...",
    color: "from-indigo-500 to-blue-500",
    needsCredentials: ["deepgram", "groq", "openai"],
  },
};

// Static provider+model registry (mirrors open-sse/config/*Registry.ts).
export const PROVIDER_MODELS: Record<Modality, ProviderModelGroup[]> = {
  image: [
    {
      id: "openai",
      name: "OpenAI",
      models: [
        { id: "openai/dall-e-3", name: "DALL-E 3" },
        { id: "openai/dall-e-2", name: "DALL-E 2" },
      ],
    },
    {
      id: "xai",
      name: "xAI (Grok)",
      models: [{ id: "xai/grok-2-image-1212", name: "Grok 2 Image" }],
    },
    {
      id: "together",
      name: "Together AI",
      models: [
        { id: "together/stabilityai/stable-diffusion-xl-base-1.0", name: "SDXL" },
        { id: "together/black-forest-labs/FLUX.1-schnell-Free", name: "FLUX.1 Schnell" },
      ],
    },
    {
      id: "fireworks",
      name: "Fireworks AI",
      models: [
        {
          id: "fireworks/accounts/fireworks/models/stable-diffusion-xl-1024-v1-0",
          name: "SDXL 1024",
        },
        { id: "fireworks/accounts/fireworks/models/flux-1-dev-fp8", name: "FLUX.1 Dev" },
      ],
    },
    {
      id: "nebius",
      name: "Nebius AI",
      models: [
        { id: "nebius/black-forest-labs/flux-dev", name: "FLUX Dev" },
        { id: "nebius/black-forest-labs/flux-schnell", name: "FLUX Schnell" },
      ],
    },
    {
      id: "hyperbolic",
      name: "Hyperbolic",
      models: [
        { id: "hyperbolic/SDXL1.0-base", name: "SDXL Base" },
        { id: "hyperbolic/stable-diffusion-2", name: "SD 2" },
      ],
    },
    {
      id: "nanobanana",
      name: "NanoBanana",
      models: [
        { id: "nanobanana/nanobanana-flash", name: "NanoBanana Flash" },
        { id: "nanobanana/nanobanana-pro", name: "NanoBanana Pro" },
      ],
    },
    {
      id: "sdwebui",
      name: "SD WebUI",
      models: [{ id: "sdwebui/sd_xl_base_1.0", name: "SDXL Base (Local)" }],
    },
    {
      id: "comfyui",
      name: "ComfyUI",
      models: [
        { id: "comfyui/flux-dev", name: "FLUX Dev (Local)" },
        { id: "comfyui/sdxl", name: "SDXL (Local)" },
      ],
    },
  ],
  video: [
    {
      id: "comfyui",
      name: "ComfyUI",
      models: [
        { id: "comfyui/animatediff", name: "AnimateDiff" },
        { id: "comfyui/svd", name: "Stable Video Diffusion" },
      ],
    },
    {
      id: "sdwebui",
      name: "SD WebUI",
      models: [{ id: "sdwebui/animatediff", name: "AnimateDiff (Local)" }],
    },
  ],
  music: [
    {
      id: "comfyui",
      name: "ComfyUI",
      models: [
        { id: "comfyui/stable-audio", name: "Stable Audio Open" },
        { id: "comfyui/musicgen", name: "MusicGen" },
      ],
    },
  ],
  speech: [
    {
      id: "openai",
      name: "OpenAI",
      models: [
        { id: "openai/tts-1", name: "TTS-1" },
        { id: "openai/tts-1-hd", name: "TTS-1 HD" },
        { id: "openai/gpt-4o-mini-tts", name: "GPT-4o Mini TTS" },
      ],
    },
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      models: [
        { id: "elevenlabs/eleven_multilingual_v2", name: "Eleven Multilingual v2" },
        { id: "elevenlabs/eleven_turbo_v2_5", name: "Eleven Turbo v2.5" },
      ],
    },
    {
      id: "deepgram",
      name: "Deepgram",
      models: [
        { id: "deepgram/aura-asteria-en", name: "Aura Asteria (EN)" },
        { id: "deepgram/aura-luna-en", name: "Aura Luna (EN)" },
        { id: "deepgram/aura-stella-en", name: "Aura Stella (EN)" },
      ],
    },
    {
      id: "hyperbolic",
      name: "Hyperbolic",
      models: [{ id: "hyperbolic/melo-tts", name: "Melo TTS" }],
    },
    {
      id: "nvidia",
      name: "NVIDIA NIM",
      models: [
        { id: "nvidia/fastpitch", name: "FastPitch" },
        { id: "nvidia/tacotron2", name: "Tacotron2" },
      ],
    },
    {
      id: "inworld",
      name: "Inworld",
      models: [
        { id: "inworld/inworld-tts-1.5-max", name: "Inworld TTS Max" },
        { id: "inworld/inworld-tts-1.5-mini", name: "Inworld TTS Mini" },
      ],
    },
    {
      id: "cartesia",
      name: "Cartesia",
      models: [
        { id: "cartesia/sonic-2", name: "Sonic 2" },
        { id: "cartesia/sonic-3", name: "Sonic 3" },
      ],
    },
    {
      id: "playht",
      name: "PlayHT",
      models: [
        { id: "playht/PlayDialog", name: "PlayDialog" },
        { id: "playht/Play3.0-mini", name: "Play3.0 Mini" },
      ],
    },
    {
      id: "huggingface",
      name: "HuggingFace",
      models: [{ id: "huggingface/espnet/kan-bayashi_ljspeech_vits", name: "VITS LJSpeech" }],
    },
    { id: "qwen", name: "Qwen", models: [{ id: "qwen/qwen3-tts", name: "Qwen3 TTS" }] },
  ],
  transcription: [
    {
      id: "deepgram",
      name: "Deepgram ($200 free)",
      models: [
        { id: "deepgram/nova-3", name: "Nova 3 (Best)" },
        { id: "deepgram/nova-2", name: "Nova 2" },
        { id: "deepgram/enhanced", name: "Enhanced" },
        { id: "deepgram/base", name: "Base" },
      ],
    },
    {
      id: "assemblyai",
      name: "AssemblyAI ($50 free)",
      models: [
        { id: "assemblyai/universal-3-pro", name: "Universal 3 Pro (Best)" },
        { id: "assemblyai/universal-2", name: "Universal 2" },
        { id: "assemblyai/nano", name: "Nano (Fast)" },
      ],
    },
    {
      id: "groq",
      name: "Groq (Free - Whisper)",
      models: [
        { id: "groq/whisper-large-v3", name: "Whisper Large v3 (Free)" },
        { id: "groq/whisper-large-v3-turbo", name: "Whisper Turbo (Free)" },
      ],
    },
    {
      id: "openai",
      name: "OpenAI",
      models: [
        { id: "openai/whisper-1", name: "Whisper 1" },
        { id: "openai/gpt-4o-transcription", name: "GPT-4o Transcription" },
      ],
    },
    {
      id: "nvidia",
      name: "NVIDIA NIM",
      models: [{ id: "nvidia/nvidia/parakeet-ctc-1.1b-asr", name: "Parakeet CTC 1.1B" }],
    },
    {
      id: "huggingface",
      name: "HuggingFace",
      models: [{ id: "huggingface/openai/whisper-large-v3", name: "Whisper Large v3 (HF)" }],
    },
    { id: "qwen", name: "Qwen", models: [{ id: "qwen/qwen3-asr", name: "Qwen3 ASR" }] },
  ],
};

export const VOICE_PRESETS: Record<string, VoicePreset[]> = {
  default: [
    { id: "alloy", label: "Alloy" },
    { id: "echo", label: "Echo" },
    { id: "fable", label: "Fable" },
    { id: "onyx", label: "Onyx" },
    { id: "nova", label: "Nova" },
    { id: "shimmer", label: "Shimmer" },
  ],
  elevenlabs: [
    { id: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (EN)" },
    { id: "AZnzlk1XvdvUeBnXmlld", label: "Domi (EN)" },
    { id: "EXAVITQu4vr4xnSDxMaL", label: "Bella (EN)" },
    { id: "ErXwobaYiN019PkySvjV", label: "Antoni (EN)" },
    { id: "MF3mGyEYCl7XYWbV9V6O", label: "Elli (EN)" },
    { id: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (EN)" },
    { id: "VR6AewLTigWG4xSOukaG", label: "Arnold (EN)" },
    { id: "pNInz6obpgDQGcFmaJgB", label: "Adam (EN)" },
    { id: "yoZ06aMxZJJ28mfd3POQ", label: "Sam (EN)" },
  ],
  cartesia: [
    { id: "a0e99841-438c-4a64-b679-ae501e7d6091", label: "Barbershop Man" },
    { id: "694f9389-aac1-45b6-b726-9d9369183238", label: "Friendly Reading Man" },
    { id: "b7d50908-b17c-442d-ad8d-810c63997ed9", label: "California Girl" },
  ],
  deepgram: [
    { id: "aura-asteria-en", label: "Asteria (EN)" },
    { id: "aura-luna-en", label: "Luna (EN)" },
    { id: "aura-stella-en", label: "Stella (EN)" },
    { id: "aura-zeus-en", label: "Zeus (EN)" },
    { id: "aura-orion-en", label: "Orion (EN)" },
  ],
  inworld: [
    { id: "Eva", label: "Eva (EN)" },
    { id: "Marcus", label: "Marcus (EN)" },
  ],
};

export const SPEECH_FORMATS = ["mp3", "wav", "opus", "flac", "pcm"];

export function getVoiceList(providerId: string) {
  return VOICE_PRESETS[providerId] ?? VOICE_PRESETS.default;
}

export function parseApiError(raw: any, statusCode: number): {
  message: string;
  isCredentials: boolean;
} {
  const msg =
    raw?.error?.message ||
    raw?.err_msg ||
    raw?.error ||
    raw?.message ||
    raw?.detail ||
    (typeof raw === "string" ? raw : null) ||
    `Request failed (${statusCode})`;

  const isCredentials =
    typeof msg === "string" &&
    (msg.toLowerCase().includes("no credentials") ||
      msg.toLowerCase().includes("invalid api key") ||
      msg.toLowerCase().includes("unauthorized") ||
      msg.toLowerCase().includes("authentication") ||
      msg.toLowerCase().includes("api key") ||
      statusCode === 401 ||
      statusCode === 403);

  return { message: String(msg), isCredentials };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
