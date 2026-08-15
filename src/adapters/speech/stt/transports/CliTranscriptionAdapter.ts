import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import type { CliSttProviderConfig } from '../SttProviderConfigSchema.js';
import type {
  ISpeechTranscriptionAdapter,
  SttTranscribeInput,
  SttTranscribeOutput,
  SttTransportType,
} from '../SpeechTranscriptionContract.js';
import {
  sttBuildSegments,
  sttBuildWords,
  sttEvidence,
  sttReadPath,
  sttStringOrEmpty,
} from '../SttAdapterUtils.js';

type SpawnLike = typeof spawn;

/**
 * CLI transport adapter.
 * Runs a local command-line transcriber (whisper.cpp, faster-whisper, ...) and
 * reads the transcript from stdout, a file or a JSON/plain output path.
 */
export class CliTranscriptionAdapter implements ISpeechTranscriptionAdapter {
  public readonly providerId: string;
  public readonly transport: SttTransportType = 'cli';
  public readonly modelId: string | null;

  private readonly config: CliSttProviderConfig;
  private readonly spawnImpl: SpawnLike;
  private readonly tempDir: string;
  private readonly timeoutMs: number;

  constructor(config: CliSttProviderConfig, deps: { spawn?: SpawnLike; tempDir?: string } = {}) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.spawnImpl = deps.spawn || spawn;
    this.tempDir = deps.tempDir || path.join(os.tmpdir(), 'zavorth-stt-cli');
    this.timeoutMs = config.timeoutMs;
  }

  public isAvailable(): boolean {
    return true;
  }

  public async transcribe(input: SttTranscribeInput): Promise<SttTranscribeOutput> {
    await fs.promises.mkdir(this.tempDir, { recursive: true });
    const audioPath = path.join(this.tempDir, `audio-${Date.now()}-${randomUUID()}.${extensionFor(input.contentType)}`);
    await fs.promises.writeFile(audioPath, input.audio);

    try {
      const baseArgs = input.wordTimestamps && this.config.wordTimestampArgs
        ? this.config.wordTimestampArgs
        : this.config.args || [];
      const args = baseArgs.map((arg) =>
        this.expandArg(arg, {
          audioPath,
          language: input.languageHint || '',
          prompt: input.prompt || '',
          temperature: typeof input.temperature === 'number' ? String(input.temperature) : '',
        }));
      const stdout = await this.runCommand(args);

      const payload = this.parseJsonOutput(stdout);
      const text = this.readTranscript(stdout, payload);
      if (!text) {
        throw new Error(`${this.providerId} cli adapter returned an empty transcript.`);
      }

      return {
        text,
        language: input.languageHint || null,
        segments: payload
          ? sttBuildSegments(payload, text, input.speakerLabels, this.config.segmentsPath, this.config.timeUnit)
          : sttBuildSegments({ segments: [{ text }] }, text, input.speakerLabels),
        words: payload ? sttBuildWords(payload, this.config.wordsPath, this.config.timeUnit) : [],
        providerEvidence: sttEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'cli',
          command: this.config.command,
          languageHint: input.languageHint || null,
        }),
      };
    } finally {
      await fs.promises.rm(audioPath, { force: true });
    }
  }

  private async runCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = this.spawnImpl(this.config.command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch (error: unknown) {
          // noop
        }
        reject(new Error(`${this.providerId} cli adapter timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

      child.stdout?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk || '');
      });
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk || '');
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`${this.providerId} cli adapter exited with ${String(code)}.${stderr ? ` stderr: ${stderr.trim()}` : ''}`));
          return;
        }
        resolve(stdout);
      });
    });
  }

  private readTranscript(stdout: string, payload: unknown): string {
    if (this.config.transcriptPath && this.config.transcriptPath !== 'text') {
      const fromPath = payload ? sttReadPath(payload, this.config.transcriptPath) : undefined;
      if (fromPath) {
        return sttStringOrEmpty(fromPath);
      }
    }
    if (payload) {
      const direct = sttReadPath(payload, 'text');
      if (direct) {
        return sttStringOrEmpty(direct);
      }
      const segments = sttReadPath(payload, this.config.segmentsPath);
      if (Array.isArray(segments)) {
        const joined = segments
          .map((segment) => sttStringOrEmpty(sttReadPath(segment, 'text')))
          .filter(Boolean)
          .join(' ');
        if (joined) {
          return joined;
        }
      }
    }
    return sttStringOrEmpty(stdout);
  }

  private parseJsonOutput(stdout: string): unknown {
    if (this.config.transcriptPath === 'text' && !this.config.wordsPath && !this.config.segmentsPath) {
      return null;
    }
    try {
      return JSON.parse(stdout);
    } catch (error: unknown) {
      return null;
    }
  }

  private expandArg(arg: string, ctx: { audioPath: string; language: string; prompt: string; temperature: string }): string {
    return arg
      .replace(/\{audio\}/g, ctx.audioPath)
      .replace(/\{language\}/g, ctx.language)
      .replace(/\{prompt\}/g, ctx.prompt)
      .replace(/\{temperature\}/g, ctx.temperature);
  }
}

function extensionFor(contentType: string): string {
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('ogg') || contentType.includes('opus')) return 'ogg';
  if (contentType.includes('flac')) return 'flac';
  return 'bin';
}
