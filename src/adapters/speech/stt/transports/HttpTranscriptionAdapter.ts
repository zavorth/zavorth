import type { HttpSttProviderConfig } from '../SttProviderConfigSchema.js';
import { resolveSttApiKey } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttEvidence,
  sttReadJson,
  sttReadError,
  sttReadPath,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type FetchLike = typeof fetch;

/**
 * HTTP transport adapter.
 * Covers raw-audio (Deepgram/Azure), json-base64 (Gemini), multipart (OpenAI)
 * and payload-template request styles through configuration — no provider-specific
 * code needed in the core.
 */
export class HttpTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'http';
  public readonly modelId: string | null;

  private readonly config: HttpSttProviderConfig;
  private readonly apiKey: string | null;
  private readonly fetchImpl: FetchLike | null;
  private readonly timeoutMs: number;

  constructor(config: HttpSttProviderConfig, deps: { fetch?: FetchLike } = {}) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.apiKey = resolveSttApiKey(config);
    this.fetchImpl = deps.fetch || globalThis.fetch || null;
    this.timeoutMs = config.timeoutMs;
  }

  public isAvailable(): boolean {
    return this.fetchImpl !== null;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.providerId} http adapter requires fetch in the runtime.`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const url = this.buildUrl(input);
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: this.buildHeaders(input.contentType),
        body: this.buildBody(input),
        signal: controller.signal,
      });
      const payload = await sttReadJson(response);
      if (!response.ok) {
        throw new Error(`${this.providerId} transcription failed: ${sttReadError(payload, response.status)}`);
      }
      const text = this.readTranscript(payload);
      if (!text) {
        throw new Error(`${this.providerId} returned an empty transcript.`);
      }
      const language = sttStringOrEmpty(
        sttReadPath(payload, this.config.languagePath || 'language')
        || sttReadPath(payload, 'lang'),
      ) || null;

      return {
        text,
        language,
        segments: sttBuildSegments(payload, text, input.speakerLabels),
        providerEvidence: sttEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'http',
          requestStyle: this.config.requestStyle,
          languageHint: input.languageHint || null,
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

  private buildUrl(input: SttTranscribeInput): string {
    let base = this.expandPlaceholders(this.config.transcribeUrl, input);
    const params: string[] = [];
    if (this.apiKey && this.config.authQueryParam) {
      params.push(`${encodeURIComponent(this.config.authQueryParam)}=${encodeURIComponent(this.apiKey)}`);
    }
    if (this.config.requestStyle === 'raw-audio' && this.config.queryParamNames) {
      if (input.prompt && this.config.queryParamNames.prompt) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.prompt)}=${encodeURIComponent(input.prompt)}`);
      }
      if (typeof input.temperature === 'number' && this.config.queryParamNames.temperature) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.temperature)}=${String(input.temperature)}`);
      }
      if (input.wordTimestamps && this.config.queryParamNames.wordTimestamps) {
        params.push(`${encodeURIComponent(this.config.queryParamNames.wordTimestamps)}=true`);
      }
    }
    if (params.length > 0) {
      const separator = base.includes('?') ? '&' : '?';
      base = `${base}${separator}${params.join('&')}`;
    }
    return base;
  }

  private buildHeaders(contentType: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.config.requestStyle === 'json-base64' || this.config.requestStyle === 'template') {
      headers['Content-Type'] = 'application/json';
    } else if (this.config.requestStyle !== 'multipart') {
      headers['Content-Type'] = contentType || 'audio/wav';
      const contentTypeHeader = this.config.requestHeaderNames?.contentType;
      if (contentTypeHeader && headers['Content-Type']) {
        headers[contentTypeHeader] = headers['Content-Type'];
        delete headers['Content-Type'];
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

  private buildBody(input: SttTranscribeInput): BodyInit {
    if (this.config.requestStyle === 'json-base64') {
      const body: Record<string, unknown> = {
        audio: input.audio.toString('base64'),
        contentType: input.contentType,
        model: this.modelId || undefined,
      };
      if (input.languageHint) {
        body.language = input.languageHint;
      }
      if (input.speakerLabels) {
        body.diarize = true;
        body.speakerLabels = true;
      }
      if (input.wordTimestamps) {
        body.wordTimestamps = true;
      }
      if (typeof input.temperature === 'number') {
        body.temperature = input.temperature;
      }
      if (input.prompt) {
        body.prompt = input.prompt;
      }
      return JSON.stringify(body);
    }
    if (this.config.requestStyle === 'multipart') {
      return buildMultipartBody(input, this.modelId);
    }
    if (this.config.requestStyle === 'template') {
      const template = this.config.payloadTemplate || '{"audio":"{audio}","contentType":"{contentType}"}';
      return this.expandTemplate(template, input);
    }
    return input.audio as unknown as BodyInit;
  }

  private expandTemplate(template: string, input: SttTranscribeInput): string {
    const language = input.languageHint || '';
    const model = this.modelId || '';
    const prompt = input.prompt || '';
    const temperature = typeof input.temperature === 'number' ? String(input.temperature) : '';
    const audio = input.audio.toString('base64');
    return template
      .replace(/\{audio\}/g, audio)
      .replace(/\{contentType\}/g, input.contentType)
      .replace(/\{language\}/g, language)
      .replace(/\{model\}/g, model)
      .replace(/\{prompt\}/g, prompt)
      .replace(/\{temperature\}/g, temperature);
  }

  private expandPlaceholders(url: string, input: SttTranscribeInput): string {
    const model = this.modelId || '';
    const apiKey = this.apiKey || '';
    const region = process.env.AZURE_SPEECH_REGION || '';
    const language = input.languageHint || '';
    return url
      .replace(/\{model\}/g, model)
      .replace(/\{apiKey\}/g, encodeURIComponent(apiKey))
      .replace(/\{region\}/g, region)
      .replace(/\{language\}/g, language);
  }

  private readTranscript(payload: unknown): string {
    if (this.config.transcriptPath) {
      return sttStringOrEmpty(sttReadPath(payload, this.config.transcriptPath));
    }
    return sttStringOrEmpty(
      sttReadPath(payload, 'text')
      || sttReadPath(payload, 'transcript')
      || sttReadPath(payload, 'DisplayText')
      || sttReadPath(payload, 'NBest.0.Display')
      || sttReadPath(payload, 'data.text')
      || sttReadPath(payload, 'results.channels.0.alternatives.0.transcript')
      || sttReadPath(payload, 'channel.alternatives.0.transcript'),
    );
  }
}

function buildMultipartBody(input: SttTranscribeInput, modelId: string | null): BodyInit {
  const form = new FormData();
  const bytes = new Uint8Array(input.audio);
  const blob = new Blob([bytes], { type: input.contentType || 'audio/mpeg' });
  form.append('file', blob, `audio-${Date.now()}.bin`);
  if (modelId) {
    form.append('model', modelId);
  }
  if (input.languageHint) {
    form.append('language', input.languageHint);
  }
  if (input.wordTimestamps) {
    form.append('response_format', 'verbose_json');
  } else {
    form.append('response_format', 'json');
  }
  if (typeof input.temperature === 'number') {
    form.append('temperature', String(input.temperature));
  }
  if (input.prompt) {
    form.append('prompt', input.prompt);
  }
  return form;
}
