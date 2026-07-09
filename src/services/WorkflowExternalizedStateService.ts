import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

type ExternalizedWorkflowRunSnapshot = {
  workflow_run_id: string;
  workflow_name: string;
  objective: string;
  workspace: string;
  status: string;
  updated_at: string;
  phases: Array<{
    id: string;
    label: string;
    executor: string;
    role: string;
    index: number;
    status: string;
    task_id: string | null;
    attempt_count: number;
    objective: string | null;
    handoff_summary: string | null;
    started_at: string | null;
    finished_at: string | null;
    result_summary: string | null;
    artifact_count: number;
  }>;
  resume_stage?: {
    id: string;
    label: string;
    executor: string;
    status: string;
    index: number;
    task_id: string | null;
    objective: string | null;
    handoff_summary: string | null;
    result_summary: string | null;
    reason: string;
  } | null;
  externalized_state?: WorkflowRunExternalizedStateSnapshot | null;
  [key: string]: unknown;
};

export type WorkflowRunExternalizedStateSnapshot = {
  run_dir: string;
  state_file: string;
  compatibility_state_file: string;
  checkpoints_file: string;
  ledger_file: string;
  latest_checkpoint_id: string | null;
  checkpoint_count: number;
  latest_state_hash: string | null;
  latest_chain_hash: string | null;
  last_event: string | null;
  recent_checkpoints: WorkflowCheckpointReplaySnapshot[];
};

export type WorkflowCheckpointReplaySnapshot = {
  checkpoint_id: string;
  sequence: number;
  event: string;
  status: string;
  updated_at: string | null;
  resume_stage_id: string | null;
  chain_hash: string;
  previous_chain_hash: string | null;
};

type WorkflowCheckpointRecord = WorkflowCheckpointReplaySnapshot & {
  checkpoint_id: string;
  sequence: number;
  workflow_run_id: string;
  workflow_name: string;
  state_hash: string;
  phases: Array<{
    id: string;
    status: string;
    task_id: string | null;
    attempt_count: number;
  }>;
};

type WorkflowLedgerRecord = {
  version: 1;
  workflow_run_id: string;
  updated_at: string;
  latest_checkpoint_id: string | null;
  checkpoint_count: number;
  latest_state_hash: string | null;
  latest_chain_hash: string | null;
  last_event: string | null;
  paths: {
    run_dir: string;
    state_file: string;
    compatibility_state_file: string;
    checkpoints_file: string;
    ledger_file: string;
  };
};

type WorkflowStateEnvelope = {
  version: 1;
  persisted_at: string;
  event: string;
  run: ExternalizedWorkflowRunSnapshot;
};

type WorkflowExternalizedStateRuntime = {
  storageDir: string;
  now?: () => Date;
};

export class WorkflowExternalizedStateService {
  private readonly storageDir: string;
  private readonly now: () => Date;

  constructor(runtime: WorkflowExternalizedStateRuntime) {
    this.storageDir = runtime.storageDir;
    this.now = runtime.now || (() => new Date());
  }

  public persist(
    run: ExternalizedWorkflowRunSnapshot,
    event: string,
  ): WorkflowRunExternalizedStateSnapshot {
    const workflowRunId = String(run.workflow_run_id || '').trim();
    const timestamp = this.now().toISOString();
    const runDir = this.getRunDirectory(workflowRunId);
    const stateFile = this.getStateFilePath(workflowRunId);
    const compatibilityStateFile = this.getCompatibilityStateFilePath(workflowRunId);
    const checkpointsFile = this.getCheckpointsFilePath(workflowRunId);
    const ledgerFile = this.getLedgerFilePath(workflowRunId);
    const previousLedger = this.readLedger(workflowRunId);
    const checkpointSequence = Number(previousLedger?.checkpoint_count || 0) + 1;
    const checkpointId = `${this.toSafeId(workflowRunId)}-cp-${String(checkpointSequence).padStart(4, '0')}`;
    const canonicalRun = this.stripExternalizedState(run);
    const stateHash = this.hash(this.stableSerialize(canonicalRun));
    const previousChainHash = previousLedger?.latest_chain_hash || null;
    const checkpoint: WorkflowCheckpointRecord = {
      checkpoint_id: checkpointId,
      sequence: checkpointSequence,
      workflow_run_id: workflowRunId,
      workflow_name: String(run.workflow_name || '').trim(),
      event: String(event || '').trim() || 'state_updated',
      status: String(run.status || '').trim(),
      updated_at: String(run.updated_at || timestamp).trim() || timestamp,
      state_hash: stateHash,
      previous_chain_hash: previousChainHash,
      chain_hash: this.hash(this.stableSerialize({
        workflow_run_id: workflowRunId,
        checkpoint_id: checkpointId,
        sequence: checkpointSequence,
        event,
        previous_chain_hash: previousChainHash,
        state_hash: stateHash,
        updated_at: String(run.updated_at || timestamp).trim() || timestamp,
      })),
      resume_stage_id: String(run.resume_stage?.id || '').trim() || null,
      phases: Array.isArray(run.phases)
        ? run.phases.map((phase) => ({
            id: String(phase?.id || '').trim(),
            status: String(phase?.status || '').trim(),
            task_id: String(phase?.task_id || '').trim() || null,
            attempt_count: Math.max(0, Number(phase?.attempt_count || 0)),
          }))
        : [],
    };

    const ledger: WorkflowLedgerRecord = {
      version: 1,
      workflow_run_id: workflowRunId,
      updated_at: timestamp,
      latest_checkpoint_id: checkpoint.checkpoint_id,
      checkpoint_count: checkpoint.sequence,
      latest_state_hash: checkpoint.state_hash,
      latest_chain_hash: checkpoint.chain_hash,
      last_event: checkpoint.event,
      paths: {
        run_dir: runDir,
        state_file: stateFile,
        compatibility_state_file: compatibilityStateFile,
        checkpoints_file: checkpointsFile,
        ledger_file: ledgerFile,
      },
    };

    fs.mkdirSync(runDir, { recursive: true });
    fs.appendFileSync(checkpointsFile, `${JSON.stringify(checkpoint)}\n`, 'utf8');
    fs.writeFileSync(ledgerFile, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');

    const externalizedState = this.describe(workflowRunId);
    const runWithState: ExternalizedWorkflowRunSnapshot = {
      ...canonicalRun,
      externalized_state: externalizedState,
    };
    const envelope: WorkflowStateEnvelope = {
      version: 1,
      persisted_at: timestamp,
      event: checkpoint.event,
      run: runWithState,
    };

    fs.writeFileSync(stateFile, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
    fs.writeFileSync(compatibilityStateFile, `${JSON.stringify(runWithState, null, 2)}\n`, 'utf8');

    return externalizedState;
  }

  public readRun(workflowRunId: string): ExternalizedWorkflowRunSnapshot | null {
    const stateFile = this.getStateFilePath(workflowRunId);
    if (fs.existsSync(stateFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as WorkflowStateEnvelope;
        if (parsed?.run && typeof parsed.run === 'object') {
          return parsed.run;
        }
      } catch (error: any) {
      // fallback below
      logger.warn('[Workflow Externalized State] JSON parse failed', error);
    }
    }

    const compatibilityFile = this.getCompatibilityStateFilePath(workflowRunId);
    if (!fs.existsSync(compatibilityFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(compatibilityFile, 'utf8')) as ExternalizedWorkflowRunSnapshot;
    } catch (error: any) { logger.warn('[Workflow Externalized State] JSON parse failed', error); return null; }
  }

  public readAllRuns(): ExternalizedWorkflowRunSnapshot[] {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    const merged = new Map<string, ExternalizedWorkflowRunSnapshot>();
    const entries = fs.readdirSync(this.storageDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const run = this.readRun(entry.name);
        if (run?.workflow_run_id) {
          merged.set(String(run.workflow_run_id), run);
        }
      }
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) {
        continue;
      }
      const targetPath = path.join(this.storageDir, entry.name);
      try {
        const parsed = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as ExternalizedWorkflowRunSnapshot;
        const workflowRunId = String(parsed?.workflow_run_id || '').trim();
        if (workflowRunId && !merged.has(workflowRunId)) {
          merged.set(workflowRunId, parsed);
        }
      } catch (error: any) {
      // ignore broken files during listing
      logger.warn('[Workflow Externalized State] JSON parse failed', error);
    }
    }

    return Array.from(merged.values());
  }

  public describe(workflowRunId: string): WorkflowRunExternalizedStateSnapshot {
    const ledger = this.readLedger(workflowRunId);
    return {
      run_dir: this.getRunDirectory(workflowRunId),
      state_file: this.getStateFilePath(workflowRunId),
      compatibility_state_file: this.getCompatibilityStateFilePath(workflowRunId),
      checkpoints_file: this.getCheckpointsFilePath(workflowRunId),
      ledger_file: this.getLedgerFilePath(workflowRunId),
      latest_checkpoint_id: ledger?.latest_checkpoint_id || null,
      checkpoint_count: Number(ledger?.checkpoint_count || 0),
      latest_state_hash: ledger?.latest_state_hash || null,
      latest_chain_hash: ledger?.latest_chain_hash || null,
      last_event: ledger?.last_event || null,
      recent_checkpoints: this.readRecentCheckpoints(workflowRunId),
    };
  }

  private readLedger(workflowRunId: string): WorkflowLedgerRecord | null {
    const ledgerFile = this.getLedgerFilePath(workflowRunId);
    if (!fs.existsSync(ledgerFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(ledgerFile, 'utf8')) as WorkflowLedgerRecord;
    } catch (error: any) { logger.warn('[Workflow Externalized State] JSON parse failed', error); return null; }
  }

  private readRecentCheckpoints(
    workflowRunId: string,
    limit = 4,
  ): WorkflowRunExternalizedStateSnapshot['recent_checkpoints'] {
    const checkpointsFile = this.getCheckpointsFilePath(workflowRunId);
    if (!fs.existsSync(checkpointsFile)) {
      return [];
    }

    try {
      return fs.readFileSync(checkpointsFile, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as WorkflowCheckpointRecord)
        .slice(-Math.max(1, limit))
        .reverse()
        .map((checkpoint) => ({
          checkpoint_id: checkpoint.checkpoint_id,
          sequence: checkpoint.sequence,
          event: checkpoint.event,
          status: checkpoint.status,
          updated_at: checkpoint.updated_at || null,
          resume_stage_id: checkpoint.resume_stage_id || null,
          chain_hash: checkpoint.chain_hash,
          previous_chain_hash: checkpoint.previous_chain_hash || null,
        }));
    } catch (error: any) { logger.warn('[Workflow Externalized State] filesystem check failed', error); return []; }
  }

  private getRunDirectory(workflowRunId: string): string {
    return path.join(this.storageDir, this.toSafeId(workflowRunId));
  }

  private getStateFilePath(workflowRunId: string): string {
    return path.join(this.getRunDirectory(workflowRunId), 'state.json');
  }

  private getCompatibilityStateFilePath(workflowRunId: string): string {
    return path.join(this.storageDir, `${this.toSafeId(workflowRunId)}.json`);
  }

  private getCheckpointsFilePath(workflowRunId: string): string {
    return path.join(this.getRunDirectory(workflowRunId), 'checkpoints.ndjson');
  }

  private getLedgerFilePath(workflowRunId: string): string {
    return path.join(this.getRunDirectory(workflowRunId), 'ledger.json');
  }

  private toSafeId(value: string): string {
    return String(value || '').trim().replace(/[^a-z0-9._-]+/gi, '-');
  }

  private stripExternalizedState(run: ExternalizedWorkflowRunSnapshot): ExternalizedWorkflowRunSnapshot {
    const clone = JSON.parse(JSON.stringify(run)) as ExternalizedWorkflowRunSnapshot;
    delete clone.externalized_state;
    return clone;
  }

  private hash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableSerialize(entry)).join(',')}]`;
    }

    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${this.stableSerialize(record[key])}`).join(',')}}`;
  }
}
