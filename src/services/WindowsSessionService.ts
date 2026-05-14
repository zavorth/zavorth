import { execFile } from 'child_process';
import { config } from '../config/index.js';

export type WindowsSessionStatus = {
  ok: boolean;
  accessible: boolean;
  lockedLikely: boolean;
  desktopName: string | null;
  explorerRunning: boolean;
  sessionId: number | null;
  errorCode: number | null;
  message: string;
};

export class WindowsSessionService {
  public async status(): Promise<WindowsSessionStatus> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.windowsSessionStatusScriptPath,
      ];

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          timeout: 30000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            resolve(JSON.parse(stdout.trim()) as WindowsSessionStatus);
          } catch (parseError: any) {
            reject(new Error(`Failed to parse Windows session status: ${parseError.message}`));
          }
        },
      );
    });
  }
}
