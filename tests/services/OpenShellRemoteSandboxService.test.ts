import { OpenShellCliAdapter } from '../../src/adapters/sandbox/OpenShellCliAdapter.js';
import { OpenShellConfigAdapter } from '../../src/adapters/sandbox/OpenShellConfigAdapter.js';
import { OpenShellSandboxLifecycleAdapter } from '../../src/adapters/sandbox/OpenShellSandboxLifecycleAdapter.js';
import { OpenShellSshTransportAdapter } from '../../src/adapters/sandbox/OpenShellSshTransportAdapter.js';
import { CapabilityNormalizationService } from '../../src/services/CapabilityNormalizationService.js';
import { OpenShellRemoteSandboxService } from '../../src/services/OpenShellRemoteSandboxService.js';
import { OpenShellWorkspaceBridgeService } from '../../src/services/OpenShellWorkspaceBridgeService.js';

describe('OpenShellRemoteSandboxService Worker 3', () => {
  it('closes OpenShell as a Zavorth-native remote sandbox runtime proof', () => {
    const snapshot = new OpenShellRemoteSandboxService({
      now: () => new Date('2026-05-04T23:30:00.000Z'),
    }).buildSnapshot({
      config: {
        mode: 'mirror',
        gateway: 'local',
        gatewayEndpoint: 'http://127.0.0.1:9922',
        policy: 'guardian',
        providers: ['cpu', 'gpu', 'cpu'],
        gpu: true,
        remoteWorkspaceDir: '/sandbox/project',
        remoteAgentWorkspaceDir: '/agent/runtime',
        timeoutSeconds: 30,
      },
      scopeKey: 'workspace-alpha',
      localRoot: 'C:/work/project',
      command: 'npm test',
      env: {
        SAFE_FLAG: '1',
        OPENAI_API_KEY: 'secret',
      },
      pty: true,
      stdin: 'input',
    });

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-3');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.sourceModule).toBe('openshell');
    expect(snapshot.primitiveId).toBe('sandbox.remote');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        features: 11,
        nativeRuntimeProofs: 11,
        missing: 0,
        lifecycleActions: 3,
        readinessChecks: 5,
        artifactKinds: 7,
        liveExternalCallRequired: false,
        liveSshRequired: false,
        processSpawnRequired: false,
        filesystemWriteRequired: false,
        mirrorBackToHost: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.config).toEqual(
      expect.objectContaining({
        mode: 'artifact-first-mirror',
        command: 'openshell',
        source: 'zavorth',
        policy: 'guardian',
        providers: ['cpu', 'gpu'],
        gpu: true,
        autoProviders: true,
        remoteWorkspaceDir: '/sandbox/project',
        remoteAgentWorkspaceDir: '/agent/runtime',
        timeoutMs: 30_000,
      }),
    );
    expect(snapshot.commandPlan.workspace).toEqual(
      expect.objectContaining({
        uploadBeforeExec: true,
        collectAfterExec: true,
        mirrorBackToHost: false,
        applyRequiresMutationApproval: true,
        pathGuards: expect.arrayContaining([
          'local-root-containment',
          'remote-managed-root-containment',
          'reject-symlink-parents',
          'reject-final-symlink',
          'reject-hardlink-alias',
          'artifact-first-output',
        ]),
      }),
    );
    expect(snapshot.commandPlan.ssh).toEqual(
      expect.objectContaining({
        pty: true,
        stdinMode: 'pipe-open',
        sanitizedEnvKeys: ['SAFE_FLAG'],
        blockedEnvKeys: ['OPENAI_API_KEY'],
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noSourceImports: true,
        noSourceManifestRuntimeDependency: true,
        noLiveIoInProof: true,
        noSecretsSerialized: true,
        artifactFirstMirror: true,
        mutationApprovalRequiredForHostApply: true,
        dockerBindsUnsupported: true,
        envDenylistRequired: true,
      }),
    );
  });

  it('keeps openshell normalized to a native remote sandbox contract target', () => {
    const normalization = new CapabilityNormalizationService();

    expect(normalization.resolveSourceModule('openshell')).toEqual(
      expect.objectContaining({
        primitiveId: 'sandbox.remote',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          contract: 'src/contracts/RemoteSandboxContract.ts',
          service: 'src/services/OpenShellRemoteSandboxService.ts',
          adapter: 'src/adapters/sandbox',
        }),
      }),
    );
    expect(normalization.getPrimitive('sandbox.remote')).toEqual(
      expect.objectContaining({
        runtimeStatus: 'native-contract',
        artifactKinds: ['sandbox.session', 'sandbox.command', 'sandbox.workspace-delta'],
      }),
    );
  });

  it('resolves config defaults, provider dedupe and managed remote path guards', () => {
    const adapter = new OpenShellConfigAdapter();

    expect(adapter.resolve({
      providers: ['alpha', 'beta', 'alpha', ''],
    })).toEqual(
      expect.objectContaining({
        mode: 'artifact-first-mirror',
        command: 'openshell',
        source: 'zavorth',
        providers: ['alpha', 'beta'],
        remoteWorkspaceDir: '/sandbox',
        remoteAgentWorkspaceDir: '/agent',
        timeoutMs: 120_000,
      }),
    );
    expect(() => adapter.resolve({ remoteWorkspaceDir: 'relative/path' })).toThrow(
      'must be absolute',
    );
    expect(() => adapter.resolve({ remoteWorkspaceDir: '/tmp/escape' })).toThrow(
      'must stay under /sandbox or /agent',
    );
  });

  it('builds deterministic lifecycle and CLI create flags without live IO', () => {
    const config = new OpenShellConfigAdapter().resolve({
      gateway: 'edge',
      gatewayEndpoint: 'https://gateway.example',
      policy: 'locked',
      providers: ['cpu'],
      gpu: true,
      autoProviders: false,
    });
    const plan = new OpenShellSandboxLifecycleAdapter().buildPlan({
      scopeKey: 'workspace-alpha',
      config,
    });

    expect(plan.runtimeId).toMatch(/^zv-os-workspace-alpha-[a-f0-9]{12}$/);
    expect(plan.deterministicRuntimeId).toBe(true);
    expect(plan.deleteIsExplicit).toBe(true);
    expect(plan.actions.map((entry) => entry.action)).toEqual(['get', 'create', 'delete']);
    expect(plan.actions[1].invocation).toEqual(
      expect.objectContaining({
        command: 'openshell',
        args: [
          'sandbox',
          'create',
          plan.runtimeId,
          '--from',
          'zavorth',
          '--gateway',
          'edge',
          '--gateway-endpoint',
          'https://gateway.example',
          '--policy',
          'locked',
          '--gpu',
          '--no-auto-providers',
          '--provider',
          'cpu',
        ],
        liveIoRequired: false,
        secretValuesSerialized: false,
      }),
    );
  });

  it('builds SSH command plans with shell escaping, PTY and env denylist', () => {
    const config = new OpenShellConfigAdapter().resolve();
    const ssh = new OpenShellSshTransportAdapter().buildSessionPlan({
      runtimeId: 'zv-os-test',
      config,
      command: 'echo done',
      cwd: '/sandbox/project path',
      env: {
        SAFE_VAR: 'hello world',
        ZAVORTH_TOKEN: 'secret',
      },
      pty: false,
      stdin: null,
    });

    expect(ssh.remoteCommand).toContain("SAFE_VAR='hello world'");
    expect(ssh.remoteCommand).toContain("cd '/sandbox/project path' && echo done");
    expect(ssh.blockedEnvKeys).toEqual(['ZAVORTH_TOKEN']);
    expect(ssh.sanitizedEnvKeys).toEqual(['SAFE_VAR']);
    expect(ssh.pty).toBe(false);
    expect(ssh.stdinMode).toBe('closed');
    expect(ssh.liveIoRequired).toBe(false);
  });

  it('keeps workspace bridge artifact-first and rejects local path escape', () => {
    const config = new OpenShellConfigAdapter().resolve();
    const bridge = new OpenShellWorkspaceBridgeService();
    const plan = bridge.buildSyncPlan({
      config,
      localRoot: 'C:/work/project',
    });

    expect(plan).toEqual(
      expect.objectContaining({
        mode: 'artifact-first-mirror',
        uploadBeforeExec: true,
        collectAfterExec: true,
        mirrorBackToHost: false,
        applyRequiresMutationApproval: true,
        excludedGlobs: ['.git/**', 'hooks/**', 'git-hooks/**', 'node_modules/**'],
      }),
    );
    expect(() => bridge.assertLocalPathContained({
      localRoot: 'C:/work/project',
      candidate: '../outside.txt',
    })).toThrow('escapes workspace root');
  });

  it('sanitizes secret-bearing CLI env keys', () => {
    const cli = new OpenShellCliAdapter();
    expect(cli.sanitizeEnv({
      SAFE: '1',
      API_KEY: 'secret',
      password: 'secret',
      OTHER_TOKEN: 'secret',
    })).toEqual({ SAFE: '1' });
    expect(cli.blockedEnvKeys({
      SAFE: '1',
      API_KEY: 'secret',
      password: 'secret',
      OTHER_TOKEN: 'secret',
    })).toEqual(['API_KEY', 'OTHER_TOKEN', 'password']);
  });
});
