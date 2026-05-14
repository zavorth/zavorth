import fs from 'fs';
import os from 'os';
import path from 'path';
import { DailyReportService } from '../../src/services/DailyReportService';

describe('DailyReportService', () => {
  it('builds a concise report and sends it once per day when due', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-report-'));
    const stateFile = path.join(tempDir, 'daily-report-state.json');
    const now = new Date('2026-03-28T12:15:00.000Z');
    const broadcast = jest.fn().mockResolvedValue(undefined);
    const service = new DailyReportService(
      {
        getRecentTasks: jest.fn().mockReturnValue([
          {
            task_id: 'task-ok-1',
            updated_at: '2026-03-28T10:00:00.000Z',
            status: 'completed',
            executor_used: 'codex',
            command_type: '/codex',
          },
          {
            task_id: 'task-fail-2',
            updated_at: '2026-03-28T11:00:00.000Z',
            status: 'failed',
            executor_used: 'external_executor',
            command_type: '/external_executor',
          },
        ]),
      } as any,
      {
        getRecentLogs: jest.fn().mockReturnValue([]),
      } as any,
      {
        listRequests: jest.fn().mockResolvedValue([
          {
            permission_id: 'perm-1',
            executor: 'external_executor',
            kind: 'workspace_access',
            reason: 'Precisa acessar uma pasta especifica.',
          },
        ]),
      } as any,
      {
        buildSnapshot: jest.fn().mockReturnValue({
          process: {
            rssMb: 250,
            heapMb: 90,
          },
          runtime: {
            hostSupervisor: { alive: true, pid: 1001 },
            telegramWorker: { alive: true, pid: 1002 },
          },
          tasks: {
            activeCount: 2,
            byStatus: { running: 1, waiting_approval: 1 },
            recentFailures: [
              {
                taskId: 'task-fail-2',
                executor: 'external_executor',
                commandType: '/external_executor',
                errorSummary: 'gateway timeout',
              },
            ],
          },
          logs: { lastError: null },
        }),
      } as any,
      stateFile,
      9,
      0,
      ['admin'],
      {
        now: () => new Date(now),
      },
    );

    const report = await service.buildReport(now);
    expect(report).toContain('Resumo diario do Zavorth');
    expect(report).toContain('Ultimas 24h: 1 concluidas | 1 com falha | 0 aguardando aprovacao');
    expect(report).toContain('Permissoes pendentes agora: 1');

    service.start(broadcast, 60_000);
    await new Promise((resolve) => setTimeout(resolve, 10));
    service.stop();

    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        enabled: true,
        lastSentDateKey: '2026-03-28',
      }),
    );
  });

  it('allows manual sending even outside the scheduled window', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-report-'));
    const stateFile = path.join(tempDir, 'daily-report-state.json');
    const broadcast = jest.fn().mockResolvedValue(undefined);
    const service = new DailyReportService(
      {
        getRecentTasks: jest.fn().mockReturnValue([]),
      } as any,
      {
        getRecentLogs: jest.fn().mockReturnValue([]),
      } as any,
      {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      {
        buildSnapshot: jest.fn().mockReturnValue({
          process: { rssMb: 100, heapMb: 40 },
          runtime: {
            hostSupervisor: { alive: true, pid: 1 },
            telegramWorker: { alive: true, pid: 2 },
          },
          tasks: {
            activeCount: 0,
            byStatus: {},
            recentFailures: [],
          },
          logs: { lastError: null },
        }),
      } as any,
      stateFile,
      23,
      59,
      ['admin'],
      {
        now: () => new Date('2026-03-28T08:00:00.000Z'),
      },
    );

    service.start(broadcast, 60_000);
    const result = await service.sendNow('42');
    service.stop();

    expect(result.sent).toBe(true);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(service.getStatus().lastSentAt).toBeTruthy();
  });

  it('uses the injected consolidated report builder when available', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-report-'));
    const stateFile = path.join(tempDir, 'daily-report-state.json');
    const reportBuilder = {
      buildTextReport: jest.fn().mockResolvedValue('Relatorio consolidado customizado'),
    };
    const service = new DailyReportService(
      {
        getRecentTasks: jest.fn().mockReturnValue([]),
      } as any,
      {
        getRecentLogs: jest.fn().mockReturnValue([]),
      } as any,
      {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      {
        buildSnapshot: jest.fn().mockReturnValue({
          process: { rssMb: 100, heapMb: 40 },
          runtime: {
            hostSupervisor: { alive: true, pid: 1 },
            telegramWorker: { alive: true, pid: 2 },
          },
          tasks: {
            activeCount: 0,
            byStatus: {},
            recentFailures: [],
          },
          logs: { lastError: null },
        }),
      } as any,
      stateFile,
      9,
      0,
      ['admin'],
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
        reportBuilder: reportBuilder as any,
      },
    );

    const report = await service.buildReport(new Date('2026-03-29T12:00:00.000Z'));

    expect(reportBuilder.buildTextReport).toHaveBeenCalledWith(new Date('2026-03-29T12:00:00.000Z'));
    expect(report).toBe('Relatorio consolidado customizado');
  });

  it('forwards canonical overview readers to the injected consolidated report builder when configured', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-daily-report-'));
    const stateFile = path.join(tempDir, 'daily-report-state.json');
    const reportBuilder = {
      buildTextReport: jest.fn().mockResolvedValue('Relatorio consolidado com overviews canonicos'),
    };
    const overviewReaders = {
      readOperationalOverviewSnapshot: jest.fn(),
      readTrustOverviewSnapshot: jest.fn(),
      readProductOverviewSnapshot: jest.fn(),
    };
    const service = new DailyReportService(
      {
        getRecentTasks: jest.fn().mockReturnValue([]),
      } as any,
      {
        getRecentLogs: jest.fn().mockReturnValue([]),
      } as any,
      {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      {
        buildSnapshot: jest.fn().mockReturnValue({
          process: { rssMb: 100, heapMb: 40 },
          runtime: {
            hostSupervisor: { alive: true, pid: 1 },
            telegramWorker: { alive: true, pid: 2 },
          },
          tasks: {
            activeCount: 0,
            byStatus: {},
            recentFailures: [],
          },
          logs: { lastError: null },
        }),
      } as any,
      stateFile,
      9,
      0,
      ['admin'],
      {
        now: () => new Date('2026-03-29T18:00:00.000Z'),
        reportBuilder: reportBuilder as any,
        reportOverviewReaders: overviewReaders,
      },
    );

    const report = await service.buildReport(new Date('2026-03-29T18:00:00.000Z'));

    expect(reportBuilder.buildTextReport).toHaveBeenCalledWith(
      new Date('2026-03-29T18:00:00.000Z'),
      overviewReaders,
    );
    expect(report).toBe('Relatorio consolidado com overviews canonicos');
  });
});
