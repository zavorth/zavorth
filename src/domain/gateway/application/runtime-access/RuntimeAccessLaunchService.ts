import { spawn } from 'child_process';

export type RuntimeAccessLaunchPreference = 'local' | 'remote' | 'best';

export type RuntimeAccessLaunchSelection = {
  source: 'local' | 'remote' | 'none';
  url: string | null;
  reason: string;
};

export type RuntimeAccessLaunchCommand = {
  command: string;
  args: string[];
};

export type RuntimeAccessLaunchResult = {
  attempted: boolean;
  ok: boolean;
  source: 'local' | 'remote' | 'none';
  url: string | null;
  reason: string;
  command: string | null;
  error: string | null;
};

type RuntimeAccessLaunchInput = {
  local: {
    ready: boolean;
    appUrl: string;
  };
  remote: {
    ready: boolean;
    appUrl: string | null;
  };
};

type RuntimeAccessLaunchServiceOptions = {
  platform?: NodeJS.Platform;
  spawnImpl?: typeof spawn;
};

export class RuntimeAccessLaunchService {
  private readonly platform: NodeJS.Platform;
  private readonly spawnImpl: typeof spawn;

  constructor(options: RuntimeAccessLaunchServiceOptions = {}) {
    this.platform = options.platform || process.platform;
    this.spawnImpl = options.spawnImpl || spawn;
  }

  public selectTarget(
    input: RuntimeAccessLaunchInput,
    preference: RuntimeAccessLaunchPreference = 'best',
  ): RuntimeAccessLaunchSelection {
    const localUrl = String(input.local?.appUrl || '').trim() || null;
    const remoteUrl = String(input.remote?.appUrl || '').trim() || null;
    const localReady = Boolean(input.local?.ready && localUrl);
    const remoteReady = Boolean(input.remote?.ready && remoteUrl);

    if (preference === 'local') {
      return localReady
        ? { source: 'local', url: localUrl, reason: 'Command Center local pronto para abrir.' }
        : { source: 'none', url: null, reason: 'O Command Center local ainda nao esta pronto para abrir.' };
    }

    if (preference === 'remote') {
      return remoteReady
      ? { source: 'remote', url: remoteUrl, reason: 'Command Center remoto pronto para abrir.' }
      : { source: 'none', url: null, reason: 'O Command Center remoto ainda nao esta pronto para abrir.' };
    }

    if (remoteReady) {
      return {
        source: 'remote',
        url: remoteUrl,
        reason: 'Abri o Command Center remoto porque ele ja esta pronto.',
      };
    }

    if (localReady) {
      return {
        source: 'local',
        url: localUrl,
        reason: 'Abri o Command Center local porque ele ja esta pronto.',
      };
    }

    return {
      source: 'none',
      url: null,
      reason: 'Nenhum Command Center ficou pronto para abrir ainda.',
    };
  }

  public buildLaunchCommand(url: string): RuntimeAccessLaunchCommand | null {
    const normalizedUrl = String(url || '').trim();
    if (!normalizedUrl) {
      return null;
    }

    if (this.platform === 'win32') {
      const escapedUrl = normalizedUrl.replace(/'/g, "''");
      return {
        command: 'powershell.exe',
        args: ['-NoLogo', '-NoProfile', '-Command', `Start-Process '${escapedUrl}'`],
      };
    }

    if (this.platform === 'darwin') {
      return {
        command: 'open',
        args: [normalizedUrl],
      };
    }

    return {
      command: 'xdg-open',
      args: [normalizedUrl],
    };
  }

  public async openSelected(selection: RuntimeAccessLaunchSelection): Promise<RuntimeAccessLaunchResult> {
    if (!selection.url || selection.source === 'none') {
      return {
        attempted: false,
        ok: false,
        source: selection.source,
        url: selection.url,
        reason: selection.reason,
        command: null,
        error: null,
      };
    }

    const launchCommand = this.buildLaunchCommand(selection.url);
    if (!launchCommand) {
      return {
        attempted: true,
        ok: false,
        source: selection.source,
        url: selection.url,
        reason: selection.reason,
        command: null,
        error: 'Nao foi possivel montar o comando para abrir a URL.',
      };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const child = this.spawnImpl(launchCommand.command, launchCommand.args, {
          stdio: 'ignore',
          windowsHide: true,
        });
        child.once('error', reject);
        child.once('spawn', () => {
          child.unref();
          resolve();
        });
      });

      return {
        attempted: true,
        ok: true,
        source: selection.source,
        url: selection.url,
        reason: selection.reason,
        command: `${launchCommand.command} ${launchCommand.args.join(' ')}`,
        error: null,
      };
    } catch (error: any) {
      return {
        attempted: true,
        ok: false,
        source: selection.source,
        url: selection.url,
        reason: selection.reason,
        command: `${launchCommand.command} ${launchCommand.args.join(' ')}`,
        error: String(error?.message || error || 'falha ao abrir a superficie'),
      };
    }
  }
}
