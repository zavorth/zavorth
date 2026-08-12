import { SessionContinuityService } from '../../src/services/SessionContinuityService';
import { SurfaceIdentityService } from '../../src/services/SurfaceIdentityService';

describe('SessionContinuityService', () => {
  it('builds a cross-surface continuity snapshot for the same user', () => {
    const now = '2026-03-31T20:00:00.000Z';
    const service = new SessionContinuityService(
      {
        getRecentTasks: jest.fn(() => [
          {
            task_id: 'task-running-12345678',
            source: 'telegram',
            command_type: '/task',
            status: 'running',
            workspace: 'C:/repo',
            updated_at: '2026-03-31T19:58:00.000Z',
            created_at: '2026-03-31T19:50:00.000Z',
            result_summary: null,
            error_summary: null,
            raw_message: 'continue o deploy',
            metadata: {
              execution_lifecycle: [
                {
                  kind: 'execution',
                  id: 'task-running-12345678',
                  traceId: 'trace-briefing-1',
                  runId: 'run-briefing-1',
                  sessionId: 'session-1',
                  approvalId: null,
                  artifactId: null,
                  status: 'running',
                  summary: 'Briefing final em andamento.',
                  source: 'task-manager',
                  surface: 'telegram',
                  parentId: 'task-running-12345678',
                  createdAt: '2026-03-31T19:50:00.000Z',
                  updatedAt: '2026-03-31T19:58:00.000Z',
                  metadata: {},
                },
              ],
              telegram_surface_summary: {
                titleHint: 'Briefing final',
                summary: 'Retomando briefing final com foco em consolidar a entrega executiva.',
                followupPrompt: 'Retome a conversa que veio do Telegram sobre Briefing final. Feche a consolidacao e use Briefing final como base do que vier agora.',
                workflowLabel: 'Workflow de entrega',
                recentArtifact: 'Briefing final',
                activeFocus: 'Briefing final em andamento',
                isContinuationRequest: true,
              },
              workspace_operational_memory_summary: 'Entrega em andamento com briefing final pendente.',
              workspace_response_style: 'implementation_ready',
              workspace_workflow_recommendation: {
                workflow: 'ship',
                reason: 'Ja existe contexto suficiente para fechar a entrega.',
              },
              workspace_operational_memory: {
                route_outcomes: [
                  {
                    executor: 'codex',
                    task_kind: 'research',
                    task_subtype: 'competitive_analysis',
                    rationale: '3 concluida(s), 0 falha(s), 0 rejeicao(oes), 0 aguardando aprovacao, 0 permissao(oes) pendente(s), 2 liberacao(oes) registrada(s) via telegram.',
                  },
                ],
                active_focuses: [
                  {
                    task_id: 'task-running-12345678',
                    summary: 'Briefing final em andamento',
                  },
                ],
                recent_artifacts: [
                  {
                    task_id: 'task-web-abcdefgh',
                    name: 'briefing-final.md',
                    kind: 'report',
                    path: 'C:/repo/artifacts/briefing-final.md',
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
          },
          {
            task_id: 'task-web-abcdefgh',
            source: 'web',
            command_type: '/task',
            status: 'completed',
            workspace: 'C:/repo',
            updated_at: '2026-03-31T19:40:00.000Z',
            created_at: '2026-03-31T19:35:00.000Z',
            result_summary: 'Resumo web pronto.',
            error_summary: null,
            raw_message: 'revise os logs',
            metadata: {},
          },
        ]),
        getRecentTasksByChat: jest.fn(() => [
          {
            task_id: 'task-web-abcdefgh',
            source: 'web',
            command_type: '/task',
            status: 'completed',
            workspace: 'C:/repo',
            updated_at: '2026-03-31T19:40:00.000Z',
            created_at: '2026-03-31T19:35:00.000Z',
            result_summary: 'Resumo web pronto.',
            error_summary: null,
            raw_message: 'revise os logs',
            metadata: {},
          },
        ]),
      } as any,
      {
        now: () => new Date(now),
      },
    );

    const snapshot = service.buildSnapshot('session-1', 'web:session-1', 'user-1');

    expect(snapshot.principalId).toBe('user-1');
    expect(snapshot.currentSurfaceTask).toEqual(expect.objectContaining({
      taskId: 'task-web-abcdefgh',
      source: 'web',
    }));
    expect(snapshot.activeTask).toEqual(expect.objectContaining({
      taskId: 'task-running-12345678',
      source: 'telegram',
      status: 'running',
      execution: expect.objectContaining({
        traceId: 'trace-briefing-1',
        runId: 'run-briefing-1',
        sessionId: 'session-1',
        latestStatus: 'running',
      }),
    }));
    expect(snapshot.latestTelegramTask).toEqual(expect.objectContaining({
      taskId: 'task-running-12345678',
    }));
    expect(snapshot.latestWebTask).toEqual(expect.objectContaining({
      taskId: 'task-web-abcdefgh',
    }));
    expect(snapshot.suggestedAction).toEqual(expect.objectContaining({
      kind: 'resume-active',
      prompt: expect.stringContaining('Retome a conversa que veio do Telegram sobre Briefing final.'),
    }));
    expect(snapshot.workspaceContext).toEqual(
      expect.objectContaining({
        titleHint: 'Briefing final',
        operationalSummary: 'Entrega em andamento com briefing final pendente.',
        operationalInsight: expect.stringContaining('Melhor rota recente: codex fecha research/competitive_analysis'),
        responseStyle: 'implementation_ready',
        workflowRecommendation: expect.objectContaining({
          workflow: 'ship',
          label: 'Workflow de entrega',
        }),
        activeFocus: expect.objectContaining({
          label: 'Briefing final em andamento',
        }),
        recentArtifact: expect.objectContaining({
          name: 'Briefing final',
        }),
      }),
    );
    expect(snapshot.workspaceContext?.followupPrompt).toContain('Retome a conversa que veio do Telegram sobre Briefing final.');
    expect(snapshot.workspaceContext?.followupPrompt).toContain('Briefing final');
    expect(snapshot.workspaceContext?.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'open_latest_delivery',
          command: '/files task-web',
        }),
      ]),
    );
    expect(snapshot.latestTelegramTask?.summary).toContain('Retomando briefing final');
    expect(snapshot.surfaces).toEqual({
      telegram: 1,
      web: 1,
      other: 0,
    });
    expect(snapshot.surfaceBreakdown).toEqual({
      telegram: 1,
      web: 1,
    });
  });

  it('surfaces Discord continuity when the same principal resumes from a guild session', () => {
    let persisted = '';
    const surfaceIdentity = new SurfaceIdentityService({
      now: () => new Date('2026-04-01T10:00:00.000Z'),
      existsSync: () => Boolean(persisted),
      readFileSync: () => persisted,
      writeFileSync: (_path, content) => {
        persisted = String(content);
      },
      mkdirSync: () => undefined as any,
    });
    surfaceIdentity.linkIdentity({
      source: 'discord',
      sourceUserId: 'discord-user-1',
      runtimeUserId: 'user-1',
      linkedBy: 'discord-bridge',
      verificationMethod: 'discord-bridge-signature',
      chatId: 'discord:guild:guild-1:channel:channel-9',
    });

    const service = new SessionContinuityService(
      {
        getRecentTasksByUsers: jest.fn(() => [
          {
            task_id: 'task-discord-running',
            source: 'discord',
            command_type: '/task',
            status: 'running',
            workspace: 'C:/repo',
            updated_at: '2026-04-01T09:58:00.000Z',
            created_at: '2026-04-01T09:50:00.000Z',
            result_summary: null,
            error_summary: null,
            raw_message: 'continue a migracao',
            metadata: {
              workspace_operational_memory_summary: 'Continuar a migracao do gateway pelo fluxo do Discord.',
              surface_summary: {
                titleHint: 'Migracao do gateway',
                summary: 'Continuando a migracao do gateway para o Discord.',
                followupPrompt: 'Retome a migracao do gateway a partir da ultima execucao no Discord.',
                workflowLabel: 'Workflow multicanal',
                activeFocus: 'Migracao do gateway em andamento',
              },
              surface_identity: {
                platform: 'discord',
                runtime_user_id: 'user-1',
              },
            },
          },
          {
            task_id: 'task-telegram-old',
            source: 'telegram',
            command_type: '/task',
            status: 'completed',
            workspace: 'C:/repo',
            updated_at: '2026-04-01T09:20:00.000Z',
            created_at: '2026-04-01T09:10:00.000Z',
            result_summary: 'Resumo no Telegram.',
            error_summary: null,
            raw_message: 'resuma a migracao',
            metadata: {},
          },
        ]),
        getRecentTasksByChat: jest.fn(() => [
          {
            task_id: 'task-discord-running',
            source: 'discord',
            command_type: '/task',
            status: 'running',
            workspace: 'C:/repo',
            updated_at: '2026-04-01T09:58:00.000Z',
            created_at: '2026-04-01T09:50:00.000Z',
            result_summary: null,
            error_summary: null,
            raw_message: 'continue a migracao',
            metadata: {},
          },
        ]),
      } as any,
      {
        now: () => new Date('2026-04-01T10:00:00.000Z'),
        surfaceIdentityService: surfaceIdentity,
      },
    );

    const snapshot = service.buildSnapshot(
      'discord-session-1',
      'discord:guild:guild-1:channel:channel-9',
      'discord-user-1',
    );

    expect(snapshot.principalId).toBe('user-1');
    expect(snapshot.tenantContext).toEqual(
      expect.objectContaining({
        tenantId: 'discord:guild:guild-1',
        isolationMode: 'tenant',
      }),
    );
    expect(snapshot.latestDiscordTask).toEqual(
      expect.objectContaining({
        taskId: 'task-discord-running',
        source: 'discord',
      }),
    );
    expect(snapshot.surfaces).toEqual({
      telegram: 1,
      web: 0,
      other: 1,
    });
    expect(snapshot.surfaceBreakdown).toEqual({
      discord: 1,
      telegram: 1,
    });
    expect(snapshot.suggestedAction).toEqual(
      expect.objectContaining({
        kind: 'resume-active',
        reason: 'Existe uma tarefa ativa em discord.',
        prompt: expect.stringContaining('Continue a conversa'),
      }),
    );
  });

  it('uses tenant-aware task lookups for public Discord guild continuity', () => {
    const getRecentTasksByUsersAndTenant = jest.fn(() => [
      {
        task_id: 'task-discord-tenant',
        source: 'discord',
        command_type: '/task',
        status: 'running',
        workspace: 'C:/repo',
        updated_at: '2026-04-01T09:58:00.000Z',
        created_at: '2026-04-01T09:50:00.000Z',
        result_summary: null,
        error_summary: null,
        raw_message: 'continue tenant',
        metadata: {
          tenant_id: 'discord:guild:guild-1',
        },
      },
    ]);
    const service = new SessionContinuityService(
      {
        getRecentTasksByUsersAndTenant,
        getRecentTasksByChat: jest.fn(() => []),
      } as any,
      {
        now: () => new Date('2026-04-01T10:00:00.000Z'),
      },
    );

    const snapshot = service.buildSnapshot(
      'discord-session-2',
      'discord:guild:guild-1:channel:channel-9',
      'discord-user-2',
    );

    expect(getRecentTasksByUsersAndTenant).toHaveBeenCalledWith(
      ['discord-user-2'],
      'discord:guild:guild-1',
      12,
    );
    expect(snapshot.tenantContext?.tenantId).toBe('discord:guild:guild-1');
  });

  it('filters fallback continuity lookups by tenant when tenant-aware loaders are unavailable', () => {
    const getRecentTasksByUsers = jest.fn(() => [
      {
        task_id: 'task-discord-tenant',
        source: 'discord',
        command_type: '/task',
        status: 'running',
        workspace: 'C:/repo',
        updated_at: '2026-04-01T09:58:00.000Z',
        created_at: '2026-04-01T09:50:00.000Z',
        result_summary: null,
        error_summary: null,
        raw_message: 'continue tenant certo',
        metadata: {
          tenant_id: 'discord:guild:guild-1',
          surface_summary: {
            summary: 'Tenant certo.',
          },
        },
      },
      {
        task_id: 'task-discord-other-tenant',
        source: 'discord',
        command_type: '/task',
        status: 'running',
        workspace: 'C:/repo',
        updated_at: '2026-04-01T09:59:00.000Z',
        created_at: '2026-04-01T09:55:00.000Z',
        result_summary: null,
        error_summary: null,
        raw_message: 'continue tenant errado',
        metadata: {
          tenant_id: 'discord:guild:guild-2',
          surface_summary: {
            summary: 'Tenant errado.',
          },
        },
      },
    ]);
    const service = new SessionContinuityService(
      {
        getRecentTasksByUsers,
        getRecentTasksByChat: jest.fn(() => [
          {
            task_id: 'task-discord-other-tenant',
            source: 'discord',
            command_type: '/task',
            status: 'running',
            workspace: 'C:/repo',
            updated_at: '2026-04-01T09:59:00.000Z',
            created_at: '2026-04-01T09:55:00.000Z',
            result_summary: null,
            error_summary: null,
            raw_message: 'continue tenant errado',
            metadata: {
              tenant_id: 'discord:guild:guild-2',
            },
          },
        ]),
      } as any,
      {
        now: () => new Date('2026-04-01T10:00:00.000Z'),
      },
    );

    const snapshot = service.buildSnapshot(
      'discord-session-3',
      'discord:guild:guild-1:channel:channel-9',
      'discord-user-2',
    );

    expect(getRecentTasksByUsers).toHaveBeenCalledWith(['discord-user-2'], 12);
    expect(snapshot.recentTasks).toHaveLength(1);
    expect(snapshot.recentTasks[0]).toEqual(
      expect.objectContaining({
        taskId: 'task-discord-tenant',
      }),
    );
    expect(snapshot.currentSurfaceTask).toBeNull();
    expect(snapshot.activeTask).toEqual(
      expect.objectContaining({
        taskId: 'task-discord-tenant',
      }),
    );
  });
});
