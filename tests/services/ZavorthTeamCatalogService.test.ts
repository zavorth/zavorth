import { ZavorthTeamCatalogService } from '../../src/services/ZavorthTeamCatalogService';

describe('ZavorthTeamCatalogService', () => {
  it('builds a visible product snapshot for workflow teams', () => {
    const service = new ZavorthTeamCatalogService({
      now: () => new Date('2026-04-02T15:00:00.000Z'),
      discordSurfacePolicyService: {
        getCommandExposure: () => 'minimal',
        getAllowedChannelIds: () => [],
        getOwnerUserIds: () => ['956344010224586822'],
        isPublicServerMode: () => true,
        requiresOwnerForOperational: () => true,
      } as any,
      workflowRunService: {
        listRuns: () => ([
          {
            workflow_run_id: 'wf-ship-001',
            workflow_name: 'ship',
            objective: 'Concluir onboarding do hub',
            workspace: 'C:/repo',
            status: 'approval_pending',
            updated_at: '2026-04-02T14:58:00.000Z',
            resume_stage: {
              id: 'reviewer',
              label: 'ExternalExecutor Reviewer',
              executor: 'external_executor',
              status: 'approval_pending',
              index: 1,
              attempt_count: 1,
              task_id: 'task-ship-1',
              objective: 'Revise as mudancas',
              handoff_summary: 'Resumo parcial',
              result_summary: 'Waiting for approval',
              reason: 'Your confirmation is missing to continue.',
            },
            stages: [],
            artifacts: [],
            artifacts_manifest: {},
            workspace_context: null,
            externalized_state: {
              run_dir: 'C:/runtime/wf-ship-001',
              state_file: 'C:/runtime/wf-ship-001/state.json',
              compatibility_state_file: 'C:/runtime/wf-ship-001.json',
              checkpoints_file: 'C:/runtime/wf-ship-001/checkpoints.ndjson',
              ledger_file: 'C:/runtime/wf-ship-001/ledger.json',
              latest_checkpoint_id: 'wf-ship-001-cp-0003',
              checkpoint_count: 3,
              latest_state_hash: 'abc123',
              latest_chain_hash: 'def456',
              last_event: 'stage_interrupted',
              recent_checkpoints: [],
            },
            created_at: '2026-04-02T14:40:00.000Z',
            resume_prompt: 'Resume o ship.',
          },
          {
            workflow_run_id: 'wf-research-001',
            workflow_name: 'research',
            objective: 'Pesquisar concorrentes locais',
            workspace: 'C:/repo',
            status: 'completed',
            updated_at: '2026-04-02T13:10:00.000Z',
            resume_stage: null,
            stages: [],
            artifacts: [],
            artifacts_manifest: {},
            workspace_context: null,
            created_at: '2026-04-02T12:40:00.000Z',
            resume_prompt: null,
          },
        ] as any),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.generatedAt).toBe('2026-04-02T15:00:00.000Z');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 4,
        resumable: 1,
        active: 1,
        completedRecently: 1,
        executors: expect.arrayContaining(['aistudio', 'codex', 'external_executor']),
      }),
    );
    expect(snapshot.teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ship',
          status: 'resumable',
          surfaces: expect.arrayContaining([
            expect.objectContaining({
              surfaceId: 'telegram',
              status: 'available',
            }),
            expect.objectContaining({
              surfaceId: 'web',
              status: 'available',
            }),
            expect.objectContaining({
              surfaceId: 'discord_dm',
              status: 'owner_only',
            }),
            expect.objectContaining({
              surfaceId: 'discord_channel',
              status: 'restricted',
            }),
          ]),
          latestRun: expect.objectContaining({
            workflowRunId: 'wf-ship-001',
            resumeAvailable: true,
            resumeStageLabel: 'ExternalExecutor Reviewer',
            checkpointCount: 3,
            latestChainHash: 'def456',
            lastCheckpointEvent: 'stage_interrupted',
          }),
          operatorSummary: expect.stringContaining('3 checkpoint(s)'),
        }),
        expect.objectContaining({
          id: 'research',
          status: 'idle',
          runStats: expect.objectContaining({
            completedRecently: 1,
          }),
        }),
        expect.objectContaining({
          id: 'review',
          members: expect.arrayContaining([
            expect.objectContaining({
              role: 'maker',
              executor: 'external_executor',
            }),
          ]),
        }),
        expect.objectContaining({
          id: 'sdd',
          entryCommand: '/workflow sdd <feature-id>',
          members: expect.arrayContaining([
            expect.objectContaining({
              role: 'execution',
              executor: 'codex',
            }),
          ]),
        }),
      ]),
    );
    expect(snapshot.narrative.headline).toContain('4 team(s)');
    expect(snapshot.narrative.operatorSummary).toContain('1 com resume ready');
  });
});
