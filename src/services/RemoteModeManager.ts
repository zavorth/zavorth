import { execFile } from 'child_process';
import { config } from '../config/index.js';export type RemoteModeCommand = 'status' | 'activate' | 'restore';

export type RemoteModeSnapshot = {
  schemeGuid: string | null;
  power: Record<string, { subgroup: string; setting: string; ac: number | null; dc: number | null }>;
  registry: Record<string, { hasValue: boolean; value: string | null }>;
};

export type RemoteModeResult = {
  ok: boolean;
  mode: RemoteModeCommand;
  active: boolean;
  changed: boolean;
  message: string;
  appliedAt: string | null;
  warnings: string[];
  snapshot: RemoteModeSnapshot | null;
};

export class RemoteModeManager {
  public async status(): Promise<RemoteModeResult> {
    return this.run('status');
  }

  public async activate(): Promise<RemoteModeResult> {
    return this.run('activate');
  }

  public async restore(): Promise<RemoteModeResult> {
    return this.run('restore');
  }

  private run(mode: RemoteModeCommand): Promise<RemoteModeResult> {
    return new Promise((resolve, reject) => {
      const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
      const args = [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        config.remoteModeScriptPath,
        '-Mode',
        mode,
        '-StateFile',
        config.remoteModeStateFile,
      ];

      execFile(
        powershellPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }

          try {
            const parsed = JSON.parse(stdout.trim()) as RemoteModeResult;
            resolve(parsed);
          } catch (parseError: unknown) {reject(new Error(`Failed to parse remote mode result: ${parseError.message}`));
          }
        },
      );
    });
  }
}
