import fs from 'fs';
import os from 'os';
import path from 'path';
import { GatewaySessionService } from '../../src/services/GatewaySessionService.js';
import { GatewaySessionLedgerService } from '../../src/services/GatewaySessionLedgerService.js';

describe('GatewaySessionService', () => {
  it('builds a unified session snapshot with continuity, replay and handoff', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-session-service-'));
    const tasks = [
      {
        task_id: 'task-web-1',
        source: 'web',
        chat_id: 'web:session-web-1',
        user_id: 'telegram-admin',
        workspace: 'C:/repo',
        updated_at: '2026-04-02T12:00:00.000Z',
        created_at: '2026-04-02T11:59:00.000Z',
        status: 'waiting_approval',
        raw_message: 'continue gateway',
        result_summary: 'Task waiting for approval.',
        stdout_summary: 'tsc passou sem erros.',
        stderr_summary: null,
        diff_summary: 'Changed gateway.ts to expose the runtime.',
        actions_executed: [
          {
            tool: 'apply_patch',
            kind: 'filesystem_write',
            status: 'completed',
            started_at: '2026-04-02T12:00:00.000Z',
            finished_at: '2026-04-02T12:00:02.000Z',
            files: ['C:/repo/src/gateway.ts'],
            patches: [
              {
                path: 'C:/repo/src/gateway.ts',
                diff: '@@\\n+export const gateway = true;\\n',
                summary: 'Expose gateway runtime.',
              },
            ],
          },
        ],
        metadata: {
          workflow_run_id: 'wf-1',
          execution_lifecycle: [
            {
              kind: 'approval',
              id: 'perm-1',
              traceId: 'trace-gateway-1',
              runId: 'run-gateway-1',
              sessionId: 'session-web-1',
              approvalId: 'perm-1',
              artifactId: null,
              status: 'approval_required',
              summary: 'Precisa approve a entrega final.',
              source: 'approval-manager',
              surface: 'web',
              parentId: 'task-web-1',
              createdAt: '2026-04-02T12:00:00.000Z',
              updatedAt: '2026-04-02T12:00:01.000Z',
              metadata: {},
            },
          ],
          runtime_user_id: 'telegram-admin',
          surface_identity: {
            chatId: 'web:session-web-1',
            sessionId: 'session-web-1',
            runtime_user_id: 'telegram-admin',
          },
        },
        target_files: ['C:/repo/src/gateway.ts'],
        artifacts: [
          {
            id: 'artifact-task-log',
            name: 'task-log.txt',
            kind: 'report',
            type: 'file',
            path: 'C:/repo/output/task-log.txt',
          },
        ],
      },
    ];
    const permissions = [
      {
        permission_id: 'perm-1',
        task_id: 'task-web-1',
        status: 'pending',
        executor: 'codex',
        kind: 'filesystem_write',
        reason: 'Precisa gravar file final.',
        updated_at: '2026-04-02T12:00:01.000Z',
      },
    ];
    const workflowRun = {
      workflow_run_id: 'wf-1',
      workflow_name: 'ship',
      objective: 'Close gateway',
      workspace: 'C:/repo',
      created_at: '2026-04-02T11:50:00.000Z',
      updated_at: '2026-04-02T12:00:00.000Z',
      status: 'approval_pending',
      stages: [],
      resume_stage: {
        id: 'review',
        label: 'Review final',
        executor: 'external_executor',
        status: 'approval_pending',
        index: 1,
        attempt_count: 1,
        task_id: 'task-web-1',
        objective: 'Revisar gateway',
        handoff_summary: 'Gateway consolidado.',
        result_summary: 'Waiting for approval.',
        reason: 'Existe approval pendente.',
      },
      resume_prompt: 'Resume a review final.',
      workspace_context: null,
      origin: {
        origin_task_id: null,
        origin_user_id: null,
        runtime_user_id: 'telegram-admin',
        tenant_id: null,
        source_surface: 'web',
        route_strategy: null,
        route_source: null,
        parent_chat_id: 'web:session-web-1',
      },
      trigger: {
        task_kind: 'task',
        task_subtype: null,
      },
      artifacts: [
        {
          id: 'artifact-gateway-plan',
          name: 'gateway-plan.md',
          kind: 'report',
          type: 'file',
          path: 'C:/repo/output/gateway-plan.md',
        },
      ],
      artifacts_manifest: {},
    };
    const sessionLedger = new GatewaySessionLedgerService({
      rootDir: tempDir,
      now: () => new Date('2026-04-02T12:05:00.000Z'),
    });
    sessionLedger.appendMessage(
      {
        platform: 'web',
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
        runtimeUserId: 'telegram-admin',
        sourceUserId: 'session-web-1',
      },
      {
        id: 'msg-1',
        role: 'user',
        content: 'continue gateway',
        createdAt: '2026-04-02T11:58:30.000Z',
        taskId: 'task-web-1',
        kind: 'input',
        surface: 'web',
      },
    );

    const service = new GatewaySessionService({
      now: () => new Date('2026-04-02T12:05:00.000Z'),
      taskManager: {
        getRecentTasksByChat: () => tasks as any,
        getRecentTasksByUsers: () => tasks as any,
        getRecentTasks: () => tasks as any,
      } as any,
      permissionService: {
        listRequests: async () => permissions as any,
      },
      workflowRunService: {
        getRun: () => workflowRun as any,
        listRuns: () => [workflowRun as any],
      },
      sessionLedgerService: sessionLedger,
    });
    service.patchSessionMetadata({
      userId: 'telegram-admin',
      chatId: 'web:session-web-1',
      sessionId: 'session-web-1',
      platform: 'web',
      sourceUserId: 'session-web-1',
      label: 'Gateway principal',
      workspaceHint: 'C:/repo/gateway',
      pinned: true,
      modelProfile: 'gpt-5.4',
    });

    const snapshot = await service.buildSessionSnapshot({
      userId: 'telegram-admin',
      chatId: 'web:session-web-1',
    });
    const sessions = await service.listSessions({
      userId: 'telegram-admin',
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        generatedAt: '2026-04-02T12:05:00.000Z',
        chatId: 'web:session-web-1',
        runtimeUserId: 'telegram-admin',
      }),
    );
    expect(snapshot?.continuity.focusTask?.taskId).toBe('task-web-1');
    expect(snapshot?.continuity.focusTask?.execution).toEqual(expect.objectContaining({
      traceId: 'trace-gateway-1',
      runId: 'run-gateway-1',
      sessionId: 'session-web-1',
    }));
    expect(snapshot?.executionContext).toEqual(expect.objectContaining({
      traceId: 'trace-gateway-1',
      runId: 'run-gateway-1',
      sessionId: 'session-web-1',
    }));
    expect(snapshot?.metadata).toEqual(expect.objectContaining({
      label: 'Gateway principal',
      workspaceHint: 'C:/repo/gateway',
      pinned: true,
      modelProfile: 'gpt-5.4',
    }));
    expect(snapshot?.permissions).toHaveLength(1);
    expect(snapshot?.workflowRuns).toHaveLength(1);
    expect(snapshot?.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'msg-1',
          content: 'continue gateway',
        }),
      ]),
    );
    expect(snapshot?.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'artifact-gateway-plan',
          workflowRunId: 'wf-1',
        }),
      ]),
    );
    expect(snapshot?.filesTouched).toEqual(
      expect.arrayContaining(['C:/repo/src/gateway.ts']),
    );
    expect(snapshot?.toolRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: 'task-web-1',
          workflowRunId: 'wf-1',
          toolName: 'apply_patch',
          status: 'completed',
          stdout: 'tsc passou sem erros.',
          filesTouched: expect.arrayContaining(['C:/repo/src/gateway.ts']),
          diff: expect.objectContaining({
            patches: expect.arrayContaining([
              expect.objectContaining({
                path: 'C:/repo/src/gateway.ts',
              }),
            ]),
          }),
        }),
      ]),
    );
    expect(snapshot?.summary).toEqual(
      expect.objectContaining({
        messages: 1,
        tasks: 1,
        toolRuns: expect.any(Number),
        pendingPermissions: 1,
      }),
    );
    expect(snapshot?.handoff.canonicalTarget.id).toBe('task-web-1');
    expect(sessions.entries[0]).toEqual(
      expect.objectContaining({
        chatId: 'web:session-web-1',
        label: 'Gateway principal',
        latestTaskId: 'task-web-1',
        pinned: true,
        modelProfile: 'gpt-5.4',
        workspace: 'C:/repo/gateway',
      }),
    );
    expect(
      sessionLedger.readSnapshotSync({
        platform: 'web',
        chatId: 'web:session-web-1',
        sessionId: 'session-web-1',
      }),
    ).toEqual(
      expect.objectContaining({
        latestTaskId: 'task-web-1',
        artifactCount: 2,
        toolRunCount: expect.any(Number),
        transcriptCount: 1,
      }),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('preserves telegram as the canonical platform for raw telegram chat ids', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-session-telegram-'));
    const tasks = [
      {
        task_id: 'task-telegram-1',
        source: 'telegram',
        chat_id: 'chat-1',
        user_id: 'user-1',
        workspace: 'C:/repo',
        updated_at: '2026-04-02T12:10:00.000Z',
        created_at: '2026-04-02T12:09:00.000Z',
        status: 'completed',
        raw_message: 'continue o briefing final',
        result_summary: 'Briefing final consolidado.',
        metadata: {},
        target_files: ['C:/repo/briefing-final.md'],
        artifacts: [],
      },
    ];
    const sessionLedger = new GatewaySessionLedgerService({
      rootDir: tempDir,
      now: () => new Date('2026-04-02T12:11:00.000Z'),
    });
    sessionLedger.appendMessage(
      {
        platform: 'telegram',
        chatId: 'chat-1',
        sessionId: null,
        runtimeUserId: 'user-1',
        sourceUserId: 'user-1',
      },
      {
        id: 'msg-telegram-1',
        role: 'user',
        content: 'continue o briefing final',
        createdAt: '2026-04-02T12:09:30.000Z',
        taskId: 'task-telegram-1',
        kind: 'input',
        surface: 'telegram',
      },
    );

    const service = new GatewaySessionService({
      now: () => new Date('2026-04-02T12:11:00.000Z'),
      taskManager: {
        getRecentTasksByChat: () => tasks as any,
        getRecentTasksByUsers: () => tasks as any,
        getRecentTasks: () => tasks as any,
      } as any,
      permissionService: {
        listRequests: async () => [],
      } as any,
      sessionLedgerService: sessionLedger,
    });

    const snapshot = await service.buildSessionSnapshot({
      userId: 'user-1',
      chatId: 'chat-1',
      platform: 'telegram',
      sourceUserId: 'user-1',
    });
    const sessions = await service.listSessions({
      userId: 'user-1',
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        chatId: 'chat-1',
        platform: 'telegram',
        sourceUserId: 'user-1',
      }),
    );
    expect(snapshot?.transcript).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'msg-telegram-1',
          surface: 'telegram',
        }),
      ]),
    );
    expect(sessions.entries[0]).toEqual(
      expect.objectContaining({
        chatId: 'chat-1',
      }),
    );
    expect(
      sessionLedger.readSnapshotSync({
        platform: 'telegram',
        chatId: 'chat-1',
        sessionId: null,
        runtimeUserId: 'user-1',
        sourceUserId: 'user-1',
      }),
    ).toEqual(
      expect.objectContaining({
        latestTaskId: 'task-telegram-1',
        filesTouched: ['C:/repo/briefing-final.md'],
      }),
    );

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
