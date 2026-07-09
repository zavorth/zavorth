import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ChimeService {
  private readonly soundsDir: string;
  private enabled: boolean;

  constructor(options?: { enabled?: boolean }) {
    this.enabled = options?.enabled !== false;
    this.soundsDir = path.resolve(__dirname, '../assets/sounds');
  }

  public setEnabled(value: boolean): void {
    this.enabled = value;
  }

  public playStart(): void {
    this.play('start.wav');
  }

  public playStop(): void {
    this.play('stop.wav');
  }

  public playError(): void {
    this.play('error.wav');
  }

  private play(fileName: string): void {
    if (!this.enabled) {
      return;
    }

    const filePath = path.join(this.soundsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`[Chime] Sound file not found: ${filePath}`);
      return;
    }

    try {
      const platform = process.platform;
      let command = '';
      if (platform === 'win32') {
        const escapedPath = filePath.replace(/'/g, "''");
        command = `powershell -NoProfile -Command "(New-Object System.Media.SoundPlayer('${escapedPath}')).PlaySync()"`;
      } else if (platform === 'darwin') {
        command = `afplay "${filePath}"`;
      } else {
        command = `aplay "${filePath}" || paplay "${filePath}" || pw-play "${filePath}"`;
      }
      
      // Fire and forget execution to avoid blocking the main JS loop
      exec(command, (error) => {
        if (error) {
          console.error(`[Chime] Failed to play sound ${fileName}: ${error.message}`);
        }
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error(`[Chime] Error invoking player: ${err.message}`);
    }
  }
}
export default ChimeService;
