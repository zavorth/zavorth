import crypto from 'crypto';
import type {
  OpenShellLifecyclePlan,
  OpenShellRemoteSandboxConfig,
} from '../../contracts/RemoteSandboxContract.js';
import { OpenShellCliAdapter } from './OpenShellCliAdapter.js';

type OpenShellSandboxLifecycleRuntime = {
  cliAdapter?: Pick<OpenShellCliAdapter, 'buildSandboxGet' | 'buildSandboxCreate' | 'buildSandboxDelete'>;
};

export class OpenShellSandboxLifecycleAdapter {
  private readonly cli: Pick<OpenShellCliAdapter, 'buildSandboxGet' | 'buildSandboxCreate' | 'buildSandboxDelete'>;

  constructor(runtime: OpenShellSandboxLifecycleRuntime = {}) {
    this.cli = runtime.cliAdapter || new OpenShellCliAdapter();
  }

  public buildRuntimeId(scopeKey: string): string {
    const normalized = String(scopeKey || '').trim() || 'default';
    const slug = normalized
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'default';
    const digest = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
    return `zv-os-${slug}-${digest}`;
  }

  public buildPlan(input: {
    scopeKey: string;
    config: OpenShellRemoteSandboxConfig;
  }): OpenShellLifecyclePlan {
    const scopeKey = String(input.scopeKey || '').trim() || 'default';
    const runtimeId = this.buildRuntimeId(scopeKey);
    return {
      runtimeId,
      scopeKey,
      deterministicRuntimeId: true,
      deleteIsExplicit: true,
      actions: [
        {
          action: 'get',
          invocation: this.cli.buildSandboxGet(input.config, runtimeId),
          receipt: `openshell.lifecycle.${runtimeId}.get.receipt`,
        },
        {
          action: 'create',
          invocation: this.cli.buildSandboxCreate(input.config, runtimeId),
          receipt: `openshell.lifecycle.${runtimeId}.create.receipt`,
        },
        {
          action: 'delete',
          invocation: this.cli.buildSandboxDelete(input.config, runtimeId),
          receipt: `openshell.lifecycle.${runtimeId}.delete.receipt`,
        },
      ],
    };
  }
}
