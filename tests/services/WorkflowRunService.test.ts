import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkflowRunService } from '../../src/services/WorkflowRunService';

describe('WorkflowRunService', () => {
  it('tracks stage completion and aggregates artifacts across the workflow run', () => {
    const service = new WorkflowRunService();
    const run = service.createRun('research', 'Pesquisar mercado local', 'C:/repo', [
      {
        id: 'researcher',
        executor: 'aistudio',
        role: 'researcher',
        label: 'AI Studio Researcher',
        intro: 'Pesquisa inicial.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
      {
        id: 'synthesizer',
        executor: 'codex',
        role: 'synthesizer',
        label: 'Codex Synthesizer',
        intro: 'Sintese final.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'researcher', 'Pesquisar mercado local', null);
    service.markStageCompleted(run, 'researcher', {
      execution_id: 'exec-1',
      task_id: 'task-1',
      executor: 'aistudio',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: 'Report inicial ready',
      stderr: null,
      diff_summary: null,
      artifacts: [
        {
          key: 'research-report',
          name: 'research-report.md',
          kind: 'report',
          type: 'file',
          url: 'https://example.com/research-report.md',
        },
      ],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    }, 'Report inicial ready');

    service.markStageStarted(run, 'synthesizer', 'Sintetizar pesquisa', 'Report inicial ready');
    service.markStageCompleted(run, 'synthesizer', {
      execution_id: 'exec-2',
      task_id: 'task-2',
      executor: 'codex',
      success: true,
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      actions_executed: [],
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: 'Briefing final ready',
      stderr: null,
      diff_summary: null,
      artifacts: [
        {
          key: 'briefing-final',
          name: 'briefing-final.md',
          kind: 'report',
          type: 'file',
          url: 'https://example.com/briefing-final.md',
        },
      ],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {},
    }, 'Briefing final ready');

    expect(run.status).toBe('completed');
    expect(run.artifacts).toHaveLength(2);
    expect(run.resume_prompt).toBeNull();
    expect(run.artifacts_manifest).toEqual(expect.objectContaining({
      total: 2,
      primary_artifact_name: 'research-report.md',
      package_mode: 'bundle',
    }));
    expect(run.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'run',
        status: 'planned',
        runId: run.workflow_run_id,
      }),
      expect.objectContaining({
        kind: 'execution',
        status: 'running',
        metadata: expect.objectContaining({
          stageId: 'researcher',
        }),
      }),
      expect.objectContaining({
        kind: 'execution',
        status: 'completed',
      }),
      expect.objectContaining({
        kind: 'run',
        status: 'completed',
        runId: run.workflow_run_id,
      }),
    ]));
    expect(run.resume_stage).toBeNull();
    expect(run.stages[1]).toEqual(expect.objectContaining({
      handoff_summary: 'Report inicial ready',
      artifact_count: 1,
      status: 'completed',
      task_id: 'task-2',
      attempt_count: 1,
    }));
  });

  it('persists workflow runs and allows listing them back by workspace and status', () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-runs-'));
    const clock = (() => {
      const times = [
        new Date('2026-04-01T12:00:00.000Z'),
        new Date('2026-04-01T12:01:00.000Z'),
        new Date('2026-04-01T12:02:00.000Z'),
        new Date('2026-04-01T12:03:00.000Z'),
      ];
      let index = 0;
      return () => times[Math.min(index++, times.length ? 1)];
    })();

    const service = new WorkflowRunService({
      storageDir,
      persist: true,
      now: clock,
    });

    const run = service.createRun(
      'review',
      'Revisar modulo de pagamentos',
      'C:/repo',
      [
      {
        id: 'maker',
        executor: 'external_executor',
        role: 'maker',
        label: 'ExternalExecutor Maker',
        intro: 'Executando review inicial.',
        strategy_note: 'Keep the current maker because the recent flow was stable.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
      ],
      {
        profile_summary: 'Workspace de pagamentos',
        operational_summary: 'Existe uma approval pendente na review atual',
        profile_notes: [],
        operational_notes: [],
        active_focus: null,
        recent_artifact: null,
        continuity_recommendation: {
          label: 'Retomar review',
          reason: 'A review pausou waiting for sua decision.',
          executor: 'external_executor',
        },
      },
    );

    service.markStageStarted(run, 'maker', 'Revisar modulo de pagamentos', null, 'task-maker-1');
    service.markStageInterrupted(run, 'maker', 'approval_pending', 'Aguardando sua decision.');

    const restored = service.getRun(run.workflow_run_id);
    expect(restored).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'approval_pending',
      workspace: 'C:/repo',
      workspace_context: expect.objectContaining({
        profile_summary: 'Workspace de pagamentos',
      }),
    }));
    expect(restored?.stages[0]).toEqual(expect.objectContaining({
      status: 'approval_pending',
      objective: 'Revisar modulo de pagamentos',
      strategy_note: 'Keep the current maker because the recent flow was stable.',
      result_summary: 'Aguardando sua decision.',
      task_id: 'task-maker-1',
      attempt_count: 1,
    }));
    expect(restored?.resume_stage).toEqual(expect.objectContaining({
      id: 'maker',
      label: 'ExternalExecutor Maker',
      executor: 'external_executor',
      strategy_note: 'Keep the current maker because the recent flow was stable.',
      status: 'approval_pending',
      objective: 'Revisar modulo de pagamentos',
      task_id: 'task-maker-1',
      result_summary: 'Aguardando sua decision.',
      reason: 'waits for your confirmation before continuing',
    }));
    expect(restored?.actionable_stages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'maker',
          status: 'approval_pending',
          action: 'continue',
          reason: 'Aguardando sua decision.',
        }),
      ]),
    );
    expect(restored?.resume_prompt).toContain('at stage ExternalExecutor Maker');
    expect(restored?.resume_prompt).toContain('Objetivo: Revisar modulo de pagamentos.');
    expect(restored?.resume_prompt).toContain('Original strategy: keep the current maker because the recent flow was stable.');
    expect(restored?.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'approval',
        status: 'approval_required',
      }),
      expect.objectContaining({
        kind: 'run',
        status: 'approval_required',
      }),
    ]));

    const runs = service.listRuns({
      workspace: 'C:/repo',
      statuses: ['approval_pending'],
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'approval_pending',
    }));
  });

  it('prefers the persisted workflow state when another instance updates the same run', () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-cross-instance-'));
    const writer = new WorkflowRunService({
      storageDir,
      persist: true,
      now: () => new Date('2026-04-06T09:00:00.000Z'),
    });
    const reader = new WorkflowRunService({
      storageDir,
      persist: true,
      now: () => new Date('2026-04-06T09:01:00.000Z'),
    });

    const run = writer.createRun('ship', 'Publicar entrega final', 'C:/repo', [
      {
        id: 'review',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Final review.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    const initial = reader.getRun(run.workflow_run_id);
    expect(initial).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'running',
    }));

    writer.markStageStarted(run, 'review', 'Publicar entrega final', 'Checklist consolidado', 'task-review-1');
    writer.markStageInterrupted(run, 'review', 'approval_pending', 'Waiting for approval final.');

    const refreshed = reader.getRun(run.workflow_run_id);
    const listed = reader.listRuns({
      workspace: 'C:/repo',
      statuses: ['approval_pending'],
    });

    expect(refreshed).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'approval_pending',
      resume_stage: expect.objectContaining({
        id: 'review',
        status: 'approval_pending',
      }),
    }));
    expect(listed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflow_run_id: run.workflow_run_id,
          status: 'approval_pending',
        }),
      ]),
    );
  });

  it('allows the operator to close a blocked workflow run and removes resume metadata', () => {
    const service = new WorkflowRunService({
      persist: false,
      now: () => new Date('2026-04-05T12:00:00.000Z'),
    });
    const run = service.createRun('ship', 'Close release public', 'C:/repo', [
      {
        id: 'review',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Final review.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'review', 'Close release public', 'Checklist consolidado', 'task-review-1');
    service.markStageInterrupted(run, 'review', 'blocked', 'Dependencia externa unavailable.');

    const closed = service.closeRun({
      workflowRunId: run.workflow_run_id,
      reason: 'Operador decidiu encerrar esta resumption.',
      surface: 'web',
    });

    expect(closed).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'blocked',
      operator_state: 'closed',
      operator_close_reason: 'Operador decidiu encerrar esta resumption.',
      operator_closed_by_surface: 'web',
      resume_stage: null,
      resume_prompt: null,
      actionable_stages: [],
    }));
  });

  it('externalizes workflow state into state, checkpoints and ledger files with a hash chain', () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-state-'));
    const service = new WorkflowRunService({
      storageDir,
      persist: true,
      now: () => new Date('2026-04-03T15:00:00.000Z'),
    });

    const run = service.createRun('ship', 'Close release public', 'C:/repo', [
      {
        id: 'review',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Final review.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'review', 'Close release public', 'Checklist consolidado', 'task-review-1');
    service.markStageInterrupted(run, 'review', 'approval_pending', 'Waiting for approval final.');

    const safeId = run.workflow_run_id.replace(/[^a-z0-9._-]+/gi, '-');
    const runDir = path.join(storageDir, safeId);
    const stateFile = path.join(runDir, 'state.json');
    const checkpointsFile = path.join(runDir, 'checkpoints.ndjson');
    const ledgerFile = path.join(runDir, 'ledger.json');
    const compatibilityFile = path.join(storageDir, `${safeId}.json`);

    expect(fs.existsSync(runDir)).toBe(true);
    expect(fs.existsSync(stateFile)).toBe(true);
    expect(fs.existsSync(checkpointsFile)).toBe(true);
    expect(fs.existsSync(ledgerFile)).toBe(true);
    expect(fs.existsSync(compatibilityFile)).toBe(true);

    const stateEnvelope = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as any;
    const checkpoints = fs.readFileSync(checkpointsFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as any;

    expect(stateEnvelope.run).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'approval_pending',
      execution_lifecycle: expect.arrayContaining([
        expect.objectContaining({
          kind: 'approval',
          status: 'approval_required',
        }),
      ]),
      externalized_state: expect.objectContaining({
        checkpoint_count: 3,
        latest_checkpoint_id: expect.any(String),
        latest_chain_hash: expect.any(String),
        recent_checkpoints: expect.arrayContaining([
          expect.objectContaining({
            sequence: 3,
            event: 'stage_interrupted',
            status: 'approval_pending',
          }),
        ]),
      }),
    }));
    expect(checkpoints).toHaveLength(3);
    expect(checkpoints[0]).toEqual(expect.objectContaining({
      sequence: 1,
      event: 'run_created',
      previous_chain_hash: null,
    }));
    expect(checkpoints[1]).toEqual(expect.objectContaining({
      sequence: 2,
      event: 'stage_started',
      previous_chain_hash: checkpoints[0].chain_hash,
    }));
    expect(checkpoints[2]).toEqual(expect.objectContaining({
      sequence: 3,
      event: 'stage_interrupted',
      previous_chain_hash: checkpoints[1].chain_hash,
      resume_stage_id: 'review',
    }));
    expect(ledger).toEqual(expect.objectContaining({
      checkpoint_count: 3,
      latest_checkpoint_id: checkpoints[2].checkpoint_id,
      latest_chain_hash: checkpoints[2].chain_hash,
      paths: expect.objectContaining({
        state_file: stateFile,
        checkpoints_file: checkpointsFile,
        compatibility_state_file: compatibilityFile,
      }),
    }));

    fs.rmSync(compatibilityFile, { force: true });
    const restored = service.getRun(run.workflow_run_id);

    expect(restored).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'approval_pending',
      externalized_state: expect.objectContaining({
        state_file: stateFile,
        checkpoints_file: checkpointsFile,
        ledger_file: ledgerFile,
        checkpoint_count: 3,
        latest_chain_hash: checkpoints[2].chain_hash,
        recent_checkpoints: expect.arrayContaining([
          expect.objectContaining({
            checkpoint_id: checkpoints[2].checkpoint_id,
            event: 'stage_interrupted',
          }),
        ]),
      }),
    }));
  });

  it('can turn an approval-pending stage back into a resumable pending stage after approval', () => {
    const service = new WorkflowRunService({
      persist: false,
    });
    const run = service.createRun('ship', 'Close release', 'C:/repo', [
      {
        id: 'review',
        executor: 'external_executor',
        role: 'reviewer',
        label: 'ExternalExecutor Reviewer',
        intro: 'Final review.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'review', 'Close release', 'Previous context', 'task-review-1');
    service.markStageInterrupted(run, 'review', 'approval_pending', 'Aguardando sua approval.');

    const updated = service.applyStageApprovalDecision({
      workflowRunId: run.workflow_run_id,
      stageId: 'review',
      taskId: 'task-review-1',
      action: 'approve',
      summary: 'Approval recorded pelo operador.',
    });

    expect(updated).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'running',
      resume_stage: null,
      actionable_stages: [],
      resume_prompt: null,
    }));
    expect(updated?.stages[0]).toEqual(expect.objectContaining({
      id: 'review',
      status: 'pending',
      task_id: 'task-review-1',
      result_summary: 'Approval recorded pelo operador.',
    }));
  });

  it('persists the SDD feature id in trigger, metadata and plan notes', () => {
    const service = new WorkflowRunService({
      persist: false,
    });
    const run = service.createRun('sdd', 'Executar loop SDD da feature', 'C:/repo', [
      {
        id: 'execution',
        executor: 'codex',
        role: 'execution',
        label: 'Codex Execution Agent',
        intro: 'Executando a task SDD atual.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ], null, {
      trigger: {
        task_kind: 'sdd_loop',
        task_subtype: 'execution',
        feature_id: 'multisurface/shared-command-contract',
      },
    });

    const metadata = service.buildTaskMetadata(run, run.stages[0] as any, 0, null, null);
    const notes = service.buildPlanNotes(run, run.stages[0] as any, null, null);

    expect(run.trigger).toEqual(expect.objectContaining({
      feature_id: 'multisurface/shared-command-contract',
    }));
    expect(metadata).toEqual(expect.objectContaining({
      workflow_name: 'sdd',
      workflow_trigger_feature_id: 'multisurface/shared-command-contract',
      workflow_trigger_task_kind: 'sdd_loop',
      workflow_trigger_task_subtype: 'execution',
      traceId: run.workflow_run_id,
      runId: run.workflow_run_id,
      sessionId: null,
      workflow_execution_lifecycle: expect.arrayContaining([
        expect.objectContaining({
          kind: 'run',
          status: 'planned',
        }),
      ]),
    }));
    expect(notes).toContain('feature=multisurface/shared-command-contract');
  });

  it('marks the workflow stage as blocked after a rejection decision', () => {
    const service = new WorkflowRunService({
      persist: false,
    });
    const run = service.createRun('review', 'Revisar pagamento', 'C:/repo', [
      {
        id: 'maker',
        executor: 'external_executor',
        role: 'maker',
        label: 'ExternalExecutor Maker',
        intro: 'Review inicial.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'maker', 'Revisar pagamento', null, 'task-maker-1');
    service.markStageInterrupted(run, 'maker', 'approval_pending', 'Aguardando sua approval.');

    const updated = service.applyStageApprovalDecision({
      workflowRunId: run.workflow_run_id,
      taskId: 'task-maker-1',
      action: 'reject',
      summary: 'Approval rejected pelo operador.',
    });

    expect(updated).toEqual(expect.objectContaining({
      workflow_run_id: run.workflow_run_id,
      status: 'blocked',
      resume_stage: expect.objectContaining({
        id: 'maker',
        status: 'blocked',
      }),
      actionable_stages: expect.arrayContaining([
        expect.objectContaining({
          id: 'maker',
          status: 'blocked',
          action: 'destravar',
        }),
      ]),
    }));
    expect(updated?.stages[0]).toEqual(expect.objectContaining({
      status: 'blocked',
      result_summary: 'Approval rejected pelo operador.',
    }));
    expect(updated?.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'approval',
        status: 'blocked',
      }),
      expect.objectContaining({
        kind: 'run',
        status: 'blocked',
      }),
    ]));
  });

  it('persists canonical approval decision events in the workflow ledger', () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-approval-events-'));
    const service = new WorkflowRunService({
      storageDir,
      persist: true,
      now: () => new Date('2026-04-03T17:00:00.000Z'),
    });

    const run = service.createRun('review', 'Revisar modulo critical', 'C:/repo', [
      {
        id: 'maker',
        executor: 'external_executor',
        role: 'maker',
        label: 'ExternalExecutor Maker',
        intro: 'Review inicial.',
        buildObjective: ({ originalObjective }) => originalObjective,
      },
    ]);

    service.markStageStarted(run, 'maker', 'Revisar modulo critical', null, 'task-maker-1');
    service.markStageInterrupted(run, 'maker', 'approval_pending', 'Waiting for approval.');
    service.applyStageApprovalDecision({
      workflowRunId: run.workflow_run_id,
      taskId: 'task-maker-1',
      action: 'reject',
      summary: 'The operator rejected the approval.',
    });

    const safeId = run.workflow_run_id.replace(/[^a-z0-9._-]+/gi, '-');
    const checkpointsFile = path.join(storageDir, safeId, 'checkpoints.ndjson');
    const ledgerFile = path.join(storageDir, safeId, 'ledger.json');
    const checkpoints = fs.readFileSync(checkpointsFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as any;
    const lastCheckpoint = checkpoints[checkpoints.length - 1];

    expect(lastCheckpoint).toEqual(expect.objectContaining({
      event: 'stage_rejected',
      previous_chain_hash: checkpoints[checkpoints.length - 2].chain_hash,
    }));
    expect(ledger).toEqual(expect.objectContaining({
      last_event: 'stage_rejected',
      latest_checkpoint_id: lastCheckpoint.checkpoint_id,
      latest_chain_hash: lastCheckpoint.chain_hash,
    }));
  });
});
