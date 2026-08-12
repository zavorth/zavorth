import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawn, spawnSync, type ChildProcess } from 'child_process';export interface WhisperConfig {
  modelPath: string;
  language: string;
  binaryPath: string | null;
  tempDir: string;
  additionalArgs: string[];
  microphoneCommand: string | null;
  microphoneArgs: string[];
}

type SpawnLike = typeof spawn;
type SpawnSyncLike = typeof spawnSync;

type LocalVoiceDictationDeps = {
  spawn?: SpawnLike;
  spawnSync?: SpawnSyncLike;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  readFileSync?: typeof fs.readFileSync;
  rmSync?: typeof fs.rmSync;
};

export class LocalVoiceDictation {
  private isRecording = false;
  private recorderProcess: ChildProcess | null = null;
  private readonly config: WhisperConfig;
  private readonly spawnImpl: SpawnLike;
  private readonly spawnSyncImpl: SpawnSyncLike;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly rmSyncImpl: typeof fs.rmSync;

  constructor(config?: Partial<WhisperConfig>, deps: LocalVoiceDictationDeps = {}) {
    this.config = {
      modelPath:
        config?.modelPath
        || process.env.ZAVORTH_WHISPER_MODEL_PATH
        || path.join(process.cwd(), 'models', 'whisper', 'ggml-tiny.bin'),
      language:
        config?.language
        || process.env.ZAVORTH_WHISPER_LANGUAGE
        || 'pt',
      binaryPath:
        config?.binaryPath
        ?? process.env.ZAVORTH_WHISPER_BINARY
        ?? null,
      tempDir:
        config?.tempDir
        || process.env.ZAVORTH_WHISPER_TEMP_DIR
        || path.join(os.tmpdir(), 'zavorth-whisper'),
      additionalArgs:
        config?.additionalArgs
        || this.readArgList(process.env.ZAVORTH_WHISPER_ARGS),
      microphoneCommand:
        config?.microphoneCommand
        ?? process.env.ZAVORTH_VOICE_MIC_COMMAND
        ?? null,
      microphoneArgs:
        config?.microphoneArgs
        || this.readArgList(process.env.ZAVORTH_VOICE_MIC_ARGS),
    };
    this.spawnImpl = deps.spawn || spawn;
    this.spawnSyncImpl = deps.spawnSync || spawnSync;
    this.existsSyncImpl = deps.existsSync || fs.existsSync;
    this.mkdirSyncImpl = deps.mkdirSync || fs.mkdirSync;
    this.writeFileSyncImpl = deps.writeFileSync || fs.writeFileSync;
    this.readFileSyncImpl = deps.readFileSync || fs.readFileSync;
    this.rmSyncImpl = deps.rmSync || fs.rmSync;
  }

  public async transcribeBuffer(audioBinary: Buffer): Promise<string> {
    if (!Buffer.isBuffer(audioBinary) || audioBinary.length === 0) {
      throw new Error('LocalVoiceDictation requires a non-empty WAV audio buffer for transcription.');
    }

    const binaryPath = this.resolveWhisperBinaryPath();
    const modelPath = this.resolveModelPath();
    this.mkdirSyncImpl(this.config.tempDir, { recursive: true });

    const basePath = path.join(this.config.tempDir, `voice-${Date.now()}-${randomUUID()}`);
    const audioPath = `${basePath}.wav`;
    const outputBase = basePath;
    const outputTxtPath = `${outputBase}.txt`;
    this.writeFileSyncImpl(audioPath, audioBinary);

    try {
      const transcript = await this.runWhisper(binaryPath, modelPath, audioPath, outputBase, outputTxtPath);
      if (!transcript) {
        throw new Error('Whisper returned an empty transcription.');
      }
      return transcript;
    } finally {
      this.safeDelete(audioPath);
      this.safeDelete(outputTxtPath);
      this.safeDelete(`${outputBase}.json`);
      this.safeDelete(`${outputBase}.srt`);
      this.safeDelete(`${outputBase}.vtt`);
    }
  }

  public async transcribeFile(audioPath: string): Promise<string> {
    const normalizedPath = path.resolve(String(audioPath || '').trim());
    if (!normalizedPath || !this.existsSyncImpl(normalizedPath)) {
      throw new Error(`Audio file not found for local Whisper: ${normalizedPath}`);
    }

    const binaryPath = this.resolveWhisperBinaryPath();
    const modelPath = this.resolveModelPath();
    this.mkdirSyncImpl(this.config.tempDir, { recursive: true });

    const outputBase = path.join(this.config.tempDir, `voice-${Date.now()}-${randomUUID()}`);
    const outputTxtPath = `${outputBase}.txt`;

    try {
      const transcript = await this.runWhisper(binaryPath, modelPath, normalizedPath, outputBase, outputTxtPath);
      if (!transcript) {
        throw new Error('Whisper returned an empty transcription.');
      }
      return transcript;
    } finally {
      this.safeDelete(outputTxtPath);
      this.safeDelete(`${outputBase}.json`);
      this.safeDelete(`${outputBase}.srt`);
      this.safeDelete(`${outputBase}.vtt`);
    }
  }

  public async startContinuousMicrophoneRecord(onTranscript: (text: string) => void): Promise<void> {
    if (this.isRecording) {
      return;
    }

    const command = String(this.config.microphoneCommand || '').trim();
    if (!command) {
      throw new Error(
        'Continuous voice capture requires ZAVORTH_VOICE_MIC_COMMAND configured for an external microphone/transcription worker.',
      );
    }

    this.isRecording = true;
    const child = this.spawnImpl(command, [...this.config.microphoneArgs], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.recorderProcess = child;

    let stdoutBuffer = '';
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk) => {
      stdoutBuffer += String(chunk || '');
      const lines = stdoutBuffer.split(/\r?\n/g);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const text = String(line || '').trim();
        if (text) {
          onTranscript(text);
        }
      }
    });

    child.once('error', () => {
      this.isRecording = false;
      this.recorderProcess = null;
    });

    child.once('close', () => {
      const trailing = stdoutBuffer.trim();
      if (trailing) {
        onTranscript(trailing);
      }
      this.isRecording = false;
      this.recorderProcess = null;
    });
  }

  public stopRecording(): void {
    this.isRecording = false;
    if (this.recorderProcess) {
      try {
        this.recorderProcess.kill();
      } catch (error: unknown) {// noop
      }
      this.recorderProcess = null;
    }
  }

  private async runWhisper(
    binaryPath: string,
    modelPath: string,
    audioPath: string,
    outputBase: string,
    outputTxtPath: string,
  ): Promise<string> {
    const args = [
      '-m',
      modelPath,
      '-f',
      audioPath,
      '-l',
      this.config.language,
      '-otxt',
      '-of',
      outputBase,
      '-np',
      ...this.config.additionalArgs,
    ];

    return await new Promise<string>((resolve, reject) => {
      const child = this.spawnImpl(binaryPath, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      child.stdout?.setEncoding('utf8');
      child.stderr?.setEncoding('utf8');
      child.stdout?.on('data', (chunk) => {
        stdout += String(chunk || '');
      });
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk || '');
      });

      child.once('error', (error) => {
        reject(
          new Error(
            `Failed to start local Whisper at "${binaryPath}": ${error instanceof Error ? error.message : String(error)}`,
          ),
        );
      });

      child.once('close', (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `local Whisper exited with code ${String(code)}.${stderr ? ` stderr: ${stderr.trim()}` : ''}`,
            ),
          );
          return;
        }

        if (this.existsSyncImpl(outputTxtPath)) {
          const transcript = this.readFileSyncImpl(outputTxtPath, 'utf8').trim();
          resolve(transcript);
          return;
        }

        const normalizedStdout = stdout.trim();
        if (normalizedStdout) {
          resolve(normalizedStdout);
          return;
        }

        resolve('');
      });
    });
  }

  private resolveModelPath(): string {
    const modelPath = path.resolve(this.config.modelPath);
    if (!this.existsSyncImpl(modelPath)) {
      throw new Error(
        `Whisper model not found at "${modelPath}". Configure ZAVORTH_WHISPER_MODEL_PATH with a real model, for example ggml-tiny.bin.`,
      );
    }
    return modelPath;
  }

  private resolveWhisperBinaryPath(): string {
    const configuredPath = String(this.config.binaryPath || '').trim();
    const candidates = [
      configuredPath,
      path.join(process.cwd(), 'third_party', 'whisper.cpp', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(process.cwd(), 'third_party', 'whisper.cpp', 'build', 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(process.cwd(), 'third_party', 'whisper.cpp', 'build', 'bin', 'Release', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(process.cwd(), 'third_party', 'whisper.cpp', process.platform === 'win32' ? 'main.exe' : 'main'),
      path.join(process.cwd(), 'third_party', 'whisper.cpp', 'build', 'bin', process.platform === 'win32' ? 'main.exe' : 'main'),
      path.join(process.cwd(), 'third_party', 'whisper.cpp', 'build', 'bin', 'Release', process.platform === 'win32' ? 'main.exe' : 'main'),
      this.findExecutableOnPath(process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      this.findExecutableOnPath(process.platform === 'win32' ? 'main.exe' : 'main'),
    ]
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);

    for (const candidate of candidates) {
      if (this.existsSyncImpl(candidate)) {
        return path.resolve(candidate);
      }
    }

    throw new Error(
      'local Whisper binary not found. Configure ZAVORTH_WHISPER_BINARY or provision third_party/whisper.cpp with whisper-cli/main.',
    );
  }

  private findExecutableOnPath(commandName: string): string | null {
    const locator = process.platform === 'win32' ? 'where.exe' : 'which';
    const result = this.spawnSyncImpl(locator, [commandName], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (result.status !== 0) {
      return null;
    }

    const stdout = String(result.stdout || '').trim();
    const firstLine = stdout.split(/\r?\n/g).map((line) => line.trim()).find(Boolean);
    return firstLine || null;
  }

  private readArgList(rawValue: string | undefined): string[] {
    const raw = String(rawValue || '').trim();
    if (!raw) {
      return [];
    }
    return raw.split(/\s+/g).map((entry) => entry.trim()).filter(Boolean);
  }

  private safeDelete(targetPath: string): void {
    try {
      if (this.existsSyncImpl(targetPath)) {
        this.rmSyncImpl(targetPath, { force: true });
      }
    } catch (error: unknown) {// noop
    }
  }
}
