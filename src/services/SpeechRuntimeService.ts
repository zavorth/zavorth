import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import type {
  SpeechArtifactRef,
  SpeechPolicyDecision,
  SpeechProviderEvidence,
  SpeechSynthesizeRequest,
  SpeechSynthesizeResult,
  SpeechTranscriptSegment,
  SpeechTranscribeRequest,
  SpeechTranscribeResult,
} from '../contracts/SpeechContract.js';
import { SPEECH_CONTRACT_VERSION } from '../contracts/SpeechContract.js';
import type {
  ISpeechSynthesisLiveAdapter,
  ISpeechTranscriptionLiveAdapter,
  SpeechSynthesisAdapterOutput,
} from '../adapters/speech/SpeechVoiceLiveAdapters.js';

type SpeechRuntimeServiceOptions = {
  now?: () => Date;
  artifactDir?: string;
  transcribeAdapter?: ISpeechTranscriptionLiveAdapter | null;
  synthesizeAdapter?: ISpeechSynthesisLiveAdapter | null;
  fetchImpl?: typeof fetch;
};

export class SpeechRuntimeService {
  private readonly now: () => Date;
  private readonly artifactDir: string;
  private readonly transcribeAdapter: ISpeechTranscriptionLiveAdapter | null;
  private readonly synthesizeAdapter: ISpeechSynthesisLiveAdapter | null;
  private readonly fetchImpl: typeof fetch | null;

  constructor(options: SpeechRuntimeServiceOptions = {}) {
    this.now = options.now || (() => new Date());
    this.artifactDir = options.artifactDir || path.join(config.dataDir, 'artifacts', 'speech');
    this.transcribeAdapter = options.transcribeAdapter || null;
    this.synthesizeAdapter = options.synthesizeAdapter || null;
    this.fetchImpl = options.fetchImpl || globalThis.fetch || null;
  }

  public transcribe(request: SpeechTranscribeRequest): SpeechTranscribeResult {
    const processedAt = this.now().toISOString();
    if (!request.source?.artifactId || !request.source.storageRef) {
      return this.transcribeError('Audio artifact source is required.', processedAt);
    }

    const artifactKey = this.normalizeId(request.source.artifactId);
    return {
      ok: true,
      contractVersion: SPEECH_CONTRACT_VERSION,
      transcriptArtifactId: `speech.transcript.${artifactKey}`,
      text: `Dry transcript for ${request.source.artifactId}.`,
      segments: [
        {
          text: `Dry transcript for ${request.source.artifactId}.`,
          startMs: 0,
          endMs: null,
          speakerId: request.speakerLabels ? 'speaker-1' : null,
          confidence: null,
        },
      ],
      policyDecision: this.policy('transcription uses artifact input only', 'artifact'),
      providerEvidence: this.providerEvidence('speech-transcribe-dry-run', request.languageHint || null),
      receiptId: `speech.transcribe.${artifactKey}.receipt`,
      processedAt,
      error: null,
    };
  }

  public synthesize(request: SpeechSynthesizeRequest): SpeechSynthesizeResult {
    const processedAt = this.now().toISOString();
    const text = String(request.text || '').trim();
    if (!text) {
      return this.synthesizeError('Text is required for speech synthesis.', processedAt);
    }

    const format = request.format || 'wav';
    const artifactId = `speech.audio.${this.normalizeId(text).slice(0, 32) || 'output'}.${format}`;
    return {
      ok: true,
      contractVersion: SPEECH_CONTRACT_VERSION,
      audioArtifact: {
        artifactId,
        contentType: this.contentType(format),
        storageRef: `artifact://${artifactId}`,
      },
      policyDecision: this.policy('synthesis output is artifact-first', 'artifact'),
      providerEvidence: this.providerEvidence('speech-synthesize-dry-run', request.voiceId || null),
      receiptId: `${artifactId}.receipt`,
      processedAt,
      error: null,
    };
  }

  public async transcribeLive(request: SpeechTranscribeRequest): Promise<SpeechTranscribeResult> {
    const processedAt = this.now().toISOString();
    if (!this.transcribeAdapter) {
      return this.transcribeError('Live transcription adapter is required.', processedAt);
    }
    if (!request.source?.artifactId || !request.source.storageRef) {
      return this.transcribeError('Audio artifact source is required.', processedAt);
    }

    try {
      const audio = await this.readArtifactBytes(request.source);
      const output = await this.transcribeAdapter.transcribe({
        source: request.source,
        audio,
        languageHint: request.languageHint || null,
        speakerLabels: request.speakerLabels,
        mode: 'batch',
      });
      const transcriptArtifact = await this.storeTranscriptArtifact(output.text, output.segments, request);
      return {
        ok: true,
        contractVersion: SPEECH_CONTRACT_VERSION,
        transcriptArtifactId: transcriptArtifact.artifactId,
        transcriptArtifact,
        text: output.text,
        segments: output.segments,
        policyDecision: this.policy('transcription uses artifact input and stores transcript output', 'artifact'),
        providerEvidence: output.providerEvidence,
        receiptId: `${transcriptArtifact.artifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error) {
      return this.transcribeError(error instanceof Error ? error.message : String(error), processedAt);
    }
  }

  public async synthesizeLive(request: SpeechSynthesizeRequest): Promise<SpeechSynthesizeResult> {
    const processedAt = this.now().toISOString();
    const text = String(request.text || '').trim();
    if (!text) {
      return this.synthesizeError('Text is required for speech synthesis.', processedAt);
    }
    if (!this.synthesizeAdapter) {
      return this.synthesizeError('Live speech synthesis adapter is required.', processedAt);
    }

    try {
      const format = request.format || 'wav';
      const output = await this.synthesizeAdapter.synthesize({
        text,
        voiceId: request.voiceId || null,
        format,
      });
      const audioArtifact = await this.storeAudioArtifact(output, format);
      return {
        ok: true,
        contractVersion: SPEECH_CONTRACT_VERSION,
        audioArtifact,
        policyDecision: this.policy('synthesis output is stored as a governed audio artifact', 'artifact'),
        providerEvidence: output.providerEvidence,
        receiptId: `${audioArtifact.artifactId}.receipt`,
        processedAt,
        error: null,
      };
    } catch (error) {
      return this.synthesizeError(error instanceof Error ? error.message : String(error), processedAt);
    }
  }

  private transcribeError(message: string, processedAt: string): SpeechTranscribeResult {
    return {
      ok: false,
      contractVersion: SPEECH_CONTRACT_VERSION,
      transcriptArtifactId: null,
      text: '',
      segments: [],
      policyDecision: this.policy(message, 'ephemeral'),
      providerEvidence: null,
      receiptId: 'speech.transcribe.blocked.receipt',
      processedAt,
      error: message,
    };
  }

  private synthesizeError(message: string, processedAt: string): SpeechSynthesizeResult {
    return {
      ok: false,
      contractVersion: SPEECH_CONTRACT_VERSION,
      audioArtifact: null,
      policyDecision: this.policy(message, 'ephemeral'),
      providerEvidence: null,
      receiptId: 'speech.synthesize.blocked.receipt',
      processedAt,
      error: message,
    };
  }

  private policy(reason: string, retention: SpeechPolicyDecision['retention']): SpeechPolicyDecision {
    return {
      allowed: true,
      reason,
      consentRequired: false,
      retention,
    };
  }

  private providerEvidence(providerId: string, hint: string | null): SpeechProviderEvidence {
    return {
      providerId,
      modelId: null,
      metadata: {
        dryRun: true,
        hint,
        secretValuesSerialized: false,
      },
    };
  }

  private contentType(format: NonNullable<SpeechSynthesizeRequest['format']>): SpeechArtifactRef['contentType'] {
    if (format === 'mp3') {
      return 'audio/mpeg';
    }
    if (format === 'ogg') {
      return 'audio/ogg';
    }
    return 'audio/wav';
  }

  private async readArtifactBytes(source: SpeechArtifactRef): Promise<Buffer> {
    const storageRef = String(source.storageRef || '').trim();
    if (!storageRef || storageRef.startsWith('artifact://')) {
      throw new Error(`Live transcription requires a readable local artifact path, received ${storageRef || 'empty storageRef'}.`);
    }
    const filePath = storageRef.startsWith('file://')
      ? new URL(storageRef)
      : path.resolve(storageRef);
    return await fs.promises.readFile(filePath);
  }

  private async storeTranscriptArtifact(
    text: string,
    segments: SpeechTranscriptSegment[],
    request: SpeechTranscribeRequest,
  ): Promise<SpeechArtifactRef> {
    await fs.promises.mkdir(this.artifactDir, { recursive: true });
    const artifactId = `speech.transcript.${this.normalizeId(request.source.artifactId)}.${randomUUID()}`;
    const storageRef = path.join(this.artifactDir, `${artifactId}.json`);
    await fs.promises.writeFile(
      storageRef,
      JSON.stringify({
        artifactId,
        sourceArtifactId: request.source.artifactId,
        text,
        segments,
        languageHint: request.languageHint || null,
        generatedAt: this.now().toISOString(),
        secretValuesSerialized: false,
      }, null, 2),
      'utf8',
    );
    return {
      artifactId,
      contentType: 'application/json',
      storageRef,
    };
  }

  private async storeAudioArtifact(
    output: SpeechSynthesisAdapterOutput,
    format: NonNullable<SpeechSynthesizeRequest['format']>,
  ): Promise<SpeechArtifactRef> {
    await fs.promises.mkdir(this.artifactDir, { recursive: true });
    const artifactId = `speech.audio.${randomUUID()}.${format}`;
    const storageRef = path.join(this.artifactDir, artifactId);
    if (output.data) {
      await fs.promises.writeFile(storageRef, output.data);
    } else if (output.sourceUrl) {
      await this.downloadToFile(output.sourceUrl, storageRef);
    } else {
      throw new Error('Speech synthesis adapter returned no data and no sourceUrl.');
    }
    return {
      artifactId,
      contentType: output.contentType || this.contentType(format),
      storageRef,
    };
  }

  private async downloadToFile(url: string, targetPath: string): Promise<void> {
    if (!this.fetchImpl) {
      throw new Error('fetch is required to download speech artifact output.');
    }
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`Speech artifact download failed: HTTP ${response.status}`);
    }
    await fs.promises.writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
  }

  private normalizeId(value: string): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
