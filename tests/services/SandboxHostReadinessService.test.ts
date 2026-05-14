import { SandboxHostReadinessService } from '../../src/services/SandboxHostReadinessService';
import type { DockerSandboxStatus } from '../../src/services/sandbox/DockerSandboxRuntime';
import type { FirecrackerSandboxStatus } from '../../src/services/sandbox/FirecrackerSandboxRuntime';

describe('SandboxHostReadinessService', () => {
  it('reports Firecracker as dormant on Windows without blocking the core', async () => {
    const microvmSmoke = jest.fn();
    const service = new SandboxHostReadinessService({
      platform: 'win32',
      osRelease: 'test-win',
      config: baseConfig({
        firecrackerEnabled: false,
        firecrackerTransport: 'wsl',
      }),
      dockerRuntime: dockerRuntime(dockerStatus({
        enabled: false,
        detail: 'docker disabled in test',
      })),
      firecrackerRuntime: firecrackerRuntime(firecrackerStatus({
        enabled: false,
        transport: 'wsl',
        detail: 'Firecracker disabled in test',
      })),
      localJailRuntime: localJailRuntime(),
      sandboxExecutionService: {
        executeCodeInMicrovm: microvmSmoke,
      },
      existsSync: () => false,
      accessSync: () => {
        throw new Error('not available');
      },
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const snapshot = service.inspect();
    const firecracker = snapshot.tiers.find((tier) => tier.id === 'firecracker');

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.defaultPolicy.strongSandboxReady).toBe(false);
    expect(snapshot.defaultPolicy.liveMutationDefault).toBe('dry-run-only');
    expect(snapshot.defaultPolicy.blockedWithoutStrongSandbox).toEqual(expect.arrayContaining([
      'workspace-write',
      'host-command',
      'network-write',
      'channel-send',
      'live-skill-apply',
    ]));
    expect(firecracker?.status).toBe('dormant');
    expect(firecracker?.reasons.join(' ')).toContain('Windows');

    const smoke = await service.runSmoke({
      includeLocalJail: false,
      includeMicrovm: true,
    });
    const smokedFirecracker = smoke.tiers.find((tier) => tier.id === 'firecracker');

    expect(microvmSmoke).not.toHaveBeenCalled();
    expect(smokedFirecracker?.smoke).toEqual(expect.objectContaining({
      id: 'firecracker:e2e',
      status: 'skip',
    }));
    expect(smoke.summary.ok).toBe(true);
  });

  it('runs the MicroVM smoke only when Linux/KVM and assets are ready', async () => {
    const microvmSmoke = jest.fn().mockResolvedValue({
      stdout: 'zavorth-microvm-ok\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 5,
      securityLevel: 'microvm',
      runtime: 'FirecrackerSandboxRuntime',
    });
    const service = new SandboxHostReadinessService({
      platform: 'linux',
      osRelease: 'test-linux',
      config: baseConfig({
        firecrackerEnabled: true,
        firecrackerTransport: 'direct',
        firecrackerBinPath: '/usr/local/bin/firecracker',
        firecrackerKernelPath: '/repo/data/firecracker/vmlinux',
        firecrackerRootfsPath: '/repo/data/firecracker/rootfs.ext4',
      }),
      dockerRuntime: dockerRuntime(dockerStatus({ canRun: true })),
      firecrackerRuntime: firecrackerRuntime(firecrackerStatus({
        enabled: true,
        transport: 'direct',
        firecrackerReachable: true,
        kvmAvailable: true,
        kernelPresent: true,
        rootfsPresent: true,
        canRun: true,
        detail: 'Firecracker ready',
      })),
      localJailRuntime: localJailRuntime(),
      sandboxExecutionService: {
        executeCodeInMicrovm: microvmSmoke,
      },
      existsSync: (targetPath) => [
        '/dev/kvm',
        '/usr/local/bin/firecracker',
        '/repo/data/firecracker/vmlinux',
        '/repo/data/firecracker/rootfs.ext4',
      ].includes(targetPath),
      accessSync: () => undefined,
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const smoke = await service.runSmoke({
      includeLocalJail: false,
      includeMicrovm: true,
    });
    const firecracker = smoke.tiers.find((tier) => tier.id === 'firecracker');

    expect(firecracker?.status).toBe('ready');
    expect(smoke.defaultPolicy.strongSandboxReady).toBe(true);
    expect(smoke.defaultPolicy.liveMutationDefault).toBe('sandboxed-with-approval');
    expect(firecracker?.smoke).toEqual(expect.objectContaining({
      id: 'firecracker:e2e',
      status: 'pass',
      exitCode: 0,
    }));
    expect(microvmSmoke).toHaveBeenCalledWith(
      'console.log("zavorth-microvm-ok")',
      'javascript',
      15000,
    );
    expect(smoke.summary.ok).toBe(true);
  });

  it('keeps Docker and gVisor as explicit tiers without starting a runsc smoke on read', () => {
    const service = new SandboxHostReadinessService({
      platform: 'linux',
      osRelease: 'test-linux',
      config: baseConfig({
        dockerSandboxRuntime: 'runsc',
      }),
      dockerRuntime: dockerRuntime(dockerStatus({
        canRun: true,
        sandboxRuntime: 'runsc',
      })),
      firecrackerRuntime: firecrackerRuntime(firecrackerStatus({
        enabled: false,
        detail: 'disabled',
      })),
      localJailRuntime: localJailRuntime(),
      existsSync: () => false,
      accessSync: () => {
        throw new Error('not available');
      },
    });

    const snapshot = service.inspect();
    const docker = snapshot.tiers.find((tier) => tier.id === 'docker');
    const gvisor = snapshot.tiers.find((tier) => tier.id === 'gvisor');

    expect(docker?.status).toBe('ready');
    expect(gvisor?.status).toBe('ready');
    expect(gvisor?.startsOnRead).toBe(false);
    expect(gvisor?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'gvisor:runtime-config',
        status: 'pass',
      }),
    ]));
  });

  it('marks local-jail smoke failure as blocking because it is the minimum fallback', async () => {
    const service = new SandboxHostReadinessService({
      platform: 'linux',
      osRelease: 'test-linux',
      config: baseConfig(),
      dockerRuntime: dockerRuntime(dockerStatus({ enabled: false })),
      firecrackerRuntime: firecrackerRuntime(firecrackerStatus({
        enabled: false,
        detail: 'disabled',
      })),
      localJailRuntime: {
        execute: jest.fn().mockResolvedValue({
          stdout: '',
          stderr: 'boom',
          exitCode: 1,
          executionTimeMs: 1,
          securityLevel: 'local-jail',
          runtime: 'LocalJailSandboxRuntime',
        }),
      },
      existsSync: () => false,
      accessSync: () => {
        throw new Error('not available');
      },
    });

    const snapshot = await service.runSmoke({
      includeLocalJail: true,
      includeMicrovm: false,
    });
    const localJail = snapshot.tiers.find((tier) => tier.id === 'local-jail');

    expect(localJail?.status).toBe('degraded');
    expect(localJail?.smoke?.status).toBe('fail');
    expect(snapshot.summary.ok).toBe(false);
  });
});

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    dockerSandboxEnabled: true,
    dockerSandboxRequired: false,
    dockerCliPath: 'docker',
    dockerSandboxImage: 'node:22-bullseye',
    dockerSandboxJavascriptImage: 'node:22-bullseye',
    dockerSandboxAutoPull: false,
    dockerSandboxRuntime: '',
    firecrackerEnabled: false,
    firecrackerTransport: 'direct',
    firecrackerBinPath: 'firecracker',
    firecrackerKernelPath: '/repo/data/firecracker/vmlinux',
    firecrackerRootfsPath: '/repo/data/firecracker/rootfs.ext4',
    ...overrides,
  } as any;
}

function dockerStatus(overrides: Partial<DockerSandboxStatus> = {}): DockerSandboxStatus {
  return {
    enabled: true,
    language: 'javascript',
    image: 'node:22-bullseye',
    dockerReachable: true,
    daemonReachable: true,
    imagePresent: true,
    autoPullEnabled: false,
    sandboxRuntime: 'runc',
    canRun: false,
    detail: 'docker test status',
    ...overrides,
  };
}

function firecrackerStatus(overrides: Partial<FirecrackerSandboxStatus> = {}): FirecrackerSandboxStatus {
  return {
    enabled: false,
    transport: 'direct',
    bridgeReady: false,
    firecrackerReachable: false,
    kvmAvailable: false,
    kernelPresent: false,
    rootfsPresent: false,
    canRun: false,
    detail: 'firecracker test status',
    ...overrides,
  };
}

function dockerRuntime(status: DockerSandboxStatus) {
  return {
    getStatus: jest.fn().mockReturnValue(status),
  };
}

function firecrackerRuntime(status: FirecrackerSandboxStatus) {
  return {
    getStatus: jest.fn().mockReturnValue(status),
  };
}

function localJailRuntime() {
  return {
    execute: jest.fn().mockResolvedValue({
      stdout: 'zavorth-local-jail-ok\n',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 1,
      securityLevel: 'local-jail',
      runtime: 'LocalJailSandboxRuntime',
    }),
  };
}
