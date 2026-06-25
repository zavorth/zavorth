import type { PlaygroundImageResult, PlaygroundOption } from "./playgroundTypes";

export const ENDPOINT_OPTIONS: PlaygroundOption[] = [
  { value: "chat", label: "Chat Completions" },
  { value: "responses", label: "Responses" },
  { value: "images", label: "Image Generation" },
  { value: "embeddings", label: "Embeddings" },
  { value: "speech", label: "Text to Speech" },
  { value: "transcription", label: "Audio Transcription" },
  { value: "video", label: "Video Generation" },
  { value: "music", label: "Music Generation" },
  { value: "rerank", label: "Rerank" },
  { value: "search", label: "Web Search" },
];

export const DEFAULT_BODIES: Record<string, object> = {
  chat: {
    model: "",
    messages: [{ role: "user", content: "Hello! Say hi in one sentence." }],
    max_tokens: 100,
    stream: false,
  },
  responses: {
    model: "",
    input: "Hello! Say hi in one sentence.",
    stream: false,
  },
  images: {
    model: "",
    prompt: "A beautiful sunset over mountains",
    n: 1,
    size: "1024x1024",
  },
  embeddings: {
    model: "",
    input: "Hello world",
    encoding_format: "float",
  },
  speech: {
    model: "openai/tts-1",
    input: "Hello, this is a test of the text-to-speech endpoint.",
    voice: "alloy",
    response_format: "mp3",
  },
  transcription: {
    model: "deepgram/nova-2",
    language: "en",
  },
  video: {
    model: "comfyui/animatediff",
    prompt: "A timelapse of a sunset over the ocean",
    n: 1,
  },
  music: {
    model: "comfyui/stable-audio",
    prompt: "Calm ambient piano music with soft reverb",
    duration: 10,
  },
  rerank: {
    model: "cohere/rerank-english-v3.0",
    query: "What is the capital of France?",
    documents: [
      "Paris is the capital of France.",
      "London is the capital of England.",
      "Berlin is the capital of Germany.",
    ],
    top_n: 2,
  },
  search: {
    query: "latest AI developments",
    max_results: 5,
    search_type: "web",
  },
};

export const ENDPOINT_PATHS: Record<string, string> = {
  chat: "/v1/chat/completions",
  responses: "/v1/responses",
  images: "/v1/images/generations",
  embeddings: "/v1/embeddings",
  speech: "/v1/audio/speech",
  transcription: "/v1/audio/transcriptions",
  video: "/v1/videos/generations",
  music: "/v1/music/generations",
  rerank: "/v1/rerank",
  search: "/v1/search",
};

const VISION_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-4-vision",
  "claude-3",
  "claude-sonnet",
  "claude-opus",
  "claude-haiku",
  "gemini",
  "llava",
  "bakllava",
  "pixtral",
  "qwen-vl",
  "qvq",
  "mistral-pixtral",
];

export function isVisionModel(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return VISION_MODELS.some((keyword) => lower.includes(keyword));
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function buildChatBodyWithImages(parsed: any, imageBase64s: string[]): any {
  if (!imageBase64s.length) return parsed;
  const messages = [...(parsed.messages || [])];
  if (messages.length === 0) return parsed;
  const lastMessage = messages[messages.length - 1];
  const currentContent = typeof lastMessage.content === "string" ? lastMessage.content : "";
  messages[messages.length - 1] = {
    ...lastMessage,
    content: [
      { type: "text", text: currentContent },
      ...imageBase64s.map((b64) => ({
        type: "image_url",
        image_url: { url: b64 },
      })),
    ],
  };
  return { ...parsed, messages };
}

export function extractPlaygroundImages(data: any): PlaygroundImageResult[] {
  return data?.data || [];
}
