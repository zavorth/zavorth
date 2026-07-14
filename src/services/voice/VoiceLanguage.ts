/**
 * STT/TTS language normalization (production hardening).
 * Maps loose tags (pt, pt-BR, portuguese) → BCP-47 primary + Whisper-friendly ISO 639-1.
 */

export type NormalizedVoiceLanguage = {
  /** Original input after trim */
  raw: string;
  /** auto | ISO 639-1 (en, pt, es, …) for Whisper/OpenAI-compatible STT */
  whisper: string;
  /** BCP-47-ish tag for browser / Edge TTS (pt-BR, en-US, …) */
  bcp47: string;
  /** Deepgram-friendly language code when not auto */
  deepgram: string | null;
  isAuto: boolean;
};

const ALIASES: Record<string, { whisper: string; bcp47: string }> = {
  auto: { whisper: 'auto', bcp47: 'auto' },
  en: { whisper: 'en', bcp47: 'en-US' },
  eng: { whisper: 'en', bcp47: 'en-US' },
  english: { whisper: 'en', bcp47: 'en-US' },
  'en-us': { whisper: 'en', bcp47: 'en-US' },
  'en-gb': { whisper: 'en', bcp47: 'en-GB' },
  pt: { whisper: 'pt', bcp47: 'pt-BR' },
  por: { whisper: 'pt', bcp47: 'pt-BR' },
  portuguese: { whisper: 'pt', bcp47: 'pt-BR' },
  'pt-br': { whisper: 'pt', bcp47: 'pt-BR' },
  'pt-pt': { whisper: 'pt', bcp47: 'pt-PT' },
  es: { whisper: 'es', bcp47: 'es-ES' },
  spa: { whisper: 'es', bcp47: 'es-ES' },
  spanish: { whisper: 'es', bcp47: 'es-ES' },
  'es-es': { whisper: 'es', bcp47: 'es-ES' },
  'es-mx': { whisper: 'es', bcp47: 'es-MX' },
  fr: { whisper: 'fr', bcp47: 'fr-FR' },
  french: { whisper: 'fr', bcp47: 'fr-FR' },
  de: { whisper: 'de', bcp47: 'de-DE' },
  german: { whisper: 'de', bcp47: 'de-DE' },
  it: { whisper: 'it', bcp47: 'it-IT' },
  ja: { whisper: 'ja', bcp47: 'ja-JP' },
  japanese: { whisper: 'ja', bcp47: 'ja-JP' },
  ko: { whisper: 'ko', bcp47: 'ko-KR' },
  zh: { whisper: 'zh', bcp47: 'zh-CN' },
  chinese: { whisper: 'zh', bcp47: 'zh-CN' },
  'zh-cn': { whisper: 'zh', bcp47: 'zh-CN' },
  'zh-tw': { whisper: 'zh', bcp47: 'zh-TW' },
};

/**
 * Normalize free-form language preference for STT providers.
 */
export function normalizeVoiceLanguage(value: unknown): NormalizedVoiceLanguage {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'auto') {
    return {
      raw: raw || 'auto',
      whisper: 'auto',
      bcp47: 'auto',
      deepgram: null,
      isAuto: true,
    };
  }

  const key = raw.toLowerCase().replace(/_/g, '-');
  const aliased = ALIASES[key];
  if (aliased) {
    return {
      raw,
      whisper: aliased.whisper,
      bcp47: aliased.bcp47,
      deepgram: aliased.whisper === 'auto' ? null : aliased.whisper,
      isAuto: aliased.whisper === 'auto',
    };
  }

  // BCP-47: take primary subtag for Whisper
  const primary = key.split('-')[0] || key;
  const primaryAlias = ALIASES[primary];
  if (primaryAlias) {
    return {
      raw,
      whisper: primaryAlias.whisper,
      bcp47: key.length > 2 ? raw : primaryAlias.bcp47,
      deepgram: primaryAlias.whisper === 'auto' ? null : primaryAlias.whisper,
      isAuto: false,
    };
  }

  // Unknown tag — pass primary 2-letter if possible
  const whisper = primary.length === 2 || primary.length === 3 ? primary : 'auto';
  return {
    raw,
    whisper,
    bcp47: raw,
    deepgram: whisper === 'auto' ? null : whisper,
    isAuto: whisper === 'auto',
  };
}

/** Value to send to OpenAI-compatible Whisper `language` field (omit when auto). */
export function whisperLanguageParam(value: unknown): string | null {
  const n = normalizeVoiceLanguage(value);
  return n.isAuto ? null : n.whisper;
}
