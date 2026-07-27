import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkflowExternalizedStateService } from '../../src/services/WorkflowExternalizedStateService';

describe('WorkflowExternalizedStateService', () => {
  it('persists a resumable hash-chained state ledger for workflow runs', () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-workflow-ledger-'));
    const service = new WorkflowExternalizedStateService({
      storageDir,
      now: () => new Date('2026-04-03T16:00:00.000Z'),
    });

    const baseRun = {
      workflow_run_id: 'wf-sdd-abc123',
      workflow_name: 'sdd',
      objective: 'Executar loop SDD',
      workspace: 'C:/repo',
      status: 'running',
      updated_at: '2026-04-03T16:00:00.000Z',
      stages: [
        {
          id: 'execution',
          label: 'Codex Execution Agent',
          executor: 'codex',
          role: 'execution',
          index: 0,
          status: 'pending',
          task_id: null,
          attempt_count: 0,
          objective: null,
          handoff_summary: null,
          started_at: null,
          finished_at: null,
          result_summary: null,
          artifact_count: 0,
        },
      ],
      resume_stage: null,
    };

    const created = service.persist(baseRun, 'run_created');
    const interrupted = service.persist({
      ...baseRun,
      status: 'approval_pending',
      updated_at: '2026-04-03T16:05:00.000Z',
      resume_stage: {
        id: 'execution',
        label: 'Codex Execution Agent',
        executor: 'codex',
        status: 'approval_pending',
        index: 0,
        task_id: 'task-sdd-1',
        objective: 'Executar loop SDD',
        handoff_summary: 'Spec e plan readys',
        result_summary: 'Waiting for approval do operador',
        reason: 'waits for your confirmation before continuing',
      },
      stages: [
        {
          ...baseRun.stages[0],
          status: 'approval_pending',
          task_id: 'task-sdd-1',
          attempt_count: 1,
          objective: 'Executar loop SDD',
          handoff_summary: 'Spec e plan readys',
          result_summary: 'Waiting for approval do operador',
        },
      ],
    }, 'stage_interrupted');

    expect(created.checkpoint_count).toBe(1);
    expect(interrupted.checkpoint_count).toBe(2);
    expect(interrupted.latest_chain_hash).toBeTruthy();
    expect(interrupted.latest_chain_hash).not.toBe(created.latest_chain_hash);
    expect(interrupted.recent_checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sequence: 2,
          event: 'stage_interrupted',
          status: 'approval_pending',
        }),
        expect.objectContaining({
          sequence: 1,
          event: 'run_created',
          status: 'running',
        }),
      ]),
    );

    const checkpointsFile = path.join(storageDir, 'wf-sdd-abc123', 'checkpoints.ndjson');
    const checkpoints = fs.readFileSync(checkpointsFile, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    expect(checkpoints).toHaveLength(2);
    expect(checkpoints[0]).toEqual(expect.objectContaining({
      event: 'run_created',
      previous_chain_hash: null,
    }));
    expect(checkpoints[1]).toEqual(expect.objectContaining({
      event: 'stage_interrupted',
      previous_chain_hash: checkpoints[0].chain_hash,
      resume_stage_id: 'execution',
    }));

    const restored = service.readRun('wf-sdd-abc123');
    expect(restored).toEqual(expect.objectContaining({
      workflow_run_id: 'wf-sdd-abc123',
      status: 'approval_pending',
      externalized_state: expect.objectContaining({
        checkpoint_count: 2,
        latest_chain_hash: checkpoints[1].chain_hash,
      }),
    }));

    const described = service.describe('wf-sdd-abc123');
    expect(described).toEqual(expect.objectContaining({
      checkpoint_count: 2,
      latest_checkpoint_id: checkpoints[1].checkpoint_id,
      last_event: 'stage_interrupted',
      recent_checkpoints: expect.arrayContaining([
        expect.objectContaining({
          checkpoint_id: checkpoints[1].checkpoint_id,
          chain_hash: checkpoints[1].chain_hash,
        }),
      ]),
    }));
  });
});
