import { DeepSandboxIsolationService } from '../../src/domain/trust-governance/infrastructure/DeepSandboxIsolationService.js';

describe('DeepSandboxIsolationService', () => {
  it('prefers microvm when aggressive opt-in is active and Firecracker is available', () => {
    const service = new DeepSandboxIsolationService({
      sandboxExecutionService: {
        resolveSandboxTier: jest.fn(() => ({ tier: 'container', reason: 'policy' })),
      } as any,
      dockerRuntime: {
        getStatus: jest.fn(() => ({
          enabled: true,
          language: 'javascript',
          image: 'node:22',
          dockerReachable: true,
          daemonReachable: true,
          imagePresent: true,
          autoPullEnabled: false,
          sandboxRuntime: 'runsc',
          canRun: true,
          detail: 'docker ok',
        })),
        isGvisorActive: jest.fn(() => true),
      } as any,
      firecrackerRuntime: {
        getStatus: jest.fn(() => ({
          enabled: true,
          transport: 'wsl',
          canRun: true,
          detail: 'firecracker ok',
          runtime: 'firecracker',
          recommendedAction: null,
        })),
      } as any,
      wasmCapabilityService: {
        getStatus: jest.fn(() => ({
          enabled: false,
          available: true,
          canRun: false,
          detail: 'disabled',
          runtime: 'node-webassembly',
          supportedLanguages: ['wasm'],
          recommendedAction: null,
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ aggressiveOptIn: true });
    const decision = service.resolveDecision({
      executor: 'local',
      instructions: ['npm test'],
      metadata: {},
    } as any, {
      aggressiveOptIn: true,
    });

    expect(snapshot.posture).toBe('microvm-kernel');
    expect(decision.requestedTier).toBe('microvm');
    expect(decision.reason).toContain('Firecracker');
  });

  it('reports honest container posture when only Docker is available', () => {
    const service = new DeepSandboxIsolationService({
      sandboxExecutionService: {
        resolveSandboxTier: jest.fn(() => null),
      } as any,
      dockerRuntime: {
        getStatus: jest.fn(() => ({
          enabled: true,
          language: 'javascript',
          image: 'node:22',
          dockerReachable: true,
          daemonReachable: true,
          imagePresent: true,
          autoPullEnabled: false,
          sandboxRuntime: 'runc',
          canRun: true,
          detail: 'docker ok',
        })),
        isGvisorActive: jest.fn(() => false),
      } as any,
      firecrackerRuntime: {
        getStatus: jest.fn(() => ({
          enabled: false,
          transport: 'wsl',
          canRun: false,
          detail: 'firecracker disabled',
          runtime: 'firecracker',
          recommendedAction: 'enable firecracker',
        })),
      } as any,
      wasmCapabilityService: {
        getStatus: jest.fn(() => ({
          enabled: false,
          available: true,
          canRun: false,
          detail: 'disabled',
          runtime: 'node-webassembly',
          supportedLanguages: ['wasm'],
          recommendedAction: null,
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ aggressiveOptIn: false });

    expect(snapshot.posture).toBe('container-runc');
    expect(snapshot.preferredTier).toBe('container');
    expect(snapshot.summary).toContain('Docker');
  });
});
