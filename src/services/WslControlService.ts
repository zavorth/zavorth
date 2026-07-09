
import { execFile } from 'child_process';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

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
        ? `WSL ativo. ${running.length} distro(s) rodando: ${running.map(d => d.name).join(', ')}.`
        : 'WSL parado. Nenhuma distro rodando.';

      return { ok: true, action: 'status', distros, message, warnings: [] };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Wsl Control] parsing failed', error);
    return {
        ok: false,
        action: 'status',
        distros: [],
        message: `Falha ao consultar WSL: ${err.message}`,
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
        warnings.push('O comando respondeu sem o marcador WSL_READY.');
      }

      const statusResult = await this.status();
      if (!statusResult.ok) {
        return {
          ok: false,
          action: 'start',
          distros: [],
          message: `O comando de inicializacao rodou, mas a verificacao do WSL falhou: ${statusResult.message}`,
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
            message: `A distro ${distro} nao apareceu no status depois da inicializacao.`,
            warnings,
          };
        }

        const running = matchedDistro.state.toLowerCase() === 'running';
        if (!running) {
          warnings.push(`A distro ${matchedDistro.name} respondeu ao start, mas o estado atual e ${matchedDistro.state}.`);
        }

        return {
          ok: running,
          action: 'start',
          distros: statusResult.distros,
          message: running
            ? `WSL iniciado e confirmado para a distro ${matchedDistro.name}.`
            : `O comando de inicializacao rodou, mas a distro ${matchedDistro.name} ainda nao ficou Running.`,
          warnings,
        };
      }

      if (runningDistros.length === 0) {
        const fallbackDistro = statusResult.distros[0];
        if (!distro && fallbackDistro) {
          const fallbackResult = await this.start(fallbackDistro.name);
          fallbackResult.warnings = [
            `O start generico nao subiu nenhuma distro util. Tentei automaticamente ${fallbackDistro.name}.`,
            ...fallbackResult.warnings,
          ];
          return fallbackResult;
        }

        return {
          ok: false,
          action: 'start',
          distros: statusResult.distros,
          message: 'O comando de inicializacao rodou, mas nenhuma distro ficou Running depois da verificacao.',
          warnings,
        };
      }

      return {
        ok: true,
        action: 'start',
        distros: statusResult.distros,
        message: `WSL iniciado e confirmado. ${runningDistros.length} distro(s) em execucao: ${runningDistros.map((entry) => entry.name).join(', ')}.`,
        warnings,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Wsl Control] process execution failed', error);
    return {
        ok: false,
        action: 'start',
        distros: [],
        message: `Falha ao iniciar WSL: ${err.message}`,
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
          message: 'O comando de desligamento foi enviado. Nao consegui confirmar o estado final do WSL depois disso.',
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
            ? 'WSL desligado e confirmado. Toda a RAM do WSL foi liberada.'
            : `O comando de desligamento foi enviado, mas ainda ha distros rodando: ${runningDistros.map((entry) => entry.name).join(', ')}.`,
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
