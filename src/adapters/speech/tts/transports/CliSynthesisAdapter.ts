import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import type { CliTtsProviderConfig } from '../TtsProviderConfigSchema.js';
import type {
  ISpeechSynthesisAdapter,
  TtsSynthesizeInput,
  TtsSynthesizeOutput,
  TtsTransportType,
  TtsVoiceInfo,
} from '../SpeechSynthesisContract.js';
import { ttsContentTypeFor, ttsEvidence } from '../TtsAdapterUtils.js';

type SpawnLike = typeof spawn;

type PlatformCommand = {
  command: string;
  args?: string[];
  voiceArgs?: string[];
  rateMode?: 'multiply' | 'delta';
  rateBase?: number;
};

/**
 * CLI transport adapter.
 * Runs a local synthesizer (macOS `say`, Linux `espeak`, Windows System.Speech,
 * MLX, ...) writing audio to a temp file, then returns the bytes. Text goes
 * through `{text}` or a `{textFile}` placeholder so scripts never embed user
 * input directly into a shell command.
 */
export class CliSynthesisAdapter implements ISpeechSynthesisAdapter {
  public readonly providerId: string;
  public readonly transport: TtsTransportType = 'cli';
  public readonly modelId: string | null;
  public readonly defaultVoiceId: string | null;

  private readonly config: CliTtsProviderConfig;
  private readonly spawnImpl: SpawnLike;
  private readonly tempDir: string;
  private readonly timeoutMs: number;

  constructor(config: CliTtsProviderConfig, deps: { spawn?: SpawnLike; tempDir?: string } = {}) {
    this.config = config;
    this.providerId = config.providerId;
    this.modelId = config.modelId || null;
    this.defaultVoiceId = config.defaultVoiceId || null;
    this.spawnImpl = deps.spawn || spawn;
    this.tempDir = deps.tempDir || path.join(os.tmpdir(), 'zavorth-tts-cli');
    this.timeoutMs = config.timeoutMs;
  }

  public isAvailable(): boolean {
    return this.platformCommand() !== null;
  }

  public listVoices(): TtsVoiceInfo[] {
    return this.config.voices;
  }

  public async synthesize(input: TtsSynthesizeInput): Promise<TtsSynthesizeOutput> {
    const platform = this.platformCommand();
    if (!platform) {
      throw new Error(`${this.providerId} cli adapter has no command for platform ${process.platform}.`);
    }
    if (!input.text) {
      throw new Error(`${this.providerId} cli adapter received empty text.`);
    }

    await fs.promises.mkdir(this.tempDir, { recursive: true });
    const outputFormat = this.config.outputFormat || 'mp3';
    const outputPath = path.join(this.tempDir, `tts-${Date.now()}-${randomUUID()}.${outputFormat}`);
    const textFilePath = path.join(this.tempDir, `text-${Date.now()}-${randomUUID()}.txt`);
    await fs.promises.writeFile(textFilePath, input.text, 'utf8');

    try {
      const args = this.buildArgs(platform, input, outputPath, textFilePath);
      await this.runCommand(platform.command, args);
      const audio = await fs.promises.readFile(outputPath);
      if (audio.length === 0) {
        throw new Error(`${this.providerId} cli adapter produced an empty audio file.`);
      }
      return {
        audio,
        format: outputFormat,
        contentType: this.config.responseContentType || ttsContentTypeFor(outputFormat),
        providerEvidence: ttsEvidence(this.providerId, this.modelId, {
          mode: 'batch',
          transport: 'cli',
          command: platform.command,
          platform: process.platform,
          voice: input.voiceId || null,
        }),
      };
    } finally {
      await fs.promises.rm(outputPath, { force: true });
      await fs.promises.rm(textFilePath, { force: true });
    }
  }

  private platformCommand(): PlatformCommand | null {
    const platform = process.platform as 'darwin' | 'linux' | 'win32';
    const override = this.config.platformCommands?.[platform];
    if (override) {
      return override;
    }
    return { command: this.config.command, args: this.config.args };
  }  private buildArgs(
    platform: PlatformCommand,
    input: TtsSynthesizeInput,
    outputPath: string,
    textFilePath: string,
  ): string[] {
    const voice = input.voiceId || this.defaultVoiceId || '';
    const speed = typeof input.speed === 'number' ? input.speed : 1.0;
    const pitch = typeof input.pitch === 'number' ? input.pitch : 0;
    const rate = this.resolveRate(speed, platform);
    const language = input.language || this.config.languageCode || 'en-US';

    const base = (platform.args || []).map((arg) => this.expandArg(arg, {
      text: input.text,
      textFilePath,
      outputPath,
      voice,
      language,
      rate: String(rate),
      pitch: String(pitch),
      speed: String(speed),
    }));

    if (voice && platform.voiceArgs && platform.voiceArgs.length > 0) {
      const voiceArgs = platform.voiceArgs.map((arg) => this.expandArg(arg, {
        text: input.text,
        textFilePath,
        outputPath,
        voice,
        language,
        rate: String(rate),
        pitch: String(pitch),
        speed: String(speed),
      }));
      const textIndex = base.findIndex((arg) => arg === input.text);
      if (textIndex >= 0) {
        base.splice(textIndex, 0, ...voiceArgs);
      } else {
        base.push(...voiceArgs);
      }
    }
    return base;
  }

  private resolveRate(speed: number, platform: PlatformCommand): number {
    const mode = platform.rateMode || this.config.rateMode;
    const base = platform.rateBase || this.config.rateBase;
    if (mode === 'delta') {
      return Math.round((speed - 1) * base);
    }
    return Math.round(base * speed);
  }

  private expandArg(
    arg: string,
    ctx: {
      text: string;
      textFilePath: string;
      outputPath: string;
      voice: string;
      language: string;
      rate: string;
      pitch: string;
      speed: string;
    },
  ): string {
    return arg
      .replace(/\{text\}/g, ctx.text)
      .replace(/\{textFile\}/g, ctx.textFilePath)
      .replace(/\{output\}/g, ctx.outputPath)
      .replace(/\{voice\}/g, ctx.voice)
      .replace(/\{language\}/g, ctx.language)
      .replace(/\{rate\}/g, ctx.rate)
      .replace(/\{pitch\}/g, ctx.pitch)
      .replace(/\{speed\}/g, ctx.speed);
  }

  private runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child: ChildProcess = this.spawnImpl(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stderr = '';
      const timer = setTimeout(() => {
        try {
          child.kill();
        } catch (error: unknown) {
          // noop
        }
        reject(new Error(`${this.providerId} cli adapter timed out after ${this.timeoutMs}ms.`));
      }, this.timeoutMs);

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
        resolve();
      });
    });
  }
}
