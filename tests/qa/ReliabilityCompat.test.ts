import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildReliabilityCompatReport } from '../../qa/compat/ReliabilityCompat';

describe('ReliabilityCompat', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('passes when the minimum reliability metrics are present', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-reliability-compat-'));
    tempDirs.push(root);

    fs.writeFileSync(path.join(root, 'benchmark-boot.json'), JSON.stringify({
      runs: [
        { operationName: 'Gateway host boot', durationMs: 50 },
        { operationName: 'CLI status fast', durationMs: 75 },
        { operationName: 'CLI doctor fast', durationMs: 120 },
      ],
    }));
    fs.writeFileSync(path.join(root, 'benchmark-runtime-flow.json'), JSON.stringify({
      runs: [
        { operationName: 'Gateway session spawn', durationMs: 5 },
        { operationName: 'Gateway session send', durationMs: 10 },
        { operationName: 'Node Mesh invoke device.info', durationMs: 3 },
        { operationName: 'Web shell /app latency', durationMs: 15 },
      ],
    }));
    fs.writeFileSync(path.join(root, 'benchmark-sidecars.json'), JSON.stringify({
      runs: [
        { operationName: 'Remote transport doctor', durationMs: 30 },
        { operationName: 'Channel provider doctor', durationMs: 40 },
      ],
    }));
    fs.writeFileSync(path.join(root, 'critical-regression.json'), JSON.stringify({
      tests: [
        { id: 'gateway-public-api', success: true },
        { id: 'web-app-shell', success: true },
        { id: 'remote-transport-doctor', success: true },
      ],
    }));

    const report = buildReliabilityCompatReport({
      qaRuntimeDir: root,
      readAutoRepairEntries: () => [
        { status: 'repaired' } as any,
        { status: 'failed' } as any,
      ],
    });

    expect(report.status).toBe('passed');
    expect(report.metrics.doctorMs).toBe(120);
    expect(report.metrics.appLatencyMs).toBe(15);
    expect(report.metrics.autorepairSuccessRate).toBe(0.5);
  });

  it('fails when a minimum benchmark metric is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-reliability-compat-missing-'));
    tempDirs.push(root);

    fs.writeFileSync(path.join(root, 'benchmark-boot.json'), JSON.stringify({
      runs: [
        { operationName: 'Gateway host boot', durationMs: 50 },
        { operationName: 'CLI status fast', durationMs: 75 },
      ],
    }));

    const report = buildReliabilityCompatReport({
      qaRuntimeDir: root,
      readAutoRepairEntries: () => [],
    });

    expect(report.status).toBe('failed');
    expect(report.checks.some((entry) => entry.status === 'failed')).toBe(true);
  });
});
