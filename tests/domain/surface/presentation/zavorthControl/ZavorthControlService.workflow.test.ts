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
    summary: 'Zavorth pronto para uso local e remoto',
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
      summary: 'Nenhuma correcao segura disponivel.',
    },
    startup: null,
    manifest: {
      summary: 'Zavorth pronto para uso local e remoto',
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
          title: 'Instalacao',
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

  it('serves web assets, protects the web api, and exposes preview and SSE endpoints', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const packagePreviewPath = path.join(process.cwd(), 'package.json');
    const outsidePreviewPath = path.join(os.tmpdir(), `zavorth-preview-outside-${Date.now()}.txt`);
    fs.writeFileSync(outsidePreviewPath, 'fora do workspace', 'utf8');
    tempDirs.push(outsidePreviewPath);

    const tasks: any[] = [
      {
        task_id: 'web-preview-task-1',
        chat_id: '',
        source: 'web',
        raw_message: '/task revisar package',
        normalized_message: '/task revisar package',
        command_type: '/task',
        status: 'completed',
        risk_level: 0,
        requires_approval: false,
        approval_status: 'not_required',
        executor_used: 'local',
        workspace: process.cwd(),
        result_summary: 'Arquivo do workspace entregue.',
        error_summary: null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        metadata: {},
        target_files: [packagePreviewPath],
        artifacts: [
          {
            id: 'artifact-preview-1',
            key: 'package-json',
            type: 'document',
            kind: 'report',
            name: 'package.json',
            source: 'local',
            path: packagePreviewPath,
            url: null,
            mimeType: 'application/json',
            summary: 'Arquivo principal do workspace.',
            description: null,
            previewText: null,
            sizeBytes: 512,
            exists: true,
            deliveryChannel: 'document',
            createdAt: new Date().toISOString(),
          },
        ],
      },
    ];

    const service = new ZavorthControlService(logRepo);
    service.attachChatRuntime({
      permissionService: {
        listRequests: jest.fn().mockResolvedValue([]),
      } as any,
      taskManager: {
        getRecentTasks: jest.fn(() => tasks),
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
        handleApproval: jest.fn(),
        handleRejection: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
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
    jest.spyOn(require('../../../../../src/skills/SkillLoader').SkillLoader.prototype, 'loadAll').mockReturnValue([
      {
        name: 'debugging',
        description: 'Investiga bugs e falhas.',
        dirPath: 'C:/skills/debugging',
        skillFilePath: 'C:/skills/debugging/SKILL.md',
        supportFilePaths: [],
      },
    ] as any);

    await service.start();
    const stylesResponse = await fetchNoKeepAlive(`${service.getUrl()}/styles.css`);
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const scriptResponse = await fetchNoKeepAlive(`${baseUrl}/app.js`);
    const scriptBody = await scriptResponse.text();
    const unauthorizedResponse = await fetchNoKeepAlive(`${baseUrl}/api/web/session`);
    const { status: sessionStatus, payload: sessionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    tasks[0].chat_id = `web:${sessionPayload.sessionId}`;
    const { response: stateResponse, payload: statePayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/state?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { response: hostStatusResponse, payload: hostStatusPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/status?detail=full',
      { token },
    );
    const { response: officialRemoteAccessResponse, payload: officialRemoteAccessPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/official-remote-access',
      { token },
    );
    const { response: remoteAccessResponse, payload: remoteAccessPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/remote-access',
      { token },
    );
    const { response: catalogResponse, payload: catalogPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/catalog?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { response: previewResponse, payload: previewPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/file-preview?path=${encodeURIComponent(packagePreviewPath)}`,
      { token },
    );
    const { response: blockedPreviewResponse, payload: blockedPreviewPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/file-preview?path=${encodeURIComponent(outsidePreviewPath)}`,
      { token },
    );
    const eventsResponse = await openEventStreamProbe(
      `${baseUrl}/api/web/events?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      token,
    );

    const styles = await stylesResponse.text();
    eventsResponse.close();
    await service.stopAsync();

    expect(stylesResponse.status).toBe(200);
    expect(styles).toContain(':root');
    expect(styles).toContain('.runtime-handoff-shell');
    expect(styles).toContain('.profile-grid');
    expect(scriptResponse.status).toBe(200);
    expect(scriptResponse.headers.get('content-type')).toContain('application/javascript');
    expect(scriptBody).toContain('fetchRuntimeStatus');
    expect(scriptBody).toContain('fetchPublicSnapshot');
    expect(scriptBody).toContain('validateProtectedAccess');
    expect(scriptBody).toContain('/api/auth/status');
    expect(scriptBody).toContain('runtime-shell-status');
    expect(unauthorizedResponse.status).toBe(401);
    expect(sessionStatus).toBe(200);
    expect(stateResponse.status).toBe(200);
    expect(statePayload.snapshot.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          task_id: 'web-preview-task-1',
          status: 'completed',
        }),
      ]),
    );
    expect(hostStatusResponse.status).toBe(200);
    expect(hostStatusPayload).toEqual(
      expect.objectContaining({
        ok: true,
        host: expect.objectContaining({
          authorized: true,
        }),
        readiness: expect.objectContaining({
          summary: expect.any(String),
        }),
        manifest: expect.objectContaining({
          commands: expect.objectContaining({
            install: expect.stringContaining('npm run ops:install'),
          }),
        }),
        installJourney: expect.objectContaining({
          summary: expect.any(String),
          phases: expect.arrayContaining([
            expect.objectContaining({
              id: 'bootstrap',
            }),
          ]),
        }),
        officialRemoteAccess: expect.objectContaining({
          summary: expect.any(String),
          state: expect.any(Object),
          actions: expect.any(Object),
        }),
        remoteAccess: expect.objectContaining({
          summary: expect.any(String),
          recommendedPathId: expect.any(String),
          paths: expect.any(Array),
        }),
        surfaceConsistency: expect.objectContaining({
          recommended: expect.arrayContaining([
            expect.objectContaining({
              commandType: '/task',
            }),
          ]),
        }),
      }),
    );
    expect(officialRemoteAccessResponse.status).toBe(200);
    expect(officialRemoteAccessPayload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: expect.any(String),
          state: expect.any(Object),
          actions: expect.any(Object),
        }),
      }),
    );
    expect(remoteAccessResponse.status).toBe(200);
    expect(remoteAccessPayload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: expect.any(String),
          recommendedPathId: expect.any(String),
          recommendedPathReason: expect.any(String),
          official: expect.any(Object),
          paths: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              summary: expect.any(String),
            }),
          ]),
          nextSteps: expect.any(Array),
        }),
      }),
    );
    expect(catalogResponse.status).toBe(200);
    expect(catalogPayload.catalog.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'debugging', type: 'skill' }),
      ]),
    );
    expect(catalogPayload.catalog.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'artifact' }),
      ]),
    );
    expect(catalogPayload.catalog.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'file' }),
      ]),
    );
    expect(previewResponse.status).toBe(200);
    expect(previewPayload.preview).toEqual(
      expect.objectContaining({
        path: packagePreviewPath,
        content: expect.stringContaining('"name": "zavorth"'),
      }),
    );
    expect(blockedPreviewResponse.status).toBe(400);
    expect(blockedPreviewPayload.error).toContain('fora do workspace');
    expect(eventsResponse.statusCode).toBe(200);
    expect(String(eventsResponse.headers['content-type'] || '')).toContain('text/event-stream');
  }, 180000);

  it('applies a provider profile through the web endpoint and returns updated snapshots', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    (config as any).llmProvider = 'gemini';
    (config as any).geminiModel = 'gemini-2.5-flash';
    (config as any).geminiApiKeys = ['gemini-key'];
    (config as any).openaiApiKey = 'openai-key';
    (config as any).AIGatewayBaseUrl = 'http://127.0.0.1:20128/v1';

    const providerControlPlane = new ProviderControlPlaneService({
      clearProviderCache: jest.fn(),
    });
    const integrationHub = new IntegrationHubService({
      providerControlPlaneService: providerControlPlane,
    });
    const capabilityCatalog = new ZavorthCapabilityCatalogService({
      integrationHubService: integrationHub,
    });

    const service = new ZavorthControlService(logRepo, {
      providerControlPlaneService: providerControlPlane,
      integrationHubService: integrationHub,
      capabilityCatalogService: capabilityCatalog,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status, payload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/providers/profile',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            profileId: 'coding',
            selectedId: 'openrouter',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        appliedProfile: expect.objectContaining({
          id: 'coding',
          label: 'Coding',
        }),
        selection: expect.objectContaining({
          providerName: 'openai',
          targetId: 'openai',
        }),
        capabilities: expect.objectContaining({
          providers: expect.objectContaining({
            activeProviderName: 'openai',
          }),
        }),
        hub: expect.objectContaining({
          providers: expect.objectContaining({
            activeProviderName: 'openai',
          }),
          selected: expect.objectContaining({
            manifest: expect.objectContaining({
              id: 'openrouter',
            }),
          }),
        }),
      }),
    );
  });

  it('starts an agent OS loop through the protected web endpoint', async () => {
    config.zavorthWebAuthToken = 'test-web-token';

    const workflowController = {
      handleWorkflow: jest.fn(async (ctx: any, args: string) => {
        await ctx.reply(`workflow:${args}`);
      }),
    };

    const service = new ZavorthControlService(logRepo, {
      webUserId: '1',
    });

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
      workflowController: workflowController as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const { status, payload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/agent-os/actions',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actionId: 'start_loop',
            teamId: 'sdd',
            featureId: 'multisurface/shared-command-contract',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(202);
    expect(workflowController.handleWorkflow).toHaveBeenCalledWith(
      expect.any(Object),
      'sdd multisurface/shared-command-contract',
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        action: expect.objectContaining({
          actionId: 'start_loop',
          teamId: 'sdd',
          command: '/workflow sdd multisurface/shared-command-contract',
        }),
        agentOs: expect.objectContaining({
          summary: expect.objectContaining({
            loops: expect.any(Number),
          }),
        }),
        teams: expect.objectContaining({
          teams: expect.any(Array),
        }),
      }),
    );
  });

  it('exposes telegram continuity context through the web state endpoint', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    const workflowRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-control-workflows-'));
    tempDirs.push(workflowRoot);
    config.workflowRunDir = workflowRoot;

    const workflowRuns = new WorkflowRunService({ storageDir: workflowRoot, persist: true });
    const persistedRun = workflowRuns.createRun('ship', 'Concluir deploy final', 'C:/repo', [
      {
        id: 'maker',
        executor: 'codex',
        role: 'maker',
        label: 'Codex Maker',
        intro: 'Implementacao.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
      {
        id: 'reviewer',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Revisao.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);
    workflowRuns.markStageStarted(persistedRun, 'maker', 'Concluir deploy final', null);
    workflowRuns.markStageCompleted(persistedRun, 'maker', {
      execution_id: 'exec-maker',
      task_id: 'task-maker',
      executor: 'codex',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: 'Deploy consolidado.',
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    }, 'Deploy consolidado.');
    workflowRuns.markStageInterrupted(persistedRun, 'reviewer', 'approval_pending', 'Aguardando sua confirmacao.');

    const tasks: any[] = [
      {
        task_id: 'telegram-task-continuity-1',
        chat_id: 'telegram:chat-1',
        source: 'telegram',
        raw_message: 'continue o deploy final',
        normalized_message: 'continue o deploy final',
        command_type: '/task',
        status: 'running',
        workspace: 'C:/repo',
        updated_at: '2026-03-31T19:58:00.000Z',
        created_at: '2026-03-31T19:50:00.000Z',
        result_summary: null,
        error_summary: null,
        metadata: {
          workflow_run_id: persistedRun.workflow_run_id,
          telegram_surface_summary: {
            titleHint: 'Deploy final',
            summary: 'Retomando deploy final com foco em revisar os ultimos ajustes antes da liberacao.',
            followupPrompt: 'Retome a conversa que veio do Telegram sobre Deploy final. Revise os ultimos ajustes e siga para a liberacao final.',
            workflowLabel: 'Workflow de entrega',
            recentArtifact: 'deploy-checklist.md',
            activeFocus: 'Liberacao final em andamento',
            isContinuationRequest: true,
          },
          workspace_operational_memory_summary: 'Liberacao final em andamento com checklist recente pronto para revisao.',
          workspace_response_style: 'implementation_ready',
          workspace_workflow_recommendation: {
            workflow: 'ship',
            reason: 'Ja existe contexto suficiente para concluir a liberacao.',
          },
          workspace_operational_memory: {
            active_focuses: [
              {
                task_id: 'telegram-task-continuity-1',
                summary: 'Liberacao final em andamento',
              },
            ],
            recent_artifacts: [
              {
                task_id: 'web-task-continuity-1',
                name: 'deploy-checklist.md',
                kind: 'report',
                path: 'C:/repo/artifacts/deploy-checklist.md',
              },
            ],
            continuity_recommendations: [
              {
                label: 'Retomar deploy final',
                reason: 'Falta revisar os ultimos ajustes e liberar a entrega.',
              },
            ],
          },
        },
      },
      {
        task_id: 'web-task-continuity-1',
        chat_id: '',
        source: 'web',
        raw_message: '/task revisar checklist de deploy',
        normalized_message: '/task revisar checklist de deploy',
        command_type: '/task',
        status: 'completed',
        workspace: 'C:/repo',
        updated_at: '2026-03-31T19:40:00.000Z',
        created_at: '2026-03-31T19:35:00.000Z',
        result_summary: 'Checklist revisado.',
        error_summary: null,
        metadata: {},
      },
    ];

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
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        handleApproval: jest.fn(),
        handleRejection: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
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
    tasks[1].chat_id = `web:${sessionPayload.sessionId}`;

    const { status: stateStatus, payload: statePayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/state?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    await service.stopAsync();

    expect(sessionStatus).toBe(200);
    expect(stateStatus).toBe(200);
    expect(statePayload.snapshot.continuity).toEqual(
      expect.objectContaining({
        sessionId: sessionPayload.sessionId,
        latestTelegramTask: expect.objectContaining({
          taskId: 'telegram-task-continuity-1',
          summary: expect.stringContaining('Retomando deploy final'),
        }),
        latestWebTask: expect.objectContaining({
          taskId: 'web-task-continuity-1',
        }),
        workspaceContext: expect.objectContaining({
          titleHint: 'Deploy final',
          followupPrompt: expect.stringContaining('Retome a conversa que veio do Telegram sobre Deploy final.'),
          workflowRecommendation: expect.objectContaining({
            workflow: 'ship',
            label: 'Workflow de entrega',
          }),
        }),
        suggestedAction: expect.objectContaining({
          kind: 'resume-active',
          prompt: expect.stringContaining('Retome a conversa que veio do Telegram sobre Deploy final.'),
        }),
      }),
    );
    expect(statePayload.snapshot.workflowRuns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflow_run_id: persistedRun.workflow_run_id,
          workflow_name: 'ship',
          status: 'approval_pending',
          externalized_state: expect.objectContaining({
            checkpoint_count: 4,
            last_event: 'stage_interrupted',
            latest_chain_hash: expect.any(String),
            recent_checkpoints: expect.arrayContaining([
              expect.objectContaining({
                event: 'stage_interrupted',
              }),
            ]),
          }),
          resume_stage: expect.objectContaining({
            id: 'reviewer',
            label: 'ExternalExecutor Reviewer',
            status: 'approval_pending',
          }),
        }),
      ]),
    );
  });

});
