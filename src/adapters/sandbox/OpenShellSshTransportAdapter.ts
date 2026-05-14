import type {
  OpenShellRemoteSandboxConfig,
  OpenShellSshSessionPlan,
} from '../../contracts/RemoteSandboxContract.js';
import { OpenShellCliAdapter } from './OpenShellCliAdapter.js';

type OpenShellSshTransportRuntime = {
  cliAdapter?: Pick<OpenShellCliAdapter, 'buildSshConfig' | 'sanitizeEnv' | 'blockedEnvKeys'>;
};

export class OpenShellSshTransportAdapter {
  private readonly cli: Pick<OpenShellCliAdapter, 'buildSshConfig' | 'sanitizeEnv' | 'blockedEnvKeys'>;

  constructor(runtime: OpenShellSshTransportRuntime = {}) {
    this.cli = runtime.cliAdapter || new OpenShellCliAdapter();
  }

  public buildSessionPlan(input: {
    runtimeId: string;
    config: OpenShellRemoteSandboxConfig;
    command: string;
    cwd?: string | null;
    env?: Record<string, string | undefined> | null;
    pty?: boolean;
    stdin?: string | null;
  }): OpenShellSshSessionPlan {
    const sanitizedEnv = this.cli.sanitizeEnv(input.env || {});
    const envPrefix = Object.entries(sanitizedEnv)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${this.shellEscape(value)}`)
      .join(' ');
    const cwd = String(input.cwd || input.config.remoteWorkspaceDir).trim() || input.config.remoteWorkspaceDir;
    const command = [
      `cd ${this.shellEscape(cwd)}`,
      String(input.command || '').trim() || 'true',
    ].join(' && ');
    const remoteCommand = envPrefix ? `${envPrefix} ${command}` : command;

    return {
      runtimeId: input.runtimeId,
      sshConfigInvocation: this.cli.buildSshConfig(input.config, input.runtimeId),
      remoteCommand,
      pty: input.pty === true,
      stdinMode: String(input.stdin || '').length > 0 ? 'pipe-open' : 'closed',
      sanitizedEnvKeys: Object.keys(sanitizedEnv).sort(),
      blockedEnvKeys: this.cli.blockedEnvKeys(input.env || {}),
      receipt: `openshell.ssh.${input.runtimeId}.receipt`,
      liveIoRequired: false,
      secretValuesSerialized: false,
    };
  }

  public shellEscape(value: string): string {
    const text = String(value);
    if (/^[a-zA-Z0-9_./:@%+=,-]+$/.test(text)) {
      return text;
    }
    return `'${text.replace(/'/g, `'\\''`)}'`;
  }
}
