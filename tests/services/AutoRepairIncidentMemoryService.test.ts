import fs from 'fs';
import os from 'os';
import path from 'path';
import { AutoRepairIncidentMemoryService } from '../../src/services/AutoRepairIncidentMemoryService';
import type { AutoRepairReport } from '../../src/services/AutoRepairService';

describe('AutoRepairIncidentMemoryService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function createReport(overrides: Partial<AutoRepairReport> = {}): AutoRepairReport {
    return {
      startedAt: '2026-04-01T12:00:00.000Z',
      finishedAt: '2026-04-01T12:01:00.000Z',
      requestedBy: '42',
      reason: 'Operational memory test.',
      goal: 'auto',
      dryRun: false,
      force: false,
      status: 'failed',
      projectRoot: 'C:/workspace/zavorth',
      bootstrapRepair: {
        startedAt: '2026-04-01T12:00:00.000Z',
        finishedAt: '2026-04-01T12:00:05.000Z',
        dryRun: false,
        initial: { projectRoot: 'root', supervisedRuntime: {}, actions: [], summary: 'ok' },
        steps: [],
        final: { projectRoot: 'root', supervisedRuntime: {}, actions: [], summary: 'ok' },
        summary: 'ok',
      } as any,
      planner: {
        needsCodeChange: true,
        targetFile: 'src/services/FixService.ts',
        instruction: 'Corrigir o arquivo alvo.',
        summary: 'Corrigir um unico servico.',
        confidence: 0.8,
        warnings: [],
        validationHints: ['tests/services/FixService.test.ts'],
      },
      attempts: [
        {
          attemptNumber: 1,
          plannedAt: '2026-04-01T12:00:10.000Z',
          targetFile: 'src/services/FixService.ts',
instruction: 'Fix the target file.',
          plannerSummary: 'Fix a single service.',
          plannerConfidence: 0.8,
          validation: [
            {
              label: 'build',
              command: 'npm run build',
              status: 'failed',
              startedAt: '2026-04-01T12:00:20.000Z',
              finishedAt: '2026-04-01T12:00:21.000Z',
              durationMs: 1000,
              output: 'TS1005',
            },
          ],
          status: 'failed',
          error: 'Build failure.',
        },
      ],
      reloadRequest: null,
      warnings: [],
      summary: 'Failed to validate repair.',
      ...overrides,
    };
  }

  it('returns a default summary when there is no persisted history', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-empty-'));
    tempDirs.push(root);
    const service = new AutoRepairIncidentMemoryService({
      filePath: path.join(root, 'autorepair-incidents.json'),
    });

    expect(service.readEntries()).toEqual([]);
    expect(service.summarizeForPlanner()).toContain('no persisted memory yet');
    expect(service.summarizeForStatus()).toContain('no persisted incidents yet');
  });

  it('records incidents and summarizes repeated targets and failures', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-history-'));
    tempDirs.push(root);
    const filePath = path.join(root, 'autorepair-incidents.json');
    const service = new AutoRepairIncidentMemoryService({ filePath });

    service.recordRun(createReport(), ['autorepair', 'telegram']);
    service.recordRun(
      createReport({
        finishedAt: '2026-04-01T13:01:00.000Z',
        attempts: [
          {
            attemptNumber: 2,
            plannedAt: '2026-04-01T13:00:10.000Z',
            targetFile: 'src/services/FixService.ts',
instruction: 'Fix the target file.',
plannerSummary: 'Fix a single service.',
            plannerConfidence: 0.85,
            validation: [
              {
                label: 'build',
                command: 'npm run build',
                status: 'failed',
                startedAt: '2026-04-01T13:00:20.000Z',
                finishedAt: '2026-04-01T13:00:21.000Z',
                durationMs: 1000,
                output: 'TS2304',
              },
            ],
            status: 'failed',
            error: 'New build failure.',
          },
        ],
        summary: 'Second failure to validate repair.',
      }),
      ['autorepair'],
    );

    const entries = service.readEntries();
    const summary = service.summarizeForPlanner();

    expect(entries).toHaveLength(2);
    expect(summary).toContain('Records: 2.');
    expect(summary).toContain('src/services/FixService.ts (2)');
    expect(summary).toContain('build (2)');
    expect(summary).toContain('Nova falha no build.');
    expect(service.summarizeForStatus()).toContain('Operational memory: 2 record(s).');
    expect(service.summarizeForStatus()).toContain('Recurring failure: build (2).');
  });
});
