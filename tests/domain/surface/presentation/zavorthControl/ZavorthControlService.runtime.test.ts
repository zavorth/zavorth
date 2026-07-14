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

  it('serves the authenticated web app and routes a web chat message through the orchestrator', async () => {
    config.zavorthWebAuthToken = 'test-web-token';
    jest
      .spyOn(RuntimeInstallJourneyService.prototype, 'run')
      .mockResolvedValue({
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        dryRun: true,
        bootstrapRepair: {
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          dryRun: true,
          initial: {
            checkedAt: new Date().toISOString(),
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
              accessReadiness: {
                generatedAt: new Date().toISOString(),
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
              },
            },
            actions: [],
            summary: 'Bootstrap ok.',
          },
          steps: [],
          final: {
            checkedAt: new Date().toISOString(),
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
              accessReadiness: {
                generatedAt: new Date().toISOString(),
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
              },
            },
            actions: [],
            summary: 'Bootstrap ok.',
          },
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
      } as any);
    jest
      .spyOn(RuntimeOfficialRemoteAccessService.prototype, 'inspect')
      .mockResolvedValue({
        generatedAt: new Date().toISOString(),
        summary: 'Acesso remoto oficial pronto.',
        official: {
          generatedAt: new Date().toISOString(),
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
          lastActionAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
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
      } as any);
    jest
      .spyOn(RuntimeRemoteAccessService.prototype, 'inspect')
      .mockResolvedValue({
        generatedAt: new Date().toISOString(),
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
      } as any);
    const skills = [
      {
        name: 'debugging',
        description: 'Investiga bugs e falhas.',
        dirPath: 'C:/skills/debugging',
        skillFilePath: 'C:/skills/debugging/SKILL.md',
        supportFilePaths: [],
      },
    ];

    const tasks: any[] = [];
    const service = new ZavorthControlService(logRepo, {
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 8,
            builtin: 8,
            plugin: 0,
            commands: 4,
            implicitRoutes: 2,
            categories: 3,
            readyPlatforms: 1,
            installedIntegrations: 1,
            readyIntegrations: 1,
          },
          categories: [],
          featuredCommands: [
            {
              id: 'executor-external-executor',
              label: 'ExternalExecutor',
              description: 'Executa tarefas de codigo.',
              command: '/external_executor',
              usage: '<pedido>',
              section: 'execution',
              executorPreference: 'external_executor',
              source: 'builtin',
            },
          ],
          featuredImplicitRoutes: [],
          platforms: {
            entries: [],
            summary: {
              ready: 1,
              partial: 0,
              planned: 2,
              disabled: 0,
            },
          },
          integrations: {
            total: 2,
            ready: 1,
            needsConfiguration: 1,
            templates: 0,
            installed: 1,
            featured: [],
          },
          providers: {
            total: 4,
            ready: 1,
            needsConfiguration: 2,
            needsProbe: 1,
            activeProviderName: 'gemini',
            activeModelName: 'gemini-2.5-flash',
            recommendedProfile: 'coding',
            featured: [
              {
                id: 'gemini',
                label: 'Gemini',
                readiness: 'ready',
                currentModel: 'gemini-2.5-flash',
                mode: 'cloud',
              },
            ],
            recommendations: ['Use o perfil coding para requests de implementacao e review.'],
          },
          narrative: {
            headline: 'Zavorth expõe 8 capacidades carregadas no core.',
            operatorSummary: '4 comandos diretos e 2 rotas automaticas.',
          },
        })),
      } as any,
      operatorBriefService: {
        readSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          posture: 'watch',
          headline: 'Briefing do operador no app web.',
          highlights: ['2/2 sidecars prontos.'],
          maintenanceAutomation: {
            enabled: true,
            lastTriggerSource: 'priority',
            lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke vencido.',
            nextPlannedAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            label: 'Automacao prioritaria',
            summary: 'Automacao recorrente ativa; proxima janela em 45 min. Ultimo autodisparo prioritario: Prioridade operacional: renovar o Node Mesh smoke vencido.',
          },
          channelProviderDoctor: {
            status: 'passed',
            stale: false,
            checkedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            label: 'Doctor validado',
            summary: 'Doctor dos canais nativos validou Slack native e WhatsApp Cloud API.',
            command: 'npm run test:channels:smoke',
          },
          remoteTransportDoctor: {
            status: 'passed',
            stale: false,
            checkedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
            label: 'Doctor validado',
            summary: 'Doctor dos transportes remotos validou sidecars, gateways e nodes pareados.',
            command: 'npm run test:transports:smoke',
          },
          nextAction: {
            label: 'Rodar doctor',
            command: 'npm run zavorthBridge:remote:doctor',
            reason: 'Existe warning recente.',
            actionId: 'zavorth-bridge-remote-doctor',
            manualOnly: false,
          },
          zavorthBridge: {
            available: true,
            latestIncident: 'remote_mode_inactive',
            latestSeverity: 'warning',
            flappingLikely: false,
            repairedRuns: 1,
            totalRuns: 2,
          },
          text: 'Briefing do operador',
        })),
      } as any,
      productObservabilityService: {
        buildSnapshot: jest.fn().mockResolvedValue({
          generatedAt: new Date().toISOString(),
          windowHours: 168,
          totals: {
            tasks: 3,
            completed: 2,
            failed: 0,
            waitingApproval: 1,
            workflowRuns: 1,
            resumableWorkflowRuns: 1,
            artifacts: 2,
            approvals: 1,
          },
          routes: {
            strategies: [
              { label: 'workflow_memory', count: 2, last_seen_at: new Date().toISOString() },
            ],
            taskKinds: [
              { label: 'research', count: 2, last_seen_at: new Date().toISOString() },
            ],
            taskSubtypes: [
              { kind: 'research', label: 'competitive_analysis', count: 2, last_seen_at: new Date().toISOString() },
            ],
          },
          workflows: {
            active: 0,
            resumable: 1,
            completed: 0,
            failed: 0,
            recent: [
              {
                workflow_run_id: 'wf-web-1',
                workflow: 'ship',
                status: 'approval_pending',
                completed_stages: 1,
                total_stages: 2,
                resume_stage_label: 'ExternalExecutor review',
                primary_artifact_name: 'briefing-final.md',
                updated_at: new Date().toISOString(),
              },
            ],
          },
          executors: {
            top: [
              {
                executor: 'codex',
                total: 2,
                completed: 2,
                failed: 0,
                waiting_approval: 0,
                approval_friction: 0,
                success_rate: 1,
                last_seen_at: new Date().toISOString(),
              },
            ],
            friction: [
              {
                executor: 'external_executor',
                pending: 1,
                rejected: 0,
                high_risk: 0,
                permissions: 1,
                last_seen_at: new Date().toISOString(),
              },
            ],
          },
          approvals: {
            pending: 1,
            approved: 1,
            rejected: 0,
            highRisk: 0,
            permissionPending: 1,
            permissionRejected: 0,
          },
          artifacts: {
            topKinds: [
              { label: 'doc', type: 'markdown', count: 2, last_seen_at: new Date().toISOString() },
            ],
            recent: [
              {
                name: 'briefing-final.md',
                kind: 'doc',
                type: 'markdown',
                task_id: 'web-task-1',
                created_at: new Date().toISOString(),
              },
            ],
          },
          insights: ['Executor mais efetivo recente: codex (2/2 concluido(s)).'],
        }),
      } as any,
      operationsActionService: {
        execute: jest.fn(() => ({
          id: 'zavorth-bridge-remote-doctor',
          label: 'Diagnosticar remoto do ZavorthBridge',
          command: 'npm run zavorthBridge:remote:doctor',
          priority: 'normal',
          startedAt: new Date().toISOString(),
          pid: 1234,
          logFile: 'C:/runtime/actions/test.log',
          status: 'started',
          note: 'Acao iniciada em background.',
        })),
      } as any,
    });
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
        parse: jest.fn((text: string) => ({
          command_type: '/task',
          command_args: text,
          normalized_message: text.toLowerCase(),
          explicit_executor: null,
          references_last_task: false,
        })),
      } as any,
      taskOrchestrationController: {
        handleTaskMessage: jest.fn(async (ctx: any, input: any) => {
          const task = {
            task_id: 'web-task-1',
            source: 'web',
            raw_message: input.text,
            command_type: '/task',
            status: 'completed',
            risk_level: 0,
            requires_approval: false,
            approval_status: 'not_required',
            executor_used: 'local',
            workspace: 'core',
            result_summary: 'Resposta final web.',
            error_summary: null,
            updated_at: new Date().toISOString(),
            metadata: {
              workspace_operational_memory_summary: 'Entrega em andamento com briefing final pendente.',
              workspace_response_style: 'implementation_ready',
              workspace_workflow_recommendation: {
                workflow: 'ship',
                reason: 'Ja existe contexto suficiente para fechar a entrega.',
              },
              workspace_operational_memory: {
                active_focuses: [
                  {
                    task_id: 'web-task-1',
                    summary: 'Briefing final em andamento',
                  },
                ],
                recent_artifacts: [
                  {
                    task_id: 'web-task-1',
                    name: 'briefing-final.md',
                    kind: 'report',
                    path: 'C:/repo/output/briefing-final.md',
                  },
                ],
                continuity_recommendations: [
                  {
                    label: 'Retomar briefing final',
                    reason: 'Falta apenas consolidar a entrega final.',
                  },
                ],
              },
            },
            target_files: ['C:/repo/src/index.ts'],
            artifacts: [
              {
                id: 'artifact-123',
                key: 'build-log',
                type: 'document',
                kind: 'report',
                name: 'build.log',
                source: 'local',
                path: 'C:/repo/output/build.log',
                url: null,
                mimeType: 'text/plain',
                summary: 'Log principal do build.',
                description: null,
                previewText: null,
                sizeBytes: 2048,
                exists: true,
                deliveryChannel: 'document',
                createdAt: new Date().toISOString(),
              },
            ],
          };
          tasks.splice(0, tasks.length, task);
          await ctx.reply('ACK WEB');
          return task;
        }),
      } as any,
      permissionController: {
        resolvePermissionReference: jest.fn(),
        shortPermissionId: jest.fn(),
        handlePermissionCallback: jest.fn(),
        formatPermissionCreatedMessage: jest.fn(() => 'Permissao pendente'),
      } as any,
      webUserId: '1',
    });
    jest.spyOn(require('../../../../../src/skills/SkillLoader').SkillLoader.prototype, 'loadAll').mockReturnValue(skills as any);

    await service.start();
    const baseUrl = service.getUrl();
    const token = 'test-web-token';
    const appResponse = await fetchNoKeepAlive(`${baseUrl}/zavorthControl`);
    const appHtml = await appResponse.text();
    const authResponse = await fetchNoKeepAlive(`${baseUrl}/api/auth/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const { status: sessionStatus, payload: sessionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/session',
      { token },
    );
    const { status: continuityStatus, payload: continuityPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/session/continuity?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { status: briefStatus, payload: briefPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/operations/brief',
      { token },
    );
    const { status: capabilitiesStatus, payload: capabilitiesPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/capabilities',
      { token },
    );
    const { status: observabilityStatus, payload: observabilityPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/operations/product-observability',
      { token },
    );
    const { status: accessManifestStatus, payload: accessManifestPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/access-manifest',
      { token },
    );
    const { status: installJourneyStatus, payload: installJourneyPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/install-journey',
      { token },
    );
    const { status: remoteAccessStatus, payload: remoteAccessPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/remote-access',
      { token },
    );
    const { status: officialRemoteAccessStatus, payload: officialRemoteAccessPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/host/official-remote-access',
      { token },
    );
    const { status: surfaceConsistencyStatus, payload: surfaceConsistencyPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/host/surface-consistency?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    const { status: actionStatus, payload: actionPayload } = await fetchZavorthControlJson(
      baseUrl,
      '/api/web/operations/actions',
      {
        token,
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actionId: 'zavorth-bridge-remote-doctor' }),
        },
      },
    );
    const { status: sendStatus, payload: sendPayload } = await fetchZavorthControlJson(
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
            message: 'teste web',
            mentions: [
              {
                id: '/task',
                type: 'command',
                label: '/task',
                trigger: '/',
                payload: { command: '/task' },
              },
            ],
          }),
        },
      },
    );
    const { status: catalogStatus, payload: catalogPayload } = await fetchZavorthControlJson(
      baseUrl,
      `/api/web/catalog?sessionId=${encodeURIComponent(sessionPayload.sessionId)}`,
      { token },
    );
    await service.stopAsync();

    expect(appResponse.status).toBe(200);
    expect(appHtml).toContain('Zavorth Home');
    expect(appHtml).toContain('Ask Zavorth');
    expect(appHtml).toContain('Choose what Zavorth can use');
    expect(appHtml).toContain('assets/zavorth-icon.svg');
    expect(authResponse.status).toBe(200);
    expect(sessionStatus).toBe(200);
    expect(continuityStatus).toBe(200);
    expect(briefStatus).toBe(200);
    expect(capabilitiesStatus).toBe(200);
    expect(observabilityStatus).toBe(200);
    expect(accessManifestStatus).toBe(200);
    expect(installJourneyStatus).toBe(200);
    expect(remoteAccessStatus).toBe(200);
    expect(officialRemoteAccessStatus).toBe(200);
    expect(surfaceConsistencyStatus).toBe(200);
    expect(actionStatus).toBe(202);
    expect(catalogStatus).toBe(200);
    expect(sendStatus).toBe(200);
    expect(briefPayload.brief).toEqual(
      expect.objectContaining({
        headline: 'Briefing do operador no app web.',
        maintenanceAutomation: expect.objectContaining({
          label: 'Automacao prioritaria',
          lastTriggerSource: 'priority',
        }),
        channelProviderDoctor: expect.objectContaining({
          label: 'Doctor validado',
          command: 'npm run test:channels:smoke',
        }),
        remoteTransportDoctor: expect.objectContaining({
          label: 'Doctor validado',
          command: 'npm run test:transports:smoke',
        }),
        nextAction: expect.objectContaining({
          actionId: 'zavorth-bridge-remote-doctor',
        }),
      }),
    );
    expect(capabilitiesPayload).toEqual(
      expect.objectContaining({
        ok: true,
        capabilities: expect.objectContaining({
          summary: expect.objectContaining({
            total: 8,
            readyPlatforms: 1,
          }),
          providers: expect.objectContaining({
            activeProviderName: 'gemini',
            activeModelName: 'gemini-2.5-flash',
            recommendedProfile: 'coding',
            ready: 1,
            needsConfiguration: 2,
            needsProbe: 1,
          }),
          featuredCommands: expect.arrayContaining([
            expect.objectContaining({
              command: '/external_executor',
            }),
          ]),
        }),
      }),
    );
    expect(observabilityPayload).toEqual(
      expect.objectContaining({
        ok: true,
        observability: expect.objectContaining({
          totals: expect.objectContaining({
            tasks: 3,
            workflowRuns: 1,
          }),
          executors: expect.objectContaining({
            top: expect.arrayContaining([
              expect.objectContaining({
                executor: 'codex',
              }),
            ]),
          }),
        }),
      }),
    );
    expect(accessManifestPayload).toEqual(
      expect.objectContaining({
        ok: true,
        manifest: expect.objectContaining({
          summary: expect.any(String),
          local: expect.objectContaining({
            appUrl: expect.stringContaining('/zavorthControl'),
          }),
          commands: expect.objectContaining({
            install: expect.stringContaining('npm run ops:install'),
            bootstrap: 'npm run ops:bootstrap -- --repair',
            start: 'npm run ops:start',
            remote: 'npm run ops:remote:official',
          }),
          journey: expect.arrayContaining([
            expect.objectContaining({
              id: 'install',
            }),
          ]),
          surfaces: expect.arrayContaining([
            expect.objectContaining({
              id: 'control',
              label: 'ZavorthControl',
            }),
            expect.objectContaining({
              id: 'telegram',
              label: 'Telegram',
            }),
          ]),
        }),
      }),
    );
    expect(installJourneyPayload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: expect.any(String),
          phases: expect.arrayContaining([
            expect.objectContaining({
              id: 'bootstrap',
            }),
          ]),
        }),
      }),
    );
    expect(remoteAccessPayload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          summary: expect.any(String),
          recommendedPathId: expect.any(String),
          recommendedPathReason: expect.any(String),
          paths: expect.any(Array),
          nextSteps: expect.any(Array),
        }),
      }),
    );
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
    expect(surfaceConsistencyPayload).toEqual(
      expect.objectContaining({
        ok: true,
        consistency: expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              actionType: expect.stringMatching(/^(open-official-app|continue-official-access)$/),
            }),
          ]),
          commands: expect.arrayContaining([
            expect.objectContaining({
              commandType: '/task',
            }),
          ]),
        }),
      }),
    );
    expect(sessionPayload.continuity).toEqual(
      expect.objectContaining({
        sessionId: sessionPayload.sessionId,
        chatId: `web:${sessionPayload.sessionId}`,
        suggestedAction: expect.objectContaining({
          kind: expect.any(String),
        }),
      }),
    );
    expect(continuityPayload.continuity).toEqual(
      expect.objectContaining({
        sessionId: sessionPayload.sessionId,
        userId: '1',
        suggestedAction: expect.objectContaining({
          kind: expect.any(String),
        }),
      }),
    );
    expect(actionPayload).toEqual(
      expect.objectContaining({
        ok: true,
        accepted: true,
        action: expect.objectContaining({
          id: 'zavorth-bridge-remote-doctor',
        }),
      }),
    );
    expect(catalogPayload.catalog.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '/task', type: 'command' }),
      ]),
    );
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
    expect(sendPayload.snapshot.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'teste web',
          mentions: expect.arrayContaining([
            expect.objectContaining({ id: '/task', type: 'command' }),
          ]),
        }),
        expect.objectContaining({ role: 'assistant', content: 'ACK WEB' }),
      ]),
    );
    expect(sendPayload.snapshot.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ task_id: 'web-task-1', status: 'completed' }),
      ]),
    );
    expect(sendPayload.snapshot.continuity).toEqual(
      expect.objectContaining({
        latestWebTask: expect.objectContaining({
          taskId: 'web-task-1',
        }),
        workspaceContext: expect.objectContaining({
          titleHint: 'Briefing final',
        }),
        suggestedAction: expect.objectContaining({
          prompt: expect.stringContaining('workflow de entrega'),
        }),
      }),
    );
  }, 180000);

});
