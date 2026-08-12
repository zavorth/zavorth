import { OperationsReportService } from '../../src/services/OperationsReportService.js';

describe('OperationsReportService', () => {
  it('builds a consolidated snapshot and text report', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-29T12:00:00.000Z',
          headline: 'Runtime estavel.',
          summary: {
            enabledSidecars: 2,
            readySidecars: 2,
            recentErrorCount: 0,
            freeDiskPercent: 78,
            publishAgeLabel: 'agora',
          },
          runtime: {
            uptimeLabel: '3h 0m',
            memoryLabel: '256 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-29T12:00:00.000Z',
          },
          actions: [
            {
              id: 'maintenance',
              label: 'Rodar manutencao operacional',
              command: 'npm run ops:maintain',
              reason: 'Fluxo padrao.',
              priority: 'normal',
            },
          ],
          alerts: [
            {
              level: 'warn',
              source: 'sidecar',
              title: 'Acompanhamento leve',
              detail: 'Sem impacto critico.',
              timestamp: '2026-03-29T11:50:00.000Z',
            },
          ],
          operations: {
            channels: {
              discordBridge: {
                mode: 'native',
                enabled: true,
                started: true,
                pendingInbox: 1,
                pendingOutbox: 2,
                lastError: null,
              },
            },
            channelProviderDoctor: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-29T11:56:30.000Z',
              summary: 'Doctor dos canais nativos validou os providers configurados.',
              command: 'npm run test:channels:smoke',
              file: 'C:/runtime/channel-provider-doctor-last.json',
              stale: false,
              ageMs: 210000,
              maxAgeMs: 43200000,
              recommendedAction: null,
              items: [
                {
                  channelId: 'slack',
                  mode: 'native',
                  status: 'passed',
                  configured: true,
                  summary: 'Slack native validado.',
                  error: null,
                },
                {
                  channelId: 'whatsapp',
                  mode: 'cloud-api',
                  status: 'passed',
                  configured: true,
                  summary: 'WhatsApp Cloud API validada.',
                  error: null,
                },
              ],
            },
            remoteTransportDoctor: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-29T11:56:10.000Z',
              summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
              command: 'npm run test:transports:smoke',
              file: 'C:/runtime/remote-transport-doctor-last.json',
              stale: false,
              ageMs: 300000,
              maxAgeMs: 43200000,
              recommendedAction: null,
              items: [
                {
                  transportId: 'AIGateway',
                  mode: 'remote',
                  status: 'passed',
                  configured: true,
                  summary: 'AIGateway remoto validado.',
                  error: null,
                },
                {
                  transportId: 'node-host',
                  mode: 'local',
                  status: 'passed',
                  configured: true,
                  summary: 'Node host pareado validado.',
                  error: null,
                },
              ],
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-29T11:57:00.000Z',
              summary: 'Smoke real do Node Mesh passou com pairing, heartbeat e invoke completos.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-report-1',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              recommendedAction: null,
            },
            tenants: {
              totalCount: 2,
              sharedCount: 1,
              personalCount: 1,
              pendingOnboardingCount: 1,
              publicServerCount: 1,
              byPlatform: {
                discord: 1,
                telegram: 1,
              },
              recent: [
                {
                  tenantId: 'discord:guild:guild-1',
                  platform: 'discord',
                  policyProfile: 'discord-public-guild',
                  onboardingStatus: 'pending_onboarding',
                  lastSeenAt: '2026-03-29T11:58:00.000Z',
                },
              ],
              pendingOnboarding: [],
              file: 'C:/runtime/tenant-registry.json',
            },
            maintenanceAutomation: {
              enabled: true,
              lastTriggerSource: 'priority',
              lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke vencido.',
              nextPlannedAt: '2026-03-30T04:30:00.000Z',
            },
          },
        })),
      } as any,
      {
        buildSnapshot: jest.fn(() => ({
          tasks: {
            activeCount: 3,
          },
        })),
      } as any,
      {
        getRecentTasks: jest.fn(() => [
          {
            task_id: 'task-1',
            updated_at: '2026-03-29T11:30:00.000Z',
            status: 'completed',
            executor_used: 'codex',
            command_type: '/codex',
          },
          {
            task_id: 'task-2',
            updated_at: '2026-03-29T10:30:00.000Z',
            status: 'failed',
            executor_used: 'external_executor',
            command_type: '/external_executor',
          },
          {
            task_id: 'task-3',
            updated_at: '2026-03-29T09:30:00.000Z',
            status: 'waiting_approval',
            executor_used: 'codex',
            command_type: '/codex',
          },
        ]),
      } as any,
      {
        listRequests: jest.fn().mockResolvedValue([
          {
            executor: 'external_executor',
            kind: 'workspace_access',
            reason: 'Precisa acessar uma pasta protegida.',
          },
        ]),
      } as any,
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-29T12:00:00.000Z',
          posture: 'watch',
          headline: 'Zavorth operavel, mas com atencao em remote_mode_inactive.',
          highlights: ['2/2 sidecars prontos.'],
          nextAction: {
            label: 'Rodar doctor do remoto',
            command: 'npm run zavorthBridge:remote:doctor',
            reason: 'Ultimo incidente foi remote_mode_inactive.',
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
      {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-29T12:00:00.000Z',
          sessionId: 'operations-report',
          chatId: 'report:daily',
          userId: '1',
          currentSurfaceTask: null,
          activeTask: null,
          latestTelegramTask: {
            taskId: 'task-telegram',
            shortId: 'task-tel',
            source: 'telegram',
            commandType: '/task',
            status: 'completed',
            workspace: 'core',
            updatedAt: '2026-03-29T11:45:00.000Z',
            summary: 'Resumo vindo do Telegram.',
          },
          latestWebTask: null,
          focusTask: {
            taskId: 'task-telegram',
            shortId: 'task-tel',
            source: 'telegram',
            commandType: '/task',
            status: 'completed',
            workspace: 'core',
            updatedAt: '2026-03-29T11:45:00.000Z',
            summary: 'Resumo vindo do Telegram.',
          },
          recentTasks: [],
          surfaces: {
            telegram: 2,
            web: 1,
            other: 0,
          },
          suggestedAction: {
            kind: 'review-latest',
            label: 'Revisar task-tel',
            reason: 'A ultima tarefa conhecida veio de telegram.',
          },
        })),
      } as any,
      '1',
      {
        now: () => new Date('2026-03-29T12:00:00.000Z'),
      },
      {
        buildSnapshot: jest.fn().mockResolvedValue({
          generatedAt: '2026-03-29T12:00:00.000Z',
          windowHours: 168,
          totals: {
            tasks: 8,
            completed: 5,
            failed: 1,
            waitingApproval: 2,
            workflowRuns: 2,
            resumableWorkflowRuns: 1,
            artifacts: 3,
            approvals: 2,
          },
          routes: {
            strategies: [{ label: 'workspace_learning', count: 4, last_seen_at: '2026-03-29T11:50:00.000Z' }],
            taskKinds: [{ label: 'research', count: 4, last_seen_at: '2026-03-29T11:50:00.000Z' }],
            taskSubtypes: [{ kind: 'research', label: 'competitive', count: 3, last_seen_at: '2026-03-29T11:50:00.000Z' }],
          },
          workflows: {
            active: 1,
            resumable: 1,
            completed: 1,
            failed: 0,
            recent: [
              {
                workflow_run_id: 'wf-1',
                workflow: 'workflow:ship',
                status: 'approval_pending',
                completed_stages: 1,
                total_stages: 2,
                resume_stage_label: 'Aguardar aprovacao',
                primary_artifact_name: 'briefing-final.md',
                updated_at: '2026-03-29T11:52:00.000Z',
              },
            ],
          },
          executors: {
            top: [
              {
                executor: 'codex',
                total: 4,
                completed: 3,
                failed: 0,
                waiting_approval: 1,
                approval_friction: 0,
                success_rate: 0.75,
                last_seen_at: '2026-03-29T11:55:00.000Z',
              },
            ],
            friction: [],
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
            topKinds: [{ label: 'briefing', type: 'doc', count: 2, last_seen_at: '2026-03-29T11:56:00.000Z' }],
            recent: [],
          },
          insights: [
            'Rota dominante da janela: workspace_learning (4 pedido(s)).',
            'Workflow com retomada pronta: workflow:ship em Aguardar aprovacao.',
          ],
        }),
      } as any,
    );

    const snapshot = await service.buildSnapshot(new Date('2026-03-29T12:00:00.000Z'));
    const text = await service.buildTextReport(new Date('2026-03-29T12:00:00.000Z'));

    expect(snapshot.headline).toBe('Runtime estavel.');
    expect(snapshot.operatorBrief).toEqual(
      expect.objectContaining({
        posture: 'watch',
        nextAction: expect.objectContaining({
          command: 'npm run zavorthBridge:remote:doctor',
        }),
      }),
    );
    expect(snapshot.continuity).toEqual(
      expect.objectContaining({
        suggestedAction: expect.objectContaining({
          kind: 'review-latest',
        }),
        focusTask: expect.objectContaining({
          source: 'telegram',
        }),
      }),
    );
    expect(snapshot.tasks).toEqual(
      expect.objectContaining({
        activeCount: 3,
        completedLast24h: 1,
        failedLast24h: 1,
        waitingApprovalLast24h: 1,
      }),
    );
    expect(snapshot.pendingPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          executor: 'external_executor',
          kind: 'workspace_access',
        }),
      ]),
    );
    expect(snapshot.productObservability).toEqual(
      expect.objectContaining({
        routeHeadline: 'workspace_learning lidera com 4 pedido(s) recentes',
        workflowHeadline: 'workflow:ship approval_pending | retomar em Aguardar aprovacao',
      }),
    );
    expect(snapshot.executiveSummary.join(' ')).toContain('Ultimo autodisparo prioritario');
    expect(snapshot.executiveSummary.join(' ')).toContain('Doctor dos canais nativos validou');
    expect(snapshot.operations.channelProviderDoctorLabel).toContain('validado');
    expect(snapshot.operations.remoteTransportDoctorLabel).toContain('validado');
    expect(snapshot.operations.nodeMeshSmokeLabel).toContain('validado');
    expect(snapshot.operations.automationLabel).toContain('priorizada');
    expect(text).toContain('Relatorio consolidado do Zavorth');
    expect(text).toContain('Briefing do operador:');
    expect(text).toContain('Continuidade entre superficies:');
    expect(text).toContain('A ultima tarefa conhecida veio de telegram.');
    expect(text).toContain('Observabilidade de produto:');
    expect(text).toContain('Rotas: workspace_learning lidera com 4 pedido(s) recentes');
    expect(text).toContain('Insights de produto:');
    expect(text).toContain('Gateway nativo do Discord ativo; 2 envios recentes registrados.');
    expect(text).toContain('Canais nativos: validado');
    expect(text).toContain('Transportes remotos: validado');
    expect(text).toContain('Slack native');
    expect(text).toContain('WhatsApp Cloud API');
    expect(text).toContain('Node Mesh validado por smoke real');
    expect(text).toContain('Canais: discord pronto');
    expect(text).toContain('Tenants: 2 observados | onboarding pendente 1');
    expect(text).toContain('Node Mesh: validado');
    expect(text).toContain('Prioridade operacional: renovar o Node Mesh smoke vencido.');
    expect(text).toContain('Publicos: 1 | onboarding pendente 1');
    expect(text).toContain('npm run zavorthBridge:remote:doctor');
    expect(text).toContain('Permissoes pendentes:');
    expect(text).toContain('Proximas acoes recomendadas:');
  });

  it('surfaces stale Node Mesh validation in the executive report', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operavel com pontos de acompanhamento.',
          summary: {
            enabledSidecars: 1,
            readySidecars: 1,
            recentErrorCount: 0,
            freeDiskPercent: 70,
            publishAgeLabel: 'ha 1 h',
          },
          runtime: {
            uptimeLabel: '1h 30m',
            memoryLabel: '256 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-30T12:00:00.000Z',
          },
          actions: [
            {
              id: 'validate-node-mesh-smoke',
              label: 'Validar Node Mesh',
              command: 'npm run test:nodes:smoke',
              reason: 'O ultimo smoke real ficou velho e precisa ser renovado.',
              priority: 'normal',
            },
          ],
          alerts: [],
          operations: {
            channels: {
              discordBridge: {
                mode: 'native',
                enabled: true,
                started: true,
                pendingInbox: 0,
                pendingOutbox: 1,
                lastError: null,
              },
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-28T12:00:00.000Z',
              summary: 'Smoke real antigo, mas concluido com sucesso.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-report-stale',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              stale: true,
              recommendedAction: 'npm run test:nodes:smoke',
            },
            tenants: {
              totalCount: 1,
              sharedCount: 0,
              personalCount: 1,
              pendingOnboardingCount: 0,
              publicServerCount: 0,
              byPlatform: {
                telegram: 1,
              },
              recent: [],
              pendingOnboarding: [],
              file: 'C:/runtime/tenant-registry.json',
            },
            maintenanceAutomation: {
              enabled: true,
              nextPlannedAt: '2026-03-31T04:30:00.000Z',
            },
          },
        })),
      } as any,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        now: () => new Date('2026-03-30T12:00:00.000Z'),
      },
      null,
    );

    const snapshot = await service.buildSnapshot(new Date('2026-03-30T12:00:00.000Z'));

    expect(snapshot.operations.nodeMeshSmokeLabel).toContain('vencido');
    expect(snapshot.executiveSummary.join(' ')).toContain('smoke real vencido');
    expect(snapshot.text).toContain('Node Mesh: vencido');
    expect(snapshot.text).toContain('npm run test:nodes:smoke');
  });

  it('includes Slack and WhatsApp in the channel narrative when local adapters are enabled', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operavel com canais locais em rollout.',
          summary: {
            enabledSidecars: 1,
            readySidecars: 1,
            recentErrorCount: 0,
            freeDiskPercent: 70,
            publishAgeLabel: 'ha 1 h',
          },
          runtime: {
            uptimeLabel: '1h 30m',
            memoryLabel: '256 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-30T12:00:00.000Z',
          },
          actions: [],
          alerts: [],
          operations: {
            channels: {
              discordBridge: {
                mode: 'unknown',
                enabled: false,
                started: false,
                pendingInbox: 0,
                pendingOutbox: 0,
                lastError: null,
              },
              whatsapp: {
                mode: 'stub',
                enabled: true,
                started: true,
                recipientsConfigured: 2,
                allowedChatIds: ['5511999999999', '5511888888888'],
                sessionDir: 'C:/runtime/whatsapp-session',
                sessionDirConfigured: true,
                lastInboundAt: null,
                lastOutboundAt: null,
                lastError: null,
                updatedAt: '2026-03-30T11:58:00.000Z',
              },
              slack: {
                mode: 'stub',
                enabled: true,
                started: false,
                recipientsConfigured: 0,
                allowedChannelIds: [],
                workspaceId: 'T-ops',
                workspaceConfigured: true,
                lastInboundAt: null,
                lastOutboundAt: null,
                lastError: null,
                updatedAt: '2026-03-30T11:58:30.000Z',
              },
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-30T11:55:00.000Z',
              summary: 'Smoke real do Node Mesh passou.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-report-local-channels',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              stale: false,
              recommendedAction: null,
            },
            tenants: {
              totalCount: 0,
              sharedCount: 0,
              personalCount: 0,
              pendingOnboardingCount: 0,
              publicServerCount: 0,
              byPlatform: {},
              recent: [],
              pendingOnboarding: [],
              file: 'C:/runtime/tenant-registry.json',
            },
            maintenanceAutomation: {
              enabled: true,
              nextPlannedAt: '2026-03-31T04:30:00.000Z',
            },
          },
        })),
      } as any,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        now: () => new Date('2026-03-30T12:00:00.000Z'),
      },
      null,
    );

    const snapshot = await service.buildSnapshot(new Date('2026-03-30T12:00:00.000Z'));

    expect(snapshot.executiveSummary.join(' ')).toContain('WhatsApp ativo em modo local supervisionado');
    expect(snapshot.executiveSummary.join(' ')).toContain('Slack habilitado, mas ainda nao entrou em estado pronto.');
    expect(snapshot.operations.channelsLabel).toContain('whatsapp pronto | local supervisionado | chats 2');
    expect(snapshot.operations.channelsLabel).toContain('slack pendente');
    expect(snapshot.text).toContain('WhatsApp ativo em modo local supervisionado; 2 chat(s) permitidos.');
    expect(snapshot.text).toContain('Slack habilitado, mas ainda nao entrou em estado pronto.');
  });

  it('describes native Slack and WhatsApp providers honestly in the channel narrative', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'healthy',
          headline: 'Runtime operavel com canais nativos validados.',
          summary: {
            enabledSidecars: 1,
            readySidecars: 1,
            recentErrorCount: 0,
            freeDiskPercent: 76,
            publishAgeLabel: 'ha 20 min',
          },
          runtime: {
            uptimeLabel: '4h 0m',
            memoryLabel: '256 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-30T12:00:00.000Z',
          },
          actions: [],
          alerts: [],
          operations: {
            channels: {
              discordBridge: {
                mode: 'unknown',
                enabled: false,
                started: false,
                pendingInbox: 0,
                pendingOutbox: 0,
                lastError: null,
              },
              whatsapp: {
                mode: 'cloud-api',
                enabled: true,
                started: true,
                recipientsConfigured: 1,
                allowedChatIds: ['5511999999999'],
                provider: 'cloud-api',
                providerConfigured: true,
                providerDecision: 'cloud-api',
                sessionDir: null,
                sessionDirConfigured: false,
                phoneNumberId: '1234567890',
                webhookConfigured: true,
                lastInboundAt: '2026-03-30T11:55:00.000Z',
                lastOutboundAt: '2026-03-30T11:56:00.000Z',
                lastError: null,
                updatedAt: '2026-03-30T11:58:00.000Z',
              },
              slack: {
                mode: 'native',
                enabled: true,
                started: true,
                recipientsConfigured: 2,
                allowedChannelIds: ['C-ops', 'C-alerts'],
                transport: 'native',
                nativeConfigured: true,
                apiBaseUrl: 'https://slack.test/api',
                workspaceId: 'T-ops',
                workspaceConfigured: true,
                lastInboundAt: '2026-03-30T11:54:00.000Z',
                lastOutboundAt: '2026-03-30T11:56:30.000Z',
                lastError: null,
                updatedAt: '2026-03-30T11:58:30.000Z',
              },
            },
            channelProviderDoctor: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-30T11:57:00.000Z',
              summary: 'Doctor dos canais nativos validou os providers configurados.',
              command: 'npm run test:channels:smoke',
              file: 'C:/runtime/channel-provider-doctor-last.json',
              stale: false,
              ageMs: 180000,
              maxAgeMs: 43200000,
              recommendedAction: null,
              items: [
                {
                  channelId: 'slack',
                  mode: 'native',
                  status: 'passed',
                  configured: true,
                  summary: 'Slack native validado.',
                  error: null,
                },
                {
                  channelId: 'whatsapp',
                  mode: 'cloud-api',
                  status: 'passed',
                  configured: true,
                  summary: 'WhatsApp Cloud API validada.',
                  error: null,
                },
              ],
            },
            remoteTransportDoctor: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-30T11:57:30.000Z',
              summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
              command: 'npm run test:transports:smoke',
              file: 'C:/runtime/remote-transport-doctor-last.json',
              stale: false,
              ageMs: 150000,
              maxAgeMs: 43200000,
              recommendedAction: null,
              items: [
                {
                  transportId: 'AIGateway',
                  mode: 'remote',
                  status: 'passed',
                  configured: true,
                  summary: 'AIGateway remoto validado.',
                  error: null,
                },
                {
                  transportId: 'node-host',
                  mode: 'local',
                  status: 'passed',
                  configured: true,
                  summary: 'Node host pareado validado.',
                  error: null,
                },
              ],
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-30T11:55:00.000Z',
              summary: 'Smoke real do Node Mesh passou.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-report-native-channels',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              stale: false,
              recommendedAction: null,
            },
            tenants: {
              totalCount: 0,
              sharedCount: 0,
              personalCount: 0,
              pendingOnboardingCount: 0,
              publicServerCount: 0,
              byPlatform: {},
              recent: [],
              pendingOnboarding: [],
              file: 'C:/runtime/tenant-registry.json',
            },
            maintenanceAutomation: {
              enabled: true,
              nextPlannedAt: '2026-03-31T04:30:00.000Z',
            },
          },
        })),
      } as any,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        now: () => new Date('2026-03-30T12:00:00.000Z'),
      },
      null,
    );

    const snapshot = await service.buildSnapshot(new Date('2026-03-30T12:00:00.000Z'));

    expect(snapshot.executiveSummary.join(' ')).toContain('WhatsApp Cloud API ativo');
    expect(snapshot.executiveSummary.join(' ')).toContain('Slack nativo ativo');
    expect(snapshot.executiveSummary.join(' ')).toContain('Doctor dos canais nativos validou');
    expect(snapshot.operations.channelsLabel).toContain('whatsapp pronto | Cloud API | chats 1');
    expect(snapshot.operations.channelsLabel).toContain('slack pronto | nativo | canais 2');
    expect(snapshot.operations.channelProviderDoctorLabel).toContain('validado');
    expect(snapshot.operations.remoteTransportDoctorLabel).toContain('validado');
    expect(snapshot.text).toContain('WhatsApp Cloud API ativo; 1 chat(s) permitidos.');
    expect(snapshot.text).toContain('Slack nativo ativo; 2 canal(is) permitidos.');
    expect(snapshot.text).toContain('Canais nativos: validado');
    expect(snapshot.text).toContain('Transportes remotos: validado');
  });

  it('embeds canonical overview sections when overview readers are provided', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T16:00:00.000Z',
          headline: 'Runtime estavel com sinais canonicamente agregados.',
          summary: {
            enabledSidecars: 1,
            readySidecars: 1,
            recentErrorCount: 0,
            freeDiskPercent: 82,
            publishAgeLabel: 'agora',
          },
          runtime: {
            uptimeLabel: '4h 0m',
            memoryLabel: '300 MB RSS',
            heapLabel: '140 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-30T16:00:00.000Z',
          },
          actions: [
            {
              id: 'maintenance',
              label: 'Rodar manutencao operacional',
              command: 'npm run ops:maintain',
              reason: 'Fluxo padrao.',
              priority: 'normal',
            },
          ],
          alerts: [],
          operations: {
            channels: {
              discordBridge: {
                mode: 'native',
                enabled: true,
                started: true,
                pendingInbox: 0,
                pendingOutbox: 1,
                lastError: null,
              },
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-30T15:55:00.000Z',
              summary: 'Smoke real do Node Mesh passou.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-overview-1',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              stale: false,
              recommendedAction: null,
            },
            tenants: {
              totalCount: 1,
              sharedCount: 1,
              personalCount: 0,
              pendingOnboardingCount: 0,
              publicServerCount: 1,
              byPlatform: {
                discord: 1,
              },
              recent: [],
              pendingOnboarding: [],
              file: 'C:/runtime/tenant-registry.json',
            },
            maintenanceAutomation: {
              enabled: true,
              nextPlannedAt: '2026-03-31T04:30:00.000Z',
            },
          },
        })),
      } as any,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        now: () => new Date('2026-03-30T16:00:00.000Z'),
      },
      null,
    );

    const overviewReaders = {
      readOperationalOverviewSnapshot: jest.fn().mockResolvedValue({
        generatedAt: '2026-03-30T16:00:00.000Z',
        summary: { posture: 'healthy' },
        narrative: {
          headline: 'Operational Overview',
          operatorSummary: '1 canal pronto, 1 node online e replay sem pendencias.',
          nextAction: 'Revisar runtime distribuido apenas se o volume subir.',
        },
        actions: [
          {
            source: 'replay-learning',
            label: 'Inspecionar replay',
            command: '/api/operations/replay',
            reason: 'Checar os ultimos artifacts reutilizaveis.',
          },
        ],
      }),
      readTrustOverviewSnapshot: jest.fn().mockResolvedValue({
        generatedAt: '2026-03-30T16:00:00.000Z',
        summary: { posture: 'attention' },
        narrative: {
          headline: 'Trust Overview',
          operatorSummary: '1 tenant observado e nenhuma aprovacao pendente.',
          nextAction: 'Revisar tenancy compartilhada antes do proximo rollout.',
        },
        actions: [
          {
            source: 'tenants',
            label: 'Abrir tenants',
            command: '/tenants',
            reason: 'Conferir o boundary compartilhado.',
          },
        ],
      }),
      readProductOverviewSnapshot: jest.fn().mockResolvedValue({
        generatedAt: '2026-03-30T16:00:00.000Z',
        summary: { posture: 'healthy' },
        narrative: {
          headline: 'Product Overview',
          operatorSummary: 'Hub e ecosystem estaveis, sem regressions relevantes.',
          nextAction: 'Revalidar rollout readiness antes de promover para prod.',
        },
        actions: [
          {
            source: 'rollout',
            label: 'Checar rollout',
            command: 'npm run qa:phases:7-10',
            reason: 'Garantir gate verde antes da promocao.',
          },
        ],
      }),
    };

    const snapshot = await service.buildSnapshot(new Date('2026-03-30T16:00:00.000Z'), overviewReaders);
    const text = await service.buildTextReport(new Date('2026-03-30T16:00:00.000Z'), overviewReaders);

    expect(snapshot.overviews.operational).toEqual(
      expect.objectContaining({
        headline: 'Operational Overview',
        posture: 'healthy',
      }),
    );
    expect(snapshot.overviews.trust).toEqual(
      expect.objectContaining({
        headline: 'Trust Overview',
        posture: 'attention',
      }),
    );
    expect(snapshot.overviews.product).toEqual(
      expect.objectContaining({
        headline: 'Product Overview',
        posture: 'healthy',
      }),
    );
    expect(snapshot.executiveSummary.join(' ')).toContain('Overview operacional: 1 canal pronto, 1 node online e replay sem pendencias.');
    expect(snapshot.executiveSummary.join(' ')).toContain('Overview de trust: 1 tenant observado e nenhuma aprovacao pendente.');
    expect(snapshot.executiveSummary.join(' ')).toContain('Overview de produto: Hub e ecosystem estaveis, sem regressions relevantes.');
    expect(text).toContain('Overview operacional canonico:');
    expect(text).toContain('Overview de trust canonico:');
    expect(text).toContain('Overview de produto canonico:');
    expect(text).toContain('Inspecionar replay | /api/operations/replay | Checar os ultimos artifacts reutilizaveis.');
    expect(text).toContain('Abrir tenants | /tenants | Conferir o boundary compartilhado.');
    expect(text).toContain('Checar rollout | npm run qa:phases:7-10 | Garantir gate verde antes da promocao.');
  });
});
