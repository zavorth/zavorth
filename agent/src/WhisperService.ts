import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { t } from './i18n.js';
import { asErrorLike } from '../../src/utils/errorLike.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

const execAsync = promisify(exec);

/**
 * WhisperService — Local Speech-to-Text via whisper.cpp.
 *
 * Transcribes audio to text using Whisper model running 100% offline.
 * Supports whisper.cpp (compiled) or fallback to Python whisper CLI.
 *
 * Recommended models for i5-13420H / 8GB RAM:
 *   tiny  → 75MB, ~500ms (good quality)
 *   base  → 145MB, ~1s (great quality) ← RECOMMENDED
 *   small → 465MB, ~3s (excellent quality)
 */
export class WhisperService {
  private whisperPath: string;
  private modelPath: string;
  private language: string;

  constructor(options?: {
    whisperPath?: string;
    modelPath?: string;
    language?: string;
  }) {
    // Search whisper.cpp in agent folder or PATH
    this.whisperPath = options?.whisperPath || 'whisper';
    this.modelPath = options?.modelPath || path.join(process.cwd(), 'models', 'ggml-base.bin');
    this.language = options?.language || 'pt';
  }

  /**
   * Dynamically updates the transcription target language.
   */
  public setLanguage(lang: string): void {
    this.language = lang;
  }

  /**
   * Transcribes an audio file to text.
   * @param audioPath Path to .wav file
   * @returns Transcribed text
   */
  public async transcribe(audioPath: string): Promise<string> {
    console.log(`[Whisper] 🧠 Transcribing: ${path.basename(audioPath)}...`);
    const startTime = Date.now();

    try {
      // Try whisper.cpp first (faster)
      return await this.transcribeViaCpp(audioPath);
    } catch {
      try {
        // Fallback: whisper via Python
        return await this.transcribeViaPython(audioPath);
      } catch (error: unknown) {
        const err = asErrorLike(error);
        throw new Error(t('whisper_no_method', { message: String(err.message || 'Unexpected error') }));
      }
    }
  }

  /**
   * Transcription via whisper.cpp (compiled binary).
   */
  private async transcribeViaCpp(audioPath: string): Promise<string> {
    const startTime = Date.now();

    // Check if binary exists
    const binaryNames = ['whisper', 'whisper.exe', 'main', 'main.exe'];
    let binaryPath = this.whisperPath;

    for (const name of binaryNames) {
      try {
        await execAsync(`where ${name}`, { timeout: 2000 });
        binaryPath = name;
        break;
      } catch { continue; }
    }

    const { stdout, stderr } = await execAsync(
      `"${binaryPath}" -m "${this.modelPath}" -f "${audioPath}" -l ${this.language} --no-timestamps -otxt`,
      { timeout: 30000 },
    );

    // whisper.cpp writes output to stdout or .txt file
    let text = stdout.trim();

    // If empty, try reading generated .txt file
    if (!text) {
      const txtPath = audioPath.replace(/\.\w+$/, '.txt');
      if (fs.existsSync(txtPath)) {
        text = fs.readFileSync(txtPath, 'utf-8').trim();
        fs.unlinkSync(txtPath); // cleanup
      }
    }

    if (!text) {
      throw new Error(t('whisper_no_transcript'));
    }

    const duration = Date.now() - startTime;
    console.log(`[Whisper] ✅ Transcribed in ${duration}ms: "${text}"`);
    return text;
  }

  /**
   * Fallback: transcription via Python whisper CLI.
   */
  private async transcribeViaPython(audioPath: string): Promise<string> {
    const { stdout } = await execAsync(
      `python -m whisper "${audioPath}" --model base --language ${this.language} --output_format txt --output_dir "${path.dirname(audioPath)}"`,
      { timeout: 60000 },
    );

    // Read generated .txt file
    const txtPath = audioPath.replace(/\.\w+$/, '.txt');
    if (fs.existsSync(txtPath)) {
      const text = fs.readFileSync(txtPath, 'utf-8').trim();
      fs.unlinkSync(txtPath);
      console.log(`[Whisper] ✅ Transcribed (Python): "${text}"`);
      return text;
    }

    // Try extracting from stdout
    const text = stdout.trim();
    if (text) return text;

    throw new Error(t('whisper_python_no_transcript'));
  }

  /**
   * Verifies if Whisper is available (any method).
   */
  public async isAvailable(): Promise<{ available: boolean; method: string }> {
    // Check whisper.cpp
    try {
      await execAsync('where whisper', { timeout: 2000 });
      return { available: true, method: 'whisper.cpp' };
    } catch { /* continue */ }

    // Check Python whisper
    try {
      await execAsync('python -m whisper --help', { timeout: 5000 });
      return { available: true, method: 'python-whisper' };
    } catch { /* continue */ }

    return { available: false, method: 'none' };
  }
}
