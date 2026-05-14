import path from 'path';
import type {
  OpenShellRemoteSandboxConfig,
  OpenShellWorkspaceSyncPlan,
  RemoteSandboxMode,
} from '../contracts/RemoteSandboxContract.js';
import { OpenShellConfigAdapter } from '../adapters/sandbox/OpenShellConfigAdapter.js';

type OpenShellWorkspaceBridgeRuntime = {
  configAdapter?: Pick<OpenShellConfigAdapter, 'normalizeRemotePath'>;
};

export class OpenShellWorkspaceBridgeService {
  private readonly config: Pick<OpenShellConfigAdapter, 'normalizeRemotePath'>;

  constructor(runtime: OpenShellWorkspaceBridgeRuntime = {}) {
    this.config = runtime.configAdapter || new OpenShellConfigAdapter();
  }

  public buildSyncPlan(input: {
    config: OpenShellRemoteSandboxConfig;
    localRoot: string;
    remoteRoot?: string | null;
    mode?: RemoteSandboxMode | null;
  }): OpenShellWorkspaceSyncPlan {
    const localRoot = this.normalizeLocalRoot(input.localRoot);
    const mode = input.mode || input.config.mode;
    return {
      mode,
      localRoot,
      remoteRoot: this.config.normalizeRemotePath(
        input.remoteRoot,
        input.config.remoteWorkspaceDir,
        'remoteRoot',
      ),
      remoteAgentRoot: input.config.remoteAgentWorkspaceDir,
      uploadBeforeExec: mode === 'artifact-first-mirror',
      collectAfterExec: true,
      mirrorBackToHost: false,
      applyRequiresMutationApproval: true,
      excludedGlobs: ['.git/**', 'hooks/**', 'git-hooks/**', 'node_modules/**'],
      pathGuards: [
        'local-root-containment',
        'remote-managed-root-containment',
        'reject-symlink-parents',
        'reject-final-symlink',
        'reject-hardlink-alias',
        'artifact-first-output',
      ],
      outputArtifactKind: 'sandbox.workspace-delta',
      applyPlanArtifactKind: 'sandbox.apply-plan',
      receipt: 'openshell.workspace-bridge.receipt',
    };
  }

  public assertLocalPathContained(input: {
    localRoot: string;
    candidate: string;
  }): string {
    const root = this.normalizeLocalRoot(input.localRoot);
    const candidate = path.resolve(root, input.candidate);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
      throw new Error(`OpenShell local path escapes workspace root: ${input.candidate}`);
    }
    return candidate;
  }

  private normalizeLocalRoot(value: string): string {
    const normalized = path.resolve(String(value || '').trim() || process.cwd());
    if (!normalized) {
      throw new Error('OpenShell localRoot is required.');
    }
    return normalized;
  }
}
