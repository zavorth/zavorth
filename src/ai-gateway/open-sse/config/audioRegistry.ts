export interface AudioModelEntry {
  id: string;
  name: string;
  provider: string;
  subtype?: string;
}

export interface ProviderNodeRow {
  prefix: string;
  baseUrl: string;
  apiType?: string;
  id?: string;
  [key: string]: unknown;
}

export interface AudioProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  models: AudioModelEntry[];
  providerId?: string;
}

const TRANSCRIPTION_MODELS: AudioModelEntry[] = [
  { id: "whisper-1", name: "Whisper v1", provider: "openai" },
  { id: "gpt-4o-mini-transcribe", name: "GPT-4o Mini Transcribe", provider: "openai" },
  { id: "whisper-large-v3", name: "Whisper Large v3", provider: "groq" },
];

const SPEECH_MODELS: AudioModelEntry[] = [
  { id: "tts-1", name: "TTS 1", provider: "openai" },
  { id: "tts-1-hd", name: "TTS 1 HD", provider: "openai" },
  { id: "eleven-multilingual-v2", name: "ElevenLabs Multilingual v2", provider: "elevenlabs" },
];

const OPENAI_BASE = "https://api.openai.com/v1";
const GROQ_BASE = "https://api.groq.com/openai/v1";
const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export function getAllAudioModels(): AudioModelEntry[] {
  return [...TRANSCRIPTION_MODELS, ...SPEECH_MODELS];
}

export function buildDynamicAudioProvider(
  node: ProviderNodeRow,
  endpoint: string
): AudioProviderConfig {
  const base = String(node.baseUrl || "").replace(/\/+$/, "");
  return {
    id: node.prefix,
    name: node.prefix,
    baseUrl: `${base}${endpoint}`,
    authType: "apikey",
    authHeader: "bearer",
    models: [],
    providerId: node.id,
  };
}

export function parseTranscriptionModel(
  model: string,
  dynamicProviders: AudioProviderConfig[] = []
): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = TRANSCRIPTION_MODELS.find((item) => item.id === model);
  if (entry) return { provider: entry.provider, model };
  const dynamic = dynamicProviders.find((p) => p.models.some((m) => m.id === model));
  return { provider: dynamic?.id ?? null, model };
}

export function getTranscriptionProvider(providerId: string): AudioProviderConfig | undefined {
  const models = TRANSCRIPTION_MODELS.filter((m) => m.provider === providerId);
  if (models.length === 0) return undefined;
  const baseUrl =
    providerId === "groq" ? GROQ_BASE : providerId === "openai" ? OPENAI_BASE : "";
  return {
    id: providerId,
    name: providerId,
    baseUrl: `${baseUrl}/audio/transcriptions`,
    authType: "apikey",
    authHeader: "bearer",
    models,
  };
}

export function parseSpeechModel(
  model: string,
  dynamicProviders: AudioProviderConfig[] = []
): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = SPEECH_MODELS.find((item) => item.id === model);
  if (entry) return { provider: entry.provider, model };
  const dynamic = dynamicProviders.find((p) => p.models.some((m) => m.id === model));
  return { provider: dynamic?.id ?? null, model };
}

export function getSpeechProvider(providerId: string): AudioProviderConfig | undefined {
  const models = SPEECH_MODELS.filter((m) => m.provider === providerId);
  if (models.length === 0) return undefined;
  const baseUrl =
    providerId === "elevenlabs" ? ELEVENLABS_BASE : providerId === "openai" ? OPENAI_BASE : "";
  return {
    id: providerId,
    name: providerId,
    baseUrl: `${baseUrl}/audio/speech`,
    authType: "apikey",
    authHeader: providerId === "elevenlabs" ? "xi-api-key" : "bearer",
    models,
  };
}
