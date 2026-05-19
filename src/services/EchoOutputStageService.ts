import { config } from '../config/index.js';
import type { AudioSynthesisOptions } from '../telegram/AudioHandler.js';
import { logEchoTrace } from '../telegram/EchoTrace.js';

export type EchoOutputStageAudioHandler = {
  synthesize: (text: string, voiceIdOrOptions?: string | AudioSynthesisOptions) => Promise<string | null>;
  cleanup: (filePath: string) => void;
};

export type EchoOutputStagePreferenceStore = {
  isEchoModeActive: () => Promise<boolean>;
};

export type EchoOutputStageSink = {
  sendText: (text: string, options?: Record<string, unknown>) => Promise<unknown>;
  sendVoice?: (audioPath: string) => Promise<unknown>;
  sendChatAction?: (action: 'record_voice' | 'typing') => Promise<unknown>;
};

export type EchoOutputStageRequest = {
  surface: string;
  text: string;
  rawInput?: string;
  options?: Record<string, unknown>;
  sink: EchoOutputStageSink;
  traceId?: string | null;
  taskId?: string | null;
  requestedBy?: string | null;
  sessionId?: string | null;
  voiceFlow?: Record<string, unknown> | null;
  allowVoice?: boolean;
  fallbackToText?: boolean;
  preferredLanguageCode?: string | null;
  policyHint?: AudioSynthesisOptions['policyHint'];
  forceVoice?: boolean;
};

export type EchoOutputStageResult = {
  delivered: 'voice' | 'text';
  spokenChars?: number;
  ttsLatencyMs?: number;
};

type EchoOutputStageDeps = {
  audioHandler?: EchoOutputStageAudioHandler | null;
  preferenceStore?: EchoOutputStagePreferenceStore | null;
};

/**
 * Cross-surface output post-processor for Echo voice mode.
 *
 * Surfaces provide delivery primitives (text, optional voice, optional action)
 * and this phase decides whether a reply should become voice or remain text.
 */
export class EchoOutputStageService {
  constructor(private readonly deps: EchoOutputStageDeps = {}) {}

  public async deliver(request: EchoOutputStageRequest): Promise<EchoOutputStageResult> {
    const text = String(request.text || '').trim();
    if (!text) {
      return { delivered: 'text' };
    }

    if (await this.tryDeliverVoice(request, text)) {
      return { delivered: 'voice', spokenChars: this.prepareSpokenText(text).length };
    }

    if (request.fallbackToText === false) {
      return { delivered: 'text' };
    }

    await request.sink.sendText(text, request.options);
    return { delivered: 'text' };
  }

  private async tryDeliverVoice(request: EchoOutputStageRequest, text: string): Promise<boolean> {
    const audioHandler = this.deps.audioHandler || null;
    const preferenceStore = this.deps.preferenceStore || null;
    const hasInteractiveControls = Boolean((request.options as any)?.reply_markup);
    const voiceAvailable = Boolean(request.sink.sendVoice);
    const explicitVoiceRequest =
      request.forceVoice === true ||
      this.isExplicitVoiceReplyRequest(request.rawInput || '', text);
    if (
      request.allowVoice === false
      || !voiceAvailable
      || !audioHandler
      || (!preferenceStore && !explicitVoiceRequest)
      || hasInteractiveControls
      || text.length >= 4000
    ) {
      return false;
    }

    try {
      if (!explicitVoiceRequest && !(await preferenceStore!.isEchoModeActive())) {
        return false;
      }

      const preferredLanguageCode =
        String(request.preferredLanguageCode || '').trim() ||
        this.resolvePreferredLanguageCode(request.rawInput || '', text);
      const policyHint = request.policyHint || this.resolvePolicyHint(text, preferredLanguageCode);
      const spokenText = this.prepareSpokenText(text, policyHint);
      if (!spokenText) {
        return false;
      }
      const traceId = String(request.traceId || '').trim();
      const voiceFlow = request.voiceFlow || {};
      const ttsStartedAt = Date.now();

      if (traceId) {
        logEchoTrace(traceId, 'tts.started', {
          taskId: request.taskId || null,
          chars: spokenText.length,
          preferredLanguageCode,
          policyHint,
          surface: request.surface,
          llmMs: voiceFlow.llmLatencyMs || null,
          sttMs: voiceFlow.sttLatencyMs || null,
        });
      }

      await request.sink.sendChatAction?.('record_voice').catch(() => undefined);
      const audioPath = await audioHandler.synthesize(spokenText, {
        preferredLanguageCode,
        policyHint,
        traceId,
        surface: request.surface,
        requestedBy: request.requestedBy || `${request.surface}-output-phase`,
        sessionId: request.sessionId || '',
      });
      if (!audioPath) {
        return false;
      }

      const ttsLatencyMs = Date.now() - ttsStartedAt;
      try {
        const sendStartedAt = Date.now();
        await request.sink.sendVoice!(audioPath);
        if (traceId) {
          logEchoTrace(traceId, 'voice.send.completed', {
            taskId: request.taskId || null,
            surface: request.surface,
            ttsMs: ttsLatencyMs,
            sendMs: Date.now() - sendStartedAt,
            totalMs:
              typeof voiceFlow.startedAtMs === 'number'
                ? Date.now() - Number(voiceFlow.startedAtMs)
                : null,
            downloadMs: voiceFlow.downloadLatencyMs || null,
            sttMs: voiceFlow.sttLatencyMs || null,
            llmMs: voiceFlow.llmLatencyMs || null,
          });
        }
        console.log(
          `[EchoOutputStage] voice sent surface=${request.surface} chars=${spokenText.length} ttsMs=${ttsLatencyMs} sendMs=${Date.now() - sendStartedAt}`,
        );
      } finally {
        audioHandler.cleanup(audioPath);
      }

      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error || 'erro desconhecido');
      if (request.traceId) {
        logEchoTrace(request.traceId, 'voice.send.failed', {
          taskId: request.taskId || null,
          surface: request.surface,
          error: message,
        });
      }
      console.warn(`[EchoOutputStage] voice failed, falling back to text: ${message}`);
      return false;
    }
  }

  private prepareSpokenText(
    text: string,
    policyHint: AudioSynthesisOptions['policyHint'] = 'default',
  ): string {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    const configuredMaxChars = Math.max(120, config.tools.media.audio.ttsMaxChars);
    const maxChars =
      policyHint === 'safety'
        ? Math.min(configuredMaxChars, 180)
        : policyHint === 'short_reply'
          ? Math.min(configuredMaxChars, 320)
          : configuredMaxChars;
    if (normalized.length <= maxChars) {
      return normalized;
    }

    const sentences = normalized
      .split(/(?<=[.!?])\s+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    let output = '';
    for (const sentence of sentences) {
      if (output && output.length + sentence.length + 1 > maxChars) {
        break;
      }
      output = output ? `${output} ${sentence}` : sentence;
    }

    return (output || normalized.slice(0, maxChars)).trim();
  }

  private resolvePolicyHint(
    spokenText: string,
    preferredLanguageCode: string,
  ): AudioSynthesisOptions['policyHint'] {
    const normalized = String(spokenText || '').trim();
    const language = String(preferredLanguageCode || '').trim().toLowerCase();
    const edgeFriendly =
      language === 'auto'
      || language.startsWith('pt')
      || language.startsWith('en')
      || language.startsWith('es');

    if (normalized.length <= 900 && edgeFriendly) {
      return 'short_reply';
    }

    return normalized.length > 1200 ? 'long_reply' : 'short_reply';
  }

  private resolvePreferredLanguageCode(rawInput: string, responseText: string): string {
    const explicitMatch = String(rawInput || '').match(/Detected language:\s*([^\n]+)/i);
    if (explicitMatch?.[1]) {
      return explicitMatch[1].trim();
    }

    return this.detectLanguageCode(responseText || rawInput);
  }

  private detectLanguageCode(text: string): string {
    const normalized = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const ptHits = (normalized.match(/\b(voce|nao|sim|audio|noticias?|ultimas?|obrigado|consegue|ouvir|resuma|explique|ola|fale|resposta|voz|certo|tudo)\b/g) || []).length;
    const enHits = (normalized.match(/\b(you|not|yes|audio|news|latest|thanks|can|hear|summarize|explain|hello|reply|voice|right|okay)\b/g) || []).length;
    const esHits = (normalized.match(/\b(usted|tu|no|si|audio|noticias?|ultimas?|gracias|puedes|oir|resume|explica|hola|respuesta|voz|claro)\b/g) || []).length;
    if (ptHits >= enHits && ptHits >= esHits && ptHits > 0) return 'en-US';
    if (esHits >= enHits && esHits > 0) return 'es';
    if (enHits > 0) return 'en';
    return 'auto';
  }

  private isExplicitVoiceReplyRequest(rawInput: string, responseText: string): boolean {
    const normalized = `${rawInput}\n${responseText}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return false;
    }

    return (
      /\b(respond[ae]r?|responda|responde|fale|mande|envie)\b.{0,40}\b(audio|voz)\b/.test(normalized)
      || /\b(audio|voz)\b.{0,40}\b(resposta|reply|answer|response|responder|responda|responde)\b/.test(normalized)
      || /\b(reply|answer|respond|send)\b.{0,40}\b(audio|voice)\b/.test(normalized)
      || /\b(audio|voice)\b.{0,40}\b(reply|answer|response)\b/.test(normalized)
      || /\b(respuesta|responde|respondeme|enviame|mandame)\b.{0,40}\b(audio|voz)\b/.test(normalized)
    );
  }
}
