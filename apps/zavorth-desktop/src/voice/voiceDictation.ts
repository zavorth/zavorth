type SpeechRecognitionGlobal = {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
};

export function resolveDictationLanguage(language: string | null | undefined): string {
  const value = String(language || '').trim();
  if (!value) return 'en-US';
  if (value.toLowerCase().startsWith('pt')) return 'pt-BR';
  return value;
}

export function mergeDictationTranscript(current: string, transcript: string): string {
  const base = String(current || '').trim();
  const next = String(transcript || '').trim();
  if (!next) return base;
  return base ? `${base} ${next}` : next;
}

export function speechRecognitionAvailability(globalLike: SpeechRecognitionGlobal | undefined | null): {
  available: boolean;
  reason?: string;
} {
  const ctor = globalLike?.SpeechRecognition || globalLike?.webkitSpeechRecognition;
  if (typeof ctor !== 'function') {
    return { available: false, reason: 'speech-recognition-unavailable' };
  }
  return { available: true };
}

// Browser SpeechRecognition constructors are not in the standard TS lib everywhere.
export type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript?: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort?(): void;
};

export function speechRecognitionConstructor(
  globalLike: SpeechRecognitionGlobal | undefined | null,
): SpeechRecognitionConstructor | null {
  const ctor = globalLike?.SpeechRecognition || globalLike?.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionConstructor) : null;
}
