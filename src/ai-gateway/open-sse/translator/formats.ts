export const FORMATS = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
  GEMINI: "gemini",
  OLLAMA: "ollama",
  AZURE: "azure",
  OPENROUTER: "openrouter",
  MISTRAL: "mistral",
  COHERE: "cohere",
} as const;

export type TranslatorFormat = (typeof FORMATS)[keyof typeof FORMATS];

export const SUPPORTED_FORMATS: TranslatorFormat[] = [
  FORMATS.OPENAI,
  FORMATS.ANTHROPIC,
  FORMATS.GEMINI,
  FORMATS.OLLAMA,
  FORMATS.AZURE,
  FORMATS.OPENROUTER,
  FORMATS.MISTRAL,
  FORMATS.COHERE,
];

export function isSupportedFormat(value: string): value is TranslatorFormat {
  return (SUPPORTED_FORMATS as string[]).includes(value);
}
