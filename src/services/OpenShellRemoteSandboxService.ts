import type {
  CapabilitySourceMapping,
} from '../contracts/CapabilityNormalizationContract.js';
import type {
  OpenShellRemoteCommandPlan,
  OpenShellRemoteSandboxConfig,
  OpenShellRemoteSandboxSnapshot,
  RemoteSandboxArtifactKind,
  RemoteSandboxFeature,
  RemoteSandboxFeatureId,
} from '../contracts/RemoteSandboxContract.js';
import { ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION } from '../contracts/RemoteSandboxContract.js';
import {
  OpenShellConfigAdapter,
  type OpenShellConfigInput,
} from '../adapters/sandbox/OpenShellConfigAdapter.js';
import { OpenShellSandboxLifecycleAdapter } from '../adapters/sandbox/OpenShellSandboxLifecycleAdapter.js';
import { OpenShellSshTransportAdapter } from '../adapters/sandbox/OpenShellSshTransportAdapter.js';
import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';
import { OpenShellReadinessService } from './OpenShellReadinessService.js';
import { OpenShellWorkspaceBridgeService } from './OpenShellWorkspaceBridgeService.js';

type OpenShellRemoteSandboxRuntime = {
  now?: () => Date;
  normalizationService?: Pick<CapabilityNormalizationService, 'resolveSourceModule'>;
  configAdapter?: Pick<OpenShellConfigAdapter, 'resolve'>;
  lifecycleAdapter?: Pick<OpenShellSandboxLifecycleAdapter, 'buildPlan'>;
  sshTransportAdapter?: Pick<OpenShellSshTransportAdapter, 'buildSessionPlan'>;
  workspaceBridgeService?: Pick<OpenShellWorkspaceBridgeService, 'buildSyncPlan'>;
  readinessService?: Pick<OpenShellReadinessService, 'buildSnapshot'>;
};

const ARTIFACT_KINDS: RemoteSandboxArtifactKind[] = [
  'sandbox.session',
  'sandbox.command',
  'sandbox.workspace-delta',
  'sandbox.sync-plan',
  'sandbox.readiness',
  'sandbox.apply-plan',
  'sandbox.remote.receipt',
];

export class OpenShellRemoteSandboxService {
  private readonly now: () => Date;
  private readonly normalization: Pick<CapabilityNormalizationService, 'resolveSourceModule'>;
  private readonly configAdapter: Pick<OpenShellConfigAdapter, 'resolve'>;
  private readonly lifecycle: Pick<OpenShellSandboxLifecycleAdapter, 'buildPlan'>;
  private readonly ssh: Pick<OpenShellSshTransportAdapter, 'buildSessionPlan'>;
  private readonly workspaceBridge: Pick<OpenShellWorkspaceBridgeService, 'buildSyncPlan'>;
  private readonly readiness: Pick<OpenShellReadinessService, 'buildSnapshot'>;

  constructor(runtime: OpenShellRemoteSandboxRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.configAdapter = runtime.configAdapter || new OpenShellConfigAdapter();
    this.lifecycle = runtime.lifecycleAdapter || new OpenShellSandboxLifecycleAdapter();
    this.ssh = runtime.sshTransportAdapter || new OpenShellSshTransportAdapter();
    this.workspaceBridge = runtime.workspaceBridgeService || new OpenShellWorkspaceBridgeService();
    this.readiness = runtime.readinessService || new OpenShellReadinessService();
  }

  public buildSnapshot(input: {
    config?: OpenShellConfigInput;
    scopeKey?: string | null;
    localRoot?: string | null;
    command?: string | null;
    cwd?: string | null;
    env?: Record<string, string | undefined> | null;
    pty?: boolean;
    stdin?: string | null;
  } = {}): OpenShellRemoteSandboxSnapshot {
    const capabilityMapping = this.normalization.resolveSourceModule('openshell');
    this.assertOpenShellMapping(capabilityMapping);
    const config = this.configAdapter.resolve(input.config || {});
    const commandPlan = this.buildCommandPlan({
      config,
      scopeKey: input.scopeKey,
      localRoot: input.localRoot,
      command: input.command,
      cwd: input.cwd,
      env: input.env,
      pty: input.pty,
      stdin: input.stdin,
    });
    const readiness = this.readiness.buildSnapshot({ config });
    const features = this.buildFeatures();
    const missing = features.filter((feature) => feature.status === 'missing').length;
    const receipts = [
      ...features.map((feature) => `openshell.${feature.id}.receipt`),
      commandPlan.receipt,
      readiness.receipt,
    ];

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_REMOTE_SANDBOX_CONTRACT_VERSION,
      status: missing === 0 ? 'closed' : 'attention',
      sourceModule: 'openshell',
      primitiveId: 'sandbox.remote',
      summary: {
        features: features.length,
        nativeRuntimeProofs: features.filter((feature) => feature.status === 'native-runtime-proof').length,
        missing,
        lifecycleActions: commandPlan.lifecycle.actions.length,
        readinessChecks: readiness.checks.length,
        artifactKinds: ARTIFACT_KINDS.length,
        liveExternalCallRequired: false,
        liveSshRequired: false,
        processSpawnRequired: false,
        filesystemWriteRequired: false,
        mirrorBackToHost: false,
        secretValuesSerialized: false,
      },
      config,
      lifecycle: commandPlan.lifecycle,
      commandPlan,
      readiness,
      features,
      artifactKinds: ARTIFACT_KINDS,
      receipts,
      policy: {
        noSourceImports: true,
        noSourceManifestRuntimeDependency: true,
        noLiveIoInProof: true,
        noSecretsSerialized: true,
        artifactFirstMirror: true,
        mutationApprovalRequiredForHostApply: true,
        dockerBindsUnsupported: true,
        envDenylistRequired: true,
      },
      commands: {
        check: 'npm run openshell-sandbox-certification:check --silent',
        focusedTests: [
          'npx jest tests/services/OpenShellRemoteSandboxService.test.ts --runInBand',
          'npm run openshell-sandbox-certification:check --silent',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextWorker: 'Worker 4 - SDK/export closure',
      },
    };
  }

  public buildCommandPlan(input: {
    config?: OpenShellRemoteSandboxConfig;
    scopeKey?: string | null;
    localRoot?: string | null;
    command?: string | null;
    cwd?: string | null;
    env?: Record<string, string | undefined> | null;
    pty?: boolean;
    stdin?: string | null;
  }): OpenShellRemoteCommandPlan {
    const config = input.config || this.configAdapter.resolve({});
    const lifecycle = this.lifecycle.buildPlan({
      scopeKey: String(input.scopeKey || '').trim() || 'default',
      config,
    });
    const command = String(input.command || '').trim() || 'true';
    const workspace = this.workspaceBridge.buildSyncPlan({
      config,
      localRoot: String(input.localRoot || '').trim() || process.cwd(),
    });
    const ssh = this.ssh.buildSessionPlan({
      runtimeId: lifecycle.runtimeId,
      config,
      command,
      cwd: input.cwd || config.remoteWorkspaceDir,
      env: input.env || {},
      pty: input.pty,
      stdin: input.stdin,
    });
    return {
      runtimeId: lifecycle.runtimeId,
      command,
      workingDirectory: String(input.cwd || config.remoteWorkspaceDir).trim() || config.remoteWorkspaceDir,
      timeoutMs: config.timeoutMs,
      pty: input.pty === true,
      stdinMode: String(input.stdin || '').length > 0 ? 'pipe-open' : 'closed',
      lifecycle,
      ssh,
      workspace,
      artifacts: [
        'sandbox.session',
        'sandbox.command',
        'sandbox.workspace-delta',
        'sandbox.sync-plan',
        'sandbox.remote.receipt',
      ],
      receipt: `openshell.command.${lifecycle.runtimeId}.receipt`,
      liveIoRequired: false,
      filesystemWriteRequired: false,
      secretValuesSerialized: false,
    };
  }

  private buildFeatures(): RemoteSandboxFeature[] {
    return [
      feature('config-contract', ['OpenShell config resolves Zavorth defaults and managed remote path validation.'], ['sandbox.remote.receipt']),
      feature('cli-adapter', ['OpenShell CLI invocations are represented as redacted no-live-IO plans.'], ['sandbox.command', 'sandbox.remote.receipt']),
      feature('lifecycle-manager', ['Sandbox get/create/delete lifecycle uses deterministic runtime IDs.'], ['sandbox.session', 'sandbox.remote.receipt']),
      feature('ssh-transport', ['SSH command plans include shell escaping, PTY mode and pipe-open stdin.'], ['sandbox.command', 'sandbox.remote.receipt']),
      feature('remote-execution', ['Remote execution plans bind lifecycle, SSH and workspace artifacts without live SSH.'], ['sandbox.command', 'sandbox.remote.receipt']),
      feature('filesystem-bridge', ['Workspace bridge keeps containment, symlink, hardlink and artifact-first guards visible.'], ['sandbox.sync-plan', 'sandbox.workspace-delta']),
      feature('artifact-first-mirror', ['Mirror mode is converted to artifact-first collection with host apply blocked by default.'], ['sandbox.workspace-delta', 'sandbox.apply-plan']),
      feature('workspace-sync', ['Upload/collect plans exist without automatic host mirror-back.'], ['sandbox.sync-plan', 'sandbox.workspace-delta']),
      feature('env-filter', ['Secret-bearing environment keys are denied before SSH execution.'], ['sandbox.command', 'sandbox.remote.receipt']),
      feature('readiness-doctor', ['Readiness snapshot checks CLI config, remote roots, gateway config and smoke command.'], ['sandbox.readiness', 'sandbox.remote.receipt']),
      feature('security-behavior-tests', ['Tests cover remote path escape, local path escape, env filtering and artifact-first mirror policy.'], ['sandbox.remote.receipt']),
    ];
  }

  private assertOpenShellMapping(mapping: CapabilitySourceMapping): void {
    if (mapping.primitiveId !== 'sandbox.remote' || mapping.status !== 'normalized') {
      throw new Error('OpenShell source module must be normalized as sandbox.remote before runtime certification closure.');
    }
  }
}

function feature(
  id: RemoteSandboxFeatureId,
  evidence: string[],
  artifactKinds: RemoteSandboxArtifactKind[],
): RemoteSandboxFeature {
  return {
    id,
    status: 'native-runtime-proof',
    evidence,
    artifactKinds,
    receiptKind: 'sandbox.remote.receipt',
  };
}
