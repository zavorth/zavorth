import { OperationsReportService } from '../../src/services/OperationsReportService.js';

describe('OperationsReportService', () => {
  it('builds a consolidated snapshot and text report', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-29T12:00:00.000Z',
          headline: 'Runtime stable.',
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

    expect(snapshot.headline).toBe('Runtime stable.');
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
    expect(snapshot.executiveSummary.join(' ')).toContain('Last priority auto-trigger');
    expect(snapshot.executiveSummary.join(' ')).toContain('Doctor dos canais nativos validou');
    expect(snapshot.operations.channelProviderDoctorLabel).toContain('validated');
    expect(snapshot.operations.remoteTransportDoctorLabel).toContain('validated');
    expect(snapshot.operations.nodeMeshSmokeLabel).toContain('validated');
    expect(snapshot.operations.automationLabel).toContain('prioritized');
    expect(text).toContain('Zavorth consolidated report');
    expect(text).toContain('Operator briefing:');
    expect(text).toContain('Cross-surface continuity:');
    expect(text).toContain('The last known task came from telegram.');
    expect(text).toContain('Product observability:');
    expect(text).toContain('Routes: workspace_learning leads with 4 recent request(s)');
    expect(text).toContain('Product insights:');
    expect(text).toContain('Native Discord gateway active; 2 recent sends recorded.');
    expect(text).toContain('Native channels: validated');
    expect(text).toContain('Remote transports: validated');
    expect(text).toContain('Slack native');
    expect(text).toContain('WhatsApp Cloud API');
    expect(text).toContain('Node Mesh validated by real smoke');
    expect(text).toContain('Channels: discord ready');
    expect(text).toContain('Tenants: 2 observed | onboarding pending 1');
    expect(text).toContain('Node Mesh: validated');
    expect(text).toContain('Operational priority: renew stale Node Mesh smoke.');
    expect(text).toContain('Public: 1 | onboarding pending 1');
    expect(text).toContain('npm run zavorthBridge:remote:doctor');
    expect(text).toContain('Pending permissions:');
    expect(text).toContain('Next recommended actions:');
  });

  it('surfaces stale Node Mesh validation in the executive report', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operational with attention points.',
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
              reason: 'Last real smoke became stale and needs renewal.',
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
              summary: 'Old real smoke, but completed successfully.',
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

    expect(snapshot.operations.nodeMeshSmokeLabel).toContain('stale');
    expect(snapshot.executiveSummary.join(' ')).toContain('stale real smoke');
    expect(snapshot.text).toContain('Node Mesh: stale');
    expect(snapshot.text).toContain('npm run test:nodes:smoke');
  });

  it('includes Slack and WhatsApp in the channel narrative when local adapters are enabled', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operational with local channels in rollout.',
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

    expect(snapshot.executiveSummary.join(' ')).toContain('WhatsApp active in supervised local mode');
    expect(snapshot.executiveSummary.join(' ')).toContain('Slack enabled but not yet in ready state.');
    expect(snapshot.operations.channelsLabel).toContain('whatsapp ready | supervised local | chats 2');
    expect(snapshot.operations.channelsLabel).toContain('slack pending');
    expect(snapshot.text).toContain('WhatsApp active in supervised local mode; 2 chat(s) allowed.');
    expect(snapshot.text).toContain('Slack enabled but not yet in ready state.');
  });

  it('describes native Slack and WhatsApp providers honestly in the channel narrative', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T12:00:00.000Z',
          status: 'healthy',
          headline: 'Runtime operational with validated native channels.',
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

    expect(snapshot.executiveSummary.join(' ')).toContain('WhatsApp Cloud API active');
    expect(snapshot.executiveSummary.join(' ')).toContain('Native Slack active');
    expect(snapshot.executiveSummary.join(' ')).toContain('Doctor dos canais nativos validou');
    expect(snapshot.operations.channelsLabel).toContain('whatsapp ready | Cloud API | chats 1');
    expect(snapshot.operations.channelsLabel).toContain('slack ready | native | channels 2');
    expect(snapshot.operations.channelProviderDoctorLabel).toContain('validated');
    expect(snapshot.operations.remoteTransportDoctorLabel).toContain('validated');
    expect(snapshot.text).toContain('WhatsApp Cloud API active; 1 chat(s) allowed.');
    expect(snapshot.text).toContain('Native Slack active; 2 channel(s) allowed.');
    expect(snapshot.text).toContain('Native channels: validated');
    expect(text).toContain('Remote transports: validated');
  });

  it('embeds canonical overview sections when overview readers are provided', async () => {
    const service = new OperationsReportService(
      {
        readSnapshot: jest.fn(() => ({
          generatedAt: '2026-03-30T16:00:00.000Z',
          headline: 'Runtime stable with canonically aggregated signals.',
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
              label: 'Run operational maintenance',
              command: 'npm run ops:maintain',
              reason: 'Default flow.',
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
              summary: 'Real Node Mesh smoke passed.',
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
            reason: 'Check latest reusable artifacts.',
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
            reason: 'Check shared boundary.',
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
            reason: 'Ensure green gate before promotion.',
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
    expect(snapshot.executiveSummary.join(' ')).toContain('Operational Overview: 1 channel ready, 1 node online and replay without pending items.');
    expect(snapshot.executiveSummary.join(' ')).toContain('Trust Overview: 1 tenant observed and no pending approvals.');
    expect(snapshot.executiveSummary.join(' ')).toContain('Product Overview: Hub and ecosystem stable, no relevant regressions.');
    expect(text).toContain('Canonical operational overview:');
    expect(text).toContain('Canonical trust overview:');
    expect(text).toContain('Canonical product overview:');
    expect(text).toContain('Inspect replay | /api/operations/replay | Check latest reusable artifacts.');
    expect(text).toContain('Open tenants | /tenants | Check shared boundary.');
    expect(text).toContain('Check rollout | npm run qa:phases:7-10 | Ensure green gate before promotion.');
  });
});
