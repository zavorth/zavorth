import { RuntimeIdleBudgetService } from '../../src/services/RuntimeIdleBudgetService';
import type { DesktopResourceSnapshot } from '../../src/contracts/DesktopResourceContract';

describe('RuntimeIdleBudgetService', () => {
  it('passes against the current repository idle budget contract', () => {
    const service = new RuntimeIdleBudgetService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.phase).toBe('45');
    expect(snapshot.surface).toBe('runtime-idle-budget');
    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.metrics.length).toBeGreaterThanOrEqual(7);
    expect(snapshot.commands.inspect).toBe('npm run idle:budget');
    expect(snapshot.nextRecommendedStage).toEqual(expect.objectContaining({
      stage: '40',
      title: 'Web/App Polish',
    }));
  });

  it('fails when alpha boot budgets exceed the idle contract', () => {
    const service = new RuntimeIdleBudgetService({
      packageJson: packageJsonFixture(),
      alphaBudget: alphaBudgetFixture({
        'CLI status fast': 7000,
      }),
      deterministicQaMatrix: deterministicQaMatrixFixture(),
      desktopSnapshot: null,
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'budget:boot:CLI status fast',
        status: 'fail',
      }),
    ]));
  });

  it('fails when quiet gates point to persistent background commands', () => {
    const service = new RuntimeIdleBudgetService({
      packageJson: packageJsonFixture({
        'qa:stage:45': 'npx nodemon --watch src --exec node scripts/check.js',
      }),
      alphaBudget: alphaBudgetFixture(),
      deterministicQaMatrix: deterministicQaMatrixFixture(),
      desktopSnapshot: null,
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary.ok).toBe(false);
    expect(snapshot.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'quiet-gates:no-background',
        status: 'fail',
      }),
    ]));
  });

  it('warns without failing when the passive desktop resource cache is missing', () => {
    const service = new RuntimeIdleBudgetService({
      packageJson: packageJsonFixture(),
      alphaBudget: alphaBudgetFixture(),
      deterministicQaMatrix: deterministicQaMatrixFixture(),
      desktopResourcePlane: {
        readLatest: () => null,
      },
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();
    const cache = snapshot.checks.find((check) => check.id === 'desktop-resource-cache');

    expect(snapshot.summary.ok).toBe(true);
    expect(snapshot.status).toBe('attention');
    expect(cache?.status).toBe('warn');
  });

  it('warns on passive desktop resource pressure without blocking the gate', () => {
    const service = new RuntimeIdleBudgetService({
      packageJson: packageJsonFixture(),
      alphaBudget: alphaBudgetFixture(),
      deterministicQaMatrix: deterministicQaMatrixFixture(),
      desktopSnapshot: desktopSnapshotFixture({
        zavorthMemoryMb: 600,
        zavorthProcesses: 4,
      }),
      existsSync: () => true,
      readFileSync: () => '',
    });

    const snapshot = service.buildSnapshot();
    const cache = snapshot.checks.find((check) => check.id === 'desktop-resource-cache');

    expect(snapshot.summary.ok).toBe(true);
    expect(cache?.status).toBe('warn');
  });

  it('renders a human report with the next phase recommendation', () => {
    const service = new RuntimeIdleBudgetService({
      packageJson: packageJsonFixture(),
      alphaBudget: alphaBudgetFixture(),
      deterministicQaMatrix: deterministicQaMatrixFixture(),
      desktopSnapshot: null,
      existsSync: () => true,
      readFileSync: () => '',
      now: () => new Date('2026-04-24T00:00:00.000Z'),
    });

    const report = service.renderReport();

    expect(report).toContain('Etapa 45 - Runtime Performance And Idle Budget');
    expect(report).toContain('proximo passo recomendada: 40 - Web/App Polish');
  });
});

function packageJsonFixture(overrides: Record<string, string> = {}) {
  return {
    scripts: {
      dev: 'npx nodemon --watch src --ext ts --exec "npx tsx src/index.ts"',
      'dev:supervised': 'npx tsx src/host.ts',
      start: 'node dist/index.js',
      'start:supervised': 'node dist/host.js',
      'nodes:host': 'npm run build --silent && node dist-ops/scripts/node-mesh-host.js',
      'ops:maintain:scheduled': 'node scripts/ops-maintain-recurring.mjs',
      'start:ai-gateway': 'npm run build --silent && node scripts/start-ai-gateway-runtime.mjs',
      'agent:start': 'npm --prefix agent start',
      'runtime:check': 'tsc --noEmit',
      'qa:product-quality': 'npx tsx scripts/product-quality-contract.ts --require-pass',
      'qa:web-app-polish': 'npx tsx scripts/web-app-polish.ts --require-pass',
      'qa:artifact-workbench': 'npx tsx scripts/artifact-replay-workbench.ts --require-pass',
      'qa:release-ux': 'npx tsx scripts/release-ux-wizard.ts --require-pass',
      'qa:tenant-team-ops': 'npx tsx scripts/tenant-team-ops.ts --require-pass',
      'qa:deterministic': 'npx tsx scripts/deterministic-qa.ts --require-pass',
      'qa:stage:39': 'node scripts/capability-suite-market-check.mjs --phase=39',
      'qa:stage:40': 'node scripts/capability-suite-market-check.mjs --phase=40',
      'qa:stage:41': 'node scripts/capability-suite-market-check.mjs --phase=41',
      'qa:stage:42': 'node scripts/capability-suite-market-check.mjs --phase=42',
      'qa:stage:43': 'node scripts/capability-suite-market-check.mjs --phase=43',
      'qa:stage:44': 'node scripts/capability-suite-market-check.mjs --phase=44',
      'qa:stage:45': 'node scripts/capability-suite-market-check.mjs --phase=45',
      ...overrides,
    },
  };
}

function alphaBudgetFixture(overrides: Record<string, number> = {}) {
  const durations = {
    'Gateway host boot': 400,
    'CLI status fast': 5000,
    'CLI doctor fast': 10000,
    'CLI ops access fast': 1200,
    ...overrides,
  };

  return {
    benchmarks: {
      'benchmark-boot.json': {
        operations: Object.fromEntries(
          Object.entries(durations).map(([name, maxDurationMs]) => [name, { maxDurationMs }]),
        ),
      },
    },
  };
}

function deterministicQaMatrixFixture() {
  return {
    buildSnapshot: () => ({
      tiers: {
        quick: {
          maxDurationMs: 780000,
          gates: ['runtime-check', 'product-quality', 'deterministic-qa'],
        },
      },
    }),
  } as any;
}

function desktopSnapshotFixture(options: {
  zavorthMemoryMb: number;
  zavorthProcesses: number;
}): DesktopResourceSnapshot {
  return {
    version: 1,
    generatedAt: '2026-04-24T00:00:00.000Z',
    host: {
      hostname: 'test',
      platform: 'win32',
      totalVisibleMemoryMb: 32000,
      freePhysicalMemoryMb: 16000,
      totalPhysicalMemoryMb: 32000,
      memoryLoadPercent: 50,
      pressure: 'low',
      usedPhysicalMemoryMb: 16000,
    },
    signals: {
      wsl: {
        ok: true,
        distros: [],
        message: 'ok',
        warnings: [],
      },
      docker: {
        detected: false,
        status: 'unavailable',
        runningContainerCount: null,
        contextName: null,
        warnings: [],
      },
    },
    totals: {
      processesTracked: options.zavorthProcesses,
      groupsTracked: 1,
      memoryTrackedMb: options.zavorthMemoryMb,
      companionMemoryMb: 0,
      zavorthMemoryMb: options.zavorthMemoryMb,
      externalMemoryMb: 0,
    },
    groups: [],
    items: Array.from({ length: options.zavorthProcesses }, (_, index) => ({
      id: `zavorth-${index}`,
      label: `zavorth ${index}`,
      owner: 'zavorth',
      kind: 'process',
      pressure: 'low',
      controlId: 'zavorth',
      status: 'running',
      summary: 'test process',
      details: [],
      metrics: {
        cpuSeconds: 0,
        workingSetMb: 100,
        pagedMemoryMb: 0,
        privateMemoryMb: 100,
        readTransferMb: 0,
        writeTransferMb: 0,
      },
      process: {
        pid: index + 1,
        processName: 'node',
        executablePath: null,
        commandLine: 'node dist/index.js',
        mainWindowTitle: null,
      },
    })),
    topConsumers: [],
    recommendedActions: [],
    warnings: [],
    recommendations: [],
  };
}
