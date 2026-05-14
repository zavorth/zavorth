import { OperatorBriefService } from '../../src/services/OperatorBriefService';

describe('OperatorBriefService', () => {
  it('delegates fast and live reads to the matching cockpit methods', () => {
    const baseCockpit = {
      generatedAt: '2026-03-29T22:00:00.000Z',
      status: 'healthy',
      headline: 'Runtime estavel.',
      highlights: [],
      runtime: {
        uptimeLabel: '1 h',
        memoryLabel: '256 MB RSS',
        heapLabel: '64 MB heap',
        platformLabel: 'win32 / x64',
        sampledAt: '2026-03-29T22:00:00.000Z',
      },
      summary: {
        enabledSidecars: 1,
        readySidecars: 1,
        recentErrorCount: 0,
        freeDiskPercent: 55,
        publishAgeLabel: 'ha 10 min',
      },
      actions: [
        {
          id: 'maintenance',
          label: 'Rodar manutencao',
          command: 'npm run ops:maintain',
          reason: 'Rotina operacional.',
          priority: 'normal',
        },
      ],
      alerts: [],
      operations: {
        channels: {},
        nodeMeshSmoke: {
          available: true,
          status: 'passed',
          checkedAt: '2026-03-29T21:55:00.000Z',
          summary: 'Smoke ok.',
          command: 'npm run test:nodes:smoke',
          file: 'C:/runtime/node-mesh-smoke-last.json',
          nodeId: 'node-1',
          finalNodeStatus: 'online',
          recentCapabilityId: 'files.write',
          error: null,
          recommendedAction: null,
        },
        maintenanceAutomation: {
          enabled: true,
          lastTriggerSource: null,
          lastPriorityReason: null,
          nextPlannedAt: '2026-03-30T04:30:00.000Z',
        },
      },
    };

    const operationsCockpit = {
      readSnapshotFast: jest.fn(() => baseCockpit),
      readSnapshotLive: jest.fn(() => ({
        ...baseCockpit,
        headline: 'Runtime confirmado ao vivo.',
      })),
      readSnapshot: jest.fn(() => baseCockpit),
    };

    const service = new OperatorBriefService(
      operationsCockpit as any,
      {
        readHistory: jest.fn().mockReturnValue([]),
        summarize: jest.fn().mockReturnValue({
          recent: [],
          totalRuns: 0,
          repairedRuns: 0,
          readyRuns: 0,
          degradedRuns: 0,
          latest: null,
          stability: {
            flappingLikely: false,
            matchingRecentFailures: 0,
            dominantIncidentCode: null,
          },
        }),
      } as any,
      {
        now: () => new Date('2026-03-29T22:30:00.000Z'),
      },
    );

    const fastSnapshot = service.readSnapshotFast();
    const liveSnapshot = service.readSnapshotLive();

    expect(operationsCockpit.readSnapshotFast).toHaveBeenCalledTimes(1);
    expect(operationsCockpit.readSnapshotLive).toHaveBeenCalledTimes(1);
    expect(fastSnapshot.posture).toBe('stable');
    expect(liveSnapshot.posture).toBe('stable');
  });

  it('builds a concise operator brief from cockpit and doctor history', () => {
    const service = new OperatorBriefService(
      {
        readSnapshot: jest.fn().mockReturnValue({
          generatedAt: '2026-03-29T22:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operavel com atencao.',
          highlights: [],
          runtime: {
            uptimeLabel: '3 h',
            memoryLabel: '512 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-29T22:00:00.000Z',
          },
          summary: {
            enabledSidecars: 2,
            readySidecars: 2,
            recentErrorCount: 1,
            freeDiskPercent: 44,
            publishAgeLabel: 'ha 2 h',
          },
          actions: [
            {
              id: 'maintain',
              label: 'Rodar manutencao',
              command: 'npm run ops:maintain',
              reason: 'Mantem o host em dia.',
              priority: 'normal',
            },
          ],
          alerts: [],
          operations: {
            channels: {
              discordBridge: {
                mode: 'bridge',
                enabled: true,
                started: false,
                pendingInbox: 1,
                pendingOutbox: 0,
                lastError: 'relay offline',
              },
            },
            channelProviderDoctor: {
              available: true,
              status: 'failed',
              checkedAt: '2026-03-29T22:08:00.000Z',
              summary: 'Doctor dos canais nativos encontrou pendencias operacionais.',
              command: 'npm run test:channels:smoke',
              file: 'C:/runtime/channel-provider-doctor-last.json',
              stale: false,
              ageMs: 1320000,
              maxAgeMs: 43200000,
              recommendedAction: 'npm run test:channels:smoke',
              items: [
                {
                  channelId: 'slack',
                  mode: 'native',
                  status: 'failed',
                  configured: true,
                  summary: 'Slack native com assinatura pendente.',
                  error: 'SLACK_SIGNING_SECRET ausente.',
                },
              ],
            },
            remoteTransportDoctor: {
              available: true,
              status: 'failed',
              checkedAt: '2026-03-29T22:07:00.000Z',
              summary: 'Doctor dos transportes remotos falhou.',
              command: 'npm run test:transports:smoke',
              file: 'C:/runtime/remote-transport-doctor-last.json',
              stale: false,
              ageMs: 1200000,
              maxAgeMs: 43200000,
              recommendedAction: 'npm run test:transports:smoke',
              items: [],
            },
            nodeMeshSmoke: {
              available: true,
              status: 'failed',
              checkedAt: '2026-03-29T22:10:00.000Z',
              summary: 'Smoke real do Node Mesh falhou.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-brief-1',
              finalNodeStatus: 'offline',
              recentCapabilityId: 'system.run',
              error: 'system.run nao retornou o marcador esperado no smoke real.',
              recommendedAction: 'npm run test:nodes:smoke',
            },
            maintenanceAutomation: {
              enabled: true,
              lastTriggerSource: 'priority',
              lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke falho.',
              nextPlannedAt: '2026-03-30T04:30:00.000Z',
            },
          },
        }),
      } as any,
      {
        readHistory: jest.fn().mockReturnValue([]),
        summarize: jest.fn().mockReturnValue({
          recent: [
            {
              checkedAt: '2026-03-29T21:00:00.000Z',
              repairRequested: false,
              readyBefore: false,
              readyAfter: false,
              repaired: false,
              summary: 'Diagnostico concluido',
              actions: [],
              remainingRecommendations: [],
              sidecarReady: true,
              sidecarHealthOk: true,
              bridgeOnline: true,
              remoteModeActive: false,
              sessionAccessible: true,
              incidentSeverity: 'warning',
              primaryIncidentCode: 'remote_mode_inactive',
            },
          ],
          totalRuns: 1,
          repairedRuns: 0,
          readyRuns: 0,
          degradedRuns: 1,
          latest: {
            checkedAt: '2026-03-29T21:00:00.000Z',
            repairRequested: false,
            readyBefore: false,
            readyAfter: false,
            repaired: false,
            summary: 'Diagnostico concluido',
            actions: [],
            remainingRecommendations: [],
            sidecarReady: true,
            sidecarHealthOk: true,
            bridgeOnline: true,
            remoteModeActive: false,
            sessionAccessible: true,
            incidentSeverity: 'warning',
            primaryIncidentCode: 'remote_mode_inactive',
          },
          stability: {
            flappingLikely: false,
            matchingRecentFailures: 1,
            dominantIncidentCode: 'remote_mode_inactive',
          },
        }),
      } as any,
      {
        now: () => new Date('2026-03-29T22:30:00.000Z'),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.posture).toBe('watch');
    expect(snapshot.headline).toContain('remote_mode_inactive');
    expect(snapshot.nextAction.command).toBe('npm run zavorthBridge:remote:doctor');
    expect(snapshot.nextAction.actionId).toBe('zavorth-bridge-remote-doctor');
    expect(snapshot.nextAction.manualOnly).toBe(false);
    expect(snapshot.zavorthBridge.latestIncident).toBe('remote_mode_inactive');
    expect(snapshot.highlights.join(' ')).toContain('Node Mesh falhou no ultimo smoke real');
    expect(snapshot.highlights.join(' ')).toContain('Doctor dos canais nativos encontrou pendencias operacionais.');
    expect(snapshot.highlights.join(' ')).toContain('Doctor dos transportes remotos falhou.');
    expect(snapshot.highlights.join(' ')).toContain('Ultimo autodisparo prioritario');
    expect(snapshot.channelProviderDoctor).toEqual(
      expect.objectContaining({
        label: 'Doctor falhou',
        command: 'npm run test:channels:smoke',
      }),
    );
    expect(snapshot.maintenanceAutomation).toEqual(
      expect.objectContaining({
        label: 'Automacao prioritaria',
        lastTriggerSource: 'priority',
        lastPriorityReason: 'Prioridade operacional: renovar o Node Mesh smoke falho.',
      }),
    );
    expect(snapshot.highlights.join(' ')).toContain('Discord bridge pendente: relay offline.');
    expect(snapshot.text).toContain('Automacao operacional:');
    expect(snapshot.text).toContain('Automacao prioritaria');
    expect(snapshot.text).toContain('Canais nativos:');
    expect(snapshot.text).toContain('Doctor falhou');
    expect(snapshot.text).toContain('npm run test:channels:smoke');
    expect(snapshot.text).toContain('Transportes remotos:');
    expect(snapshot.text).toContain('npm run test:transports:smoke');
    expect(snapshot.text).toContain('Briefing do operador');
  });

  it('promotes Node Mesh revalidation when the last smoke report is stale', () => {
    const service = new OperatorBriefService(
      {
        readSnapshot: jest.fn().mockReturnValue({
          generatedAt: '2026-03-30T10:00:00.000Z',
          status: 'attention',
          headline: 'Runtime operavel com acompanhamento leve.',
          highlights: [],
          runtime: {
            uptimeLabel: '2 h',
            memoryLabel: '512 MB RSS',
            heapLabel: '128 MB heap',
            platformLabel: 'win32 / x64',
            sampledAt: '2026-03-30T10:00:00.000Z',
          },
          summary: {
            enabledSidecars: 1,
            readySidecars: 1,
            recentErrorCount: 0,
            freeDiskPercent: 52,
            publishAgeLabel: 'ha 30 min',
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
            channelProviderDoctor: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-28T08:00:00.000Z',
              summary: 'Doctor dos canais nativos validou os providers configurados.',
              command: 'npm run test:channels:smoke',
              file: 'C:/runtime/channel-provider-doctor-last.json',
              stale: true,
              ageMs: 90000000,
              maxAgeMs: 43200000,
              recommendedAction: 'npm run test:channels:smoke',
              items: [
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
              checkedAt: '2026-03-28T08:10:00.000Z',
              summary: 'Doctor dos transportes remotos validou os fluxos configurados.',
              command: 'npm run test:transports:smoke',
              file: 'C:/runtime/remote-transport-doctor-last.json',
              stale: true,
              ageMs: 90000000,
              maxAgeMs: 43200000,
              recommendedAction: 'npm run test:transports:smoke',
              items: [],
            },
            nodeMeshSmoke: {
              available: true,
              status: 'passed',
              checkedAt: '2026-03-28T09:00:00.000Z',
              summary: 'Smoke real antigo.',
              command: 'npm run test:nodes:smoke',
              file: 'C:/runtime/node-mesh-smoke-last.json',
              nodeId: 'node-brief-stale',
              finalNodeStatus: 'online',
              recentCapabilityId: 'files.write',
              error: null,
              stale: true,
              recommendedAction: 'npm run test:nodes:smoke',
            },
            maintenanceAutomation: {
              enabled: true,
              nextPlannedAt: '2026-03-31T04:30:00.000Z',
            },
          },
        }),
      } as any,
      {
        readHistory: jest.fn().mockReturnValue([]),
        summarize: jest.fn().mockReturnValue({
          recent: [],
          totalRuns: 0,
          repairedRuns: 0,
          readyRuns: 0,
          degradedRuns: 0,
          latest: null,
          stability: {
            flappingLikely: false,
            matchingRecentFailures: 0,
            dominantIncidentCode: null,
          },
        }),
      } as any,
      {
        now: () => new Date('2026-03-30T10:30:00.000Z'),
      },
    );

    const snapshot = service.readSnapshot();

    expect(snapshot.posture).toBe('watch');
    expect(snapshot.nextAction.command).toBe('npm run test:nodes:smoke');
    expect(snapshot.nextAction.actionId).toBe('validate-node-mesh-smoke');
    expect(snapshot.highlights.join(' ')).toContain('smoke real vencido');
    expect(snapshot.highlights.join(' ')).toContain('Doctor dos canais nativos venceu');
    expect(snapshot.highlights.join(' ')).toContain('Doctor dos transportes remotos venceu');
    expect(snapshot.channelProviderDoctor).toEqual(
      expect.objectContaining({
        label: 'Doctor vencido',
        command: 'npm run test:channels:smoke',
      }),
    );
    expect(snapshot.remoteTransportDoctor).toEqual(
      expect.objectContaining({
        label: 'Doctor vencido',
        command: 'npm run test:transports:smoke',
      }),
    );
    expect(snapshot.text).toContain('npm run test:nodes:smoke');
    expect(snapshot.text).toContain('Doctor vencido');
    expect(snapshot.text).toContain('npm run test:channels:smoke');
    expect(snapshot.text).toContain('npm run test:transports:smoke');
  });
});
