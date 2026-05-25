import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../../../../src/config/index.js';
import { SkillLoader } from '../../../../../src/skills/SkillLoader.js';
import { DashboardService } from '../../../../../src/services/DashboardService';
import { ZavorthCapabilityCatalogService } from '../../../../../src/services/ZavorthCapabilityCatalogService';
import { IntegrationHubService } from '../../../../../src/services/IntegrationHubService';
import { ProviderControlPlaneService } from '../../../../../src/services/ProviderControlPlaneService';
import { RuntimeInstallJourneyService } from '../../../../../src/runtime/access/RuntimeInstallJourneyService.js';
import { RuntimeOfficialRemoteAccessService } from '../../../../../src/runtime/access/RuntimeOfficialRemoteAccessService.js';
import { RuntimeRemoteAccessService } from '../../../../../src/runtime/access/RuntimeRemoteAccessService.js';
import { WorkflowRunService } from '../../../../../src/services/WorkflowRunService';
import {
  createTestLogRepo,
  fetchDashboardJson,
  fetchNoKeepAlive,
} from '../../../../helpers/dashboardWebTestUtils.js';

jest.setTimeout(60000);

function createInstallJourneyFixture() {
  const now = new Date().toISOString();
  const readiness = {
    generatedAt: now,
    summary: 'Zavorth pronto para uso local e remoto',
    local: {
      ready: true,
      baseUrl: 'http://127.0.0.1:33333',
      appUrl: 'http://127.0.0.1:33333/dashboard',
      issues: [],
    },
    remote: {
      configured: true,
      ready: true,
      baseUrl: 'https://zavorth.example.com',
      appUrl: 'https://zavorth.example.com/dashboard',
      issues: [],
    },
    runtime: {
      supervisorRunning: true,
      workerRunning: true,
      hostAuthorized: true,
      issues: [],
    },
    nextSteps: [],
  };
  const bootstrapReport = {
    checkedAt: now,
    projectRoot: 'C:/repo',
    env: {
      envFilePresent: true,
      llmProvider: 'gemini',
      llmCredentialReady: true,
      issues: [],
    },
    dependencies: {
      installRequired: false,
      buildRequired: false,
    },
    platforms: [],
    supervisedRuntime: {
      running: true,
      installRequired: false,
      buildRequired: false,
      accessReadiness: readiness,
    },
    actions: [],
    summary: 'Bootstrap ok.',
  };

  return {
    startedAt: now,
    finishedAt: now,
    dryRun: true,
    bootstrapRepair: {
      startedAt: now,
      finishedAt: now,
      dryRun: true,
      initial: bootstrapReport,
      steps: [],
      final: bootstrapReport,
      summary: 'Nenhuma correcao segura disponivel.',
    },
    startup: null,
    manifest: {
      summary: 'Zavorth pronto para uso local e remoto',
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/dashboard',
        dashboardUrl: 'http://127.0.0.1:33333/classic',
      },
      remote: {
        ready: true,
        requiresHttps: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/dashboard',
      },
      auth: {
        webTokenConfigured: true,
        authorizedHost: true,
      },
      commands: {
        install: 'npm run ops:install -- --trust-local --launcher --open-best',
        bootstrap: 'npm run ops:bootstrap -- --repair',
        start: 'npm run ops:start',
        access: 'npm run ops:access',
        journey: 'npm run ops:journey',
        remote: 'npm run ops:remote:official',
        trust: '/hostauth trust',
      },
      journey: [
        {
          id: 'install',
          title: 'Instalacao',
          description: 'Instale o runtime supervisionado.',
        },
      ],
      nextSteps: [],
      surfaces: [
        { id: 'control', label: 'Dashboard', url: 'http://127.0.0.1:33333/dashboard' },
        { id: 'telegram', label: 'Telegram', url: 'telegram://zavorth' },
      ],
    },
    phases: [
      {
        id: 'bootstrap',
        title: 'Plano de bootstrap',
        status: 'ready',
        summary: 'Bootstrap ok.',
        command: null,
        details: [],
      },
    ],
    summary: 'Zavorth pronto para uso local e remoto',
  } as any;
}

function createOfficialRemoteAccessFixture() {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    summary: 'Acesso remoto oficial pronto.',
    official: {
      generatedAt: now,
      summary: 'Zavorth pronto para uso local e remoto',
      tokenSource: 'env',
      journey: {} as any,
      manifest: {} as any,
      readiness: {} as any,
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/dashboard',
        trust: {
          attempted: false,
          applied: true,
          statusCode: 200,
          error: null,
        },
      },
      remote: {
        configured: true,
        appUrl: 'https://zavorth.example.com/dashboard',
        appProbe: null,
        authProbe: null,
        issues: [],
        ready: true,
      },
      nextSteps: [],
    },
    recommendedPathId: 'official',
    recommendedPathReason: 'O caminho oficial ja esta validado.',
    paths: [
      {
        id: 'official',
        label: 'Caminho oficial do app remoto',
        status: 'ready',
        summary: 'App remoto validado.',
        command: 'npm run ops:remote:official',
        steps: [],
      },
    ],
    remote: {
      configured: true,
      baseUrl: 'https://zavorth.example.com',
      appUrl: 'https://zavorth.example.com/dashboard',
      shareUrl: 'https://zavorth.example.com/dashboard',
      ready: true,
      issues: [],
    },
    rollout: {
      activeId: 'local-cloudflare',
      recommendedId: 'local-cloudflare',
      candidates: [],
    },
    state: {
      provider: 'local-cloudflare',
      status: 'ready',
      lastAction: 'verify',
      lastActionAt: now,
      lastVerifiedAt: now,
      appUrl: 'https://zavorth.example.com/dashboard',
      baseUrl: 'https://zavorth.example.com',
      issues: [],
      summary: 'Acesso remoto oficial validado.',
    },
    actions: {
      canApply: true,
      canVerify: true,
      canRollback: true,
      recommendedAction: 'verify',
      recommendedProvider: 'local-cloudflare',
    },
    nextSteps: [],
  } as any;
}

function createRemoteAccessFixture() {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    summary: 'Acesso remoto oficial pronto.',
    official: {} as any,
    recommendedPathId: 'official',
    recommendedPathReason: 'O caminho oficial ja esta validado.',
    paths: [
      {
        id: 'official',
        label: 'Caminho oficial do app remoto',
        status: 'ready',
        summary: 'App remoto validado.',
        command: 'npm run ops:remote:official',
        steps: [],
      },
    ],
    nextSteps: [],
  } as any;
}

function openEventStreamProbe(targetUrl: string, token: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  close: () => void;
}> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      targetUrl,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      (response) => {
        resolve({
          statusCode: response.statusCode || 0,
          headers: response.headers,
          close: () => {
            request.destroy();
            response.destroy();
          },
        });
      },
    );
    request.once('error', reject);
    request.end();
  });
}

describe('DashboardService', () => {
  const logRepo = createTestLogRepo();
  const originalPublicBaseUrl = config.zavorthPublicBaseUrl;
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const originalWorkflowRunDir = config.workflowRunDir;
  const originalProvider = config.llmProvider;
  const originalGeminiModel = config.geminiModel;
  const originalGeminiKeys = [...config.geminiApiKeys];
  const originalOpenAiKey = config.openaiApiKey;
  const originalAIGatewayBaseUrl = config.AIGatewayBaseUrl;
  const tempDirs: string[] = [];

  beforeEach(() => {
    jest.spyOn(SkillLoader.prototype, 'loadAll').mockReturnValue([] as any);
    jest.spyOn(RuntimeInstallJourneyService.prototype, 'run').mockResolvedValue(createInstallJourneyFixture());
    jest.spyOn(RuntimeOfficialRemoteAccessService.prototype, 'inspect').mockResolvedValue(createOfficialRemoteAccessFixture());
    jest.spyOn(RuntimeRemoteAccessService.prototype, 'inspect').mockResolvedValue(createRemoteAccessFixture());
  });

  afterEach(() => {
    config.zavorthPublicBaseUrl = originalPublicBaseUrl;
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    config.workflowRunDir = originalWorkflowRunDir;
    (config as any).llmProvider = originalProvider;
    (config as any).geminiModel = originalGeminiModel;
    (config as any).geminiApiKeys = [...originalGeminiKeys];
    (config as any).openaiApiKey = originalOpenAiKey;
    (config as any).AIGatewayBaseUrl = originalAIGatewayBaseUrl;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
    jest.restoreAllMocks();
  });

  it('handles composer actions directly without routing them through the task orchestrator', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const tasks: any[] = [
      {
        task_id: 'task-123456789',
        raw_message: '/plan revisar o repo',
        normalized_message: '/plan revisar o repo',
        command_type: '/plan',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'codex',
        workspace: 'core',
        result_summary: 'Planejamento pronto.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {},
        target_files: [],
        artifacts: [],
      },
    ];

    const taskHandler = jest.fn();
    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => tasks),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: taskHandler,
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/chat/send',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            message: '',
            mentions: [
              {
                id: 'action:resume:task-123456789',
                type: 'action',
                label: '#retomar:task-123',
                trigger: '#',
                payload: {
                  action: 'resume_task',
                  taskId: 'task-123456789',
                },
              },
            ],
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(sendStatus).toBe(200);
    expect(taskHandler).not.toHaveBeenCalled();
    expect(sendPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: '#retomar:task-123',
          mentions: expect.arrayContaining([
            expect.objectContaining({ type: 'action' }),
          ]),
        }),
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('A ultima tarefa ja terminou.'),
          taskId: 'task-123456789',
        }),
      ]),
    );
  });

  it('handles workflow stage resume actions directly from the web composer', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const tasks: any[] = [
      {
        task_id: 'task-123456789',
        raw_message: '/workflow ship fechar release',
        normalized_message: '/workflow ship fechar release',
        command_type: '/workflow',
        status: 'waiting_approval',
        risk_level: 0,
        requires_approval: true,
        approval_status: 'pending',
        executor_used: 'external_executor',
        workspace: 'core',
        result_summary: 'Workflow aguardando confirmacao na revisao final.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {
          workflow_run_id: 'wf-ship-demo-001',
        },
        target_files: [],
        artifacts: [],
      },
    ];

    const taskHandler = jest.fn();
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => tasks),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: taskHandler,
      } as any,
      workflowController: workflowController as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/chat/send',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            message: '',
            mentions: [
              {
                id: 'action:resume-workflow-stage:wf-ship-demo-001:review',
                type: 'action',
                label: '#retomar-etapa:revisao-final',
                trigger: '#',
                payload: {
                  action: 'resume_workflow',
                  workflowRunId: 'wf-ship-demo-001',
                  resumeStageId: 'review',
                  taskId: 'task-123456789',
                },
              },
            ],
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(sendStatus).toBe(200);
    expect(taskHandler).not.toHaveBeenCalled();
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'resume wf-ship-demo-001 review',
    );
    expect(sendPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: '#retomar-etapa:revisao-final',
          mentions: expect.arrayContaining([
            expect.objectContaining({ type: 'action' }),
          ]),
        }),
      ]),
    );
  });

  it('handles workflow stage restart actions directly from the web composer', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const tasks: any[] = [
      {
        task_id: 'task-draft-123456789',
        raw_message: '/workflow ship fechar release',
        normalized_message: '/workflow ship fechar release',
        command_type: '/workflow',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'codex',
        workspace: 'core',
        result_summary: 'Etapa de rascunho concluida.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {
          workflow_run_id: 'wf-ship-demo-001',
        },
        target_files: [],
        artifacts: [],
      },
    ];

    const taskHandler = jest.fn();
    const workflowController = {
      handleWorkflow: jest.fn(async () => undefined),
    };
    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => tasks),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: taskHandler,
      } as any,
      workflowController: workflowController as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/chat/send',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            message: '',
            mentions: [
              {
                id: 'action:resume-workflow-stage:wf-ship-demo-001:draft',
                type: 'action',
                label: '#reiniciar-etapa:rascunho',
                trigger: '#',
                payload: {
                  action: 'restart_workflow_stage',
                  workflowRunId: 'wf-ship-demo-001',
                  resumeStageId: 'draft',
                  taskId: 'task-draft-123456789',
                },
              },
            ],
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(sendStatus).toBe(200);
    expect(taskHandler).not.toHaveBeenCalled();
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'restart-stage wf-ship-demo-001 draft',
    );
    expect(sendPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: '#reiniciar-etapa:rascunho',
          mentions: expect.arrayContaining([
            expect.objectContaining({ type: 'action' }),
          ]),
        }),
      ]),
    );
  }, 180000);

  it('enriches the routed message when a follow-up file action is sent with text', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const tasks: any[] = [
      {
        task_id: 'task-123456789',
        raw_message: '/plan revisar o repo',
        normalized_message: '/plan revisar o repo',
        command_type: '/plan',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'codex',
        workspace: 'C:/repo',
        result_summary: 'Planejamento pronto.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {},
        target_files: ['C:/repo/src/index.ts'],
        artifacts: [],
        chat_id: '',
      },
    ];

    const taskHandler = jest.fn(async (ctx: any, input: any) => {
      await ctx.reply('ACK CONTEXT');
      return {
        task_id: 'web-task-2',
        raw_message: input.text,
        command_type: '/task',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'local',
        workspace: 'core',
        result_summary: 'Resposta com contexto.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {},
        target_files: [],
        artifacts: [],
      };
    });

    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => tasks),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn((text: string) => ({
          command_type: '/task',
          command_args: text,
          normalized_message: text.toLowerCase(),
          explicit_executor: null,
          references_last_task: false,
        })),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: taskHandler,
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/chat/send',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            message: 'analise esse arquivo',
            mentions: [
              {
                id: 'action:attach-file:file:C:/repo/src/index.ts',
                type: 'action',
                label: '#usar-arquivo:index.ts',
                trigger: '#',
                payload: {
                  action: 'attach_file_context',
                  taskId: 'task-123456789',
                  fileName: 'index.ts',
                  path: 'C:/repo/src/index.ts',
                  workspace: 'C:/repo',
                },
              },
            ],
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(sendStatus).toBe(200);
    expect(taskHandler).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        text: expect.stringContaining('[Contexto do composer]'),
      }),
    );
    expect(taskHandler).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        text: expect.stringContaining('Caminho: C:/repo/src/index.ts'),
      }),
    );
    expect(sendPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'analise esse arquivo',
        }),
      ]),
    );
  });

  it('rejects contextual follow-up actions when sent without a natural-language request', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    const service = new DashboardService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn(() => []),
        getTask: jest.fn(),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchDashboardJson(
      baseUrl,
      '/api/web/chat/send',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            message: '',
            mentions: [
              {
                id: 'action:attach-file:file:C:/repo/src/index.ts',
                type: 'action',
                label: '#usar-arquivo:index.ts',
                payload: {
                  action: 'attach_file_context',
                  path: 'C:/repo/src/index.ts',
                },
              },
            ],
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(sendStatus).toBe(400);
    expect(sendPayload.error).toContain('Essa action precisa ir junto com o proximo pedido');
  });
});
