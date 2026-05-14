import { execFile } from 'child_process';
import { config } from '../config/index.js';

export type ZavorthBridgeAppLaunchResult = {
  ok: boolean;
  pid: number | null;
  message: string;
  summary: string | null;
};

export class ZavorthBridgeAppLauncherService {
  public async launch(): Promise<ZavorthBridgeAppLaunchResult> {
    return new Promise((resolve) => {
      execFile(
        process.execPath,
        [config.zavorthBridgeStartScriptPath],
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024,
        },
        (error, stdout, stderr) => {
          if (error) {
            resolve({
              ok: false,
              pid: null,
              message: stderr?.trim() || error.message,
              summary: stdout?.trim() || null,
            });
            return;
          }

          const output = String(stdout || '').trim();
          const pidMatch = output.match(/PID:\s*(\d+)/i);
          resolve({
            ok: true,
            pid: pidMatch ? Number(pidMatch[1]) : null,
            message: 'ZavorthBridge enviado para background no modo de depuracao remota.',
            summary: output || null,
          });
        },
      );
    });
  }
}
