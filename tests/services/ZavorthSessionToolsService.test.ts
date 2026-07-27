import { ZavorthSessionToolsService } from '../../src/services/ZavorthSessionToolsService';

describe('ZavorthSessionToolsService', () => {
  it('includes workflow checkpoint integrity hints in the session history', () => {
    const service = new ZavorthSessionToolsService({
      now: () => new Date('2026-04-03T18:00:00.000Z'),
      continuityService: {
        buildSnapshot: () => ({
          sessionId: 'web-session-1',
          chatId: 'web:main',
          runtimeUserId: 'runtime-user-1',
          linkedSurfaces: [],
          recentTasks: [],
          suggestedAction: {
            label: 'Retomar run',
            reason: 'Existe uma workflow resume ready.',
          },
          currentSurfaceTask: null,
          latestTelegramTask: null,
          latestWebTask: null,
          latestDiscordTask: null,
          latestWhatsAppTask: null,
        }),
      } as any,
      replayService: {
        buildSnapshot: () => ({
          timeline: [],
          operatorSummary: 'Replay ready.',
        }),
      } as any,
      handoffService: {
        buildSnapshot: () => ({
          headline: 'Handoff ready.',
        }),
      } as any,
      workflowRunService: {
        listRuns: () => ([
          {
            workflow_run_id: 'wf-review-001',
            workflow_name: 'review',
            objective: 'Revisar modulo sensitive',
            workspace: 'C:/repo',
            status: 'approval_pending',
            updated_at: '2026-04-03T17:58:00.000Z',
            created_at: '2026-04-03T17:40:00.000Z',
            origin: {
              runtime_user_id: 'runtime-user-1',
              origin_user_id: 'runtime-user-1',
              source_surface: 'web',
            },
            resume_stage: {
              id: 'reviewer',
              label: 'ExternalExecutor Reviewer',
              executor: 'external_executor',
              status: 'approval_pending',
              index: 1,
              attempt_count: 1,
              task_id: 'task-review-1',
              objective: 'Revisar modulo sensitive',
              handoff_summary: 'Resumo parcial',
              result_summary: 'Waiting for approval',
              reason: 'waits for your confirmation before continuing',
            },
            stages: [],
            artifacts: [],
            artifacts_manifest: {},
            workspace_context: null,
            resume_prompt: 'Resume a review pelo reviewer.',
            externalized_state: {
              run_dir: 'C:/runtime/wf-review-001',
              state_file: 'C:/runtime/wf-review-001/state.json',
              compatibility_state_file: 'C:/runtime/wf-review-001.json',
              checkpoints_file: 'C:/runtime/wf-review-001/checkpoints.ndjson',
              ledger_file: 'C:/runtime/wf-review-001/ledger.json',
              latest_checkpoint_id: 'wf-review-001-cp-0004',
              checkpoint_count: 4,
              latest_state_hash: 'abc123',
              latest_chain_hash: 'def456',
              last_event: 'stage_interrupted',
              recent_checkpoints: [],
            },
          },
        ] as any),
      } as any,
    });

    const snapshot = service.buildSnapshot({
      sessionId: 'web-session-1',
      chatId: 'web:main',
      userId: 'runtime-user-1',
    });

    expect(snapshot.history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'workflow',
        id: 'wf-review-001',
        summary: expect.stringContaining('4 checkpoint(s)'),
        execution: expect.objectContaining({
          runId: 'wf-review-001',
          workflowRunId: 'wf-review-001',
        }),
      }),
    ]));
    expect(snapshot.history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'wf-review-001',
        summary: expect.stringContaining('ultimo evento stage_interrupted'),
      }),
    ]));
  });
});
