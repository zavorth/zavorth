import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { spawnNativeCommand } from '../core/CommandSpawn.js';
import { generateZavorthControlToken, isWeakZavorthControlToken } from './ZavorthControlTokenService.js';
import { logger } from '../logger.js';

export type ZavorthControlAccessAction =
  | 'open'
  | 'url'
  | 'token'
  | 'status'
  | 'doctor'
  | 'repair'
  | 'generate-token';

export type ZavorthControlAccessTokenSource = 'env' | 'runtime-file' | 'generated-runtime-file';

export type ZavorthControlAccessSnapshot = {
  url: string;
  publicUrl: string;
  token: string;
  tokenSource: ZavorthControlAccessTokenSource;
  tokenFile: string;
  opened: boolean;
  action: ZavorthControlAccessAction;
};

export type ZavorthControlAccessDoctorSnapshot = {
  ok: boolean;
  action: 'doctor' | 'repair' | 'generate-token';
  status: 'ready' | 'repaired' | 'repairable' | 'env-locked';
  publicUrl: string;
  tokenSource: ZavorthControlAccessTokenSource | 'missing';
  tokenFile: string;
  tokenPresent: boolean;
  tokenFileExists: boolean;
  tokenFileReadable: boolean;
  repaired: boolean;
  generated: boolean;
  problems: string[];
  recoveryCommands: string[];
  notes: string[];
};

type ZavorthControlAccessConfig = {
  host: string;
  port: number;
  token: string;
  tokenFile: string;
  projectRoot: string;
};

type ZavorthControlAccessServiceOptions = {
  config?: Partial<ZavorthControlAccessConfig>;
  env?: NodeJS.ProcessEnv;
  spawn?: typeof spawnNativeCommand;
};

function normalizeHostForBrowser(host: string): string {
  const normalized = String(host || '').trim();
  if (!normalized || normalized === '0.0.0.0' || normalized === '::') {
    return '127.0.0.1';
  }
  return normalized;
}

function normalizeAction(raw: string | null | undefined): ZavorthControlAccessAction {
  const normalized = String(raw || '').trim().toLowerCase();
  if (!normalized || normalized === 'open' || normalized === 'abrir') {
    return 'open';
  }
  if (normalized === 'url' || normalized === 'link' || normalized === 'copy' || normalized === 'copiar') {
    return 'url';
  }
  if (normalized === 'token' || normalized === 'senha' || normalized === 'access') {
    return 'token';
  }
  if (normalized === 'status' || normalized === 'check') {
    return 'status';
  }
  if (normalized === 'doctor' || normalized === 'diagnostic') {
    return 'doctor';
  }
  if (normalized === 'repair' || normalized === 'fix' || normalized === 'corrigir' || normalized === 'reparar') {
    return 'repair';
  }
  if (
    normalized === 'generate-token'
    || normalized === 'generate'
    || normalized === 'regen'
    || normalized === 'rotate'
    || normalized === 'novo-token'
  ) {
    return 'generate-token';
  }
  return 'open';
}

export function parseZavorthControlAccessAction(args: string): ZavorthControlAccessAction {
  return normalizeAction(String(args || '').trim().split(/\s+/u)[0] || '');
}

export class ZavorthControlAccessService {
  private readonly optionsConfig: Partial<ZavorthControlAccessConfig>;
  private readonly env: NodeJS.ProcessEnv;
  private readonly spawnImpl: typeof spawnNativeCommand;

  constructor(options: ZavorthControlAccessServiceOptions = {}) {
    this.optionsConfig = options.config || {};
    this.env = options.env || process.env;
    this.spawnImpl = options.spawn || spawnNativeCommand;
  }

  public async run(action: ZavorthControlAccessAction): Promise<ZavorthControlAccessSnapshot> {
    if (action === 'doctor' || action === 'repair' || action === 'generate-token') {
      action = 'status';
    }
    const resolved = this.resolveToken();
    const publicUrl = this.buildPublicUrl();
    const url = `${publicUrl}#token=${encodeURIComponent(resolved.token)}`;
    const snapshot: ZavorthControlAccessSnapshot = {
      url,
      publicUrl,
      token: resolved.token,
      tokenSource: resolved.source,
      tokenFile: this.resolveConfig().tokenFile,
      opened: false,
      action,
    };

    if (action === 'open') {
      snapshot.opened = this.openUrl(url);
    }

    return snapshot;
  }

  public doctor(): ZavorthControlAccessDoctorSnapshot {
    return this.buildDoctorSnapshot('doctor', false, false);
  }

  public repair(): ZavorthControlAccessDoctorSnapshot {
    const inspection = this.inspectToken();
    if (inspection.source === 'env') {
      return this.buildDoctorSnapshot('repair', false, false, [
        'Access already comes from ZAVORTH_WEB_AUTH_TOKEN. Because the environment variable overrides the local file, nothing was rotated.',
      ]);
    }

    const generated = !inspection.token;
    if (generated) {
      this.writeGeneratedToken();
    }

    return this.buildDoctorSnapshot(
      'repair',
      generated,
      generated,
      generated
        ? ['Generated a new local token in the runtime file. Open with `zavorth zavorthControl`.']
        : ['The local token already exists. Use `zavorth zavorthControl` to open a new unblocked tab.'],
    );
  }

  public generateToken(): ZavorthControlAccessDoctorSnapshot {
    const inspection = this.inspectToken();
    if (inspection.source === 'env') {
      return this.buildDoctorSnapshot('generate-token', false, false, [
        'ZAVORTH_WEB_AUTH_TOKEN is defined. This token overrides any local file; to change it, edit the variable in the environment/.env.',
      ]);
    }

    this.writeGeneratedToken();
    return this.buildDoctorSnapshot('generate-token', true, true, [
      'Generated a new local token in the runtime file. Open a new tab with `zavorth zavorthControl`.',
    ]);
  }

  private resolveConfig(): ZavorthControlAccessConfig {
    return {
      host: this.optionsConfig.host || config.zavorthWebHost,
      port: this.optionsConfig.port || config.zavorthWebPort,
      token: this.optionsConfig.token || config.zavorthWebAuthToken,
      tokenFile: this.optionsConfig.tokenFile || config.zavorthWebAuthTokenFile,
      projectRoot: this.optionsConfig.projectRoot || config.projectRoot,
    };
  }

  private buildPublicUrl(): string {
    const resolved = this.resolveConfig();
    const host = normalizeHostForBrowser(resolved.host);
    return `http://${host}:${resolved.port}/control`;
  }

  private resolveToken(): { token: string; source: ZavorthControlAccessTokenSource } {
    const inspected = this.inspectToken();
    if (inspected.token) {
      return { token: inspected.token, source: inspected.source as ZavorthControlAccessTokenSource };
    }

    const generated = this.writeGeneratedToken();
    return { token: generated, source: 'generated-runtime-file' };
  }

  private inspectToken(): {
    token: string | null;
    source: ZavorthControlAccessTokenSource | 'missing';
    tokenFileExists: boolean;
    tokenFileReadable: boolean;
  } {
    const resolved = this.resolveConfig();
    const envToken = String(this.env.ZAVORTH_WEB_AUTH_TOKEN || resolved.token || '').trim();
    if (envToken && !isWeakZavorthControlToken(envToken)) {
      return {
        token: envToken,
        source: 'env',
        tokenFileExists: fs.existsSync(resolved.tokenFile),
        tokenFileReadable: this.readTokenFile(resolved.tokenFile) !== null,
      };
    }

    const tokenFileExists = fs.existsSync(resolved.tokenFile);
    const fileToken = this.readTokenFile(resolved.tokenFile);
    if (fileToken) {
      return {
        token: fileToken,
        source: 'runtime-file',
        tokenFileExists,
        tokenFileReadable: true,
      };
    }

    return {
      token: null,
      source: 'missing',
      tokenFileExists,
      tokenFileReadable: false,
    };
  }

  private writeGeneratedToken(): string {
    const tokenFile = this.resolveConfig().tokenFile;
    const generated = generateZavorthControlToken();
    fs.mkdirSync(path.dirname(tokenFile), { recursive: true });
    fs.writeFileSync(tokenFile, generated, 'utf8');
    return generated;
  }

  private buildDoctorSnapshot(
    action: 'doctor' | 'repair' | 'generate-token',
    repaired: boolean,
    generated: boolean,
    extraNotes: string[] = [],
  ): ZavorthControlAccessDoctorSnapshot {
    const inspected = this.inspectToken();
    const resolved = this.resolveConfig();
    const rawEnvToken = String(this.env.ZAVORTH_WEB_AUTH_TOKEN || resolved.token || '').trim();
    const weakEnvTokenIgnored = Boolean(rawEnvToken && isWeakZavorthControlToken(rawEnvToken));
    const problems: string[] = [];
    if (!inspected.token) {
      problems.push('Local token missing.');
    }
    if (inspected.source !== 'env' && inspected.tokenFileExists && !inspected.tokenFileReadable) {
      problems.push('Token file exists, but is empty or unreadable.');
    }

    const status = inspected.source === 'env'
      ? 'env-locked'
      : repaired
        ? 'repaired'
        : problems.length > 0
          ? 'repairable'
          : 'ready';

    return {
      ok: problems.length === 0 || repaired || inspected.source === 'env',
      action,
      status,
      publicUrl: this.buildPublicUrl(),
      tokenSource: inspected.source,
      tokenFile: resolved.tokenFile,
      tokenPresent: Boolean(inspected.token),
      tokenFileExists: inspected.tokenFileExists,
      tokenFileReadable: inspected.tokenFileReadable,
      repaired,
      generated,
      problems,
      recoveryCommands: [
        'zavorth zavorthControl',
        'zavorth zavorthControl url',
        'zavorth zavorthControl repair',
        'zavorth zavorthControl generate-token',
        'zavorth zavorthControl token',
      ],
      notes: [
        weakEnvTokenIgnored
          ? 'ZAVORTH_WEB_AUTH_TOKEN appears to be an insecure placeholder and was ignored; use `zavorth zavorthControl generate-token` to rotate.'
          : null,
        inspected.source === 'env'
          ? 'ZAVORTH_WEB_AUTH_TOKEN is active and takes precedence over the local file.'
          : 'The local token stays in the runtime file and is applied through #token when opening the panel.',
        'If an old tab reports an invalid token, open a new tab with `zavorth zavorthControl`.',
        ...extraNotes,
      ].filter(Boolean) as string[],
    };
  }

  private readTokenFile(filePath: string): string | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const token = fs.readFileSync(filePath, 'utf8').trim();
      return token || null;
    } catch (error: unknown) {logger.warn('[Zavorth Control Access] filesystem operation failed', error); return null; }
  }

  private openUrl(url: string): boolean {
    try {
      const child = this.spawnImpl(...this.buildOpenCommand(url));
      child.unref?.();
      return true;
    } catch (error: unknown) {logger.warn('[Zavorth Control Access] filesystem operation failed', error); return false; }
  }

  private buildOpenCommand(url: string): Parameters<typeof spawnNativeCommand> {
    const options = {
      cwd: this.resolveConfig().projectRoot,
      detached: true,
      stdio: 'ignore' as const,
    };
    if (process.platform === 'win32') {
      return ['rundll32.exe', ['url.dll,FileProtocolHandler', url], options];
    }
    if (process.platform === 'darwin') {
      return ['open', [url], options];
    }
    return ['xdg-open', [url], options];
  }
}
