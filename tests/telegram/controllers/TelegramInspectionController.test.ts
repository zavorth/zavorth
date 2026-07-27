import { TelegramInspectionController } from '../../../src/telegram/controllers/TelegramInspectionController';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('TelegramInspectionController', () => {
  it('lists recent tasks for the requesting user', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const taskManager = {
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([
        {
          task_id: 'abcdef12-3456',
          status: 'completed',
          command_type: '/codex',
          risk_level: 1,
          workspace: 'core',
          result_summary: 'build ok',
          error_summary: null,
          diff_summary: null,
          stdout_summary: null,
          intent: 'code',
        },
      ]),
    } as any;

    const controller = new TelegramInspectionController(taskManager, {} as any);
    await controller.handleTasks(ctx, '', '42');

    expect(ctx.reply.mock.calls[0][0]).toContain('Recent tasks');
    expect(ctx.reply.mock.calls[0][0]).toContain('abcdef12');
    expect(ctx.reply.mock.calls[0][0]).toContain('build ok');
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Next|next step|Next|next/i);
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Agora:|Now:/);
  });

  it('filters approval-pending tasks and shows approval hints', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const taskManager = {
      getPendingTasks: jest.fn().mockReturnValue([
        {
          task_id: 'wait1234-3456',
          user_id: '42',
          status: 'waiting_approval',
          approval_status: 'pending',
          command_type: '/external',
          risk_level: 2,
          workspace: 'core',
          executor_used: 'external_executor',
          result_summary: null,
          error_summary: null,
          diff_summary: null,
          stdout_summary: null,
          intent: 'review',
          metadata: {},
          artifacts: [],
        },
      ]),
      getRecentTasks: jest.fn().mockReturnValue([
        {
          task_id: 'wait1234-3456',
          user_id: '42',
          status: 'waiting_approval',
          approval_status: 'pending',
          command_type: '/external',
          risk_level: 2,
          workspace: 'core',
          executor_used: 'external_executor',
          result_summary: null,
          error_summary: null,
          diff_summary: null,
          stdout_summary: null,
          intent: 'review',
          metadata: {},
          artifacts: [],
        },
      ]),
    } as any;

    const controller = new TelegramInspectionController(taskManager, {} as any);
    await controller.handleTasks(ctx, 'approval 5', '42');

    expect(ctx.reply.mock.calls[0][0]).toContain('Pending approvals');
    expect(ctx.reply.mock.calls[0][0]).toContain('/approve (or /approve 1 if several)');
  });

  it('filters failed tasks and suggests diff inspection', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const taskManager = {
      getPendingTasks: jest.fn().mockReturnValue([]),
      getRecentTasks: jest.fn().mockReturnValue([
        {
          task_id: 'fail1234-3456',
          status: 'failed',
          command_type: '/codex',
          risk_level: 1,
          workspace: 'core',
          executor_used: 'codex',
          result_summary: null,
          error_summary: 'lint falhou',
          diff_summary: null,
          stdout_summary: null,
          intent: 'code',
          metadata: {},
          artifacts: [],
        },
      ]),
    } as any;

    const controller = new TelegramInspectionController(taskManager, {} as any);
    await controller.handleTasks(ctx, 'failed', '42');

    expect(ctx.reply.mock.calls[0][0]).toContain('Recent failures');
    expect(ctx.reply.mock.calls[0][0]).toContain('/diff fail1234');
  });

  it('shows recent logs with truncated text', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const logRepo = {
      getRecentLogs: jest.fn().mockReturnValue([
        {
          timestamp: '2026-03-24T12:34:56.000Z',
          level: 'warn',
          category: 'Bridge',
          message: 'bridge offline',
        },
      ]),
    } as any;

    const controller = new TelegramInspectionController({} as any, logRepo);
    await controller.handleLogs(ctx, '5');

    expect(logRepo.getRecentLogs).toHaveBeenCalledWith(5);
    expect(ctx.reply.mock.calls[0][0]).toContain('[WARN] 2026-03-24 12:34:56 | Bridge');
  });

  it('resolves task artifacts from a short id', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-inspection-'));
    const reportPath = path.join(tempDir, 'report.md');
    fs.writeFileSync(reportPath, '# briefing', 'utf8');
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const taskManager = {
      getRecentTasks: jest
        .fn()
        .mockReturnValueOnce([
          {
            task_id: 'abc12345-9999',
            target_files: ['src/app.ts'],
            artifacts: [{ path: reportPath, summary: 'briefing' }],
          },
        ])
        .mockReturnValue([]),
      getTask: jest.fn().mockReturnValue(undefined),
    } as any;

    try {
      const controller = new TelegramInspectionController(taskManager, {} as any);
      await controller.handleTaskFiles(ctx, 'abc12345', '42');

      expect(ctx.reply.mock.calls[0][0]).toContain('src/app.ts');
      expect(ctx.reply.mock.calls[0][0]).toContain('report.md');
      expect(ctx.reply.mock.calls[0][0]).toMatch(/Total: 1|images: 0|files: 1|files: 1/);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('routes natural compare requests through the inspection service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const inspectionService = {
      shouldHandleNaturalQuery: jest.fn().mockReturnValue(true),
      prepare: jest.fn().mockResolvedValue({
        kind: 'result',
        text: 'Comparison between index.html e old-index.html',
      }),
    } as any;
    const controller = new TelegramInspectionController(
      {
        getRecentTasks: jest.fn().mockReturnValue([]),
        getTask: jest.fn().mockReturnValue(undefined),
      } as any,
      {} as any,
      {},
      inspectionService,
    );

    await controller.handleTaskFiles(ctx, 'compare "index.html" e "old-index.html"', '42');

    expect(inspectionService.prepare).toHaveBeenCalled();
    expect(ctx.reply.mock.calls[0][0]).toContain('Comparison between index.html e old-index.html');
  });

  it('creates a scoped permission request for natural inspection outside allowed roots', async () => {
    const ctx = {
      from: { id: 42 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const createRequest = jest.fn().mockResolvedValue({
      permission_id: 'perm-inspect-1',
      executor: 'file_delivery',
      kind: 'workspace_access',
      scope: 'once',
      requested_value: 'C:/fora',
      resolved_value: 'C:/fora',
      metadata: {
        permission_source: 'file_inspection',
      },
    });
    const inspectionService = {
      shouldHandleNaturalQuery: jest.fn().mockReturnValue(true),
      prepare: jest.fn().mockResolvedValue({
        kind: 'permission',
        requestedPath: 'C:/fora',
        previewPath: 'C:/fora',
        originalRequest: 'compare "C:/fora/a.txt" e "C:/fora/b.txt"',
        reason: 'This path exists, but is not allowed for local Zavorth inspection yet.',
      }),
    } as any;
    const controller = new TelegramInspectionController(
      {
        getRecentTasks: jest.fn().mockReturnValue([]),
        getTask: jest.fn().mockReturnValue(undefined),
      } as any,
      {} as any,
      {
        permissionService: {
          createRequest,
          listApprovedRequests: jest.fn().mockResolvedValue([]),
        } as any,
        buildPermissionKeyboard: jest.fn().mockReturnValue(undefined),
        formatPermissionCreatedMessage: jest.fn().mockReturnValue('Permission de inspecao'),
      },
      inspectionService,
    );

    await controller.handleTaskFiles(ctx, 'compare "C:/fora/a.txt" e "C:/fora/b.txt"', '42');

    expect(createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        executor: 'file_delivery',
        kind: 'workspace_access',
        metadata: expect.objectContaining({
          permission_source: 'file_inspection',
          access_level: 'read_only',
        }),
      }),
    );
    expect(ctx.reply).toHaveBeenCalledWith('Permission de inspecao', undefined);
  });

  it('resumes a natural inspection after a read-only folder approval', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const inspectionService = {
      prepare: jest.fn().mockResolvedValue({
        kind: 'result',
        text: 'Files changed today outside',
      }),
    } as any;
    const controller = new TelegramInspectionController({} as any, {} as any, {}, inspectionService);

    const resumed = await controller.handleApprovedPermission(ctx, {
      executor: 'file_delivery',
      kind: 'workspace_access',
      requested_value: 'C:/fora',
      resolved_value: 'C:/fora',
      metadata: {
        permission_source: 'file_inspection',
        original_request: 'what changed today in "C:/outside"',
      },
    } as any);

    expect(resumed).toBe(true);
    expect(inspectionService.prepare).toHaveBeenCalledWith('what changed today in "C:/outside"', {
      extraAllowedPaths: ['C:/fora'],
    });
    expect(ctx.reply.mock.calls[0][0]).toContain('Files changed today outside');
  });
});
