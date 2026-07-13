
import { execFile } from 'child_process';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';
import { tService } from '../i18n/services.js';

export type WslDistroInfo = {
  name: string;
  state: string;
  version: string;
  isDefault: boolean;
};

export type WslControlResult = {
  ok: boolean;
  action: 'status' | 'start' | 'shutdown';
  distros: WslDistroInfo[];
  message: string;
  warnings: string[];
};

export class WslControlService {
  private readonly wslPath: string;

  constructor(wslPath?: string) {
    this.wslPath = wslPath || 'C:\\Windows\\System32\\wsl.exe';
  }

  /**
   * Retorna as distros instaladas e seus estados (Running/Stopped).
   */
  public async status(): Promise<WslControlResult> {
    try {
      const stdout = await this.exec(['-l', '-v']);
      const distros = this.parseDistroList(stdout);

      const running = distros.filter(d => d.state.toLowerCase() === 'running');
      const message = running.length > 0
        ? tService('wsl.active_distros', { count: String(running.length), distros: running.map(d => d.name).join(', ') })
        : tService('wsl.no_distros_running');

      return { ok: true, action: 'status', distros, message, warnings: [] };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Wsl Control] parsing failed', error);
    return {
        ok: false,
        action: 'status',
        distros: [],
        message: tService('wsl.query_failed', { reason: err.message }),
        warnings: [],
      };
  }
  }

  /**
   * Inicia uma distro WSL específica (ou a padrão).
   */
  public async start(distro?: string): Promise<WslControlResult> {
    try {
      const args = distro
        ? ['-d', distro, '--', 'echo', 'WSL_READY']
        : ['--', 'echo', 'WSL_READY'];

      const stdout = await this.exec(args);
      const warnings: string[] = [];
      if (!stdout.includes('WSL_READY')) {
        warnings.push(tService('wsl.no_wsl_ready_marker'));
      }

      const statusResult = await this.status();
      if (!statusResult.ok) {
        return {
          ok: false,
          action: 'start',
          distros: [],
          message: tService('wsl.start_command_ran_verification_failed', { message: statusResult.message }),
          warnings,
        };
      }

      const runningDistros = statusResult.distros.filter((entry) => entry.state.toLowerCase() === 'running');
      if (distro) {
        const matchedDistro = statusResult.distros.find(
          (entry) => entry.name.toLowerCase() === distro.toLowerCase(),
        );

        if (!matchedDistro) {
          return {
            ok: false,
            action: 'start',
            distros: statusResult.distros,
            message: tService('wsl.distro_not_found_after_start', { distro }),
            warnings,
          };
        }

        const running = matchedDistro.state.toLowerCase() === 'running';
        if (!running) {
          warnings.push(tService('wsl.distro_started_wrong_state', { name: matchedDistro.name, state: matchedDistro.state }));
        }

        return {
          ok: running,
          action: 'start',
          distros: statusResult.distros,
          message: running
            ? tService('wsl.distro_started_confirmed', { name: matchedDistro.name })
            : tService('wsl.distro_start_not_running', { name: matchedDistro.name }),
          warnings,
        };
      }

      if (runningDistros.length === 0) {
        const fallbackDistro = statusResult.distros[0];
        if (!distro && fallbackDistro) {
          const fallbackResult = await this.start(fallbackDistro.name);
          fallbackResult.warnings = [
            tService('wsl.generic_start_fallback', { distro: fallbackDistro.name }),
            ...fallbackResult.warnings,
          ];
          return fallbackResult;
        }

        return {
          ok: false,
          action: 'start',
          distros: statusResult.distros,
          message: tService('wsl.start_no_distros_running'),
          warnings,
        };
      }

      return {
        ok: true,
        action: 'start',
        distros: statusResult.distros,
        message: tService('wsl.started_confirmed', { count: String(runningDistros.length), distros: runningDistros.map((entry) => entry.name).join(', ') }),
        warnings,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Wsl Control] process execution failed', error);
    return {
        ok: false,
        action: 'start',
        distros: [],
        message: tService('wsl.start_failed', { reason: err.message }),
        warnings: [],
      };
  }
  }

  /**
   * Desliga TODAS as distros WSL e libera a RAM.
   */
  public async shutdown(): Promise<WslControlResult> {
    try {
      await this.exec(['--shutdown']);
      const statusResult = await this.status();

      if (!statusResult.ok) {
        return {
          ok: true,
          action: 'shutdown',
          distros: [],
          message: tService('wsl.shutdown_sent_unconfirmed'),
          warnings: [statusResult.message],
        };
      }

      const runningDistros = statusResult.distros.filter((entry) => entry.state.toLowerCase() === 'running');
      return {
        ok: runningDistros.length === 0,
        action: 'shutdown',
        distros: statusResult.distros,
        message:
          runningDistros.length === 0
            ? tService('wsl.shutdown_confirmed')
            : tService('wsl.shutdown_distros_still_running', { distros: runningDistros.map((entry) => entry.name).join(', ') }),
        warnings: [],
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Wsl Control] filesystem check failed', error);
    return {
        ok: false,
        action: 'shutdown',
        distros: [],
        message: `Falha ao desligar WSL: ${err.message}`,
        warnings: [],
      };
  }
  }

  private parseDistroList(stdout: string): WslDistroInfo[] {
    const cleaned = stdout.replace(/\u0000/g, '');
    const lines = cleaned
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .filter(line => !/^NAME\s+STATE\s+VERSION$/i.test(line));

    const distros: WslDistroInfo[] = [];

    for (const line of lines) {
      const isDefault = line.startsWith('*');
      const withoutMarker = line.replace(/^\*\s*/, '').trim();
      const parts = withoutMarker.split(/\s{2,}/);
      const name = parts[0]?.trim();
      const state = parts[1]?.trim() || 'Unknown';
      const version = parts[2]?.trim() || '?';

      if (!name || /^docker-desktop/i.test(name)) {
        continue;
      }

      distros.push({ name, state, version, isDefault });
    }

    return distros;
  }

  private exec(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        this.wslPath,
        args,
        {
          windowsHide: true,
          maxBuffer: 1024 * 1024,
          timeout: 30_000,
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr?.trim() || error.message));
            return;
          }
          resolve(stdout);
        },
      );
    });
  }
}
