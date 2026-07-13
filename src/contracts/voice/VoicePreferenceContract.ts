/**
 * Voice preference contract — user sovereignty over STT/TTS.
 * No product-level "good enough" model defaults: unconfigured means refuse, not cascade.
 */

export const ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION = 'voice-preference/v1' as const;

export type VoiceSttProviderId =
  | 'none'
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'deepgram'
  | 'whisper.cpp';

export type VoiceTtsProviderId = 'none' | 'edge-tts' | 'gemini';

export type VoiceInteractionMode = 'off' | 'dictation' | 'conversation';

export type VoiceSttPreference = {
  /** 'none' = STT not chosen (refuse until user configures). */
  provider: VoiceSttProviderId;
  /**
   * Model id for the chosen provider.
   * null = use that provider's own default ONLY after the user selected the provider.
   * Never invent a Zavorth-wide default model when provider is none.
   */
  model: string | null;
  /** ISO-ish language or 'auto'. */
  language: string;
};

export type VoiceTtsPreference = {
  /** Default false — agent does not speak unless user enables. */
  enabled: boolean;
  provider: VoiceTtsProviderId;
  /** Edge/Gemini voice id chosen by user; null until set. */
  voiceId: string | null;
};

export type VoicePreference = {
  version: typeof ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION;
  updatedAt: string;
  /** Optional operator / user scope. */
  userId: string | null;
  workspaceId: string | null;
  stt: VoiceSttPreference;
  tts: VoiceTtsPreference;
  /**
   * off — voice features disabled
   * dictation — STT fills agent input (same tools path)
   * conversation — dictation + optional TTS replies when tts.enabled
   */
  mode: VoiceInteractionMode;
};

export type VoiceSttResolveResult =
  | {
      ok: true;
      /** Single provider or explicit multi-provider list from env/user. */
      providers: Exclude<VoiceSttProviderId, 'none'>[];
      model: string | null;
      language: string;
      source: 'preference' | 'env_explicit' | 'legacy_cascade';
    }
  | {
      ok: false;
      code: 'stt_not_configured' | 'stt_disabled' | 'invalid_provider';
      message: string;
      configureHint: string;
    };

export const VOICE_STT_PROVIDER_IDS: readonly VoiceSttProviderId[] = [
  'none',
  'gemini',
  'openai',
  'groq',
  'deepgram',
  'whisper.cpp',
] as const;

export const VOICE_TTS_PROVIDER_IDS: readonly VoiceTtsProviderId[] = [
  'none',
  'edge-tts',
  'gemini',
] as const;

export function createUnconfiguredVoicePreference(
  now: () => Date = () => new Date(),
): VoicePreference {
  return {
    version: ZAVORTH_VOICE_PREFERENCE_CONTRACT_VERSION,
    updatedAt: now().toISOString(),
    userId: null,
    workspaceId: null,
    stt: {
      provider: 'none',
      model: null,
      language: 'auto',
    },
    tts: {
      enabled: false,
      provider: 'none',
      voiceId: null,
    },
    mode: 'off',
  };
}

export function isVoiceSttConfigured(preference: VoicePreference | null | undefined): boolean {
  if (!preference) return false;
  const provider = String(preference.stt?.provider || 'none').toLowerCase();
  return provider !== 'none' && provider !== '';
}

export function isVoiceTtsEnabled(preference: VoicePreference | null | undefined): boolean {
  if (!preference) return false;
  return Boolean(preference.tts?.enabled) && preference.tts.provider !== 'none';
}

export function normalizeVoiceSttProvider(value: unknown): VoiceSttProviderId | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === 'whisper' || raw === 'local') return 'whisper.cpp';
  if ((VOICE_STT_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as VoiceSttProviderId;
  }
  return null;
}

export function normalizeVoiceTtsProvider(value: unknown): VoiceTtsProviderId | null {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === 'edge') return 'edge-tts';
  if ((VOICE_TTS_PROVIDER_IDS as readonly string[]).includes(raw)) {
    return raw as VoiceTtsProviderId;
  }
  return null;
}

export const VOICE_STT_CONFIGURE_HINT =
  'Configure STT explicitly, e.g. `npx tsx scripts/zavorth-voice-pref.ts set --stt-provider openai --stt-model whisper-1` or set env ZAVORTH_AUDIO_STT_PROVIDERS (comma list). No automatic cascade of product defaults.';
