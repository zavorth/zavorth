import type { WebsocketSttProviderConfig } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttEvidence,
  sttReadPath,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type WebSocketLike = {
  addEventListener(_type: 'message', _listener: (_event: { data: unknown }) => void): void;
  addEventListener(_type: 'close', _listener: (_event: { code?: number; reason?: string }) => void): void;
  addEventListener(_type: 'error', _listener: (_event: { message?: string }) => void): void;
  send(_data: string): void;
  close(): void;
};

type WebSocketCtor = {
  new (_url: string, _protocols?: string[] | string): WebSocketLike;
};

/**
 * WebSocket transport adapter.
 * Streams audio bytes as base64 frames to a live transcription socket and
 * collects transcript chunks until the final message is received.
 */
export class WebsocketTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'websocket';
  public readonly modelId: string | null;

  private readonly config: WebsocketSttProviderConfig;
  private readonly wsCtor: WebSocketCtor | null;
  private readonly timeoutMs: number;

  constructor(
    config: WebsocketSttProviderConfig,
    deps: { WebSocket?: WebSocketCtor } = {},
  ) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.wsCtor = deps.WebSocket || (globalThis as { WebSocket?: WebSocketCtor }).WebSocket || null;
    this.timeoutMs = config.timeoutMs;
  }

  public isAvailable(): boolean {
    return this.wsCtor !== null;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    if (!this.wsCtor) {
      throw new Error(`${this.providerId} websocket adapter requires a WebSocket runtime.`);
    }
    if (input.audio.length === 0) {
      throw new Error(`${this.providerId} websocket adapter received empty audio.`);
    }

    return new Promise<SttTranscribeOutput>((resolve, reject) => {
      const socket = this.wsCtor
        ? new this.wsCtor(this.config.wsUrl, this.config.protocol)
        : null;
      if (!socket) {
        reject(new Error(`${this.providerId} websocket adapter could not connect.`));
        return;
      }

      const chunks: string[] = [];
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.close();
          reject(new Error(`${this.providerId} websocket adapter timed out after ${this.timeoutMs}ms.`));
        }
      }, this.timeoutMs);

      const finish = (output: SttTranscribeOutput) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.close();
        resolve(output);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket.close();
        } catch (closeError: unknown) {
          // noop
        }
        reject(error);
      };

      socket.addEventListener('message', (event) => {
        const raw = typeof event.data === 'string' ? event.data : '';
        if (!raw) return;
        try {
          const payload = JSON.parse(raw);
          const transcript = sttStringOrEmpty(sttReadPath(payload, this.config.transcriptPath));
          const finalFlag = Boolean(
            sttReadPath(payload, 'final') === true
            || sttReadPath(payload, 'isFinal') === true
            || sttReadPath(payload, 'type') === 'final',
          );
          if (transcript) {
            chunks.push(transcript);
          }
          if (finalFlag) {
            const text = chunks.join(' ');
            finish({
              text,
              language: null,
              segments: sttBuildSegments({}, text, input.speakerLabels),
              providerEvidence: sttEvidence(this.providerId, this.modelId, {
                mode: 'streaming',
                transport: 'websocket',
                chunkCount: chunks.length,
              }),
            });
          }
        } catch (parseError: unknown) {
          fail(new Error(`${this.providerId} websocket adapter received invalid JSON.`));
        }
      });
      socket.addEventListener('close', () => {
        if (settled) return;
        const text = chunks.join(' ');
        if (text) {
          finish({
            text,
            language: null,
            segments: sttBuildSegments({}, text, input.speakerLabels),
            providerEvidence: sttEvidence(this.providerId, this.modelId, {
              mode: 'streaming',
              transport: 'websocket',
              chunkCount: chunks.length,
            }),
          });
          return;
        }
        fail(new Error(`${this.providerId} websocket adapter closed without a transcript.`));
      });
      socket.addEventListener('error', () => {
        fail(new Error(`${this.providerId} websocket adapter error.`));
      });

      const base64 = input.audio.toString('base64');
      const frame: Record<string, unknown> = {
        audio: base64,
        contentType: input.contentType,
        model: this.modelId || undefined,
        language: input.languageHint || undefined,
        type: 'transcribe',
      };
      if (input.wordTimestamps) {
        frame.wordTimestamps = true;
      }
      if (typeof input.temperature === 'number') {
        frame.temperature = input.temperature;
      }
      if (input.prompt) {
        frame.prompt = input.prompt;
      }
      socket.send(JSON.stringify(frame));
    });
  }
}
