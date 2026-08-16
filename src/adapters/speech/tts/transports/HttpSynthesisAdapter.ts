import type { HttpTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import { resolveTtsApiKey } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import {
  ttsBuildSsml,
  ttsContentTypeFor,
  ttsEvidence,
  ttsReadError,
  ttsReadJson,
  ttsReadPath,
  ttsStringOrEmpty,
  ttsWrapPcmAsWav,
} from '../TtsAdapterUtils.js';

type FetchLike = typeof fetch;

/**
 * HTTP transport adapter.
 * Covers json-text (ElevenLabs/Deepgram), SSML (Azure) and raw-text/template
 * request styles through configuration — no provider-specific code in the core.
 * Audio extraction supports raw body bytes, base64 JSON fields and PCM16 that
 * must be wrapped into a WAV container (Gemini TTS).
 */
export class HttpSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'http';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: HttpTtsProviderConfig;
  private readonly apiKey: string | null;
  private readonly fetchImpl: FetchLike | null;
  private readonly timeoutMs: number;

  constructor(config: HttpTtsProviderConfig, deps: { fetch?: FetchLike } = {}) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
    this.apiKey = resolveTtsApiKey(config);
    this.fetchImpl = deps.fetch || globalThis.fetch || null;
    this.timeoutMs = config.timeoutMs;
  }

  public isAvailable(): boolean {
    return this.fetchImpl !== null;
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices;
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.providerId} http adapter requires fetch in the runtime.`);
    }
    if (!this.apiKey) {
      throw new Error(`${this.providerId} http adapter requires ${String(this.config.apiKeyEnvVar || 'an API key env var')}.`);
    }

    const voice = input.voiceId || this.defaultVoiceId || '';
    const language = input.language || this.config.languageCode || 'en-US';
    const speed = typeof input.speed === 'number' ? input.speed : 1.0;
    const pitch = typeof input.pitch === 'number' ? input.pitch : 0;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = this.buildUrl(input, voice, language);
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.buildHeaders(input, voice, language, speed, pitch),
        body: this.buildBody(input, voice, language, speed, pitch),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await ttsReadJson(response);
        throw new Error(`${this.providerId} synthesis failed: ${ttsReadError(payload, response.status)}`);
      }

      const audio = await this.readAudio(response);
      const format = this.detectFormat(input, response);
      const contentType = this.config.responseContentType || response.headers.get('content-type') || ttsContentTypeFor(format);

      return {
        audio,
        format,
        contentType,
        providerEvidence: ttsEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'http',
          requestStyle: this.config.requestStyle,
          audioSource: this.config.audioSource,
          voice,
          language,
        }),
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`${this.providerId} http adapter timed out after ${this.timeoutMs}ms.`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(input: TtsSynthesizeInput, voice: string, language: string): string {
    let base = this.expandUrlPlaceholders(this.config.synthesizeUrl, input, voice, language);
    const params: string[] = [];
    if (this.apiKey && this.config.authQueryParam) {
      params.push(`${encodeURIComponent(this.config.authQueryParam)}=${encodeURIComponent(this.apiKey)}`);
    }
    if (this.config.queryParamNames) {
      if (voice && this.config.queryParamNames.voice) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.voice)}=${encodeURIComponent(voice)}`);
      }
      if (this.config.queryParamNames.language) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.language)}=${encodeURIComponent(language)}`);
      }
      if (this.config.queryParamNames.outputFormat) {
        const format = input.outputFormat || 'mp3';
        params.push(`${encodeURIComponent(this.config.queryParamNames.outputFormat)}=${encodeURIComponent(format)}`);
      }
      if (typeof input.speed === 'number' && this.config.queryParamNames.speed) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.speed)}=${String(input.speed)}`);
      }
    }
    if (params.length > 0) {
      const separator = base.includes('?') ? '&' : '?';
      base = `${base}${separator}${params.join('&')}`;
    }
    return base;
  }

  private buildHeaders(
    input: TtsSynthesizeInput,
    voice: string,
    language: string,
    speed: number,
    pitch: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {};
    const style = this.config.requestStyle;
    if (style === 'json-text' || style === 'template' || style === 'raw-text') {
      headers['Content-Type'] = 'application/json';
    } else if (style === 'ssml') {
      headers['Content-Type'] = 'application/ssml+xml';
    }
    if (this.config.requestHeaderNames?.contentType) {
      const value = headers['Content-Type'];
      if (value) {
        headers[this.config.requestHeaderNames.contentType] = value;
        delete headers['Content-Type'];
      }
    }
    if (this.config.requestHeaderNames?.language && language) {
      headers[this.config.requestHeaderNames.language] = language;
    }
    if (this.config.outputFormatHeader) {
      const requested = input.outputFormat || 'mp3';
      const value = this.resolveOutputFormatHeaderValue(requested, speed, pitch);
      headers[this.config.outputFormatHeader] = value;
      if (this.config.requestHeaderNames?.outputFormat && headers[this.config.outputFormatHeader]) {
        headers[this.config.requestHeaderNames.outputFormat] = headers[this.config.outputFormatHeader];
        delete headers[this.config.outputFormatHeader];
      }
    }
    if (this.apiKey && !this.config.authQueryParam) {
      const value = this.config.authScheme
        ? `${this.config.authScheme} ${this.apiKey}`
        : this.apiKey;
      headers[this.config.authHeaderName] = value;
    }
    return headers;
  }

  private resolveOutputFormatHeaderValue(requested: string, speed: number, pitch: number): string {
    let value = this.config.outputFormatHeaderValue || '';
    value = value
      .replace(/\{format\}/g, requested)
      .replace(/\{speed\}/g, String(Math.round((speed - 1) * 100)))
      .replace(/\{pitch\}/g, pitch !== 0 ? `${pitch}Hz` : '+0Hz');
    if (value) {
      return value;
    }
    const mime = ttsContentTypeFor(requested);
    return mime === 'audio/wav' ? 'audio-24khz-16bit-mono-pcm' : 'audio-24khz-48kbitrate-mono-mp3';
  }

  private buildBody(
    input: TtsSynthesizeInput,
    voice: string,
    language: string,
    speed: number,
    pitch: number,
  ): BodyInit {
    const style = this.config.requestStyle;
    if (style === 'ssml') {
      return ttsBuildSsml({
        text: input.text,
        voice,
        language,
        speed,
        pitch,
        ssml: input.ssml,
      });
    }
    if (style === 'template' && this.config.payloadTemplate) {
      return this.expandTemplate(this.config.payloadTemplate, input, voice, language, speed, pitch);
    }
    if (style === 'raw-text') {
      return JSON.stringify({ text: input.text });
    }
    return JSON.stringify({
      text: input.text,
      ...(this.modelId ? { model_id: this.modelId } : {}),
      ...(voice ? { voice } : {}),
      ...(language ? { language_code: language } : {}),
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        speed,
      },
    });
  }

  private expandTemplate(
    template: string,
    input: TtsSynthesizeInput,
    voice: string,
    language: string,
    speed: number,
    pitch: number,
  ): string {
    const model = this.modelId || '';
    return template
      .replace(/\{text\}/g, ttsStringOrEmpty(input.text))
      .replace(/\{voice\}/g, voice)
      .replace(/\{language\}/g, language)
      .replace(/\{model\}/g, model)
      .replace(/\{speed\}/g, String(speed))
      .replace(/\{pitch\}/g, String(pitch));
  }

  private expandUrlPlaceholders(
    url: string,
    input: TtsSynthesizeInput,
    voice: string,
    language: string,
  ): string {
    const model = this.modelId || '';
    const apiKey = this.apiKey || '';
    const region = process.env.AZURE_SPEECH_REGION || '';
    const format = input.outputFormat || 'mp3';
    return url
      .replace(/\{model\}/g, model)
      .replace(/\{apiKey\}/g, encodeURIComponent(apiKey))
      .replace(/\{region\}/g, region)
      .replace(/\{voice\}/g, encodeURIComponent(voice))
      .replace(/\{language\}/g, language)
      .replace(/\{format\}/g, format);
  }

  private async readAudio(response: Response): Promise<Buffer> {
    if (this.config.audioSource === 'body') {
      return Buffer.from(await response.arrayBuffer());
    }
    const payload = await ttsReadJson(response);
    const data = this.config.audioPath
      ? ttsReadPath(payload, this.config.audioPath)
      : ttsReadPath(payload, 'audio');
    const base64 = ttsStringOrEmpty(data);
    if (!base64) {
      throw new Error(`${this.providerId} synthesis returned no audio payload.`);
    }
    const raw = Buffer.from(base64, 'base64');
    if (this.config.audioSource === 'pcm16-json') {
      return ttsWrapPcmAsWav(raw, {
        sampleRate: this.config.pcm.sampleRate,
        channels: this.config.pcm.channels,
      });
    }
    return raw;
  }

  private detectFormat(input: TtsSynthesizeInput, response: Response): string {
    if (this.config.audioSource === 'pcm16-json') {
      return 'wav';
    }
    const header = response.headers.get('content-type') || '';
    if (header.includes('wav')) return 'wav';
    if (header.includes('ogg')) return 'ogg';
    return input.outputFormat || 'mp3';
  }
}
