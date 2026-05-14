import type {
  OpenShellCliInvocation,
  OpenShellReadinessSnapshot,
  OpenShellRemoteSandboxConfig,
} from '../contracts/RemoteSandboxContract.js';
import { OpenShellCliAdapter } from '../adapters/sandbox/OpenShellCliAdapter.js';

type OpenShellReadinessRuntime = {
  cliAdapter?: Pick<OpenShellCliAdapter, 'buildInvocation'>;
};

export class OpenShellReadinessService {
  private readonly cli: Pick<OpenShellCliAdapter, 'buildInvocation'>;

  constructor(runtime: OpenShellReadinessRuntime = {}) {
    this.cli = runtime.cliAdapter || new OpenShellCliAdapter();
  }

  public buildSnapshot(input: {
    config: OpenShellRemoteSandboxConfig;
  }): OpenShellReadinessSnapshot {
    const config = input.config;
    const smoke = this.buildSmokeInvocation(config);
    const checks = [
      {
        id: 'cli-command-configured',
        status: config.command ? 'pass' as const : 'fail' as const,
        observed: config.command || 'missing',
        nextAction: config.command ? null : 'Configure OpenShell command path.',
      },
      {
        id: 'managed-remote-roots',
        status: config.remoteWorkspaceDir.startsWith('/sandbox') && config.remoteAgentWorkspaceDir.startsWith('/agent')
          ? 'pass' as const
          : 'fail' as const,
        observed: `${config.remoteWorkspaceDir} / ${config.remoteAgentWorkspaceDir}`,
        nextAction: null,
      },
      {
        id: 'gateway-config',
        status: config.gateway || config.gatewayEndpoint ? 'pass' as const : 'warn' as const,
        observed: config.gateway || config.gatewayEndpoint || 'not configured',
        nextAction: config.gateway || config.gatewayEndpoint
          ? null
          : 'Remote execution can still use CLI defaults, but explicit gateway config is recommended.',
      },
      {
        id: 'artifact-first-policy',
        status: 'pass' as const,
        observed: 'mirrorBackToHost=false',
        nextAction: null,
      },
      {
        id: 'smoke-command',
        status: 'pass' as const,
        observed: smoke.displayCommand,
        nextAction: null,
      },
    ];
    const failed = checks.some((check) => check.status === 'fail');
    const warned = checks.some((check) => check.status === 'warn');
    return {
      status: failed ? 'blocked' : warned ? 'needs-config' : 'ready',
      checks,
      smoke: {
        command: smoke.displayCommand,
        liveIoRequired: false,
        secretValuesSerialized: false,
      },
      receipt: 'openshell.readiness.receipt',
    };
  }

  private buildSmokeInvocation(config: OpenShellRemoteSandboxConfig): OpenShellCliInvocation {
    return this.cli.buildInvocation({
      config,
      args: ['sandbox', 'get', 'zv-os-smoke'],
    });
  }
}
