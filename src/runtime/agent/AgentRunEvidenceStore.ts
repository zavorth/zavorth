import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';
import { redactPrivacyValue } from '../../privacy/PrivacyRedactor.js';

export type AgentRunEvidenceSnapshotRef = {
  id: string;
  key: string;
  runId: string;
  status: string | null;
  generatedAt: string | null;
  material: boolean;
};

export type AgentRunEvidenceStoreRecord = AgentRunEvidenceSnapshotRef & {
  snapshot: Record<string, unknown>;
  sequence: number;
};

export type AgentRunEvidenceSerializedRecord = AgentRunEvidenceSnapshotRef & {
  snapshot: Record<string, unknown>;
};

export type AgentRunEvidenceStoreSnapshot = {
  source: 'AgentRunEvidenceStore';
  phase: 4;
  refs: AgentRunEvidenceSnapshotRef[];
  records?: AgentRunEvidenceSerializedRecord[];
};

export type AgentRunEvidenceStoreAdapter = {
  put: (record: AgentRunEvidenceStoreRecord) => void;
  getLatestByKey: (runId: string, key: string) => AgentRunEvidenceStoreRecord | null;
  getByRef: (runId: string, refId: string) => AgentRunEvidenceStoreRecord | null;
  getHistoryByKey: (runId: string, key: string) => AgentRunEvidenceStoreRecord[];
  snapshot: (runId: string) => AgentRunEvidenceStoreRecord[];
};

export class InMemoryAgentRunEvidenceStoreAdapter implements AgentRunEvidenceStoreAdapter {
  private readonly recordsByRunId = new Map<string, Map<string, AgentRunEvidenceStoreRecord>>();
  private readonly latestRefByRunKey = new Map<string, Map<string, string>>();
  private readonly historyRefsByRunKey = new Map<string, Map<string, string[]>>();

  public put(record: AgentRunEvidenceStoreRecord): void {
    const records = this.recordsByRunId.get(record.runId) || new Map<string, AgentRunEvidenceStoreRecord>();
    records.set(record.id, record);
    this.recordsByRunId.set(record.runId, records);

    const latestRefs = this.latestRefByRunKey.get(record.runId) || new Map<string, string>();
    latestRefs.set(record.key, record.id);
    this.latestRefByRunKey.set(record.runId, latestRefs);

    const historyRefs = this.historyRefsByRunKey.get(record.runId) || new Map<string, string[]>();
    const keyHistory = historyRefs.get(record.key) || [];
    keyHistory.push(record.id);
    historyRefs.set(record.key, keyHistory);
    this.historyRefsByRunKey.set(record.runId, historyRefs);
  }

  public getLatestByKey(runId: string, key: string): AgentRunEvidenceStoreRecord | null {
    const latestRefId = this.latestRefByRunKey.get(runId)?.get(key);
    return latestRefId ? this.getByRef(runId, latestRefId) : null;
  }

  public getByRef(runId: string, refId: string): AgentRunEvidenceStoreRecord | null {
    return this.recordsByRunId.get(runId)?.get(refId) || null;
  }

  public getHistoryByKey(runId: string, key: string): AgentRunEvidenceStoreRecord[] {
    const records = this.recordsByRunId.get(runId);
    if (!records) {
      return [];
    }
    return (this.historyRefsByRunKey.get(runId)?.get(key) || [])
      .map((refId) => records.get(refId))
      .filter((record): record is AgentRunEvidenceStoreRecord => Boolean(record));
  }

  public snapshot(runId: string): AgentRunEvidenceStoreRecord[] {
    return Array.from(this.recordsByRunId.get(runId)?.values() || []);
  }
}

export class AgentRunEvidenceStore {
  private readonly adapter: AgentRunEvidenceStoreAdapter;

  constructor(adapter: AgentRunEvidenceStoreAdapter = new InMemoryAgentRunEvidenceStoreAdapter()) {
    this.adapter = adapter;
  }

  public put(
    run: UniversalAgentRun,
    key: string,
    snapshot: Record<string, unknown>,
    material = true,
  ): AgentRunEvidenceSnapshotRef {
    const runId = this.readRunId(run);
    const storedSnapshot = redactPrivacyValue(this.cloneSnapshot(snapshot));
    const sequence = this.adapter.getHistoryByKey(runId, key).length + 1;
    const id = this.buildRefId(run, key, storedSnapshot, sequence);
    const ref: AgentRunEvidenceSnapshotRef = {
      id,
      key,
      runId,
      status: this.readString(storedSnapshot.status),
      generatedAt: this.readString(storedSnapshot.generatedAt),
      material,
    };
    this.adapter.put({
      ...ref,
      snapshot: storedSnapshot,
      sequence,
    });
    this.attachRefs(run);
    return ref;
  }

  public get(run: UniversalAgentRun, key: string): Record<string, unknown> | null {
    const runId = this.readRunId(run);
    const record = this.adapter.getLatestByKey(runId, key);
    if (record) {
      return this.cloneSnapshot(record.snapshot);
    }
    const materialSnapshot = this.readRecord(run.metadata?.[key]);
    if (materialSnapshot) {
      return this.cloneSnapshot(materialSnapshot);
    }
    const serializedRecord = this.readSerializedRecords(run)
      .reverse()
      .find((entry) => entry.key === key);
    return serializedRecord ? this.cloneSnapshot(serializedRecord.snapshot) : null;
  }

  public getByRef(run: UniversalAgentRun, refId: string): Record<string, unknown> | null {
    const runId = this.readRunId(run);
    const record = this.adapter.getByRef(runId, refId);
    if (record) {
      return this.cloneSnapshot(record.snapshot);
    }
    const serializedRecord = this.readSerializedRecords(run).find((entry) => entry.id === refId);
    if (serializedRecord) {
      return this.cloneSnapshot(serializedRecord.snapshot);
    }
    const ref = this.readRefs(run).find((entry) => entry.id === refId);
    if (ref) {
      const materialSnapshot = this.readRecord(run.metadata?.[ref.key]);
      if (materialSnapshot) {
        return this.cloneSnapshot(materialSnapshot);
      }
    }
    return null;
  }

  public getHistory(run: UniversalAgentRun, key: string): Record<string, unknown>[] {
    const runId = this.readRunId(run);
    const records = this.adapter.getHistoryByKey(runId, key);
    const history = records.length > 0
      ? records.map((record) => record.snapshot)
      : this.readSerializedRecords(run)
        .filter((entry) => entry.key === key)
        .map((entry) => entry.snapshot);
    return history.map((snapshot) => this.cloneSnapshot(snapshot));
  }

  public snapshot(run: UniversalAgentRun): AgentRunEvidenceStoreSnapshot {
    const records = this.adapter.snapshot(this.readRunId(run));
    const latestFirstRecords = records.slice().sort((left, right) => right.sequence - left.sequence);
    const refs = records.length > 0
      ? latestFirstRecords.map((record) => ({
        id: record.id,
        key: record.key,
        runId: record.runId,
        status: record.status,
        generatedAt: record.generatedAt,
        material: record.material,
      }))
      : this.readRefs(run);
    const serializedRecords = this.readSerializedRecords(run);
    return {
      source: 'AgentRunEvidenceStore',
      phase: 4,
      refs,
      ...(serializedRecords.length > 0 ? { records: serializedRecords } : {}),
    };
  }

  private attachRefs(run: UniversalAgentRun): void {
    const snapshot = this.snapshot(run);
    const serializedRecords = this.buildSerializedRecords(run);
    run.metadata = {
      ...run.metadata,
      evidenceRefs: {
        ...snapshot,
        ...(serializedRecords.length > 0 ? { records: serializedRecords } : {}),
      },
    };
  }

  private buildRefId(
    run: UniversalAgentRun,
    key: string,
    snapshot: Record<string, unknown>,
    sequence: number,
  ): string {
    const generatedAt = this.readString(snapshot.generatedAt) || run.updatedAt || run.createdAt;
    return `evidence:${this.readRunId(run)}:${key}:${generatedAt}:${sequence}`;
  }

  private cloneSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
    try {
      return structuredClone(snapshot) as Record<string, unknown>;
    } catch {
      return { ...snapshot };
    }
  }

  private readString(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private readRunId(run: UniversalAgentRun): string {
    return this.readString(run.id) || 'unknown-run';
  }

  private readRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  }

  private readRefs(run: UniversalAgentRun): AgentRunEvidenceSnapshotRef[] {
    const evidenceRefs = this.readRecord(run.metadata?.evidenceRefs);
    const refs = Array.isArray(evidenceRefs?.refs) ? evidenceRefs.refs : [];
    return refs
      .map((entry) => this.readSnapshotRef(entry))
      .filter((entry): entry is AgentRunEvidenceSnapshotRef => Boolean(entry));
  }

  private readSerializedRecords(run: UniversalAgentRun): AgentRunEvidenceSerializedRecord[] {
    const evidenceRefs = this.readRecord(run.metadata?.evidenceRefs);
    const records = Array.isArray(evidenceRefs?.records) ? evidenceRefs.records : [];
    return records
      .map((entry) => this.readSerializedRecord(entry))
      .filter((entry): entry is AgentRunEvidenceSerializedRecord => Boolean(entry));
  }

  private readSnapshotRef(value: unknown): AgentRunEvidenceSnapshotRef | null {
    const record = this.readRecord(value);
    if (!record) {
      return null;
    }
    const id = this.readString(record.id);
    const key = this.readString(record.key);
    const runId = this.readString(record.runId);
    if (!id || !key || !runId) {
      return null;
    }
    return {
      id,
      key,
      runId,
      status: this.readString(record.status),
      generatedAt: this.readString(record.generatedAt),
      material: record.material === true,
    };
  }

  private readSerializedRecord(value: unknown): AgentRunEvidenceSerializedRecord | null {
    const ref = this.readSnapshotRef(value);
    const record = this.readRecord(value);
    const snapshot = this.readRecord(record?.snapshot);
    return ref && snapshot
      ? {
        ...ref,
        snapshot,
      }
      : null;
  }

  private buildSerializedRecords(run: UniversalAgentRun): AgentRunEvidenceSerializedRecord[] {
    const existing = this.readSerializedRecords(run);
    const existingIds = new Set(existing.map((record) => record.id));
    const newRecords = this.adapter.snapshot(this.readRunId(run))
      .filter((record) => !existingIds.has(record.id))
      .map((record) => ({
        id: record.id,
        key: record.key,
        runId: record.runId,
        status: record.status,
        generatedAt: record.generatedAt,
        material: record.material,
        snapshot: this.cloneSnapshot(record.snapshot),
      }));
    return [
      ...existing,
      ...newRecords,
    ];
  }
}
