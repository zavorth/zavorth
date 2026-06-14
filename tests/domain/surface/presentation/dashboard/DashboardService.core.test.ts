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

import { Database } from '../../../../../src/storage/Database.js';

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
        dashboardUrl: 'http://127.0.0.1:33333/dashboard',
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
  const originalDbPath = config.dbPath;
  const tempDirs: string[] = [];

  beforeEach(async () => {
    // Close any global Database singleton instance so we can switch paths
    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-test-')));
    tempDirs.push(tempDir);
    config.dbPath = path.join(tempDir, 'zavorth-test.db');

    jest.spyOn(SkillLoader.prototype, 'loadAll').mockReturnValue([] as any);
    jest.spyOn(RuntimeInstallJourneyService.prototype, 'run').mockResolvedValue(createInstallJourneyFixture());
    jest.spyOn(RuntimeOfficialRemoteAccessService.prototype, 'inspect').mockResolvedValue(createOfficialRemoteAccessFixture());
    jest.spyOn(RuntimeRemoteAccessService.prototype, 'inspect').mockResolvedValue(createRemoteAccessFixture());
  });

  afterEach(async () => {
    // Close the temp database before directory cleanup
    const dbInstance = (Database as any).instance;
    if (dbInstance) {
      dbInstance.close();
    }

    config.dbPath = originalDbPath;
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

  it('redirects the root to the web app, retires /classic, and serves stats and healthcheck', async () => {
    const continuityTasks = [
      {
        task_id: 'telegram-task-1',
        source: 'telegram',
        command_type: '/task',
        status: 'completed',
        workspace: 'core',
        result_summary: 'Resumo vindo do Telegram.',
        error_summary: null,
        raw_message: '/task revisar deploy',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
          metadata: {
            execution_lifecycle: [
              {
                kind: 'approval',
                id: 'approval-dashboard-1',
                traceId: 'trace-dashboard-1',
                runId: 'run-dashboard-1',
                sessionId: 'classic-dashboard',
                approvalId: 'approval-dashboard-1',
                artifactId: null,
                status: 'approval_required',
                summary: 'Aguardando confirmacao no dashboard.',
                source: 'test',
                surface: 'telegram',
                parentId: 'telegram-task-1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                metadata: {},
              },
            ],
            telegram_surface_summary: {
              titleHint: 'Deploy final',
            summary: 'Retomando deploy final com foco em revisar os ultimos ajustes.',
            followupPrompt: 'Retome a conversa que veio do Telegram sobre Deploy final. Revise os ultimos ajustes e siga para o proximo passo util.',
            workflowLabel: 'Workflow de entrega',
            recentArtifact: 'Deploy final',
            activeFocus: 'Deploy final em andamento',
            isContinuationRequest: true,
          },
        },
      },
      {
        task_id: 'web-task-2',
        source: 'web',
        command_type: '/task',
        status: 'running',
        workspace: 'core',
        result_summary: 'Task ativa na web.',
        error_summary: null,
        raw_message: '/task acompanhar runtime',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];
    const service = new DashboardService(logRepo, {
      executionGateway: {
        listActions: jest.fn(() => [
          {
            actionId: 'host-action-dashboard-1',
            metadata: {
              execution_lifecycle: [
                {
                  kind: 'execution',
                  id: 'host-action-dashboard-1',
                  traceId: 'trace-host-dashboard-1',
                  runId: 'host-run-dashboard-1',
                  sessionId: 'classic-dashboard',
                  approvalId: null,
                  artifactId: null,
                  status: 'completed',
                  summary: 'Host action completed in dashboard.',
                  source: 'supervised-execution-gateway',
                  surface: 'web',
                  parentId: 'host-action-dashboard-1',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  metadata: {},
                },
              ],
            },
          },
        ]),
      },
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 12,
            builtin: 12,
            plugin: 0,
            commands: 6,
            implicitRoutes: 3,
            categories: 4,
            readyPlatforms: 1,
            installedIntegrations: 2,
            readyIntegrations: 1,
          },
          categories: [
            {
              type: 'executor',
              label: 'Executores',
              total: 4,
              commands: 2,
              implicitRoutes: 1,
              builtin: 4,
              plugin: 0,
              featured: [],
            },
          ],
          featuredCommands: [
            {
              id: 'executor-codex',
              label: 'Codex CLI',
              description: 'Executa tarefas locais.',
              command: '/codex',
              usage: '<pedido>',
              section: 'execution',
              executorPreference: 'codex',
              source: 'builtin',
            },
          ],
          featuredImplicitRoutes: [
            {
              id: 'route-external-executor-auto',
              label: 'Investigacao ampla',
              description: 'Rota automatica.',
              routingReason: 'Pedido amplo de investigacao.',
              executorPreference: 'external_executor',
              confidence: 0.82,
            },
          ],
          platforms: {
            entries: [],
            summary: {
              ready: 1,
              partial: 1,
              planned: 1,
              disabled: 0,
            },
          },
          integrations: {
            total: 4,
            ready: 1,
            needsConfiguration: 2,
            templates: 1,
            installed: 2,
            featured: [],
          },
          narrative: {
            headline: 'Zavorth expõe 12 capacidades carregadas no core.',
            operatorSummary: '6 comandos diretos e 3 rotas automaticas.',
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
              id: 'local-supervised',
              label: 'Local supervisionado',
              family: 'local',
              readiness: 'ready',
              available: true,
              operatorSummary: 'Reload supervisionado pronto.',
              recommendedFor: 'Iteracao local.',
              actionHint: '/selfupdate',
              details: ['Reload supervisionado e build local.'],
            },
            {
              id: 'docker-hardened',
              label: 'Container endurecido',
              family: 'container',
              readiness: 'ready',
              available: true,
              operatorSummary: 'Docker forte pronto.',
              recommendedFor: 'Risco moderado.',
              actionHint: 'npm run sandbox:doctor',
              details: ['gVisor ativo.'],
            },
            {
              id: 'firecracker-microvm',
              label: 'MicroVM Firecracker',
              family: 'microvm',
              readiness: 'partial',
              available: false,
              operatorSummary: 'MicroVM em preparo.',
              recommendedFor: 'Alto risco.',
              actionHint: 'npm run sandbox:firecracker:smoke',
              details: ['Rootfs ainda em preparo.'],
            },
          ],
          narrative: {
            headline: 'Zavorth expõe 5 modos de runtime.',
            operatorSummary: '3 modos prontos e 2 em preparo.',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 2,
            paired: 1,
            pending: 1,
            online: 1,
            offline: 0,
            invokable: 1,
            capabilities: 3,
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
          suggestedActions: [
            {
              label: 'Conectar transporte remoto',
              reason: 'Falta fechar o invoke plane.',
              actionHint: 'Use esta fundacao para ligar node-host.',
            },
          ],
          narrative: {
            headline: 'Node Mesh expoe 2 nodes registrados.',
            operatorSummary: '1 pareado e 1 pendente.',
          },
        })),
      } as any,
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          summary: {
            total: 3,
            active: 1,
            resumable: 1,
            completedRecently: 1,
            executors: ['aistudio', 'codex', 'external_executor'],
          },
          teams: [
            {
              id: 'ship',
              label: 'Ship Team',
              summary: 'Entrega com implementacao e revisao.',
              whenToUse: 'Use para fechar uma entrega.',
              entryCommand: '/workflow ship <objetivo>',
              status: 'resumable',
              members: [
                {
                  role: 'maker',
                  label: 'Codex Maker',
                  executor: 'codex',
                  responsibility: 'Implementa.',
                },
              ],
              runStats: {
                total: 1,
                active: 0,
                resumable: 1,
                completedRecently: 0,
              },
              latestRun: {
                workflowRunId: 'wf-ship-001',
                objective: 'Concluir o deploy',
                status: 'approval_pending',
                updatedAt: new Date().toISOString(),
                resumeStageLabel: 'ExternalExecutor Reviewer',
                resumeAvailable: true,
              },
              operatorSummary: 'Existe retomada pronta para Ship Team.',
            },
          ],
          narrative: {
            headline: 'Zavorth expõe 3 teams compostos.',
            operatorSummary: '3 teams compostos e 1 retomada pronta.',
          },
        })),
      } as any,
      operationsHealthService: {
        readSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          sidecars: {},
          docker: {
            enabled: true,
            required: false,
            available: true,
            canRun: true,
            detail: 'ok',
            languages: {
              javascript: { canRun: true, detail: 'ok', image: 'node:22-bullseye' },
              python: { canRun: true, detail: 'ok', image: 'python:3.12-slim' },
              shell: { canRun: true, detail: 'ok', image: 'bash:5.2' },
            },
          },
          publish: {
            available: true,
            publishedAt: new Date().toISOString(),
            branch: 'codex/initial-publish',
            commit: 'abc123',
            docsUrl: 'https://docs.example.com',
            remoteConsoleUrl: 'https://console.example.com',
            gitPush: 'completed',
            smokeTest: 'passed',
          },
          storage: {
            rootPath: 'C:/workspace/zavorth/data',
            totalBytes: 1000,
            freeBytes: 800,
            usedBytes: 200,
            freePercent: 80,
            hotspots: [],
          },
          security: {
            dashboardAuth: {
              enabled: true,
              source: 'env',
              tokenFile: '/runtime/web-api-token.txt',
              tokenFileExists: true,
              note: 'Protegido por env.',
            },
            mailboxSecret: {
              source: 'runtime-file',
              filePath: '/runtime/mailbox-secret.key',
              fileExists: true,
            },
            dbEncryption: {
              enabled: true,
              source: 'runtime-file',
              filePath: '/runtime/db-field.key',
              fileExists: true,
            },
            hostIdentity: {
              filePath: '/runtime/authorized-host.json',
              exists: true,
            },
            lastAudit: {
              available: true,
              generatedAt: new Date().toISOString(),
              ok: true,
              summary: 'Nenhum problema relevante detectado.',
              trailAvailable: true,
              trailDir: '/runtime/security-audit-trail',
              eventsFile: '/runtime/security-audit-trail/events.ndjson',
              ledgerFile: '/runtime/security-audit-trail/ledger.json',
              totalEvents: 4,
              latestEventId: 'audit-0000004',
              latestEventType: 'PERMISSION_DECISION',
              latestTaskId: 'task-audit-1',
              latestTimestamp: new Date().toISOString(),
              latestChainHash: 'abcdef1234567890',
              recentChain: [
                {
                  eventId: 'audit-0000004',
                  eventType: 'PERMISSION_DECISION',
                  taskId: 'task-audit-1',
                  timestamp: new Date().toISOString(),
                  chainHash: 'abcdef1234567890',
                  previousChainHash: '1234567890abcdef',
                },
              ],
            },
            lastPreflight: {
              available: true,
              generatedAt: new Date().toISOString(),
              ok: true,
              summary: 'Nenhum problema relevante detectado.',
            },
            needsAttention: false,
          },
          errors: {
            lastError: null,
            recent: [],
          },
        })),
      } as any,
      operatorBriefService: {
        readSnapshot: jest.fn(() => ({
          generatedAt: new Date().toISOString(),
          posture: 'watch',
          headline: 'Briefing operacional com atencao leve.',
          highlights: ['2/2 sidecars prontos.'],
          nextAction: {
            label: 'Rodar doctor',
            command: 'npm run zavorthBridge:remote:doctor',
            reason: 'Ultimo incidente foi apenas warning.',
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
            tasks: 2,
            completed: 1,
            failed: 0,
            waitingApproval: 0,
            workflowRuns: 1,
            resumableWorkflowRuns: 1,
            artifacts: 1,
            approvals: 1,
          },
          routes: {
            strategies: [
              { label: 'workflow_memory', count: 1, last_seen_at: new Date().toISOString() },
            ],
            taskKinds: [
              { label: 'research', count: 1, last_seen_at: new Date().toISOString() },
            ],
            taskSubtypes: [
              { kind: 'research', label: 'competitive_analysis', count: 1, last_seen_at: new Date().toISOString() },
            ],
          },
          workflows: {
            active: 0,
            resumable: 1,
            completed: 0,
            failed: 0,
            recent: [
              {
                workflow_run_id: 'wf-ship-001',
                workflow: 'ship',
                status: 'approval_pending',
                completed_stages: 1,
                total_stages: 2,
                resume_stage_label: 'ExternalExecutor Reviewer',
                primary_artifact_name: 'briefing-final.md',
                updated_at: new Date().toISOString(),
              },
            ],
          },
          executors: {
            top: [
              {
                executor: 'codex',
                total: 1,
                completed: 1,
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
            approved: 0,
            rejected: 0,
            highRisk: 0,
            permissionPending: 1,
            permissionRejected: 0,
          },
          artifacts: {
            topKinds: [
              { label: 'doc', type: 'markdown', count: 1, last_seen_at: new Date().toISOString() },
            ],
            recent: [
              {
                name: 'briefing-final.md',
                kind: 'doc',
                type: 'markdown',
                task_id: 'telegram-task-1',
                created_at: new Date().toISOString(),
              },
            ],
          },
          insights: ['Workflow com retomada pronta: ship em ExternalExecutor Reviewer.'],
        }),
      } as any,
      taskManager: {
        getRecentTasks: jest.fn(() => continuityTasks),
        getRecentTasksByChat: jest.fn(() => []),
      } as any,
      webUserId: '1',
    });

    await service.start();
    const baseUrl = service.getUrl();
    const [
      rootResponse,
      classicResponse,
      { payload: stats },
      { payload: operations },
      { payload: brief },
      { payload: overview },
      { payload: trustOverview },
      { payload: productOverview },
      { payload: continuity },
      { payload: replay },
      { payload: lifecycle },
      { payload: handoff },
      { payload: capabilities },
      { payload: runtimeModes },
      { payload: nodes },
      { payload: teams },
      { payload: observability },
      { payload: accessManifest },
      { payload: health },
    ] = await Promise.all([
      fetchNoKeepAlive(`${baseUrl}/`, { redirect: 'manual' }),
      fetchNoKeepAlive(`${baseUrl}/classic`),
      fetchDashboardJson(baseUrl, '/api/stats'),
      fetchDashboardJson(baseUrl, '/api/operations/health'),
      fetchDashboardJson(baseUrl, '/api/operations/brief'),
      fetchDashboardJson(baseUrl, '/api/operations/overview'),
      fetchDashboardJson(baseUrl, '/api/operations/trust-overview'),
      fetchDashboardJson(baseUrl, '/api/operations/product-overview'),
      fetchDashboardJson(baseUrl, '/api/operations/continuity'),
      fetchDashboardJson(baseUrl, '/api/operations/replay'),
      fetchDashboardJson(baseUrl, '/api/operations/lifecycle'),
      fetchDashboardJson(baseUrl, '/api/operations/handoff'),
      fetchDashboardJson(baseUrl, '/api/operations/capabilities'),
      fetchDashboardJson(baseUrl, '/api/operations/runtime-modes'),
      fetchDashboardJson(baseUrl, '/api/operations/nodes'),
      fetchDashboardJson(baseUrl, '/api/operations/teams'),
      fetchDashboardJson(baseUrl, '/api/operations/product-observability'),
      fetchDashboardJson(baseUrl, '/api/operations/access-manifest'),
      fetchDashboardJson(baseUrl, '/healthz'),
    ]);
    const html = await classicResponse.text();
    await service.stopAsync();

    expect(rootResponse.status).toBe(302);
    expect(rootResponse.headers.get('location')).toBe('/dashboard');
    expect(classicResponse.status).toBe(410);
    expect(html).toContain('/dashboard');
    expect(stats).toEqual(
      expect.objectContaining({
        cpuUsage: expect.any(String),
        memoryUsage: expect.stringContaining('MB RSS'),
        heapUsage: expect.stringContaining('MB heap'),
        uptime: expect.any(String),
      }),
    );
    expect(operations).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        security: expect.objectContaining({
          dashboardAuth: expect.any(Object),
          lastAudit: expect.any(Object),
          lastPreflight: expect.any(Object),
        }),
      }),
    );
    expect(brief).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        posture: 'watch',
        nextAction: expect.objectContaining({
          command: 'npm run zavorthBridge:remote:doctor',
          actionId: 'zavorth-bridge-remote-doctor',
        }),
      }),
    );
    expect(overview).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        summary: expect.objectContaining({
          posture: expect.any(String),
          readyChannels: expect.any(Number),
          lifecycleEvents: expect.any(Number),
        }),
        cards: expect.arrayContaining([
          expect.objectContaining({ id: 'distributed-runtime' }),
          expect.objectContaining({ id: 'runtime-stability' }),
          expect.objectContaining({ id: 'replay-learning' }),
        ]),
        actions: expect.arrayContaining([
          expect.objectContaining({ source: 'replay-learning' }),
        ]),
      }),
    );
    expect(trustOverview).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        summary: expect.objectContaining({
          posture: expect.any(String),
          tenants: expect.any(Number),
          pendingApprovals: expect.any(Number),
        }),
        cards: expect.arrayContaining([
          expect.objectContaining({ id: 'governance' }),
          expect.objectContaining({ id: 'trust-plane' }),
          expect.objectContaining({ id: 'tenant-governance' }),
        ]),
      }),
    );
    expect(productOverview).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        summary: expect.objectContaining({
          posture: expect.any(String),
          integrations: expect.any(Number),
          scorecards: expect.any(Number),
        }),
        cards: expect.arrayContaining([
          expect.objectContaining({ id: 'hub' }),
          expect.objectContaining({ id: 'ecosystem' }),
          expect.objectContaining({ id: 'evals' }),
          expect.objectContaining({ id: 'rollout' }),
        ]),
      }),
    );
    expect(continuity).toEqual(
      expect.objectContaining({
        available: true,
        sessionId: 'classic-dashboard',
        chatId: 'dashboard:classic',
        suggestedAction: expect.objectContaining({
          kind: 'resume-active',
          prompt: expect.stringContaining('Deploy final'),
        }),
        latestTelegramTask: expect.objectContaining({
          taskId: 'telegram-task-1',
        }),
        latestWebTask: expect.objectContaining({
          taskId: 'web-task-2',
        }),
      }),
    );
    expect(replay).toEqual(
      expect.objectContaining({
        available: true,
        headline: expect.stringContaining('Replay pronto'),
        recommendedEntry: expect.objectContaining({
          kind: 'task',
        }),
        focusTask: expect.objectContaining({
          taskId: 'web-task-2',
        }),
        timeline: expect.arrayContaining([
          expect.objectContaining({
            kind: 'focus',
          }),
        ]),
      }),
    );
    expect(lifecycle).toEqual(
      expect.objectContaining({
        available: true,
        summary: expect.objectContaining({
          approvals: 1,
          approvalRequired: 1,
        }),
        latest: expect.arrayContaining([
          expect.objectContaining({
            id: 'approval-dashboard-1',
            runId: 'run-dashboard-1',
          }),
          expect.objectContaining({
            id: 'host-action-dashboard-1',
            runId: 'host-run-dashboard-1',
            origin: 'host-action',
          }),
        ]),
      }),
    );
    expect(handoff).toEqual(
      expect.objectContaining({
        available: true,
        status: 'aligned',
        headline: expect.stringContaining('Sessao compartilhada'),
        canonicalTarget: expect.objectContaining({
          kind: 'task',
        }),
        handoffPrompt: expect.stringContaining('Deploy final'),
        checkpoints: expect.objectContaining({
          tasks: expect.any(Number),
        }),
      }),
    );
    expect(capabilities).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        summary: expect.objectContaining({
          total: 12,
          commands: 6,
          readyPlatforms: 1,
        }),
        featuredCommands: expect.arrayContaining([
          expect.objectContaining({
            command: '/codex',
          }),
        ]),
      }),
    );
    expect(runtimeModes).toEqual(
      expect.objectContaining({
        generatedAt: expect.any(String),
        summary: expect.objectContaining({
          total: 5,
          ready: 3,
          partial: 2,
        }),
        entries: expect.arrayContaining([
          expect.objectContaining({
            id: 'docker-hardened',
            readiness: 'ready',
          }),
        ]),
      }),
    );
    expect(nodes).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 2,
          paired: 1,
        }),
        selected: expect.objectContaining({
          id: 'oracle-node',
        }),
      }),
    );
    expect(teams).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 3,
          resumable: 1,
        }),
        teams: expect.arrayContaining([
          expect.objectContaining({
            id: 'ship',
            status: 'resumable',
          }),
        ]),
      }),
    );
    expect(observability).toEqual(
      expect.objectContaining({
        totals: expect.objectContaining({
          tasks: 2,
          workflowRuns: 1,
        }),
        routes: expect.objectContaining({
          strategies: expect.arrayContaining([
            expect.objectContaining({ label: 'workflow_memory' }),
          ]),
        }),
        workflows: expect.objectContaining({
          resumable: 1,
          recent: expect.arrayContaining([
            expect.objectContaining({
              workflow: 'ship',
            }),
          ]),
        }),
      }),
    );
    expect(accessManifest).toEqual(
      expect.objectContaining({
        summary: expect.any(String),
        local: expect.objectContaining({
          appUrl: expect.stringContaining('/dashboard'),
          apiBaseUrl: expect.stringContaining('/api/web'),
        }),
        commands: expect.objectContaining({
          bootstrap: 'npm run ops:bootstrap -- --repair',
          access: 'npm run ops:access',
          trust: '/hostauth trust',
        }),
      }),
    );
    expect(health).toEqual(
      expect.objectContaining({
        ok: true,
        service: 'zavorth-dashboard',
      }),
    );
  });

});
