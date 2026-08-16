/**
 * Audio Transcription Service.
 * Universal, vendor-agnostic speech-to-text service backed by pluggable SttBackendRegistry adapters.
 */

import { config } from '../config/index.js';
import { asErrorLike } from '../utils/errorLike.js';
import { getVoicePreferenceService, type VoicePreferenceService } from './voice/VoicePreferenceService.js';
import { recordVoiceMetric } from './voice/VoiceMetricsService.js';
import { normalizeVoiceLanguage, whisperLanguageParam } from './voice/VoiceLanguage.js';
import { SttBackendRegistry } from '../adapters/speech/stt/SttBackendRegistry.js';
import { builtinSttProviderConfigs } from '../adapters/speech/stt/builtinSttProviderConfigs.js';
import type { ISpeechTranscriptionAdapter, SttTranscribeOutput } from '../adapters/speech/stt/SpeechTranscriptionContract.js';

export type AudioTranscriptionProvider = string;

export type AudioTranscriptionAttempt = {
  provider: string;
  model: string | null;
  status: 'skipped' | 'failed' | 'succeeded';
  reason: string | null;
  latencyMs: number;
};

export type AudioTranscriptionResult = {
  ok: boolean;
  text: string | null;
  provider: string | null;
  model: string | null;
  attempts: AudioTranscriptionAttempt[];
  error: string | null;
};

export type AudioTranscriptionInput = {
  audio: Buffer;
  mimeType: string;
  fileName?: string | null;
  prompt?: string | null;
  sessionId?: string | null;
  language?: string | null;
  allowLegacyCascade?: boolean;
};

const MIN_AUDIO_BYTES = 1024;
const TRANSIENT_RETRY_LIMIT = 1;
const SILENCE_RMS_THRESHOLD = 0.002;

export class AudioTranscriptionService {
  private readonly registry: SttBackendRegistry;
  private readonly voicePreferences: VoicePreferenceService;

  constructor(
    options: {
      registry?: SttBackendRegistry;
      voicePreferences?: VoicePreferenceService;
    } = {}
  ) {
    this.voicePreferences = options.voicePreferences || getVoicePreferenceService();
    this.registry = options.registry || this.createDefaultRegistry();
  }

  private createDefaultRegistry(): SttBackendRegistry {
    const reg = new SttBackendRegistry();
    for (const cfg of builtinSttProviderConfigs()) {
      reg.registerConfig(cfg);
    }
    return reg;
  }

  public async transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult> {
    const attempts: AudioTranscriptionAttempt[] = [];
    const startedAt = Date.now();
    const surface = String(input.sessionId || '').trim() || null;

    const fail = (message: string) => {
      recordVoiceMetric({
        kind: 'stt',
        ok: false,
        message,
        surface,
        latencyMs: Date.now() - startedAt,
        language: input.language || null,
      });
      return this.failed(attempts, message);
    };

    if (!Buffer.isBuffer(input.audio) || input.audio.length === 0) {
      return fail('Audio payload is empty. Type your message instead.');
    }
    if (input.audio.length < MIN_AUDIO_BYTES) {
      return fail('Audio payload is too small to transcribe reliably. Type your message instead.');
    }
    const preflight = this.preflightAudio(input);
    if (!preflight.ok) {
      return fail(preflight.reason);
    }
    const maxBytes = Number(config.tools?.media?.audio?.sttMaxBytes || 0) || 24 * 1024 * 1024;
    if (input.audio.length > maxBytes) {
      return fail(
        `Audio payload exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB transcription limit. Type your message instead.`
      );
    }
    const maxSeconds = Number(config.tools?.media?.audio?.sttMaxSeconds || 0) || 10 * 60;
    if (preflight.durationSeconds && preflight.durationSeconds > maxSeconds) {
      return fail(`Audio payload exceeds the ${maxSeconds}s transcription limit. Type your message instead.`);
    }
    if (config.tools?.media?.audio?.sttEnabled === false) {
      return fail('Audio transcription is disabled. Type your message instead.');
    }

    const resolved = this.resolveProvidersForRequest(input);
    if (resolved.ok === false) {
      attempts.push(this.attempt('none', null, 'skipped', resolved.message, 0));
      return fail(`${resolved.message} ${resolved.configureHint}`);
    }

    const prefLang = resolved.language && resolved.language !== 'auto' ? resolved.language : null;
    const callerLang =
      input.language && String(input.language).trim() && String(input.language) !== 'auto'
        ? String(input.language).trim()
        : null;
    const languageRaw = callerLang || prefLang || 'auto';
    const languageNorm = normalizeVoiceLanguage(languageRaw);
    const language = languageNorm.isAuto ? 'auto' : languageNorm.whisper;
    const enrichedInput: AudioTranscriptionInput = {
      ...input,
      language: whisperLanguageParam(language),
    };

    const globalTimeoutMs = Number(
      process.env.ZAVORTH_AUDIO_STT_GLOBAL_TIMEOUT_MS || config.tools?.media?.audio?.sttTimeoutMs || 45_000
    );
    const deadline = Date.now() + Math.max(5_000, globalTimeoutMs);

    for (const provider of resolved.providers) {
      if (Date.now() > deadline) {
        return fail(`STT timed out after ${globalTimeoutMs}ms. Type your message instead.`);
      }
      const remaining = Math.max(3_000, deadline - Date.now());
      const result = await this.tryProvider(provider, enrichedInput, attempts, resolved.model, remaining);
      if (result) {
        recordVoiceMetric({
          kind: 'stt',
          ok: true,
          provider,
          model: result.model,
          language,
          latencyMs: Date.now() - startedAt,
          chars: result.text.length,
          surface,
          source: resolved.ok ? 'preference_or_env' : null,
        });
        return {
          ok: true,
          text: result.text,
          provider,
          model: result.model,
          attempts,
          error: null,
        };
      }
    }

    return fail(
      attempts.find((attempt) => attempt.status === 'failed')?.reason ||
        'STT failed. Type your message instead. Set voice preference if needed.'
    );
  }

  public diagnoseLocalFallback(): { ready: boolean; model: string; reason: string | null } {
    const modelPath = String(process.env.ZAVORTH_WHISPER_MODEL_PATH || '').trim();
    return {
      ready: Boolean(modelPath),
      model: modelPath || 'whisper.cpp',
      reason: modelPath ? null : 'ZAVORTH_WHISPER_MODEL_PATH is not configured; local fallback may be unavailable.',
    };
  }

  private resolveProvidersForRequest(input: AudioTranscriptionInput):
    | {
        ok: true;
        providers: AudioTranscriptionProvider[];
        model: string | null;
        language: string;
      }
    | {
        ok: false;
        message: string;
        configureHint: string;
      } {
    if (input.allowLegacyCascade) {
      return {
        ok: true,
        providers: this.resolveConfiguredProviderOrder(),
        model: null,
        language: String(input.language || 'auto'),
      };
    }

    const resolved = this.voicePreferences.resolveStt();
    if (resolved.ok === false) {
      return {
        ok: false,
        message: resolved.message,
        configureHint: resolved.configureHint,
      };
    }

    return {
      ok: true,
      providers: resolved.providers as AudioTranscriptionProvider[],
      model: resolved.model,
      language: resolved.language || 'auto',
    };
  }

  private resolveConfiguredProviderOrder(): AudioTranscriptionProvider[] {
    const raw = Array.isArray(config.tools?.media?.audio?.sttProviderOrder)
      ? config.tools.media.audio.sttProviderOrder
      : this.registry.providerIds();
    const seen = new Set<string>();
    return raw
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => entry.length > 0 && !seen.has(entry) && seen.add(entry));
  }

  private async tryProvider(
    providerId: AudioTranscriptionProvider,
    input: AudioTranscriptionInput,
    attempts: AudioTranscriptionAttempt[],
    preferredModel?: string | null,
    timeoutMs?: number
  ): Promise<{ text: string; model: string | null } | null> {
    const adapter = this.registry.get(providerId);
    if (!adapter) {
      attempts.push(this.attempt(providerId, null, 'skipped', `Provider "${providerId}" is not registered in SttBackendRegistry.`, 0));
      return null;
    }

    const readiness = this.checkAdapterReadiness(adapter, preferredModel);
    if (!readiness.ready) {
      attempts.push(this.attempt(providerId, readiness.model, 'skipped', readiness.reason, 0));
      return null;
    }

    const retryCount = adapter.transport !== 'cli' && adapter.transport !== 'in-process' ? TRANSIENT_RETRY_LIMIT : 0;
    let lastError: string | null = null;
    const perTryTimeout = Math.max(3_000, Number(timeoutMs || config.tools?.media?.audio?.sttTimeoutMs || 45_000));

    for (let index = 0; index <= retryCount; index += 1) {
      const startedAt = Date.now();
      try {
        const result: SttTranscribeOutput = await this.withTimeout(
          adapter.transcribe({
            audio: input.audio,
            contentType: input.mimeType || 'audio/wav',
            language: input.language || undefined,
            prompt: input.prompt || undefined,
            model: readiness.model || undefined,
          }),
          perTryTimeout
        );

        const validatedText = this.requireTranscriptText(result.text);
        attempts.push(this.attempt(providerId, readiness.model, 'succeeded', null, Date.now() - startedAt));
        return { text: validatedText, model: readiness.model };
      } catch (error: unknown) {
        const err = asErrorLike(error);
        lastError = this.normalizeErrorReason(providerId, error instanceof Error ? err.message : String(error));
        attempts.push(this.attempt(providerId, readiness.model, 'failed', lastError, Date.now() - startedAt));
        if (!this.isTransientError(lastError)) {
          break;
        }
      }
    }
    return null;
  }

  private checkAdapterReadiness(
    adapter: ISpeechTranscriptionAdapter,
    preferredModel?: string | null
  ): {
    ready: boolean;
    model: string | null;
    reason: string | null;
  } {
    const override = preferredModel != null && String(preferredModel).trim() ? String(preferredModel).trim() : null;
    const configItem = builtinSttProviderConfigs().find((c) => c.providerId === adapter.providerId);

    if (adapter.transport === 'cli' || adapter.transport === 'in-process') {
      return {
        ready: true,
        model: override || 'local',
        reason: null,
      };
    }

    if (configItem?.apiKeyEnvVar) {
      const envVal = process.env[configItem.apiKeyEnvVar];
      const hasKey = Boolean(envVal && envVal.trim());
      return {
        ready: hasKey,
        model: override || configItem.modelId || null,
        reason: hasKey ? null : `${configItem.apiKeyEnvVar} is not configured.`,
      };
    }

    return {
      ready: true,
      model: override || null,
      reason: null,
    };
  }

  private requireTranscriptText(value: unknown): string {
    const text = String(value || '').trim();
    if (!text || this.isUnhelpfulAudioAnalysis(text)) {
      throw new Error('Audio transcription response missing usable text.');
    }
    return text;
  }

  private preflightAudio(input: AudioTranscriptionInput): {
    ok: boolean;
    reason: string;
    durationSeconds: number | null;
  } {
    const mimeType = String(input.mimeType || '').toLowerCase();
    if (mimeType && !/^audio\//i.test(mimeType) && mimeType !== 'video/mp4') {
      return { ok: false, reason: `Unsupported audio MIME type: ${input.mimeType}`, durationSeconds: null };
    }
    const detected = this.detectAudioContainer(input.audio);
    if (
      detected.mimeType &&
      mimeType &&
      detected.mimeType !== mimeType &&
      !(mimeType === 'audio/mp4' && detected.mimeType === 'video/mp4')
    ) {
      return {
        ok: false,
        reason: `Audio MIME mismatch: declared ${input.mimeType}, detected ${detected.mimeType}.`,
        durationSeconds: detected.durationSeconds,
      };
    }
    if (detected.durationSeconds !== null && detected.durationSeconds <= 0.15) {
      return {
        ok: false,
        reason: 'Audio is too short to transcribe reliably.',
        durationSeconds: detected.durationSeconds,
      };
    }
    if (detected.isSilent) {
      return { ok: false, reason: 'Audio appears to be silent.', durationSeconds: detected.durationSeconds };
    }
    return { ok: true, reason: 'ok', durationSeconds: detected.durationSeconds };
  }

  private detectAudioContainer(audio: Buffer): {
    mimeType: string | null;
    durationSeconds: number | null;
    isSilent: boolean;
  } {
    if (
      audio.length >= 12 &&
      audio.subarray(0, 4).toString('ascii') === 'RIFF' &&
      audio.subarray(8, 12).toString('ascii') === 'WAVE'
    ) {
      return this.inspectWav(audio);
    }
    if (audio.length >= 4 && audio.subarray(0, 4).toString('ascii') === 'OggS') {
      return { mimeType: 'audio/ogg', durationSeconds: null, isSilent: false };
    }
    if (audio.length >= 3 && audio.subarray(0, 3).toString('ascii') === 'ID3') {
      return { mimeType: 'audio/mpeg', durationSeconds: null, isSilent: false };
    }
    if (audio.length >= 12 && audio.subarray(4, 8).toString('ascii') === 'ftyp') {
      const brand = audio.subarray(8, 12).toString('ascii');
      return {
        mimeType: brand === 'M4A ' || brand === 'M4B ' ? 'audio/mp4' : 'video/mp4',
        durationSeconds: null,
        isSilent: false,
      };
    }
    return { mimeType: null, durationSeconds: null, isSilent: false };
  }

  private inspectWav(audio: Buffer): {
    mimeType: 'audio/wav';
    durationSeconds: number | null;
    isSilent: boolean;
  } {
    let offset = 12;
    let sampleRate = 0;
    let bitsPerSample = 0;
    let channels = 0;
    let dataOffset = -1;
    let dataSize = 0;
    while (offset + 8 <= audio.length) {
      const id = audio.subarray(offset, offset + 4).toString('ascii');
      const size = audio.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (id === 'fmt ' && body + 16 <= audio.length) {
        channels = audio.readUInt16LE(body + 2);
        sampleRate = audio.readUInt32LE(body + 4);
        bitsPerSample = audio.readUInt16LE(body + 14);
      } else if (id === 'data') {
        dataOffset = body;
        dataSize = Math.min(size, audio.length - body);
        break;
      }
      offset = body + size + (size % 2);
    }
    const bytesPerSample = Math.max(1, Math.floor(bitsPerSample / 8));
    const durationSeconds =
      sampleRate && channels && dataSize ? dataSize / (sampleRate * channels * bytesPerSample) : null;
    return {
      mimeType: 'audio/wav',
      durationSeconds,
      isSilent:
        dataOffset >= 0 && bitsPerSample === 16
          ? this.isPcm16Silent(audio.subarray(dataOffset, dataOffset + dataSize))
          : false,
    };
  }

  private isPcm16Silent(samples: Buffer): boolean {
    if (samples.length < 2) {
      return true;
    }
    const sampleCount = Math.floor(samples.length / 2);
    const stride = Math.max(1, Math.floor(sampleCount / 16_000));
    let count = 0;
    let sumSquares = 0;
    for (let index = 0; index + 1 < samples.length; index += 2 * stride) {
      const value = samples.readInt16LE(index) / 32768;
      sumSquares += value * value;
      count += 1;
    }
    const rms = Math.sqrt(sumSquares / Math.max(1, count));
    return rms < SILENCE_RMS_THRESHOLD;
  }

  private isUnhelpfulAudioAnalysis(value: unknown): boolean {
    const text = String(value || '')
      .trim()
      .toLowerCase();
    if (!text) {
      return false;
    }
    return [
      'cannot process audio',
      'can not process audio',
      'cannot transcribe',
      'can not transcribe',
      'provide the audio content',
      'no audio provided',
      'unable to access the audio',
    ].some((phrase) => text.includes(phrase));
  }

  private isTransientError(message: string | null): boolean {
    if (
      /\b(insufficient_quota|invalid_api_key|unauthorized|forbidden|billing|quota exceeded|not configured)\b/i.test(
        String(message || '')
      )
    ) {
      return false;
    }
    return /\b(408|409|425|429|500|502|503|504|timeout|temporar|rate limit|high demand|network|fetch failed)\b/i.test(
      String(message || '')
    );
  }

  private normalizeErrorReason(provider: string, message: string): string {
    const text = String(message || '').trim();
    if (!text) {
      return `${provider} transcription failed.`;
    }
    return text;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`Audio transcription timed out after ${timeoutMs}ms.`)),
            timeoutMs
          );
          timeoutHandle.unref?.();
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private attempt(
    provider: string,
    model: string | null,
    status: AudioTranscriptionAttempt['status'],
    reason: string | null,
    latencyMs: number
  ): AudioTranscriptionAttempt {
    return {
      provider,
      model,
      status,
      reason,
      latencyMs,
    };
  }

  private failed(attempts: AudioTranscriptionAttempt[], error: string): AudioTranscriptionResult {
    return {
      ok: false,
      text: null,
      provider: null,
      model: null,
      attempts,
      error,
    };
  }
}
