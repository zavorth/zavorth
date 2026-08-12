import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import os from 'node:os';

export interface TTSOptions {
  voice?: string;
  rate?: number;
}

type SpawnLike = typeof spawn;
type SpawnSyncLike = typeof spawnSync;

export type LocalVoiceTTSDeps = {
  spawn?: SpawnLike;
  spawnSync?: SpawnSyncLike;
  platform?: string;
};

/**
 * LocalVoiceTTS — Text-to-Speech output using OS-native tools.
 *
 * - **Windows**: PowerShell System.Speech.Synthesis.SpeechSynthesizer
 * - **macOS**: `say` command
 * - **Linux**: `espeak` or `spd-say` (checked in order)
 *
 * Zero external dependencies.
 */
export class LocalVoiceTTS {
  private readonly platform: string;
  private readonly spawnImpl: SpawnLike;
  private readonly spawnSyncImpl: SpawnSyncLike;

  constructor(deps: LocalVoiceTTSDeps = {}) {
    this.platform = deps.platform || os.platform();
    this.spawnImpl = deps.spawn || spawn;
    this.spawnSyncImpl = deps.spawnSync || spawnSync;
  }

  /**
   * Speak text aloud using the OS-native TTS tool.
   * Resolves when the speech finishes.
   */
  public speak(text: string, options?: TTSOptions): Promise<void> {
    const sanitized = String(text || '').trim();
    if (!sanitized) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const { command, args } = this.buildCommand(sanitized, options);
      if (!command) {
        reject(new Error('No TTS tool available for this platform.'));
        return;
      }

      const child: ChildProcess = this.spawnImpl(command, args, {
        stdio: 'ignore',
        windowsHide: true,
      });

      child.once('error', (err) => {
        reject(new Error(`TTS failed to start: ${err.message}`));
      });

      child.once('close', (code) => {
        if (code === 0 || code === null) {
          resolve();
        } else {
          reject(new Error(`TTS process exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Check whether TTS is available on this platform.
   */
  public isAvailable(): boolean {
    try {
      const tool = this.detectTool();
      return tool !== null;
    } catch {
      return false;
    }
  }

  /**
   * Return the name of the TTS tool that would be used.
   */
  public getToolName(): string | null {
    return this.detectTool();
  }

  /**
   * List available system voices (best-effort, platform-specific).
   */
  public getAvailableVoices(): string[] {
    try {
      if (this.platform === 'darwin') {
        const result = this.spawnSyncImpl('say', ['--voice', '...'], {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true,
        });
        const output = String(result.stdout || '');
        return output
          .split(/\r?\n/)
          .map((line) => {
            const match = line.match(/^(\S+)/);
            return match ? match[1] : '';
          })
          .filter(Boolean);
      }

      if (this.platform === 'win32') {
        const ps = `Add-Type -AssemblyName System.Speech; (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }`;
        const result = this.spawnSyncImpl('powershell', ['-NoProfile', '-Command', ps], {
          encoding: 'utf8',
          timeout: 10000,
          windowsHide: true,
        });
        return String(result.stdout || '')
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
      }

      if (this.platform === 'linux') {
        const result = this.spawnSyncImpl('espeak', ['--voices'], {
          encoding: 'utf8',
          timeout: 5000,
          windowsHide: true,
        });
        const output = String(result.stdout || '');
        return output
          .split(/\r?\n/)
          .slice(1)
          .map((line) => {
            const cols = line.trim().split(/\s+/);
            return cols.length >= 4 ? cols[3] : '';
          })
          .filter(Boolean)
          .slice(0, 20);
      }
    } catch {
      // ignore
    }
    return [];
  }

  // Private helpers

  private detectTool(): string | null {
    if (this.platform === 'darwin') {
      return 'say';
    }
    if (this.platform === 'win32') {
      return 'powershell';
    }
    if (this.platform === 'linux') {
      // Check espeak first, then spd-say
      for (const tool of ['espeak', 'spd-say']) {
        const result = this.spawnSyncImpl('which', [tool], {
          encoding: 'utf8',
          timeout: 3000,
          windowsHide: true,
        });
        if (result.status === 0 && String(result.stdout || '').trim()) {
          return tool;
        }
      }
    }
    return null;
  }

  private buildCommand(text: string, options?: TTSOptions): { command: string | null; args: string[] } {
    if (this.platform === 'darwin') {
      const args = [];
      if (options?.voice) {
        args.push('--voice', options.voice);
      }
      if (options?.rate) {
        args.push('--rate', String(Math.round(options.rate)));
      }
      args.push(text);
      return { command: 'say', args };
    }

    if (this.platform === 'win32') {
      const voiceSetup = options?.voice ? `$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SelectVoice('${options.voice.replace(/'/g, "''")}');`
        : `$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;`;
      const rateSetup = options?.rate ? `$synth.Rate = ${Math.max(-10, Math.min(10, Math.round((options.rate - 200) / 30)))};`
        : '';
      const escaped = text.replace(/'/g, "''");
      const ps = `Add-Type -AssemblyName System.Speech; ${voiceSetup} ${rateSetup} $synth.Speak('${escaped}')`;
      return { command: 'powershell', args: ['-NoProfile', '-Command', ps] };
    }

    if (this.platform === 'linux') {
      const tool = this.detectTool();
      if (tool === 'espeak') {
        const args = [];
        if (options?.rate) {
          args.push('-s', String(Math.round(options.rate)));
        }
        args.push(text);
        return { command: 'espeak', args };
      }
      if (tool === 'spd-say') {
        return { command: 'spd-say', args: [text] };
      }
    }

    return { command: null, args: [] };
  }
}
