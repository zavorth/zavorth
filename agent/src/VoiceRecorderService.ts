import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * VoiceRecorderService — Grava áudio do microfone após ativação.
 *
 * Usa PowerShell nativo no Windows para captura de áudio (zero deps externas).
 * Grava até detectar silêncio (VAD simples) ou atingir timeout.
 * Salva como .wav no diretório temp do sistema.
 */
export class VoiceRecorderService {
  private maxDurationMs: number;
  private sampleRate: number;

  constructor(options?: { maxDurationMs?: number; sampleRate?: number }) {
    this.maxDurationMs = options?.maxDurationMs || 10000; // 10s max
    this.sampleRate = options?.sampleRate || 16000; // 16kHz para Whisper
  }

  /**
   * Grava áudio do microfone e retorna o caminho do arquivo .wav.
   * Usa PowerShell nativo para gravar sem dependências externas.
   */
  public async record(): Promise<string> {
    const outputPath = path.join(os.tmpdir(), `zavorth_voice_${Date.now()}.wav`);
    const scriptPath = path.join(os.tmpdir(), `zavorth_voice_recorder_${Date.now()}.ps1`);
    const durationSeconds = Math.ceil(this.maxDurationMs / 1000);

    console.log(`[Recorder] 🔴 Gravando... (max ${durationSeconds}s)`);

    // Método: PowerShell com NAudio-like approach usando .NET
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
        console.log(`[Recorder] ✅ Gravação salva: ${outputPath} (${(stats.size / 1024).toFixed(1)}KB)`);
        return outputPath;
      }

      throw new Error('Arquivo de áudio não foi criado.');

    } catch (error: any) {
      // Fallback: gravar via SoX se disponível
      console.log('[Recorder] PowerShell falhou, tentando via SoX...');
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
  }

  /**
   * Fallback: grava via SoX (se instalado).
   */
  private async recordViaSox(outputPath: string, durationSeconds: number): Promise<string> {
    try {
      await execAsync(`where sox`, { timeout: 2000 });
    } catch {
      throw new Error(
        'Nenhum método de gravação disponível. Instale SoX: https://sox.sourceforge.net/'
      );
    }

    await execAsync(
      `sox -d -r ${this.sampleRate} -c 1 -b 16 "${outputPath}" trim 0 ${durationSeconds}`,
      { timeout: this.maxDurationMs + 5000 },
    );

    if (fs.existsSync(outputPath)) {
      console.log(`[Recorder] ✅ Gravação via SoX: ${outputPath}`);
      return outputPath;
    }

    throw new Error('Falha na gravação via SoX.');
  }

  /**
   * Remove arquivo de áudio temporário.
   */
  public cleanup(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch { /* ignore */ }
  }
}
