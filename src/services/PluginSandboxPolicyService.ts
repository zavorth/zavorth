import type {
  ZavorthPluginLifecycleAction,
  ZavorthPluginManifest,
  ZavorthPluginPermission,
  ZavorthPluginPermissionKind,
  ZavorthPluginPermissionScope,
  ZavorthPluginSandboxDecision,
  ZavorthPluginTrustLevel,
} from '../contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_PERMISSION_KINDS } from '../contracts/PluginManifestContract.js';

type PluginSandboxPolicyRuntime = {
  now?: () => Date;
};

export type PluginSandboxEvaluationInput = {
  manifest: ZavorthPluginManifest;
  action: ZavorthPluginLifecycleAction;
  approved?: boolean;
  trustOverride?: ZavorthPluginTrustLevel | null;
};

export class PluginSandboxPolicyService {
  private readonly now: () => Date;
  private readonly knownPermissionKinds = new Set<string>(ZAVORTH_PLUGIN_PERMISSION_KINDS);

  constructor(runtime: PluginSandboxPolicyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public evaluate(input: PluginSandboxEvaluationInput): ZavorthPluginSandboxDecision {
    const manifest = input.manifest;
    const action = input.action;
    const trust = input.trustOverride || manifest.policy.defaultTrust;
    const reasons: string[] = [];
    const requiredApprovals: string[] = [];

    if (trust === 'blocked') {
      reasons.push('plugin trust is blocked');
    }
    if (trust !== 'trusted') {
      requiredApprovals.push('review-trust plugin requires explicit approval before code import');
    }

    if (!manifest.lifecycle.actions.includes(action)) {
      reasons.push(`action ${action} is not declared in plugin lifecycle`);
    }

    for (const permission of manifest.permissions) {
      this.inspectPermission({
        permission,
        manifest,
        reasons,
        requiredApprovals,
      });
    }

    if (manifest.policy.requiresApproval) {
      requiredApprovals.push('manifest policy requires explicit approval');
    }

    const blocked = reasons.length > 0;
    const needsApproval = !blocked && requiredApprovals.length > 0 && input.approved !== true;
    const network = this.collectScopes(manifest.permissions, ['network.external', 'network.local']);
    const filesystem = this.collectScopes(manifest.permissions, ['filesystem.read', 'filesystem.write']);

    return {
      generatedAt: this.now().toISOString(),
      pluginId: manifest.id,
      action,
      status: blocked ? 'blocked' : needsApproval ? 'needs_approval' : 'allow',
      trust,
      reasons,
      requiredApprovals,
      constraints: {
        network,
        filesystem,
        secrets: manifest.permissions.some((permission) => permission.kind === 'secret.read'),
        processSpawn: manifest.permissions.some((permission) => permission.kind === 'process.spawn'),
        artifacts: manifest.artifactKinds,
        receipts: manifest.receiptKinds,
      },
    };
  }

  private inspectPermission(input: {
    permission: ZavorthPluginPermission;
    manifest: ZavorthPluginManifest;
    reasons: string[];
    requiredApprovals: string[];
  }): void {
    const { permission, manifest, reasons, requiredApprovals } = input;
    if (!this.knownPermissionKinds.has(permission.kind)) {
      reasons.push(`unknown permission kind ${permission.kind}`);
      return;
    }

    if (permission.scope === 'system') {
      reasons.push(`${permission.kind} requested system scope`);
      return;
    }

    if (permission.kind === 'process.spawn' && !manifest.policy.allowProcessSpawnByDefault) {
      requiredApprovals.push('process spawn permission requires approval');
    }

    if (permission.kind === 'filesystem.write' && !manifest.policy.allowFilesystemWriteByDefault) {
      requiredApprovals.push('filesystem write permission requires approval');
    }

    if (permission.kind === 'network.external' && !manifest.policy.allowNetworkByDefault) {
      requiredApprovals.push('external network permission requires approval');
    }

    if (permission.kind === 'secret.read') {
      requiredApprovals.push('secret access requires approval');
    }

    if (permission.required && manifest.policy.sandboxProfile === 'metadata-only') {
      requiredApprovals.push(`${permission.kind} escapes metadata-only sandbox`);
    }
  }

  private collectScopes(
    permissions: ZavorthPluginPermission[],
    kinds: ZavorthPluginPermissionKind[],
  ): ZavorthPluginPermissionScope[] {
    return Array.from(new Set(
      permissions
        .filter((permission) => kinds.includes(permission.kind))
        .map((permission) => permission.scope),
    ));
  }
}
