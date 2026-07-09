import { config } from '../config/index.js';
import { safeFetch } from '../security/SafeFetchService.js';
import { LocalVoiceDictation } from '../voice/LocalVoiceDictation.js';
import { MediaUnderstandingService } from './MediaUnderstandingService.js';

export type AudioTranscriptionProvider =
  | 'gemini'
  | 'openai'
  | 'groq'
  | 'deepgram'
  | 'whisper.cpp';

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
};

const MIN_AUDIO_BYTES = 1024;
const TRANSIENT_RETRY_LIMIT = 1;
const SILENCE_RMS_THRESHOLD = 0.002;

export class AudioTranscriptionService {
  private readonly mediaUnderstanding: MediaUnderstandingService;
  private readonly localVoiceDictation: LocalVoiceDictation;

  constructor(options: {
    mediaUnderstanding?: MediaUnderstandingService;
    localVoiceDictation?: LocalVoiceDictation;
  } = {}) {
    this.mediaUnderstanding = options.mediaUnderstanding || new MediaUnderstandingService();
    this.localVoiceDictation = options.localVoiceDictation || new LocalVoiceDictation({ language: 'auto' });
  }

  public async transcribe(input: AudioTranscriptionInput): Promise<AudioTranscriptionResult> {
    const attempts: AudioTranscriptionAttempt[] = [];
    if (!Buffer.isBuffer(input.audio) || input.audio.length === 0) {
      return this.failed(attempts, 'Audio payload is empty.');
    }
    if (input.audio.length < MIN_AUDIO_BYTES) {
      return this.failed(attempts, 'Audio payload is too small to transcribe reliably.');
    }
    const preflight = this.preflightAudio(input);
    if (!preflight.ok) {
      return this.failed(attempts, preflight.reason);
    }
    const maxBytes = Number(config.tools?.media?.audio?.sttMaxBytes || 0) || 24 * 1024 * 1024;
    if (input.audio.length > maxBytes) {
      return this.failed(attempts, `Audio payload exceeds the ${Math.round(maxBytes / (1024 * 1024))} MB transcription limit.`);
    }
    const maxSeconds = Number(config.tools?.media?.audio?.sttMaxSeconds || 0) || 10 * 60;
    if (preflight.durationSeconds && preflight.durationSeconds > maxSeconds) {
      return this.failed(attempts, `Audio payload exceeds the ${maxSeconds}s transcription limit.`);
    }
    if (config.tools?.media?.audio?.sttEnabled === false) {
      return this.failed(attempts, 'Audio transcription is disabled.');
    }

    const providers = this.resolveProviderOrder();
    for (const provider of providers) {
      const result = await this.tryProvider(provider, input, attempts);
      if (result) {
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

    return this.failed(
      attempts,
      attempts.find((attempt) => attempt.status === 'failed')?.reason || 'No audio transcription provider is configured or ready.',
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

  private resolveProviderOrder(): AudioTranscriptionProvider[] {
    const raw = Array.isArray(config.tools?.media?.audio?.sttProviderOrder)
      ? config.tools.media.audio.sttProviderOrder
      : ['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp'];
    const known = new Set<AudioTranscriptionProvider>(['gemini', 'openai', 'groq', 'deepgram', 'whisper.cpp']);
    const seen = new Set<string>();
    return raw
      .map((entry) => String(entry || '').trim().toLowerCase() as AudioTranscriptionProvider)
      .filter((entry) => known.has(entry) && !seen.has(entry) && seen.add(entry));
  }

  private async tryProvider(
    provider: AudioTranscriptionProvider,
    input: AudioTranscriptionInput,
    attempts: AudioTranscriptionAttempt[],
  ): Promise<{ text: string; model: string | null } | null> {
    const readiness = this.providerReadiness(provider);
    if (!readiness.ready) {
      attempts.push(this.attempt(provider, readiness.model, 'skipped', readiness.reason, 0));
      return null;
    }

    const retryCount = this.isNetworkProvider(provider) ? TRANSIENT_RETRY_LIMIT : 0;
    let lastError: string | null = null;
    for (let index = 0; index <= retryCount; index += 1) {
      const startedAt = Date.now();
      try {
        const text = await this.withTimeout(
          this.callProvider(provider, input),
          Number(config.tools?.media?.audio?.sttTimeoutMs || 45_000),
        );
        const validated = this.requireTranscriptText(text);
        attempts.push(this.attempt(provider, readiness.model, 'succeeded', null, Date.now() - startedAt));
        return { text: validated, model: readiness.model };
      } catch (error: any) {
        lastError = this.normalizeErrorReason(provider, error instanceof Error ? error.message : String(error));
        attempts.push(this.attempt(provider, readiness.model, 'failed', lastError, Date.now() - startedAt));
        if (!this.isTransientError(lastError)) {
          break;
        }
      }
    }
    return null;
  }

  private providerReadiness(provider: AudioTranscriptionProvider): {
    ready: boolean;
    model: string | null;
    reason: string | null;
  } {
    switch (provider) {
      case 'gemini':
        return {
          ready: Boolean(config.geminiApiKey || config.geminiApiKeys?.length),
          model: config.geminiTranscriptionModel || config.geminiVideoModel || config.geminiModel || null,
          reason: config.geminiApiKey || config.geminiApiKeys?.length ? null : 'GEMINI_API_KEY is not configured.',
        };
      case 'openai':
        return {
          ready: Boolean(config.openaiApiKey || config.openaiApiKeys?.length),
          model: config.openaiTranscriptionModel || null,
          reason: config.openaiApiKey || config.openaiApiKeys?.length ? null : 'OPENAI_API_KEY is not configured.',
        };
      case 'groq':
        return {
          ready: Boolean(config.groqApiKey),
          model: config.groqTranscriptionModel || null,
          reason: config.groqApiKey ? null : 'GROQ_API_KEY is not configured.',
        };
      case 'deepgram':
        return {
          ready: Boolean(config.deepgramApiKey),
          model: config.deepgramTranscriptionModel || null,
          reason: config.deepgramApiKey ? null : 'DEEPGRAM_API_KEY is not configured.',
        };
      case 'whisper.cpp':
        return {
          ready: true,
          model: this.diagnoseLocalFallback().model,
          reason: null,
        };
      default:
        return {
          ready: false,
          model: null,
          reason: `Unknown STT provider: ${provider}`,
        };
    }
  }

  private async callProvider(provider: AudioTranscriptionProvider, input: AudioTranscriptionInput): Promise<string | null> {
    switch (provider) {
      case 'gemini':
        return this.transcribeWithGemini(input);
      case 'openai':
        return this.transcribeWithOpenAiCompatible({
          endpoint: 'https://api.openai.com/v1/audio/transcriptions',
          apiKeys: config.openaiApiKeys?.length ? config.openaiApiKeys : [config.openaiApiKey].filter(Boolean),
          model: config.openaiTranscriptionModel,
          input,
        });
      case 'groq':
        return this.transcribeWithOpenAiCompatible({
          endpoint: 'https://api.groq.com/openai/v1/audio/transcriptions',
          apiKeys: [config.groqApiKey].filter(Boolean),
          model: config.groqTranscriptionModel,
          input,
        });
      case 'deepgram':
        return this.transcribeWithDeepgram(input);
      case 'whisper.cpp':
        return this.localVoiceDictation.transcribeBuffer(input.audio);
      default:
        return null;
    }
  }

  private async transcribeWithGemini(input: AudioTranscriptionInput): Promise<string | null> {
    const result = await this.mediaUnderstanding.analyze({
      source: {
        kind: 'buffer',
        data: input.audio,
        contentType: input.mimeType,
        fileName: input.fileName || 'audio.wav',
      },
      modality: 'audio',
      analysisType: 'extract',
      prompt: input.prompt || 'Transcribe the attached audio. If there is no speech, say that no speech was detected.',
      sessionId: input.sessionId || null,
      providerHints: {
        surface: 'zavorth-control',
        responseLanguage: 'English',
      },
    });
    const text = result.analysis?.extractedText || result.analysis?.answer || result.analysis?.description || result.summary;
    if (!result.ok) {
      throw new Error(result.error?.message || result.summary || 'Gemini transcription failed.');
    }
    return text;
  }

  private async transcribeWithOpenAiCompatible(input: {
    endpoint: string;
    apiKeys: string[];
    model: string;
    input: AudioTranscriptionInput;
  }): Promise<string | null> {
    if (!globalThis.fetch || typeof FormData === 'undefined' || typeof Blob === 'undefined') {
      throw new Error('Fetch/FormData runtime is unavailable.');
    }
    const apiKeys = input.apiKeys.filter(Boolean);
    if (apiKeys.length === 0) {
      throw new Error('API key is not configured.');
    }
    let lastError: string | null = null;
    for (const apiKey of apiKeys) {
      try {
        const formData = new FormData();
        formData.append(
          'file',
          new Blob([new Uint8Array(input.input.audio)], { type: input.input.mimeType || 'audio/wav' }),
          input.input.fileName || 'audio.wav',
        );
        formData.append('model', input.model);
        formData.append('response_format', 'json');
        if (input.input.language && input.input.language !== 'auto') {
          formData.append('language', input.input.language);
        }
        const response = await safeFetch(input.endpoint, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
          },
          body: formData as unknown as BodyInit,
        }, { serviceName: 'Audio transcription STT' });
        if (!response.ok) {
          throw new Error(`STT HTTP ${response.status}: ${await response.text()}`);
        }
        const payload = await response.json() as Record<string, unknown>;
        return String(payload?.text || payload?.transcript || '').trim() || null;
      } catch (error: any) {
        lastError = error instanceof Error ? error.message : String(error);
        if (!this.isTransientError(lastError)) {
          throw new Error(lastError);
        }
      }
    }
    throw new Error(lastError || 'OpenAI-compatible transcription failed.');
  }

  private async transcribeWithDeepgram(input: AudioTranscriptionInput): Promise<string | null> {
    if (!config.deepgramApiKey || !globalThis.fetch) {
      throw new Error('Deepgram is not configured.');
    }
    const model = config.deepgramTranscriptionModel;
    const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&detect_language=true&smart_format=true`;
    const response = await safeFetch(url, {
      method: 'POST',
      headers: {
        authorization: `Token ${config.deepgramApiKey}`,
        'content-type': input.mimeType || 'audio/wav',
      },
      body: input.audio as unknown as BodyInit,
    }, { serviceName: 'Deepgram audio transcription' });
    if (!response.ok) {
      throw new Error(`Deepgram STT HTTP ${response.status}: ${await response.text()}`);
    }
    const payload = await response.json() as Record<string, unknown>;
    const alternative = (payload?.results as Record<string, unknown>)?.channels
      ? ((payload.results as Record<string, unknown>).channels as Array<Record<string, unknown>>)?.[0]?.alternatives
        ? (((payload.results as Record<string, unknown>).channels as Array<Record<string, unknown>>)?.[0]?.alternatives as Array<Record<string, unknown>>)?.[0]
        : null
      : null;
    return String(alternative?.transcript || '').trim() || null;
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
    if (detected.mimeType && mimeType && detected.mimeType !== mimeType && !(mimeType === 'audio/mp4' && detected.mimeType === 'video/mp4')) {
      return { ok: false, reason: `Audio MIME mismatch: declared ${input.mimeType}, detected ${detected.mimeType}.`, durationSeconds: detected.durationSeconds };
    }
    if (detected.durationSeconds !== null && detected.durationSeconds <= 0.15) {
      return { ok: false, reason: 'Audio is too short to transcribe reliably.', durationSeconds: detected.durationSeconds };
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
    if (audio.length >= 12 && audio.subarray(0, 4).toString('ascii') === 'RIFF' && audio.subarray(8, 12).toString('ascii') === 'WAVE') {
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
      return { mimeType: brand === 'M4A ' || brand === 'M4B ' ? 'audio/mp4' : 'video/mp4', durationSeconds: null, isSilent: false };
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
    const durationSeconds = sampleRate && channels && dataSize
      ? dataSize / (sampleRate * channels * bytesPerSample)
      : null;
    return {
      mimeType: 'audio/wav',
      durationSeconds,
      isSilent: dataOffset >= 0 && bitsPerSample === 16
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
    const text = String(value || '').trim().toLowerCase();
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

  private isNetworkProvider(provider: string): boolean {
    return provider !== 'whisper.cpp';
  }

  private isTransientError(message: string | null): boolean {
    if (/\b(insufficient_quota|invalid_api_key|unauthorized|forbidden|billing|quota exceeded|not configured)\b/i.test(
      String(message || ''),
    )) {
      return false;
    }
    return /\b(408|409|425|429|500|502|503|504|timeout|temporar|rate limit|high demand|network|fetch failed)\b/i.test(
      String(message || ''),
    );
  }

  private normalizeErrorReason(provider: string, message: string): string {
    const text = String(message || '').trim();
    if (!text) {
      return `${provider} transcription failed.`;
    }
    if (/Provedor de analise de midia indisponivel/i.test(text)) {
      return `${provider} media analysis provider is unavailable.`;
    }
    return text;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Audio transcription timed out after ${timeoutMs}ms.`)), timeoutMs);
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
    latencyMs: number,
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
