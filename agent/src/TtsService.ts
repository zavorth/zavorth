import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { t } from './i18n.js';

const execAsync = promisify(exec);

/**
 * TtsService - Local-first Text-to-Speech for Zavorth Agent.
 *
 * Prioritizes `edge-tts` locally, but exposes edge-only path
 * so that hybrid pipeline can try cloud voice before SAPI fallback.
 */
export class TtsService {
  private voice: string;
  private rate: string;
  private volume: string;

  constructor(options?: {
    voice?: string;
    rate?: string;
    volume?: string;
  }) {
    this.voice = options?.voice || 'en-US-GuyNeural';
    this.rate = options?.rate || '+0%';
    this.volume = options?.volume || '+0%';
  }

  /**
   * Converts text to audio and plays it.
   * Maintains legacy behavior: edge-tts first, SAPI as last resort fallback.
   */
  public async speak(text: string): Promise<string> {
    try {
      return await this.speakEdge(text);
    } catch (error: any) {
      console.error(t('tts_failed', { message: error.message }));

      try {
        return await this.speakSystemFallback(text);
      } catch {
        throw new Error(`No TTS method available: ${error.message}`);
      }
    }
  }

  /**
   * Premium local path: generates audio via edge-tts without system fallback.
   */
  public async speakEdge(text: string): Promise<string> {
    const audioPath = path.join(os.tmpdir(), `zavorth_tts_${Date.now()}.mp3`);

    console.log(`[TTS] Speaking: "${text.substring(0, 60)}${text.length > 60 ? '...' : ''}"`);

    await this.generateAudio(text, audioPath);
    await TtsService.playAudioFile(audioPath);

    return audioPath;
  }

  /**
   * Last resort local path to avoid blocking agent flow on Windows.
   */
  public async speakSystemFallback(text: string): Promise<string> {
    await this.speakViaSapi(text);
    return '';
  }

  /**
   * Generates audio via edge-tts CLI (Python).
   */
  private async generateAudio(text: string, outputPath: string): Promise<void> {
    const safeText = text
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/[<>]/g, '');

    await execAsync(
      `edge-tts --voice "${this.voice}" --rate="${this.rate}" --volume="${this.volume}" --text "${safeText}" --write-media "${outputPath}"`,
      { timeout: 15000 },
    );

    if (!fs.existsSync(outputPath)) {
      throw new Error(t('tts_no_audio'));
    }
  }

  /**
   * Plays audio file on local host.
   */
  public static async playAudioFile(filePath: string): Promise<void> {
    const platform = os.platform();

    if (platform === 'win32') {
      await execAsync(
        `powershell -NoProfile -Command "$player = New-Object System.Media.SoundPlayer; $player.SoundLocation = ''; Add-Type -AssemblyName presentationCore; $media = New-Object System.Windows.Media.MediaPlayer; $media.Open([Uri]'${filePath.replace(/\\/g, '\\\\')}'); $media.Play(); Start-Sleep -Seconds (([Math]::Ceiling($media.NaturalDuration.TimeSpan.TotalSeconds)) + 1); $media.Close()"`,
        { timeout: 30000 },
      );
      return;
    }

    if (platform === 'darwin') {
      await execAsync(`afplay "${filePath}"`, { timeout: 30000 });
      return;
    }

    await execAsync(`aplay "${filePath}"`, { timeout: 30000 });
  }

  /**
   * Fallback: speaks via System TTS (SAPI on Windows, say on macOS, spd-say/espeak on Linux).
   */
  private async speakViaSapi(text: string): Promise<void> {
    const platform = os.platform();
    const safeText = text.replace(/"/g, "'").replace(/\n/g, ' ');
    if (platform === 'win32') {
      await execAsync(
        `powershell -NoProfile -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${safeText}')"`,
        { timeout: 30000 },
      );
    } else if (platform === 'darwin') {
      await execAsync(`say "${safeText}"`, { timeout: 30000 });
    } else {
      try {
        await execAsync(`spd-say "${safeText}"`, { timeout: 15000 });
      } catch {
        try {
          await execAsync(`espeak "${safeText}"`, { timeout: 15000 });
        } catch {
          throw new Error('No system TTS engine available.');
        }
      }
    }
    console.log('[TTS] Played via System TTS (fallback).');
  }

  /**
   * Checks if edge-tts is available.
   */
  public async isAvailable(): Promise<{ available: boolean; method: string }> {
    try {
      await execAsync('edge-tts --help', { timeout: 5000 });
      return { available: true, method: 'edge-tts' };
    } catch {
      // continue
    }

    const platform = os.platform();
    if (platform === 'win32') {
      return { available: true, method: 'sapi-fallback' };
    }
    if (platform === 'darwin') {
      return { available: true, method: 'mac-say-fallback' };
    }
    try {
      await execAsync('which spd-say || which espeak', { timeout: 2000 });
      return { available: true, method: 'linux-say-fallback' };
    } catch {
      // continue
    }

    return { available: false, method: 'none' };
  }

  /**
   * Lists available edge-tts voices.
   */
  public async listVoices(language = 'pt'): Promise<string[]> {
    try {
      const { stdout } = await execAsync('edge-tts --list-voices', { timeout: 10000 });
      return stdout
        .split('\n')
        .filter((line) => line.toLowerCase().includes(language))
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Removes temporary audio file.
   */
  public cleanup(filePath: string): void {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore
    }
  }
}
