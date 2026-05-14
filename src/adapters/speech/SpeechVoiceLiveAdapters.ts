import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import type {
  SpeechArtifactRef,
  SpeechProviderEvidence,
  SpeechTranscriptSegment,
} from '../../contracts/SpeechContract.js';

type FetchRuntime = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type SpawnLike = typeof spawn;

export type SpeechTranscriptionAdapterInput = {
  source: SpeechArtifactRef;
  audio: Buffer;
  languageHint?: string | null;
  speakerLabels?: boolean;
  mode?: 'batch' | 'streaming';
};

export type SpeechTranscriptionAdapterOutput = {
  text: string;
  segments: SpeechTranscriptSegment[];
  providerEvidence: SpeechProviderEvidence;
};

export type SpeechSynthesisAdapterInput = {
  text: string;
  voiceId?: string | null;
  format: 'wav' | 'mp3' | 'ogg';
};

export type SpeechSynthesisAdapterOutput = {
  data?: Buffer | null;
  sourceUrl?: string | null;
  contentType: string;
  sizeBytes?: number | null;
  providerEvidence: SpeechProviderEvidence;
};

export interface ISpeechTranscriptionLiveAdapter {
  readonly adapterId: string;
  readonly providerId: string;
  readonly supportedModes: Array<'batch' | 'streaming'>;
  transcribe(input: SpeechTranscriptionAdapterInput): Promise<SpeechTranscriptionAdapterOutput>;
}

export interface ISpeechSynthesisLiveAdapter {
  readonly adapterId: string;
  readonly providerId: string;
  readonly supportedFormats: Array<'wav' | 'mp3' | 'ogg'>;
  synthesize(input: SpeechSynthesisAdapterInput): Promise<SpeechSynthesisAdapterOutput>;
}

export type HttpSpeechTranscriptionConfig = {
  adapterId: string;
  providerId: string;
  transcribeUrl: string;
  apiKey?: string | null;
  modelId?: string | null;
  requestStyle?: 'raw-audio' | 'json-base64';
  authHeaderName?: string;
  authScheme?: string | null;
  transcriptPath?: string | null;
};

export type HttpSpeechSynthesisConfig = {
  adapterId: string;
  providerId: string;
  synthesizeUrl: string;
  apiKey?: string | null;
  modelId?: string | null;
  voiceId?: string | null;
  requestStyle?: 'json-text' | 'elevenlabs';
  authHeaderName?: string;
  authScheme?: string | null;
  responseContentType?: string;
};

export type LocalCliSpeechSynthesisConfig = {
  adapterId: string;
  providerId: string;
  command: string;
  args?: string[];
  voiceId?: string | null;
  contentType?: string;
  tempDir?: string;
  timeoutMs?: number;
};

export class HttpSpeechTranscriptionLiveAdapter implements ISpeechTranscriptionLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedModes: Array<'batch' | 'streaming'> = ['batch', 'streaming'];

  private readonly config: Required<Omit<HttpSpeechTranscriptionConfig, 'apiKey' | 'modelId' | 'authScheme' | 'transcriptPath'>> & {
    apiKey?: string | null;
    modelId?: string | null;
    authScheme?: string | null;
    transcriptPath?: string | null;
  };
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: HttpSpeechTranscriptionConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = {
      ...config,
      requestStyle: config.requestStyle || 'raw-audio',
      authHeaderName: config.authHeaderName || 'Authorization',
      authScheme: config.authScheme === undefined ? 'Bearer' : config.authScheme,
      transcriptPath: config.transcriptPath || null,
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async transcribe(input: SpeechTranscriptionAdapterInput): Promise<SpeechTranscriptionAdapterOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }

    const response = await this.fetchImpl(this.config.transcribeUrl, {
      method: 'POST',
      headers: this.headers(input.source.contentType),
      body: this.body(input),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(`${this.adapterId} transcription failed: ${readError(payload, response.status)}`);
    }
    const text = this.readTranscript(payload);
    if (!text) {
      throw new Error(`${this.adapterId} returned an empty transcript.`);
    }

    return {
      text,
      segments: normalizeSegments(payload, text, input.speakerLabels),
      providerEvidence: {
        providerId: this.providerId,
        modelId: String(this.config.modelId || '').trim() || null,
        metadata: {
          mode: input.mode || 'batch',
          languageHint: input.languageHint || null,
          requestStyle: this.config.requestStyle,
          secretValuesSerialized: false,
        },
      },
    };
  }

  private body(input: SpeechTranscriptionAdapterInput): BodyInit {
    if (this.config.requestStyle === 'json-base64') {
      return JSON.stringify({
        audio: input.audio.toString('base64'),
        contentType: input.source.contentType,
        language: input.languageHint || undefined,
        model: this.config.modelId || undefined,
        speakerLabels: Boolean(input.speakerLabels),
      });
    }
    return input.audio as unknown as BodyInit;
  }

  private headers(contentType: string): Record<string, string> {
    const headers: Record<string, string> = this.config.requestStyle === 'json-base64'
      ? { 'Content-Type': 'application/json' }
      : { 'Content-Type': contentType || 'audio/wav' };
    if (this.config.apiKey) {
      const value = this.config.authScheme
        ? `${this.config.authScheme} ${this.config.apiKey}`
        : this.config.apiKey;
      headers[this.config.authHeaderName] = value;
    }
    return headers;
  }

  private readTranscript(payload: unknown): string {
    if (this.config.transcriptPath) {
      return stringOrEmpty(readPath(payload, this.config.transcriptPath));
    }
    return stringOrEmpty(
      readPath(payload, 'text')
      || readPath(payload, 'transcript')
      || readPath(payload, 'DisplayText')
      || readPath(payload, 'NBest.0.Display')
      || readPath(payload, 'data.text')
      || readPath(payload, 'results.channels.0.alternatives.0.transcript')
      || readPath(payload, 'channel.alternatives.0.transcript'),
    );
  }
}

export class HttpSpeechSynthesisLiveAdapter implements ISpeechSynthesisLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedFormats: Array<'wav' | 'mp3' | 'ogg'> = ['wav', 'mp3', 'ogg'];

  private readonly config: Required<Omit<HttpSpeechSynthesisConfig, 'apiKey' | 'modelId' | 'voiceId' | 'authScheme'>> & {
    apiKey?: string | null;
    modelId?: string | null;
    voiceId?: string | null;
    authScheme?: string | null;
  };
  private readonly fetchImpl: typeof fetch | null;

  constructor(config: HttpSpeechSynthesisConfig, runtime: FetchRuntime = {}) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = {
      ...config,
      requestStyle: config.requestStyle || 'json-text',
      authHeaderName: config.authHeaderName || 'Authorization',
      authScheme: config.authScheme === undefined ? 'Bearer' : config.authScheme,
      responseContentType: config.responseContentType || 'audio/mpeg',
    };
    this.fetchImpl = runtime.fetchImpl || globalThis.fetch || null;
  }

  public async synthesize(input: SpeechSynthesisAdapterInput): Promise<SpeechSynthesisAdapterOutput> {
    if (!this.fetchImpl) {
      throw new Error(`${this.adapterId} requires fetch in the runtime.`);
    }

    const response = await this.fetchImpl(this.config.synthesizeUrl, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.body(input)),
    });
    const contentType = response.headers.get('content-type') || this.config.responseContentType;

    if (!response.ok) {
      const payload = contentType.includes('json') ? await readJson(response) : null;
      throw new Error(`${this.adapterId} synthesis failed: ${readError(payload, response.status)}`);
    }

    if (contentType.includes('json')) {
      const payload = await readJson(response);
      const base64 = stringOrEmpty(
        readPath(payload, 'audio')
        || readPath(payload, 'audio_base64')
        || readPath(payload, 'data.audio')
        || readPath(payload, 'data.0.b64_json'),
      );
      const sourceUrl = stringOrEmpty(
        readPath(payload, 'url')
        || readPath(payload, 'audio_url')
        || readPath(payload, 'data.url'),
      );
      return {
        data: base64 ? Buffer.from(stripDataUrlPrefix(base64), 'base64') : null,
        sourceUrl: sourceUrl || null,
        contentType: contentTypeForFormat(input.format),
        sizeBytes: base64 ? Buffer.byteLength(stripDataUrlPrefix(base64), 'base64') : null,
        providerEvidence: this.evidence(input),
      };
    }

    const data = Buffer.from(await response.arrayBuffer());
    return {
      data,
      sourceUrl: null,
      contentType,
      sizeBytes: data.length,
      providerEvidence: this.evidence(input),
    };
  }

  private body(input: SpeechSynthesisAdapterInput): Record<string, unknown> {
    if (this.config.requestStyle === 'elevenlabs') {
      return {
        text: input.text,
        model_id: this.config.modelId || undefined,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      };
    }
    return {
      text: input.text,
      input: input.text,
      voice: input.voiceId || this.config.voiceId || undefined,
      voiceId: input.voiceId || this.config.voiceId || undefined,
      model: this.config.modelId || undefined,
      format: input.format,
    };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      const value = this.config.authScheme
        ? `${this.config.authScheme} ${this.config.apiKey}`
        : this.config.apiKey;
      headers[this.config.authHeaderName] = value;
    }
    return headers;
  }

  private evidence(input: SpeechSynthesisAdapterInput): SpeechProviderEvidence {
    return {
      providerId: this.providerId,
      modelId: String(this.config.modelId || '').trim() || null,
      metadata: {
        voiceId: input.voiceId || this.config.voiceId || null,
        format: input.format,
        requestStyle: this.config.requestStyle,
        secretValuesSerialized: false,
      },
    };
  }
}

export class LocalCliSpeechSynthesisLiveAdapter implements ISpeechSynthesisLiveAdapter {
  public readonly adapterId: string;
  public readonly providerId: string;
  public readonly supportedFormats: Array<'wav' | 'mp3' | 'ogg'> = ['wav', 'mp3', 'ogg'];

  private readonly config: Required<Omit<LocalCliSpeechSynthesisConfig, 'voiceId'>>;
  private readonly voiceId: string | null;
  private readonly spawnImpl: SpawnLike;

  constructor(config: LocalCliSpeechSynthesisConfig, deps: { spawn?: SpawnLike } = {}) {
    this.adapterId = config.adapterId;
    this.providerId = config.providerId;
    this.config = {
      ...config,
      args: config.args || ['--text', '{text}', '--output', '{output}'],
      contentType: config.contentType || 'audio/wav',
      tempDir: config.tempDir || path.join(os.tmpdir(), 'zavorth-tts-local-cli'),
      timeoutMs: config.timeoutMs || 60_000,
    };
    this.voiceId = config.voiceId || null;
    this.spawnImpl = deps.spawn || spawn;
  }

  public async synthesize(input: SpeechSynthesisAdapterInput): Promise<SpeechSynthesisAdapterOutput> {
    await fs.promises.mkdir(this.config.tempDir, { recursive: true });
    const outputPath = path.join(this.config.tempDir, `tts-${Date.now()}-${randomUUID()}.${extensionForFormat(input.format)}`);
    const args = this.config.args.map((arg) => this.expandArg(arg, input, outputPath));

    await this.runCommand(args, outputPath);
    const data = await fs.promises.readFile(outputPath);
    await fs.promises.rm(outputPath, { force: true });

    return {
      data,
      sourceUrl: null,
      contentType: contentTypeForFormat(input.format) || this.config.contentType,
      sizeBytes: data.length,
      providerEvidence: {
        providerId: this.providerId,
        modelId: null,
        metadata: {
          command: this.config.command,
          voiceId: input.voiceId || this.voiceId,
          format: input.format,
          localCli: true,
          secretValuesSerialized: false,
        },
      },
    };
  }

  private runCommand(args: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = this.spawnImpl(this.config.command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch {
          // noop
        }
        reject(new Error(`${this.adapterId} local TTS command timed out.`));
      }, this.config.timeoutMs);

      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk || '');
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', async (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`${this.adapterId} local TTS command exited with ${String(code)}.${stderr ? ` stderr: ${stderr.trim()}` : ''}`));
          return;
        }
        if (!fs.existsSync(outputPath)) {
          reject(new Error(`${this.adapterId} local TTS command did not produce ${outputPath}.`));
          return;
        }
        resolve();
      });
    });
  }

  private expandArg(arg: string, input: SpeechSynthesisAdapterInput, outputPath: string): string {
    return arg
      .replace(/\{text\}/g, input.text)
      .replace(/\{output\}/g, outputPath)
      .replace(/\{voice\}/g, input.voiceId || this.voiceId || '')
      .replace(/\{format\}/g, input.format);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function readError(payload: unknown, status: number): string {
  return String(readPath(payload, 'error.message') || readPath(payload, 'message') || readPath(payload, 'error') || `HTTP ${status}`);
}

function normalizeSegments(payload: unknown, text: string, speakerLabels?: boolean): SpeechTranscriptSegment[] {
  const segments = readPath(payload, 'segments');
  if (Array.isArray(segments)) {
    return segments.map((segment, index) => ({
      text: stringOrEmpty(readPath(segment, 'text')) || text,
      startMs: numberOrNull(readPath(segment, 'startMs') || readPath(segment, 'start')),
      endMs: numberOrNull(readPath(segment, 'endMs') || readPath(segment, 'end')),
      speakerId: stringOrEmpty(readPath(segment, 'speakerId') || readPath(segment, 'speaker')) || (speakerLabels ? `speaker-${index + 1}` : null),
      confidence: numberOrNull(readPath(segment, 'confidence')),
    }));
  }
  return [{
    text,
    startMs: 0,
    endMs: null,
    speakerId: speakerLabels ? 'speaker-1' : null,
    confidence: numberOrNull(readPath(payload, 'confidence') || readPath(payload, 'results.channels.0.alternatives.0.confidence')),
  }];
}

function readPath(payload: unknown, pathExpression: string): unknown {
  return String(pathExpression || '')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, part) => {
      if (current === null || current === undefined) {
        return undefined;
      }
      if (Array.isArray(current) && /^\d+$/.test(part)) {
        return current[Number(part)];
      }
      if (typeof current === 'object') {
        return (current as Record<string, unknown>)[part];
      }
      return undefined;
    }, payload);
}

function stringOrEmpty(value: unknown): string {
  return String(value || '').trim();
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stripDataUrlPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/i, '');
}

function contentTypeForFormat(format: 'wav' | 'mp3' | 'ogg'): string {
  if (format === 'mp3') return 'audio/mpeg';
  if (format === 'ogg') return 'audio/ogg';
  return 'audio/wav';
}

function extensionForFormat(format: 'wav' | 'mp3' | 'ogg'): string {
  if (format === 'mp3') return 'mp3';
  if (format === 'ogg') return 'ogg';
  return 'wav';
}
