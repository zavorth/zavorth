import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthQaControlPlaneService } from '../../src/services/ZavorthQaControlPlaneService.js';

describe('ZavorthQaControlPlaneService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds a healthy QA snapshot when budgets, smokes and regressions are green', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-qa-plane-'));
    tempDirs.push(root);
    const qaRuntimeDir = path.join(root, 'runtime');
    const qaBudgetsDir = path.join(root, 'budgets');
    fs.mkdirSync(qaRuntimeDir, { recursive: true });
    fs.mkdirSync(qaBudgetsDir, { recursive: true });

    fs.writeFileSync(path.join(qaBudgetsDir, 'alpha.json'), JSON.stringify({
      profile: 'alpha',
      benchmarks: {
        'benchmark-boot.json': {
          label: 'Boot benchmark',
          required: true,
          maxAgeHours: 96,
          operations: {
            'Gateway host boot': { maxDurationMs: 500, maxMemoryDeltaBytes: 512 },
          },
        },
      },
      regression: {
        'critical-regression.json': {
          label: 'Critical regression suite',
          required: true,
          maxAgeHours: 96,
          maxFailures: 0,
          requiredTests: ['gateway-public-api'],
        },
      },
      smokes: {
        'smoke-suite.json': {
          label: 'Smoke suite',
          required: true,
          maxAgeHours: 96,
          maxFailures: 0,
          requiredSteps: ['build'],
        },
      },
    }, null, 2));
    fs.writeFileSync(path.join(qaBudgetsDir, 'beta.json'), fs.readFileSync(path.join(qaBudgetsDir, 'alpha.json'), 'utf8'));

    fs.writeFileSync(path.join(qaRuntimeDir, 'benchmark-boot.json'), JSON.stringify({
      suiteName: 'Boot benchmark',
      generatedAt: '2026-04-12T18:00:00.000Z',
      status: 'passed',
      summary: {
        totalRuns: 1,
        passed: 1,
        failed: 0,
        warnings: 0,
        totalDurationMs: 120,
        averageDurationMs: 120,
      },
      runs: [
        {
          operationName: 'Gateway host boot',
          durationMs: 120,
          memoryDeltaBytes: -4096,
          success: true,
          error: null,
          warning: null,
          details: {},
        },
      ],
    }, null, 2));

    fs.writeFileSync(path.join(qaRuntimeDir, 'critical-regression.json'), JSON.stringify({
      generatedAt: '2026-04-12T18:00:00.000Z',
      status: 'passed',
      failures: 0,
      tests: [
        {
          id: 'gateway-public-api',
          description: 'Gateway ok',
          criticalPath: 'gateway',
          success: true,
          durationMs: 50,
          error: null,
        },
      ],
    }, null, 2));

    fs.writeFileSync(path.join(qaRuntimeDir, 'smoke-suite.json'), JSON.stringify({
      suiteName: 'Smoke Suite',
      generatedAt: '2026-04-12T18:00:00.000Z',
      status: 'passed',
      summary: {
        totalSteps: 1,
        passed: 1,
        failed: 0,
        totalDurationMs: 500,
      },
      steps: [
        {
          id: 'build',
          label: 'build',
          command: 'npm run build',
          durationMs: 500,
          success: true,
          error: null,
        },
      ],
    }, null, 2));

    const service = new ZavorthQaControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      qaRuntimeDir,
      qaBudgetsDir,
      buildArchitectureSnapshot: () => ({
        summary: { posture: 'healthy' } as any,
        gate: { status: 'passed', canProceed: true, blockingReasons: [], warnings: [] },
        narrative: {
          headline: 'Architecture',
          operatorSummary: 'Arquitetura verde.',
          nextAction: 'Preservar o gate.',
        },
      }),
    });

    const snapshot = service.buildSnapshot({ profile: 'alpha' });

    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.releaseReady).toBe(true);
    expect(snapshot.architecture.gate).toBe('passed');
    expect(snapshot.benchmarks[0]?.status).toBe('healthy');
    expect(snapshot.regressions[0]?.status).toBe('healthy');
    expect(snapshot.smokes[0]?.status).toBe('healthy');
    expect(snapshot.releaseGates[0]?.ready).toBe(true);
    expect(service.renderReport({ profile: 'alpha' })).toContain('Wave 6: QA, budgets e release gates');
  });

  it('flags missing or stale reports as gate problems', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-qa-plane-missing-'));
    tempDirs.push(root);
    const qaRuntimeDir = path.join(root, 'runtime');
    const qaBudgetsDir = path.join(root, 'budgets');
    fs.mkdirSync(qaRuntimeDir, { recursive: true });
    fs.mkdirSync(qaBudgetsDir, { recursive: true });

    const profile = {
      profile: 'alpha',
      benchmarks: {
        'benchmark-boot.json': {
          label: 'Boot benchmark',
          required: true,
          maxAgeHours: 1,
          operations: {
            'Gateway host boot': { maxDurationMs: 100 },
          },
        },
      },
      regression: {},
      smokes: {},
    };
    fs.writeFileSync(path.join(qaBudgetsDir, 'alpha.json'), JSON.stringify(profile, null, 2));
    fs.writeFileSync(path.join(qaBudgetsDir, 'beta.json'), JSON.stringify(profile, null, 2));
    fs.writeFileSync(path.join(qaRuntimeDir, 'benchmark-boot.json'), JSON.stringify({
      suiteName: 'Boot benchmark',
      generatedAt: '2026-04-10T18:00:00.000Z',
      status: 'passed',
      summary: {
        totalRuns: 1,
        passed: 1,
        failed: 0,
        warnings: 0,
        totalDurationMs: 500,
        averageDurationMs: 500,
      },
      runs: [
        {
          operationName: 'Gateway host boot',
          durationMs: 500,
          memoryDeltaBytes: 1024,
          success: true,
          error: null,
          warning: null,
          details: {},
        },
      ],
    }, null, 2));

    const service = new ZavorthQaControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      qaRuntimeDir,
      qaBudgetsDir,
      buildArchitectureSnapshot: () => ({
        summary: { posture: 'healthy' } as any,
        gate: { status: 'passed', canProceed: true, blockingReasons: [], warnings: [] },
        narrative: {
          headline: 'Architecture',
          operatorSummary: 'Arquitetura verde.',
          nextAction: 'Preservar o gate.',
        },
      }),
    });

    const snapshot = service.buildSnapshot({ profile: 'alpha' });

    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.releaseReady).toBe(false);
    expect(snapshot.benchmarks[0]?.status).toBe('critical');
    expect(snapshot.actions[0]?.command).toBe('npm run qa:bench:boot');
  });

  it('treats intentionally skipped benchmark probes as a controlled no-op', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-qa-plane-skipped-'));
    tempDirs.push(root);
    const qaRuntimeDir = path.join(root, 'runtime');
    const qaBudgetsDir = path.join(root, 'budgets');
    fs.mkdirSync(qaRuntimeDir, { recursive: true });
    fs.mkdirSync(qaBudgetsDir, { recursive: true });

    const profile = {
      profile: 'alpha',
      benchmarks: {
        'benchmark-sidecars.json': {
          label: 'Transport and sidecar benchmark',
          required: true,
          maxAgeHours: 96,
          operations: {
            'Remote transport doctor': { maxDurationMs: 10, maxMemoryDeltaBytes: 1 },
          },
        },
      },
      regression: {},
      smokes: {},
    };
    fs.writeFileSync(path.join(qaBudgetsDir, 'alpha.json'), JSON.stringify(profile, null, 2));
    fs.writeFileSync(path.join(qaBudgetsDir, 'beta.json'), JSON.stringify(profile, null, 2));
    fs.writeFileSync(path.join(qaRuntimeDir, 'benchmark-sidecars.json'), JSON.stringify({
      suiteName: 'Transport and Sidecar Operations',
      generatedAt: '2026-04-12T18:00:00.000Z',
      status: 'passed',
      summary: {
        totalRuns: 1,
        passed: 1,
        failed: 0,
        warnings: 1,
        totalDurationMs: 500,
        averageDurationMs: 500,
      },
      runs: [
        {
          operationName: 'Remote transport doctor',
          durationMs: 500,
          memoryDeltaBytes: 999999,
          success: true,
          error: null,
          warning: 'Nenhum transporte remoto elegivel para doctor neste runtime.',
          details: { status: 'skipped', items: 4 },
        },
      ],
    }, null, 2));

    const service = new ZavorthQaControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      qaRuntimeDir,
      qaBudgetsDir,
      buildArchitectureSnapshot: () => ({
        summary: { posture: 'healthy' } as any,
        gate: { status: 'passed', canProceed: true, blockingReasons: [], warnings: [] },
        narrative: {
          headline: 'Architecture',
          operatorSummary: 'Arquitetura verde.',
          nextAction: 'Preservar o gate.',
        },
      }),
    });

    const snapshot = service.buildSnapshot({ profile: 'alpha' });

    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.releaseReady).toBe(true);
    expect(snapshot.benchmarks[0]?.status).toBe('healthy');
  });

  it('blocks the release gate when the architecture gate is not passed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-qa-plane-architecture-'));
    tempDirs.push(root);
    const qaRuntimeDir = path.join(root, 'runtime');
    const qaBudgetsDir = path.join(root, 'budgets');
    fs.mkdirSync(qaRuntimeDir, { recursive: true });
    fs.mkdirSync(qaBudgetsDir, { recursive: true });

    const profile = {
      profile: 'alpha',
      benchmarks: {},
      regression: {},
      smokes: {},
    };
    fs.writeFileSync(path.join(qaBudgetsDir, 'alpha.json'), JSON.stringify(profile, null, 2));
    fs.writeFileSync(path.join(qaBudgetsDir, 'beta.json'), JSON.stringify(profile, null, 2));

    const service = new ZavorthQaControlPlaneService({
      now: () => new Date('2026-04-12T19:00:00.000Z'),
      qaRuntimeDir,
      qaBudgetsDir,
      buildArchitectureSnapshot: () => ({
        summary: { posture: 'attention' } as any,
        gate: { status: 'warning', canProceed: true, blockingReasons: [], warnings: ['fan-out alto'] },
        narrative: {
          headline: 'Architecture',
          operatorSummary: 'Arquitetura ainda com avisos.',
          nextAction: 'Fechar o gate.',
        },
      }),
    });

    const snapshot = service.buildSnapshot({ profile: 'alpha' });

    expect(snapshot.summary.releaseReady).toBe(false);
    expect(snapshot.architecture.gate).toBe('warning');
    expect(snapshot.actions.some((entry) => entry.command === 'npm run qa:architecture')).toBe(true);
  });
});
