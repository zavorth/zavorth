import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../../../../src/config/index.js';
import { SkillLoader } from '../../../../../src/skills/SkillLoader.js';
import { ZavorthControlService } from '../../../../../src/services/ZavorthControlService';
import { ZavorthCapabilityCatalogService } from '../../../../../src/services/ZavorthCapabilityCatalogService';
import { IntegrationHubService } from '../../../../../src/services/IntegrationHubService';
import { ProviderControlPlaneService } from '../../../../../src/services/ProviderControlPlaneService';
import { RuntimeInstallJourneyService } from '../../../../../src/runtime/access/RuntimeInstallJourneyService.js';
import { RuntimeOfficialRemoteAccessService } from '../../../../../src/runtime/access/RuntimeOfficialRemoteAccessService.js';
import { RuntimeRemoteAccessService } from '../../../../../src/runtime/access/RuntimeRemoteAccessService.js';
import { WorkflowRunService } from '../../../../../src/services/WorkflowRunService';
import {
  createTestLogRepo,
  fetchZavorthControlJson,
  fetchNoKeepAlive,
} from '../../../../helpers/zavorthControlWebTestUtils.js';

jest.setTimeout(60000);

function createInstallJourneyFixture() {
  const now = new Date().toISOString();
  const readiness = {
    generatedAt: now,
    summary: 'Zavorth ready for local and remote use',
    local: {
      ready: true,
      baseUrl: 'http://127.0.0.1:33333',
      appUrl: 'http://127.0.0.1:33333/zavorthControl',
      issues: [],
    },
    remote: {
      configured: true,
      ready: true,
      baseUrl: 'https://zavorth.example.com',
      appUrl: 'https://zavorth.example.com/zavorthControl',
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
      summary: 'No safe correction available.',
    },
    startup: null,
    manifest: {
      summary: 'Zavorth ready for local and remote use',
      local: {
        ready: true,
        baseUrl: 'http://127.0.0.1:33333',
        appUrl: 'http://127.0.0.1:33333/zavorthControl',
        zavorthControlUrl: 'http://127.0.0.1:33333/zavorthControl',
      },
      remote: {
        ready: true,
        requiresHttps: true,
        baseUrl: 'https://zavorth.example.com',
        appUrl: 'https://zavorth.example.com/zavorthControl',
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
          title: 'Instalaction',
          description: 'Instale o runtime supervisionado.',
        },
      ],
      nextSteps: [],
      surfaces: [
        { id: 'control', label: 'ZavorthControl', url: 'http://127.0.0.1:33333/zavorthControl' },
        { id: 'telegram', label: 'Telegram', url: 'telegram://zavorth' },
      ],
    },
    phases: [
      {
        id: 'bootstrap',
        title: 'Bootstrap plan',
        status: 'ready',
        summary: 'Bootstrap ok.',
        command: null,
        details: [],
      },
    ],
    summary: 'Zavorth ready for local and remote use',
  } as any;
}

function createOfficialRemoteAccessFixture() {
  const now = new Date().toISOString();
  return {
    generatedAt: now,
    summary: 'Acesso remoto oficial ready.',
    official: {
      generatedAt: now,
      summary: 'Zavorth ready for local and remote use',
      tokenSource: 'env',
      journey: {} as any,
      manifest: {} as any,
      readiness: {} as any,
      local: {
        ready: true,
        appUrl: 'http://127.0.0.1:33333/zavorthControl',
        trust: {
          attempted: false,
          applied: true,
          statusCode: 200,
          error: null,
        },
      },
      remote: {
        configured: true,
        appUrl: 'https://zavorth.example.com/zavorthControl',
        appProbe: null,
        authProbe: null,
        issues: [],
        ready: true,
      },
      nextSteps: [],
    },
    recommendedPathId: 'official',
    recommendedPathReason: 'The official path is already validated.',
    paths: [
      {
        id: 'official',
        label: 'Caminho oficial do app remoto',
        status: 'ready',
        summary: 'Remote app validated.',
        command: 'npm run ops:remote:official',
        steps: [],
      },
    ],
    remote: {
      configured: true,
      baseUrl: 'https://zavorth.example.com',
      appUrl: 'https://zavorth.example.com/zavorthControl',
      shareUrl: 'https://zavorth.example.com/zavorthControl',
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
      appUrl: 'https://zavorth.example.com/zavorthControl',
      baseUrl: 'https://zavorth.example.com',
      issues: [],
      summary: 'Official remote access validated.',
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
    summary: 'Acesso remoto oficial ready.',
    official: {} as any,
    recommendedPathId: 'official',
    recommendedPathReason: 'The official path is already validated.',
    paths: [
      {
        id: 'official',
        label: 'Caminho oficial do app remoto',
        status: 'ready',
        summary: 'Remote app validated.',
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

describe('ZavorthControlService', () => {
  const logRepo = createTestLogRepo();
  const originalPublicBaseUrl = config.zavorthPublicBaseUrl;
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalZavorthControlRuntimeStateFile = config.zavorthControlRuntimeStateFile;
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
    config.zavorthControlRuntimeStateFile = originalZavorthControlRuntimeStateFile;
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

  it('serves the runtime handoff shell while preserving SDD workflow catalog and teams data', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    const workflowRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-sdd-workflow-'));
    tempDirs.push(workflowRoot);
    config.workflowRunDir = workflowRoot;

    const workflowRuns = new WorkflowRunService({
      storageDir: workflowRoot,
      persist: true,
      now: () => new Date('2026-04-03T11:00:00.000Z'),
    });
    const run = workflowRuns.createRun(
      'sdd',
      'Avancar o loop SDD da feature.',
      'core',
      [],
      null,
      {
        trigger: {
          feature_id: 'multisurface/shared-command-contract',
        },
      },
    );

    const tasks: any[] = [
      {
        task_id: 'task-sdd-123456789',
        raw_message: '/workflow sdd multisurface/shared-command-contract',
        normalized_message: '/workflow sdd multisurface/shared-command-contract',
        command_type: '/workflow',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'codex',
        workspace: 'core',
        result_summary: 'SDD loop ready for the next iteration.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        metadata: {
          workflow_run_id: run.workflow_run_id,
          workflow_trigger_feature_id: 'multisurface/shared-command-contract',
        },
        target_files: [],
        artifacts: [],
      },
    ];

    const service = new ZavorthControlService(logRepo);
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
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permission pendente'),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const appResponse = await fetchNoKeepAlive(`${baseUrl}/app`);
    const appHtml = await appResponse.text();
    const scriptResponse = await fetchNoKeepAlive(`${baseUrl}/app.js`);
    const scriptBody = await scriptResponse.text();
    const { status: sessionStatus, payload: sessionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: catalogStatus, payload: catalogPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/catalog-sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { status: teamsStatus, payload: teamsPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/teams',
      { token },
    );
    await service.stopAsync();

    expect(appResponse.status).toBe(200);
    expect(appHtml).toContain('Zavorth Runtime');
    expect(appHtml).toContain('runtime-handoff');
    expect(appHtml).toContain('Cockpit do operador');
    expect(appHtml).toContain('shell protegido');
    expect(scriptResponse.status).toBe(200);
    expect(scriptBody).toContain('runtime-shell-status');
    expect(sessionStatus).toBe(200);
    expect(catalogStatus).toBe(200);
    expect(catalogPayload.catalog.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('#workflow-sdd:'),
          payload: expect.objectContaining({
            action: 'compose_followup',
            draftMessage: '/workflow sdd multisurface/shared-command-contract',
          }),
        }),
      ]),
    );
    expect(teamsStatus).toBe(200);
    expect(teamsPayload).toEqual(
      expect.objectContaining({
        ok: true,
        teams: expect.objectContaining({
          teams: expect.arrayContaining([
            expect.objectContaining({
              id: 'sdd',
              entryCommand: '/workflow sdd <feature-id>',
            }),
          ]),
        }),
      }),
    );
  });

  it('processes live task approvals and rejections through the web app endpoints', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const createdAt = new Date().toISOString();
    const tasks: any[] = [
      {
        task_id: 'web-approval-task-1',
        chat_id: '',
        raw_message: '/run echo approval one',
        normalized_message: '/run echo approval one',
        command_type: '/run',
        status: 'waiting_approval',
        risk_level: 9,
        requires_approval: true,
        approval_status: 'pending',
        executor_used: 'local',
        workspace: 'C:/repo',
        result_summary: 'Waiting for human approval to resume execution.',
        error_summary: null,
        updated_at: createdAt,
        created_at: createdAt,
        metadata: {},
        target_files: [],
        artifacts: [],
      },
      {
        task_id: 'web-approval-task-2',
        chat_id: '',
        raw_message: '/run echo approval two',
        normalized_message: '/run echo approval two',
        command_type: '/run',
        status: 'waiting_approval',
        risk_level: 7,
        requires_approval: true,
        approval_status: 'pending',
        executor_used: 'local',
        workspace: 'C:/repo',
        result_summary: 'Waiting for human approval to resume execution.',
        error_summary: null,
        updated_at: createdAt,
        created_at: createdAt,
        metadata: {},
        target_files: [],
        artifacts: [],
      },
    ];

    const permissionController = {
      resolvePermissionReference: jest.fn(),
      shortPermissionId: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleApproval: jest.fn(async (ctx: any, args: string) => {
        const taskId = String(args || '').trim().split(/\s+/)[0];
        const task = tasks.find((entry) => entry.task_id === taskId);
        task.status = 'completed';
        task.approval_status = 'approved';
        task.updated_at = new Date().toISOString();
        task.result_summary = 'Approval registrado e run resumption.';
        await ctx.reply('Task approval recorded.');
      }),
      handleRejection: jest.fn(async (ctx: any, taskId: string) => {
        const task = tasks.find((entry) => entry.task_id === taskId);
        task.status = 'rejected';
        task.approval_status = 'rejected';
        task.updated_at = new Date().toISOString();
        task.error_summary = 'Approval rejected pelo operador.';
        await ctx.reply('Tudo certo. A tarefa foi rejected.');
      }),
      formatPermissionCreatedMessage: jest.fn(() => 'Permission pendente'),
    };

    const service = new ZavorthControlService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasksByChat: jest.fn((chatId: string) => tasks.filter((task) => task.chat_id === chatId)),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: permissionController as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    tasks.forEach((task) => {
      task.chat_id = `web:${sessionPayload.sessionId}`;
    });

              reason: 'The approval was recorded and the final file is ready.',
      baseUrl,
      '/api/web/tasks/approve',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            taskId: 'web-approval-task-1',
          }),
        },
      },
    );

    const { status: rejectStatus, payload: rejectPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/tasks/reject',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            taskId: 'web-approval-task-2',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
              reason: 'The approval was recorded and the final file is ready.',
    expect(rejectStatus).toBe(200);
    expect(permissionController.handleApproval).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining('web-approval-task-1'),
    );
    expect(permissionController.handleRejection).toHaveBeenCalledWith(
      expect.any(Object),
      'web-approval-task-2',
    );
    expect(approvePayload.snapshot.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: 'web-approval-task-1',
          status: 'completed',
          approval_status: 'approved',
        }),
      ]),
    );
    expect(approvePayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Task approval recorded'),
        }),
      ]),
    );
    expect(rejectPayload.snapshot.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: 'web-approval-task-2',
          status: 'rejected',
          approval_status: 'rejected',
        }),
      ]),
    );
    expect(rejectPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('A tarefa foi rejected'),
        }),
      ]),
    );
  });

  it('updates paused workflow continuity after web approval and exposes the final delivery preview', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    const workflowRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-approval-workflow-'));
    tempDirs.push(workflowRoot);
    config.workflowRunDir = workflowRoot;

    const finalArtifactPath = path.join(process.cwd(), `zavorthControl-final-delivery-${Date.now()}.md`);
    fs.writeFileSync(
      finalArtifactPath,
              reason: 'The briefing is ready for final review and release.',
      'utf8',
    );

    const workflowRuns = new WorkflowRunService({ storageDir: workflowRoot, persist: true });
              reason: 'The briefing is ready for final review and release.',
      {
        id: 'maker',
        executor: 'codex',
        role: 'maker',
        label: 'Codex Maker',
        intro: 'Implementaction.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
      {
        id: 'reviewer',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Review.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);
              reason: 'The briefing is ready for final review and release.',
    workflowRuns.markStageCompleted(persistedRun, 'maker', {
      execution_id: 'exec-maker-approval',
      task_id: 'task-maker-approval',
      executor: 'codex',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
              reason: 'The briefing is ready for final review and release.',
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
              reason: 'The briefing is ready for final review and release.',
    workflowRuns.markStageStarted(
      persistedRun,
      'reviewer',
              reason: 'The briefing is ready for final review and release.',
      'Waiting for human approval to resume execution.',
    );
    workflowRuns.markStageInterrupted(
      persistedRun,
      'reviewer',
      'approval_pending',
      'Waiting for human approval to resume execution.',
    );

    const createdAt = new Date().toISOString();
    const telegramTask: any = {
      task_id: 'telegram-workflow-task-1',
      chat_id: 'telegram:chat-approval-1',
      source: 'telegram',
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
      command_type: '/workflow',
      status: 'waiting_approval',
      risk_level: 7,
      requires_approval: true,
      approval_status: 'pending',
      executor_used: 'external_executor',
      workspace: workflowRoot,
      result_summary: 'Workflow pausado waiting for sua confirmation.',
      error_summary: null,
      updated_at: createdAt,
      created_at: createdAt,
      metadata: {
        workflow_run_id: persistedRun.workflow_run_id,
        workflow_resume_stage_id: 'reviewer',
        workflow_resume_stage_label: 'ExternalExecutor Reviewer',
        workflow_stage_id: 'reviewer',
        telegram_surface_summary: {
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
          workflowLabel: 'Workflow de entrega',
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
          isContinuationRequest: true,
        },
              reason: 'The briefing is ready for final review and release.',
        workspace_response_style: 'implementation_ready',
        workspace_workflow_recommendation: {
          workflow: 'ship',
              reason: 'The briefing is ready for final review and release.',
        },
        workspace_operational_memory: {
          active_focuses: [
            {
              task_id: 'telegram-workflow-task-1',
              reason: 'The briefing is ready for final review and release.',
            },
          ],
          recent_artifacts: [
            {
              task_id: 'telegram-workflow-task-1',
              reason: 'The briefing is ready for final review and release.',
              kind: 'report',
              reason: 'The briefing is ready for final review and release.',
            },
          ],
          continuity_recommendations: [
            {
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
            },
          ],
        },
      },
      target_files: [],
      artifacts: [],
    };
    const webTask: any = {
      task_id: 'web-workflow-task-1',
      chat_id: '',
      source: 'web',
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
      command_type: '/task',
      status: 'completed',
      risk_level: 0,
      requires_approval: false,
      approval_status: 'not_required',
      executor_used: 'local',
      workspace: workflowRoot,
      result_summary: 'Previous review completed.',
      error_summary: null,
      updated_at: createdAt,
      created_at: createdAt,
      metadata: {},
      target_files: [],
      artifacts: [],
    };
    const tasks: any[] = [telegramTask, webTask];

    const permissionController = {
      resolvePermissionReference: jest.fn(),
      shortPermissionId: jest.fn(),
      handlePermissionCallback: jest.fn(),
      handleApproval: jest.fn(async (ctx: any, args: string) => {
        const taskId = String(args || '').trim().split(/\s+/)[0];
        const task = tasks.find((entry) => entry.task_id === taskId);
        task.status = 'completed';
        task.approval_status = 'approved';
        task.updated_at = new Date().toISOString();
        task.result_summary = 'Approval registrado e workflow resumed.';
        task.metadata.workflow_resume_stage_id = null;
        task.metadata.workflow_resume_stage_label = null;
        task.metadata.workflow_stage_id = null;
        task.metadata.telegram_surface_summary = {
          ...task.metadata.telegram_surface_summary,
              reason: 'The briefing is ready for final review and release.',
          followupPrompt:
              reason: 'The briefing is ready for final review and release.',
              reason: 'The briefing is ready for final review and release.',
        };
        task.metadata.workspace_operational_memory = {
          ...task.metadata.workspace_operational_memory,
          recent_artifacts: [
            {
              task_id: task.task_id,
              reason: 'The briefing is ready for final review and release.',
              kind: 'report',
              path: finalArtifactPath,
            },
          ],
          continuity_recommendations: [
            {
              label: 'Abrir entrega final',
              reason: 'The approval was recorded and the final file is ready.',
            },
          ],
        };
        task.artifacts = [
          {
            id: 'artifact-final-1',
              reason: 'The briefing is ready for final review and release.',
            type: 'document',
            kind: 'report',
              reason: 'The briefing is ready for final review and release.',
            source: 'web',
            path: finalArtifactPath,
            url: null,
            mimeType: 'text/markdown',
              reason: 'The briefing is ready for final review and release.',
            description: null,
            previewText: null,
            sizeBytes: fs.statSync(finalArtifactPath).size,
            exists: true,
            deliveryChannel: 'document',
            createdAt: new Date().toISOString(),
          },
        ];
        workflowRuns.markStageCompleted(persistedRun, 'reviewer', {
          execution_id: 'exec-reviewer-approval',
          task_id: taskId,
          executor: 'external_executor',
          success: true,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          actions_executed: [],
          files_read: [],
          files_written: [finalArtifactPath],
          files_deleted: [],
          commands_executed: [],
              reason: 'The briefing is ready for final review and release.',
          stderr: null,
          diff_summary: null,
          artifacts: task.artifacts,
          rollback_available: false,
          error_code: null,
          error_message: null,
          metadata: {},
              reason: 'The briefing is ready for final review and release.',
        await ctx.reply('Task approval recorded.');
      }),
      handleRejection: jest.fn(),
      formatPermissionCreatedMessage: jest.fn(() => 'Permission pendente'),
    };

    const service = new ZavorthControlService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasks: jest.fn(() => tasks),
        getRecentTasksByChat: jest.fn((chatId: string) => tasks.filter((task) => task.chat_id === chatId)),
        getTask: jest.fn((taskId: string) => tasks.find((task) => task.task_id === taskId)),
      } as any,
      parser: {
        parse: jest.fn(),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(),
      } as any,
      permissionController: permissionController as any,
      hostIdentityService: {
        getStatus: jest.fn(() => ({
          authorized: true,
          firstRun: false,
          currentFingerprint: 'host-current',
          storedFingerprint: 'host-current',
        })),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status: sessionStatus, payload: sessionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    telegramTask.chat_id = `web:${sessionPayload.sessionId}`;
    webTask.chat_id = `web:${sessionPayload.sessionId}`;

    const { status: beforeStatus, payload: beforePayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/state-sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
              reason: 'The approval was recorded and the final file is ready.',
      baseUrl,
      '/api/web/tasks/approve',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionPayload.sessionId,
            taskId: telegramTask.task_id,
          }),
        },
      },
    );
    const { status: afterStatus, payload: afterPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/state-sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { status: previewStatus, payload: previewPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/file-preview-path=${encodeURIComponent(finalArtifactPath)}`,
      { token },
    );
    if (fs.existsSync(finalArtifactPath)) {
      fs.unlinkSync(finalArtifactPath);
    }
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    if (beforeStatus !== 200) console.log("State Error:", beforePayload);
    expect(beforeStatus).toBe(200);
              reason: 'The approval was recorded and the final file is ready.',
    expect(afterStatus).toBe(200);
    expect(previewStatus).toBe(200);
    expect(beforePayload.snapshot.continuity).toEqual(
      expect.objectContaining({
        latestTelegramTask: expect.objectContaining({
          taskId: telegramTask.task_id,
          status: 'waiting_approval',
        }),
        workspaceContext: expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
          workflowRun: expect.objectContaining({
            workflow: 'ship',
            status: 'approval_pending',
            resumeStage: expect.objectContaining({
              id: 'reviewer',
              status: 'approval_pending',
            }),
          }),
          nextActions: expect.arrayContaining([
            expect.objectContaining({
              kind: 'approve_task',
              taskId: telegramTask.task_id,
            }),
            expect.objectContaining({
              kind: 'resume_workflow',
              workflowRunId: persistedRun.workflow_run_id,
            }),
          ]),
        }),
      }),
    );
    expect(permissionController.handleApproval).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringContaining(telegramTask.task_id),
    );
    expect(approvePayload.snapshot.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: telegramTask.task_id,
          approval_status: 'approved',
          status: 'completed',
          artifacts: expect.arrayContaining([
            expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
            }),
          ]),
        }),
      ]),
    );
    expect(afterPayload.snapshot.continuity).toEqual(
      expect.objectContaining({
        latestTelegramTask: expect.objectContaining({
          taskId: telegramTask.task_id,
          status: 'completed',
        }),
        workspaceContext: expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
          recentArtifact: expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
            path: finalArtifactPath,
          }),
          workflowRun: expect.objectContaining({
            workflow: 'ship',
            status: 'completed',
            resumeStage: null,
          }),
          nextActions: expect.arrayContaining([
            expect.objectContaining({
              kind: 'open_latest_delivery',
            }),
          ]),
        }),
        suggestedAction: expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
        }),
      }),
    );
    expect(afterPayload.snapshot.workflowRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflow_run_id: persistedRun.workflow_run_id,
          status: 'completed',
          artifacts: expect.arrayContaining([
            expect.objectContaining({
              reason: 'The briefing is ready for final review and release.',
            }),
          ]),
        }),
      ]),
    );
    expect(previewPayload.preview).toEqual(
      expect.objectContaining({
        path: finalArtifactPath,
              reason: 'The briefing is ready for final review and release.',
      }),
    );
  }, 180000);

});
