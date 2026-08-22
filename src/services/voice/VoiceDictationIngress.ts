/**
 * Dictation-first ingress (Claude Code model).
 * Successful STT becomes the same text the agent would receive if the user typed.
 * No parallel "voice brain"; no invented media placeholders.
 */

import {
  type VoiceInteractionMode,
  type VoicePreference,
  VOICE_STT_CONFIGURE_HINT,
} from '../../contracts/voice/VoicePreferenceContract.js';
import { getVoicePreferenceService, type VoicePreferenceService } from './VoicePreferenceService.js';

export const VOICE_DICTATION_INGRESS_VERSION = 'voice-dictation-ingress/v1' as const;

export type VoiceDictationIngressInput = {
  transcript: string;
  provider?: string | null;
  model?: string | null;
  languageCode?: string | null;
  /** 0–1 when available; null = unknown */
  confidence?: number | null;
  /** Prefer explicit preference; else load from service */
  preference?: VoicePreference | null;
  surface?: string | null;
  /**
   * When true, show transcript even if mode would not (ops / config echo).
   */
  forceShowTranscript?: boolean;
  /**
   * Threshold below which we still dispatch but always show transcript.
   * Default 0.55 when confidence is known.
   */
  lowConfidenceThreshold?: number;
};

export type VoiceDictationIngressOk = {
  ok: true;
  version: typeof VOICE_DICTATION_INGRESS_VERSION;
  /** Clean text for processTextMessage / agent gateway — same as typing. */
  agentText: string;
  mode: VoiceInteractionMode;
  showTranscript: boolean;
  transcriptPreview: string;
  lowConfidence: boolean;
  ttsReplyDesired: boolean;
  reason: string;
  metadata: {
    source: 'voice_dictation';
    sttProvider: string | null;
    sttModel: string | null;
    languageCode: string | null;
    confidence: number | null;
    surface: string | null;
  };
};

export type VoiceDictationIngressFail = {
  ok: false;
  version: typeof VOICE_DICTATION_INGRESS_VERSION;
  code: 'mode_off' | 'stt_not_configured' | 'empty_transcript' | 'invalid';
  message: string;
  showTranscript: boolean;
  transcriptPreview: string;
  configureHint?: string;
};

export type VoiceDictationIngressResult = VoiceDictationIngressOk | VoiceDictationIngressFail;

const MEDIA_PLACEHOLDER_RE = /^\[(?:audio enviado|automatically transcribed audio|audio|voice)[^\]]*\]\s*/i;

/**
 * Strip legacy media wrappers so the agent sees user intent only.
 */
export function normalizeDictationTranscript(raw: string): string {
  let text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .trim();
  text = text.replace(MEDIA_PLACEHOLDER_RE, '').trim();
  // Collapse excessive whitespace but keep newlines for multi-line dictation
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3}/g, '\n\n')
    .trim();
  return text;
}

export function formatDictationTranscriptNotice(input: {
  transcript: string;
  languageCode?: string | null;
  provider?: string | null;
  lowConfidence?: boolean;
}): string {
  const lang = String(input.languageCode || 'auto').trim() || 'auto';
  const provider = String(input.provider || '').trim();
  const conf = input.lowConfidence ? ' · low confidence — edit by typing if wrong' : '';
  const meta = provider ? `${lang}, ${provider}${conf}` : `${lang}${conf}`;
  return `📝 ${meta}\n${input.transcript}`;
}

export class VoiceDictationIngress {
  private readonly preferences: VoicePreferenceService;

  constructor(options: { voicePreferences?: VoicePreferenceService } = {}) {
    this.preferences = options.voicePreferences || getVoicePreferenceService();
  }

  /**
   * Decide how a successful STT transcript enters the agent.
   */
  public prepare(input: VoiceDictationIngressInput): VoiceDictationIngressResult {
    const agentText = normalizeDictationTranscript(input.transcript);
    

    if (!agentText) {
      return {
        ok: false,
        version: VOICE_DICTATION_INGRESS_VERSION,
        code: 'empty_transcript',
        message: 'Empty transcript after normalization. Type your message instead.',
        showTranscript: false,
        transcriptPreview: '',
      };
    }

    const preference = input.preference || this.preferences.get();
    const sttResolved = this.preferences.resolveStt();

    // Prefer preference mode; if STT is configured via env only, treat as dictation.
    let mode: VoiceInteractionMode = preference.mode || 'off';
    if (
      mode === 'off' &&
      (Boolean(String(input.provider || '').trim()) || (sttResolved.ok && sttResolved.source !== 'legacy_cascade'))
    ) {
      mode = 'dictation';
    }

    if (mode === 'off') {
      if (sttResolved.ok === false) {
        return {
          ok: false,
          version: VOICE_DICTATION_INGRESS_VERSION,
          code: 'stt_not_configured',
          message: sttResolved.message,
          showTranscript: false,
          transcriptPreview: agentText,
          configureHint: sttResolved.configureHint || VOICE_STT_CONFIGURE_HINT,
        };
      }
      return {
        ok: false,
        version: VOICE_DICTATION_INGRESS_VERSION,
        code: 'mode_off',
        message:
          'Voice mode is off. Enable dictation: `npx tsx scripts/zavorth-voice-pref.ts set --mode dictation` (and configure STT).',
        showTranscript: false,
        transcriptPreview: agentText,
        configureHint: VOICE_STT_CONFIGURE_HINT,
      };
    }

    const threshold =
      typeof input.lowConfidenceThreshold === 'number' && Number.isFinite(input.lowConfidenceThreshold)
        ? input.lowConfidenceThreshold
        : 0.55;
    const confidence =
      typeof input.confidence === 'number' && Number.isFinite(input.confidence) ? input.confidence : null;
    const lowConfidence = confidence != null ? confidence < threshold : false;

    // Always show transcript in dictation/conversation (transparency), or when forced / low conf.
    const showTranscript =
      Boolean(input.forceShowTranscript) || mode === 'dictation' || mode === 'conversation' || lowConfidence;

    const ttsReplyDesired =
      mode === 'conversation' && Boolean(preference.tts?.enabled) && preference.tts.provider !== 'none';

    return {
      ok: true,
      version: VOICE_DICTATION_INGRESS_VERSION,
      agentText,
      mode,
      showTranscript,
      transcriptPreview: agentText,
      lowConfidence,
      ttsReplyDesired,
      reason: mode === 'conversation' ? 'conversation_dictation_to_agent' : 'dictation_to_agent',
      metadata: {
        source: 'voice_dictation',
        sttProvider: input.provider ? String(input.provider) : null,
        sttModel: input.model ? String(input.model) : null,
        languageCode: input.languageCode ? String(input.languageCode) : null,
        confidence,
        surface: input.surface ? String(input.surface) : null,
      },
    };
  }
}

let defaultIngress: VoiceDictationIngress | null = null;

export function getVoiceDictationIngress(options?: {
  voicePreferences?: VoicePreferenceService;
}): VoiceDictationIngress {
  if (options?.voicePreferences) {
    return new VoiceDictationIngress(options);
  }
  if (!defaultIngress) {
    defaultIngress = new VoiceDictationIngress();
  }
  return defaultIngress;
}

export function resetVoiceDictationIngressForTests(): void {
  defaultIngress = null;
}
