import fs from 'fs';
import path from 'path';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { config } from '../config/index.js';

export type RuntimeLauncherInstallMode = 'desktop' | 'startup';

export type RuntimeLauncherInstallResult = {
  attempted: boolean;
  applied: boolean;
  skipped: boolean;
  mode: RuntimeLauncherInstallMode;
  command: string | null;
  scriptPath: string | null;
  error: string | null;
  output: string | null;
};

type RuntimeLauncherInstallServiceOptions = {
  platform?: NodeJS.Platform;
  projectRoot?: string;
  existsSync?: typeof fs.existsSync;
  spawnSyncImpl?: typeof spawnSync;
  systemRoot?: string;
  allowStartupInstall?: boolean;
};

export class RuntimeLauncherInstallService {
  private readonly platform: NodeJS.Platform;
  private readonly projectRoot: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly spawnSyncImpl: typeof spawnSync;
  private readonly systemRoot: string;
  private readonly allowStartupInstall: boolean;

  constructor(options: RuntimeLauncherInstallServiceOptions = {}) {
    this.platform = options.platform || process.platform;
    this.projectRoot = String(options.projectRoot || config.projectRoot);
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.spawnSyncImpl = options.spawnSyncImpl || spawnSync;
    this.systemRoot = String(options.systemRoot || process.env.SystemRoot || 'C:\\Windows');
    this.allowStartupInstall = options.allowStartupInstall === true;
  }

  public buildInstallCommand(mode: RuntimeLauncherInstallMode): {
    command: string;
    scriptPath: string;
    powershellPath: string;
  } {
    const scriptFile = mode === 'startup'
      ? 'install-windows-startup.ps1'
      : 'install-windows-launcher.ps1';
    return {
      command: mode === 'startup'
        ? 'npm run launcher:startup:install'
        : 'npm run launcher:install',
      scriptPath: path.join(this.projectRoot, 'scripts', scriptFile),
      powershellPath: path.join(this.systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    };
  }

  public install(
    mode: RuntimeLauncherInstallMode,
    options: {
      dryRun?: boolean;
      confirmStartup?: boolean;
    } = {},
  ): RuntimeLauncherInstallResult {
    const installCommand = this.buildInstallCommand(mode);

    if (this.platform !== 'win32') {
      return {
        attempted: false,
        applied: false,
        skipped: true,
        mode,
        command: installCommand.command,
        scriptPath: installCommand.scriptPath,
        error: null,
        output: 'launcher oficial so e instalado automaticamente no Windows.',
      };
    }

    if (options.dryRun === true) {
      return {
        attempted: false,
        applied: false,
        skipped: true,
        mode,
        command: installCommand.command,
        scriptPath: installCommand.scriptPath,
        error: null,
        output: `dry-run: launcher ${mode === 'startup' ? 'startup' : 'desktop'} was not installed.`,
      };
    }

    if (mode === 'startup' && options.confirmStartup !== true && !this.allowStartupInstall) {
      return {
        attempted: false,
        applied: false,
        skipped: true,
        mode,
        command: installCommand.command,
        scriptPath: installCommand.scriptPath,
        error: null,
        output: 'automatic startup remains blocked. Explicitly confirm this step before installing autorun.',
      };
    }

    if (!this.existsSync(installCommand.scriptPath)) {
      return {
        attempted: true,
        applied: false,
        skipped: false,
        mode,
        command: installCommand.command,
        scriptPath: installCommand.scriptPath,
        error: `script missing em ${installCommand.scriptPath}`,
        output: null,
      };
    }

    if (!this.existsSync(installCommand.powershellPath)) {
      return {
        attempted: true,
        applied: false,
        skipped: false,
        mode,
        command: installCommand.command,
        scriptPath: installCommand.scriptPath,
        error: `powershell missing em ${installCommand.powershellPath}`,
        output: null,
      };
    }

    const result = this.spawnSyncImpl(
      installCommand.powershellPath,
      [
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        installCommand.scriptPath,
        ...(mode === 'startup' ? ['-AllowInstall'] : []),
      ],
      {
        cwd: this.projectRoot,
        encoding: 'utf8',
        windowsHide: true,
      },
    ) as SpawnSyncReturns<string>;

    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || null;
    return {
      attempted: true,
      applied: result.status === 0,
      skipped: false,
      mode,
      command: installCommand.command,
      scriptPath: installCommand.scriptPath,
      error: result.status === 0 ? null : (output || `status ${String(result.status ?? 'unknown')}`),
      output,
    };
  }
}
