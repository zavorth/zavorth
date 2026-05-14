import { DeterministicQaMatrixService } from '../../src/services/DeterministicQaMatrixService';
import type { DeterministicQaGateSpec } from '../../src/contracts/DeterministicQaContract';

describe('DeterministicQaMatrixService', () => {
  it('passes against the current repository QA matrix', () => {
    const service = new DeterministicQaMatrixService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('41');
    expect(snapshot.surface).toBe('deterministic-qa-matrix');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.tiers.quick.gates).toContain('product-quality');
    expect(snapshot.tiers.standard.gates).toEqual(expect.arrayContaining(snapshot.tiers.quick.gates));
    expect(snapshot.tiers.release.gates).toEqual(expect.arrayContaining(snapshot.tiers.standard.gates));
    expect(snapshot.nextRecommendedPhase).toEqual(expect.objectContaining({
      phase: '45',
      title: 'Runtime Performance And Idle Budget',
    }));
  });

  it('fails when a required package script is missing', () => {
    const service = new DeterministicQaMatrixService({
      packageJson: {
        scripts: {
          'runtime:check': 'tsc --noEmit',
        },
      },
      gates: [
        gate({
          id: 'runtime-check',
          packageScript: 'runtime:check',
        }),
        gate({
          id: 'product-quality',
          packageScript: 'qa:product-quality',
        }),
      ],
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'script:qa:product-quality',
        status: 'fail',
      }),
    ]));
  });

  it('fails gates that require network or persistent background process', () => {
    const service = new DeterministicQaMatrixService({
      packageJson: {
        scripts: {
          'qa:remote': 'node remote.js',
        },
      },
      gates: [
        gate({
          id: 'remote',
          packageScript: 'qa:remote',
          command: 'npm run qa:remote',
          requiresNetwork: true,
          startsPersistentProcess: true,
        }),
      ],
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'matrix:no-network',
        status: 'fail',
      }),
      expect.objectContaining({
        id: 'matrix:no-persistent-process',
        status: 'fail',
      }),
    ]));
  });

  it('renders the selected next phase recommendation', () => {
    const service = new DeterministicQaMatrixService({
      packageJson: {
        scripts: {
          'runtime:check': 'tsc --noEmit',
        },
      },
      gates: [
        gate({
          id: 'runtime-check',
          packageScript: 'runtime:check',
        }),
      ],
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const report = service.renderReport();

    expect(report).toContain('Fase 41 - QA Deterministico');
    expect(report).toContain('proxima fase recomendada: 45 - Runtime Performance And Idle Budget');
  });
});

function gate(overrides: Partial<DeterministicQaGateSpec> = {}): DeterministicQaGateSpec {
  return {
    id: 'gate',
    label: 'Gate',
    tier: 'quick',
    layer: 'contract',
    command: 'npm run gate',
    packageScript: 'gate',
    maxDurationMs: 1000,
    required: true,
    requiresNetwork: false,
    startsPersistentProcess: false,
    producesJson: false,
    reason: 'test gate',
    ...overrides,
  };
}
