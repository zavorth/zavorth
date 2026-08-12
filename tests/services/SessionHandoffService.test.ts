import { SessionHandoffService } from '../../src/services/SessionHandoffService.js';

describe('SessionHandoffService', () => {
  it('builds a session handoff snapshot from continuity, replay and workflow context', () => {
    const service = new SessionHandoffService({
      now: () => new Date('2026-04-02T12:05:00.000Z'),
    });

    const snapshot = service.buildSnapshot({
      continuity: {
        generatedAt: '2026-04-02T12:00:00.000Z',
        sessionId: 'web-1',
        chatId: 'web:web-1',
        userId: 'u1',
        principalId: 'u1',
        runtimeUserId: 'u1',
        currentSurfaceTask: {
          taskId: 'task-web-1',
          shortId: 'task-web',
          source: 'web',
          commandType: '/task',
          status: 'waiting_approval',
          workspace: 'C:/repo',
          updatedAt: '2026-04-02T12:00:00.000Z',
          summary: 'Aguardando confirmacao para entregar o arquivo final.',
        },
        activeTask: null,
        latestTelegramTask: {
          taskId: 'task-tg-1',
          shortId: 'task-tg',
          source: 'telegram',
          commandType: '/research',
          status: 'completed',
          workspace: 'C:/repo',
          updatedAt: '2026-04-02T11:40:00.000Z',
          summary: 'Pesquisa concluida no Telegram.',
        },
        latestWebTask: {
          taskId: 'task-web-1',
          shortId: 'task-web',
          source: 'web',
          commandType: '/task',
          status: 'waiting_approval',
          workspace: 'C:/repo',
          updatedAt: '2026-04-02T12:00:00.000Z',
          summary: 'Aguardando confirmacao para entregar o arquivo final.',
        },
        latestDiscordTask: null,
        latestWhatsAppTask: null,
        focusTask: {
          taskId: 'task-web-1',
          shortId: 'task-web',
          source: 'web',
          commandType: '/task',
          status: 'waiting_approval',
          workspace: 'C:/repo',
          updatedAt: '2026-04-02T12:00:00.000Z',
          summary: 'Aguardando confirmacao para entregar o arquivo final.',
        },
        recentTasks: [
          {
            taskId: 'task-web-1',
            shortId: 'task-web',
            source: 'web',
            commandType: '/task',
            status: 'waiting_approval',
            workspace: 'C:/repo',
            updatedAt: '2026-04-02T12:00:00.000Z',
            summary: 'Aguardando confirmacao para entregar o arquivo final.',
          },
          {
            taskId: 'task-tg-1',
            shortId: 'task-tg',
            source: 'telegram',
            commandType: '/research',
            status: 'completed',
            workspace: 'C:/repo',
            updatedAt: '2026-04-02T11:40:00.000Z',
            summary: 'Pesquisa concluida no Telegram.',
          },
        ],
        surfaces: {
          telegram: 1,
          web: 1,
          other: 0,
        },
        surfaceBreakdown: {
          telegram: 1,
          web: 1,
        },
        linkedSurfaces: [
          {
            source: 'telegram',
            sourceUserId: 'telegram-admin',
            linkedAt: '2026-04-02T11:00:00.000Z',
          },
        ],
        suggestedAction: {
          kind: 'resume-active',
          label: 'Retomar task-web',
          reason: 'Existe uma entrega aguardando sua confirmacao.',
          prompt: 'Retome a entrega e prepare o proximo passo com base no que ja foi validado.',
        },
        workspaceContext: null,
      },
      replay: {
        generatedAt: '2026-04-02T12:01:00.000Z',
        headline: 'Replay pronto para retomar task-web em web.',
        operatorSummary: '2 tarefa(s) recentes | 1 workflow(s) composto(s) | 1 confirmacao(oes) pendente(s)',
        focusTask: {
          taskId: 'task-web-1',
          shortId: 'task-web',
          source: 'web',
          commandType: '/task',
          status: 'waiting_approval',
          workspace: 'C:/repo',
          updatedAt: '2026-04-02T12:00:00.000Z',
          summary: 'Aguardando confirmacao para entregar o arquivo final.',
        },
        dominantSurface: 'web',
        stats: {
          tasks: 2,
          workflowRuns: 1,
          pendingPermissions: 1,
          artifacts: 2,
          linkedSurfaces: 1,
        },
        recommendedEntry: {
          kind: 'task',
          label: 'Retomar task-web',
          reason: 'A tarefa mais recente continua sendo o melhor ponto de entrada.',
          targetId: 'task-web-1',
        },
        recentArtifacts: [],
        timeline: [],
      },
      workflowRuns: [
        {
          workflow_run_id: 'wf-1',
          workflow_name: 'ship',
          objective: 'Fechar entrega final',
          workspace: 'C:/repo',
          workspace_context: null,
          created_at: '2026-04-02T11:50:00.000Z',
          updated_at: '2026-04-02T11:58:00.000Z',
          status: 'approval_pending',
          stages: [],
          resume_stage: {
            id: 'review',
            label: 'ExternalExecutor Review',
            executor: 'external_executor',
            status: 'approval_pending',
            index: 1,
            attempt_count: 1,
            task_id: 'task-web-1',
            objective: 'Revisar entrega',
            handoff_summary: 'Entrega consolidada.',
            result_summary: 'Aguardando confirmacao para concluir.',
            reason: 'Existe uma aprovacao pendente na etapa final.',
          },
          resume_prompt: 'Retome a revisao final.',
          artifacts: [],
          artifacts_manifest: {},
        },
      ],
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        generatedAt: '2026-04-02T12:05:00.000Z',
        status: 'resume-required',
        headline: expect.stringContaining('Handoff pronto'),
        operatorSummary: expect.stringContaining('resume suggested'),
        canonicalTarget: expect.objectContaining({
          kind: 'task',
          id: 'task-web-1',
          source: 'web',
        }),
        handoffPrompt: expect.stringContaining('Retome a entrega'),
        handoffCommand: 'Retome a tarefa task-web-1 e continue do ponto atual.',
        checkpoints: expect.objectContaining({
          tasks: 2,
          workflowRuns: 1,
          pendingPermissions: 1,
          artifacts: 2,
          linkedSurfaces: 1,
        }),
        carryForward: expect.arrayContaining([
          expect.objectContaining({
            label: 'Foco atual',
          }),
          expect.objectContaining({
            label: 'Ultimo Telegram',
          }),
        ]),
        surfaces: expect.arrayContaining([
          expect.objectContaining({
            source: 'telegram',
            linked: true,
          }),
          expect.objectContaining({
            source: 'web',
            linked: false,
          }),
        ]),
      }),
    );
  });
});
