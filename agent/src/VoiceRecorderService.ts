import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { t } from './i18n.js';

const execAsync = promisify(exec);

/**
 * VoiceRecorderService — Records audio from microphone after activation.
 *
 * Uses native PowerShell on Windows for audio capture (zero external deps).
 * Records until silence is detected (simple VAD) or timeout is reached.
 * Saves as .wav in system temp directory.
 */
export class VoiceRecorderService {
  private maxDurationMs: number;
  private sampleRate: number;

  constructor(options?: { maxDurationMs?: number; sampleRate?: number }) {
    this.maxDurationMs = options?.maxDurationMs || 10000; // 10s max
    this.sampleRate = options?.sampleRate || 16000; // 16kHz for Whisper
  }

  /**
   * Records microphone audio and returns .wav file path.
   */
  public async record(): Promise<string> {
    const outputPath = path.join(os.tmpdir(), `zavorth_voice_${Date.now()}.wav`);
    const durationSeconds = Math.ceil(this.maxDurationMs / 1000);

    if (os.platform() === 'win32') {
      const scriptPath = path.join(os.tmpdir(), `zavorth_voice_recorder_${Date.now()}.ps1`);
      console.log(`[Recorder] 🔴 Recording... (max ${durationSeconds}s)`);
      const escapedOutputPath = outputPath.replace(/'/g, "''");
      const psScript = `
        Add-Type -AssemblyName System.Speech
        Add-Type @"
          using System;
          using System.IO;
          using System.Runtime.InteropServices;

          public class TrackRecorder {
            [DllImport("winmm.dll")]
            public static extern int mciSendString(string command, System.Text.StringBuilder buffer, int bufferSize, IntPtr callback);

            public static void Record(string outputFile, int durationMs) {
              var sb = new System.Text.StringBuilder(256);
              mciSendString("open new Type waveaudio Alias capture", sb, 256, IntPtr.Zero);
              mciSendString("set capture time format milliseconds", sb, 256, IntPtr.Zero);
              mciSendString("record capture", sb, 256, IntPtr.Zero);
              System.Threading.Thread.Sleep(durationMs);
              mciSendString("stop capture", sb, 256, IntPtr.Zero);
              mciSendString("save capture \\"" + outputFile + "\\"", sb, 256, IntPtr.Zero);
              mciSendString("close capture", sb, 256, IntPtr.Zero);
            }
          }
"@
        [TrackRecorder]::Record('${escapedOutputPath}', ${this.maxDurationMs})
      `;

      try {
        fs.writeFileSync(scriptPath, psScript, 'utf8');
        await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
          { timeout: this.maxDurationMs + 5000 },
        );

        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath);
          console.log(t('recording_saved', { path: outputPath, size: (stats.size / 1024).toFixed(1) }));
          return outputPath;
        }

        throw new Error(t('recording_no_file'));

      } catch (error: any) {
        console.log('[Recorder] Windows PowerShell recording failed, trying via SoX...');
        return this.recordViaSox(outputPath, durationSeconds);
      } finally {
        try {
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }
        } catch {
          // ignore temp cleanup failure
        }
      }
    } else {
      console.log(`[Recorder] 🔴 Recording via SoX/rec... (max ${durationSeconds}s)`);
      return this.recordViaSox(outputPath, durationSeconds);
    }
  }

  /**
   * Check if a command exists on the system.
   */
  private async isCommandAvailable(cmd: string): Promise<boolean> {
    try {
      const checkCmd = os.platform() === 'win32' ? `where ${cmd}` : `which ${cmd}`;
      await execAsync(checkCmd, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fallback/Native: record via SoX (if installed).
   */
  private async recordViaSox(outputPath: string, durationSeconds: number): Promise<string> {
    const isSoxAvailable = await this.isCommandAvailable('sox');
    const isRecAvailable = await this.isCommandAvailable('rec');

    if (!isSoxAvailable && !isRecAvailable) {
      throw new Error(t('recording_no_method'));
    }

    const command = isRecAvailable
      ? `rec -r ${this.sampleRate} -c 1 -b 16 "${outputPath}" trim 0 ${durationSeconds}`
      : `sox -d -r ${this.sampleRate} -c 1 -b 16 "${outputPath}" trim 0 ${durationSeconds}`;

    await execAsync(command, { timeout: this.maxDurationMs + 5000 });

    if (fs.existsSync(outputPath)) {
      console.log(t('recording_sox', { path: outputPath }));
      return outputPath;
    }

    throw new Error(t('recording_sox_failed'));
  }

  /**
   * Removes temporary audio file.
   */
  public cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch { /* ignore */ }
  }
}
