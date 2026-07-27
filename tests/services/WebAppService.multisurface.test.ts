import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { SurfaceIdentityService } from '../../src/services/SurfaceIdentityService';
import { SurfaceTaskDispatchService } from '../../src/services/SurfaceTaskDispatchService';
import { createTestLogRepo, fetchNoKeepAlive } from '../helpers/dashboardWebTestUtils.js';

async function webJson(
  baseUrl: string,
  token: string,
  route: string,
  init: RequestInit = {},
): Promise<{ status: number; payload: any }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  try {
    const response = await fetchNoKeepAlive(`${baseUrl}${route}`, {
      ...init,
      headers,
      signal: controller.signal,
    });
    return {
      status: response.status,
      payload: await response.json(),
    };
  } catch (error: unknown) {
    throw new Error(`Failure em ${route}: ${error?.message || error}`);
  } finally {
    clearTimeout(timeout);
  }
}

describe('Web app multisurface flow', () => {
  jest.setTimeout(30000);

  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalSurfaceIdentityStateFile = config.surfaceIdentityStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.surfaceIdentityStateFile = originalSurfaceIdentityStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('creates a web session, dispatches through the shared surface runtime and exposes continuity plus pending permissions', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-multisurface-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.surfaceIdentityStateFile = path.join(root, 'surface-identities.json');

    const tasks: any[] = [
      {
        task_id: 'task-telegram-seed',
        created_at: '2026-04-01T09:40:00.000Z',
        updated_at: '2026-04-01T09:45:00.000Z',
        source: 'telegram',
        chat_id: 'telegram:chat-1',
        user_id: 'telegram-admin',
        raw_message: 'resuma a migraction',
        normalized_message: 'resuma a migraction',
        command_type: '/task',
        intent: 'task',
        target: null,
        workspace: 'C:/repo',
        risk_level: 1,
        status: 'completed',
        requires_planning: false,
        requires_approval: false,
        approval_status: 'not_required',
        planner_used: null,
        executor_used: 'codex',
        fallback_used: false,
        parent_task_id: null,
        actions_planned: [],
        actions_executed: [],
        target_files: [],
        artifacts: [],
        stdout_summary: null,
        stderr_summary: null,
        diff_summary: null,
        result_summary: 'Resumo no Telegram.',
        error_summary: null,
        rollback_available: false,
        metadata: {},
      },
    ];
    const pendingPermissions: any[] = [];

    const taskManager = {
      getRecentTasksByChat: jest.fn((chatId: string) =>
        tasks
          .filter((task) => task.chat_id === chatId)
          .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at))),
      ),
      getRecentTasksByUsers: jest.fn((userIds: string[]) =>
        tasks
          .filter((task) => {
            const runtimeUserId = task.metadata?.runtime_user_id || task.metadata?.surface_identity?.runtime_user_id;
            return userIds.includes(task.user_id) || userIds.includes(runtimeUserId);
          })
          .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at))),
      ),
      getRecentTasks: jest.fn((limit: number, userId-: string) =>
        tasks
          .filter((task) => (!userId ? true : task.user_id === userId))
          .slice(0, limit || 10),
      ),
      getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId) || null),
    } as any;

    const parser = {
      parse: jest.fn((text: string) => ({
        normalized_message: text,
        command_type: '/task',
      })),
    };
    const taskOrchestrationController = {
      handleTaskMessage: jest.fn(async (_ctx: any, input: any) => {
        const task = {
          task_id: 'task-web-1',
          created_at: '2026-04-01T10:00:00.000Z',
          updated_at: '2026-04-01T10:00:00.000Z',
          source: input.source,
          chat_id: input.chatId,
          user_id: input.userId,
          raw_message: input.text,
          normalized_message: input.text,
          command_type: input.parsed?.command_type || '/task',
          intent: 'task',
          target: null,
          workspace: 'C:/repo',
          risk_level: 1,
          status: 'waiting_approval',
          requires_planning: false,
          requires_approval: true,
          approval_status: 'pending',
          planner_used: null,
          executor_used: 'codex',
          fallback_used: false,
          parent_task_id: null,
          actions_planned: [],
          actions_executed: [],
          target_files: [],
          artifacts: [],
          stdout_summary: null,
          stderr_summary: null,
          diff_summary: null,
          result_summary: null,
          error_summary: null,
          rollback_available: false,
          metadata: {
            runtime_user_id: input.userId,
            surface_identity: {
              ...input.surfaceMetadata,
              runtime_user_id: input.userId,
            },
          },
        };
        tasks.unshift(task);
        pendingPermissions.splice(0, pendingPermissions.length, {
          permission_id: 'perm-web-1',
          task_id: task.task_id,
          executor: 'codex',
          kind: 'filesystem_write',
          reason: 'Precisa escrever o summary final em disco.',
          requested_value: 'C:/repo/out/summary.md',
          scope: 'once',
          created_at: '2026-04-01T10:00:01.000Z',
          updated_at: '2026-04-01T10:00:01.000Z',
          status: 'pending',
        });
        return task;
      }),
    };
    const permissionService = {
      listRequests: jest.fn(async (status: string, limit: number) =>
        pendingPermissions.filter((permission) => permission.status === status).slice(0, limit),
      ),
    } as any;
    const permissionController = {
      formatPermissionCreatedMessage: jest.fn((permission: any) => `Permission ${permission.permission_id}`),
      resolvePermissionReference: jest.fn(),
      handlePermissionCallback: jest.fn(),
      shortPermissionId: jest.fn((permission: any) => permission.permission_id),
      handleApproval: jest.fn(),
      handleRejection: jest.fn(),
    } as any;
    const surfaceTaskDispatcher = new SurfaceTaskDispatchService({
      parser: parser as any,
      taskOrchestrationController: taskOrchestrationController as any,
      surfaceIdentityService: new SurfaceIdentityService({
        filePath: config.surfaceIdentityStateFile,
      }),
    });

    const service = new DashboardService(logRepo, {
      memoryPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            persistedMemories: 2,
            relevantMemories: 1,
            replayTasks: 2,
            workflowRuns: 1,
            artifacts: 1,
            workspaceSignals: 3,
          },
          memory: {
            recent: [
              {
                key: 'workspace-focus',
                value: 'Consolidar o gateway.',
                category: 'workspace',
                updatedAt: '2026-04-02T11:58:00.000Z',
              },
            ],
            relevant: [],
            categories: ['workspace'],
            vectorRecall: true,
          },
          replay: {
            headline: 'Replay ready.',
            recommendedEntry: {
              label: 'Retomar gateway',
              reason: 'Existe uma tarefa ativa na session web.',
            },
          },
          artifacts: {
            recent: [
              {
                id: 'artifact-1',
                label: 'gateway-summary.md',
                kind: 'doc',
                summary: 'Resumo consolidado do gateway.',
                path: 'artifacts/gateway-summary.md',
                createdAt: '2026-04-02T11:58:00.000Z',
                sourceTaskId: 'task-web-1',
              },
            ],
            kinds: ['doc'],
            latestLabel: 'gateway-summary.md',
            reusableCount: 1,
          },
          workspace: {
            workspace: 'C:/repo',
            summary: 'Workspace with a delivery ready to resume.',
            recentArtifacts: [],
            continuityRecommendations: [],
            workflowRecommendations: [],
          },
          suggestedActions: [
            {
              id: 'resume-memory-plane',
              label: 'Abrir contexto',
              command: '/sessionhistory web:session-1',
              reason: 'There is a better resumption point.',
              kind: 'resume',
            },
          ],
          narrative: {
            headline: 'Memory, Replay & Artifacts',
            operatorSummary: 'Canonical snapshot of resumption and deliveries.',
          },
        })),
        buildSnapshotFast: jest.fn(() => ({
          generatedAt: '2026-04-02T12:00:00.000Z',
          summary: {
            persistedMemories: 0,
            relevantMemories: 0,
            replayTasks: 0,
            workflowRuns: 0,
            artifacts: 1,
            workspaceSignals: 0,
          },
          memory: {
            recent: [],
            relevant: [],
            categories: [],
            vectorRecall: true,
          },
          replay: null,
          artifacts: {
            recent: [],
            kinds: [],
            latestLabel: null,
            reusableCount: 0,
          },
          workspace: null,
          suggestedActions: [],
          narrative: {
            headline: 'Memory, Replay & Artifacts',
            operatorSummary: 'Canonical snapshot of resumption and deliveries.',
          },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 5,
            ready: 3,
            partial: 2,
            planned: 0,
            disabled: 0,
          },
          entries: [
            {
              id: 'docker-hardened',
              label: 'Container endurecido',
              family: 'container',
              readiness: 'ready',
              available: true,
              operatorSummary: 'Docker forte ready.',
              recommendedFor: 'Risco moderado.',
              actionHint: 'npm run sandbox:doctor',
              details: ['gVisor active.'],
            },
          ],
          narrative: {
            headline: 'Zavorth exposes 5 modos de runtime.',
            operatorSummary: '3 modos readys e 2 em preparo.',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 1,
            paired: 1,
            pending: 0,
            online: 1,
            offline: 0,
            invokable: 1,
            capabilities: 2,
          },
          entries: [
            {
              id: 'oracle-node',
              label: 'Oracle Node',
              kind: 'headless',
              transport: 'bridge',
              status: 'online',
              pairingStatus: 'paired',
              paired: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              pairedAt: new Date().toISOString(),
              lastSeenAt: new Date().toISOString(),
              requestedBy: 'dashboard',
              capabilityIds: ['system.run', 'files.read'],
              hostHints: {
                hostname: 'oracle',
                platform: 'linux',
                workspace: '/srv/zavorth',
                surface: 'node-host',
              },
              notes: [],
              operatorSummary: 'Heartbeat recente.',
              capabilities: [
                {
                  id: 'system.run',
                  label: 'System Run',
                  summary: 'Executa comandos controlados.',
                  category: 'system',
                  risky: true,
                  actionHint: 'Use com zero-trust.',
                },
              ],
              canInvoke: true,
              nextAction: 'Conectar o transporte remoto.',
              trustLabel: 'pareado',
            },
          ],
          selected: {
            id: 'oracle-node',
            label: 'Oracle Node',
            kind: 'headless',
            transport: 'bridge',
            status: 'online',
            pairingStatus: 'paired',
            paired: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            pairedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            requestedBy: 'dashboard',
            capabilityIds: ['system.run', 'files.read'],
            hostHints: {
              hostname: 'oracle',
              platform: 'linux',
              workspace: '/srv/zavorth',
              surface: 'node-host',
            },
            notes: [],
            operatorSummary: 'Heartbeat recente.',
            capabilities: [
              {
                id: 'system.run',
                label: 'System Run',
                summary: 'Executa comandos controlados.',
                category: 'system',
                risky: true,
                actionHint: 'Use com zero-trust.',
              },
            ],
            canInvoke: true,
            nextAction: 'Conectar o transporte remoto.',
            trustLabel: 'pareado',
          },
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: {
            headline: 'Node Mesh exposes 1 node.',
            operatorSummary: '1 node pareado e online.',
          },
        })),
      } as any,
      taskManager,
      permissionService,
      parser: parser as any,
      taskOrchestrationController: taskOrchestrationController as any,
      permissionController,
      surfaceTaskDispatcher: surfaceTaskDispatcher as any,
      webUserId: 'telegram-admin',
      agentGateway: {
        handle: jest.fn(async () => null),
        resolveApprovalIntent: jest.fn(async () => ({
          resolution: { status: 'not_approval_intent' },
        })),
        addRuntimeEventBus: jest.fn(),
        attachWatchModeService: jest.fn(),
      } as any,
    });

    try {
    await service.start();
    const baseUrl = service.getUrl();
    const token = 'web-secret';

    const { status: sessionStatus, payload: sessionPayload } = await webJson(
      baseUrl,
      token,
      '/api/web/session',
    );
    const sessionId = String(sessionPayload.sessionId || '');
    const handoffResult = await webJson(
      baseUrl,
      token,
      `/api/web/session/handoff-sessionId=${encodeURIComponent(sessionId)}`,
    );
    const sessionToolsResult = await webJson(
      baseUrl,
      token,
      `/api/web/session-tools-sessionId=${encodeURIComponent(sessionId)}`,
    );

    const { status: sendStatus, payload: sendPayload } = await webJson(
      baseUrl,
      token,
      '/api/web/chat/send',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          message: 'hello',
        }),
      },
    );
    const { status: spawnStatus, payload: spawnPayload } = await webJson(
      baseUrl,
      token,
      '/api/web/session-tools/spawn',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
        }),
      },
    );

    const { status: handoffStatus, payload: handoffPayload } = handoffResult;
    const { status: sessionToolsStatus, payload: sessionToolsPayload } = sessionToolsResult;

    expect(sessionStatus).toBe(200);
    expect(handoffStatus).toBe(200);
    expect(handoffPayload).toEqual(
      expect.objectContaining({
        ok: true,
        handoff: expect.objectContaining({
          canonicalTarget: expect.objectContaining({
            kind: 'task',
          }),
          handoffPrompt: expect.any(String),
        }),
      }),
    );
    expect(sessionToolsStatus).toBe(200);
    expect(sessionToolsPayload).toEqual(
      expect.objectContaining({
        ok: true,
        gateway: expect.objectContaining({
          summary: expect.objectContaining({
            sessionTargets: expect.any(Number),
          }),
        }),
        session: expect.objectContaining({
          chatId: expect.any(String),
        }),
        gatewaySessionTools: expect.objectContaining({
          tools: expect.arrayContaining([
            expect.objectContaining({ id: 'sessions_list' }),
            expect.objectContaining({ id: 'sessions_history' }),
            expect.objectContaining({ id: 'sessions_send' }),
            expect.objectContaining({ id: 'sessions_spawn' }),
          ]),
        }),
        sessionPlane: expect.objectContaining({
          current: expect.objectContaining({
            history: expect.anything(),
          }),
        }),
      }),
    );
    expect(sessionPayload.continuity).toEqual(
      expect.objectContaining({
        latestTelegramTask: expect.objectContaining({
          taskId: 'task-telegram-seed',
        }),
      }),
    );
    expect(sendStatus).toBe(200);
    expect(sendPayload).toEqual(
      expect.objectContaining({
        ok: true,
        taskId: 'task-web-1',
        gateway: expect.objectContaining({
          summary: expect.objectContaining({
            sessionTargets: expect.any(Number),
          }),
        }),
        session: expect.objectContaining({
          permissions: expect.any(Array),
        }),
        gatewaySessionTools: expect.objectContaining({
          history: expect.anything(),
        }),
        memoryPlane: expect.objectContaining({
          summary: expect.objectContaining({
            artifacts: expect.any(Number),
          }),
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            sendReady: true,
          }),
        }),
        snapshot: expect.objectContaining({
          continuity: expect.objectContaining({
            principalId: 'telegram-admin',
            latestTelegramTask: expect.objectContaining({
              taskId: 'task-telegram-seed',
            }),
            latestWebTask: expect.objectContaining({
              taskId: 'task-web-1',
            }),
          }),
          replay: expect.objectContaining({
            recommendedEntry: expect.objectContaining({
              kind: 'task',
              targetId: 'task-web-1',
            }),
            timeline: expect.arrayContaining([
              expect.objectContaining({
                kind: 'focus',
              }),
              expect.objectContaining({
                kind: 'permission',
              }),
            ]),
          }),
          handoff: expect.objectContaining({
            status: 'resume-required',
            canonicalTarget: expect.objectContaining({
              kind: 'task',
              id: 'task-web-1',
            }),
            checkpoints: expect.objectContaining({
              pendingPermissions: 1,
            }),
          }),
          permissions: expect.arrayContaining([
            expect.objectContaining({
              permission_id: 'perm-web-1',
              task_id: 'task-web-1',
            }),
          ]),
        }),
      }),
    );
    expect(spawnStatus).toBe(200);
    expect(spawnPayload).toEqual(
      expect.objectContaining({
        ok: true,
        spawnedFrom: sessionId,
        seededPrompt: expect.any(String),
        sessionId: expect.any(String),
        gateway: expect.objectContaining({
          summary: expect.objectContaining({
            sessionTargets: expect.any(Number),
          }),
        }),
        session: expect.objectContaining({
          chatId: expect.any(String),
        }),
        sessionPlane: expect.objectContaining({
          summary: expect.objectContaining({
            spawnReady: true,
          }),
        }),
      }),
    );
    } finally {
      await service.stopAsync();
    }
  });
});
