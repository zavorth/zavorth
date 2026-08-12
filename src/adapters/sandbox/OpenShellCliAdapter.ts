import type {
  OpenShellCliInvocation,
  OpenShellRemoteSandboxConfig,
} from '../../contracts/RemoteSandboxContract.js';

type BuildInvocationInput = {
  args: string[];
  config: OpenShellRemoteSandboxConfig;
  env?: Record<string, string | undefined> | null;
};

const SECRET_ENV_PATTERN = /(?:token|secret|password|credential|api[_-]?key|authorization|cookie)/i;

export class OpenShellCliAdapter {
  public buildInvocation(input: BuildInvocationInput): OpenShellCliInvocation {
    const env = this.sanitizeEnv(input.env || {});
    return {
      command: input.config.command,
      args: input.args,
      timeoutMs: input.config.timeoutMs,
      env,
      displayCommand: [input.config.command, ...input.args.map((arg) => this.displayArg(arg))].join(' '),
      liveIoRequired: false,
      secretValuesSerialized: false,
    };
  }

  public buildSandboxGet(config: OpenShellRemoteSandboxConfig, runtimeId: string): OpenShellCliInvocation {
    return this.buildInvocation({
      config,
      args: ['sandbox', 'get', runtimeId],
    });
  }

  public buildSandboxCreate(config: OpenShellRemoteSandboxConfig, runtimeId: string): OpenShellCliInvocation {
    const args = [
      'sandbox',
      'create',
      runtimeId,
      '--from',
      config.source,
    ];
    if (config.gateway) {
      args.push('--gateway', config.gateway);
    }
    if (config.gatewayEndpoint) {
      args.push('--gateway-endpoint', config.gatewayEndpoint);
    }
    if (config.policy) {
      args.push('--policy', config.policy);
    }
    if (config.gpu) {
      args.push('--gpu');
    }
    args.push(config.autoProviders ? '--auto-providers' : '--no-auto-providers');
    for (const provider of config.providers) {
      args.push('--provider', provider);
    }
    return this.buildInvocation({ config, args });
  }

  public buildSandboxDelete(config: OpenShellRemoteSandboxConfig, runtimeId: string): OpenShellCliInvocation {
    return this.buildInvocation({
      config,
      args: ['sandbox', 'delete', runtimeId],
    });
  }

  public buildSshConfig(config: OpenShellRemoteSandboxConfig, runtimeId: string): OpenShellCliInvocation {
    return this.buildInvocation({
      config,
      args: ['sandbox', 'ssh-config', runtimeId],
    });
  }

  public sanitizeEnv(env: Record<string, string | undefined>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (!key || SECRET_ENV_PATTERN.test(key) || value === undefined) {
        continue;
      }
      sanitized[key] = String(value);
    }
    return sanitized;
  }

  public blockedEnvKeys(env: Record<string, string | undefined>): string[] {
    return Object.keys(env).filter((key) => SECRET_ENV_PATTERN.test(key)).sort();
  }

  private displayArg(value: string): string {
    if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
      return value;
    }
    return JSON.stringify(value);
  }
}
