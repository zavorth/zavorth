import { ZavorthSandboxControlPlaneService } from '../../src/services/ZavorthSandboxControlPlaneService';

const dockerStatus = (overrides: Record<string, unknown> = {}) => ({
  enabled: true,
  language: 'javascript',
  image: 'node:22-bullseye',
  dockerReachable: true,
  daemonReachable: true,
  imagePresent: true,
  autoPullEnabled: false,
  sandboxRuntime: 'runc',
  canRun: true,
  detail: 'Docker pronto.',
  ...overrides,
});

const firecrackerStatus = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  transport: 'wsl',
  firecrackerReachable: false,
  kvmAvailable: false,
  kernelPresent: false,
  rootfsPresent: false,
  canRun: false,
  detail: 'Firecracker desabilitado.',
  ...overrides,
});

const wasmStatus = (overrides: Record<string, unknown> = {}) => ({
  enabled: false,
  available: true,
  canRun: false,
  detail: 'Wasm desabilitado.',
  runtime: 'node-webassembly',
  supportedLanguages: ['wasm'],
  recommendedAction: 'npm run sandbox:wasm:smoke',
  ...overrides,
});

describe('ZavorthSandboxControlPlaneService', () => {
  it('reports lazy sandbox capabilities without probing heavy runtime activation', () => {
    const isGvisorActive = jest.fn(() => true);
    const service = new ZavorthSandboxControlPlaneService({
      now: () => new Date('2026-04-18T10:00:00.000Z'),
      dockerRuntime: {
        getStatus: jest.fn(() => dockerStatus({ sandboxRuntime: 'runsc' })),
        isGvisorActive,
      } as any,
      firecrackerRuntime: {
        getStatus: jest.fn(() => firecrackerStatus()),
      } as any,
      wasmCapabilityService: {
        getStatus: jest.fn(() => wasmStatus()),
      } as any,
      env: {},
      platform: 'win32',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(isGvisorActive).not.toHaveBeenCalled();
    expect(snapshot.profiles).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'process', status: 'ready', heavyRuntime: false }),
      expect.objectContaining({ id: 'container', status: 'ready', heavyRuntime: true }),
      expect.objectContaining({ id: 'gvisor', status: 'ready', startsOnRead: false }),
    ]));
    expect(snapshot.summary.untrustedExecutionReady).toBe(true);
  });

  it('creates a high-risk envelope with budget, temp-only filesystem and approval posture', () => {
    const service = new ZavorthSandboxControlPlaneService({
      now: () => new Date('2026-04-18T10:00:00.000Z'),
      dockerRuntime: {
        getStatus: jest.fn(() => dockerStatus()),
      } as any,
      firecrackerRuntime: {
        getStatus: jest.fn(() => firecrackerStatus({
          enabled: true,
          firecrackerReachable: true,
          kvmAvailable: true,
          kernelPresent: true,
          rootfsPresent: true,
          canRun: true,
          detail: 'Firecracker pronto.',
        })),
      } as any,
      wasmCapabilityService: {
        getStatus: jest.fn(() => wasmStatus()),
      } as any,
      env: {},
      platform: 'linux',
    });

    const snapshot = service.buildSnapshot({
      command: 'sudo nmap 127.0.0.1',
      language: 'shell',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(snapshot.envelopePreview).toEqual(expect.objectContaining({
      sandboxProfile: 'firecracker',
      networkPolicy: 'none',
      riskLevel: 'high',
      status: 'waiting_approval',
    }));
    expect(snapshot.envelopePreview?.budget).toEqual(expect.objectContaining({
      maxDurationMs: 30000,
      maxFilesystemWrites: 0,
      maxNetworkCalls: 0,
    }));
    expect(snapshot.envelopePreview?.filesystemPolicy).toEqual(expect.objectContaining({
      tempWorkspaceOnly: true,
      hostMountsReadOnly: true,
      deniedHostWrite: true,
      artifactCollection: 'explicit',
    }));
    expect(snapshot.envelopePreview?.cleanupPlan).toEqual(expect.objectContaining({
      killOnTimeout: true,
      removeWorkspace: true,
      removeContainerOrVm: true,
    }));
  });

  it('separates not-installed, unsupported, dormant and disabled doctor states', () => {
    const service = new ZavorthSandboxControlPlaneService({
      dockerRuntime: {
        getStatus: jest.fn(() => dockerStatus({
          dockerReachable: false,
          daemonReachable: false,
          imagePresent: false,
          canRun: false,
          detail: 'Docker CLI nao encontrado.',
        })),
      } as any,
      firecrackerRuntime: {
        getStatus: jest.fn(() => firecrackerStatus({
          enabled: true,
          detail: 'Plataforma atual win32 nao suporta Firecracker direto.',
        })),
      } as any,
      wasmCapabilityService: {
        getStatus: jest.fn(() => wasmStatus({ enabled: false })),
      } as any,
      env: {},
      platform: 'win32',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.doctor.ready).toContain('process');
    expect(snapshot.doctor.notInstalled).toContain('container');
    expect(snapshot.doctor.unsupported).toContain('firecracker');
    expect(snapshot.doctor.dormant).toContain('gvisor');
    expect(snapshot.doctor.disabled).toEqual(expect.arrayContaining(['remote-node', 'wasm']));
  });
});
