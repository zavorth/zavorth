import fs from 'fs';
import path from 'path';
import type { AgentMemoryRecord, AgentMemoryWriteInput } from '../contracts/runtime/AgentRuntimeGovernanceContract.js';

type MemoryState = { version: 1; records: Record<string, AgentMemoryRecord> };

export class AgentProvenanceMemoryService {
  private readonly root: string;
  private readonly now: () => Date;

  public constructor(runtime: { workspaceRoot: string; now?: () => Date }) {
    this.root = path.resolve(runtime.workspaceRoot);
    this.now = runtime.now ?? (() => new Date());
  }

  public write(input: AgentMemoryWriteInput): AgentMemoryRecord {
    validateInput(input);
    const state = this.readState(input.workspaceId);
    const now = this.now().toISOString();
    const existing = state.records[input.memoryId];
    const record: AgentMemoryRecord = {
      ...input,
      text: input.text.trim(),
      source: { ...input.source, eventIds: [...input.source.eventIds], references: [...input.source.references] },
      expiresAt: input.expiresAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      validity: 'active',
      contestedReason: null,
    };
    state.records[input.memoryId] = record;
    this.writeState(input.workspaceId, state);
    return record;
  }

  public list(workspaceId: string, options: { includeInactive?: boolean } = {}): AgentMemoryRecord[] {
    validateId(workspaceId, 'workspaceId');
    const now = this.now().getTime();
    return Object.values(this.readState(workspaceId).records)
      .map((record) => activeRecord(record, now))
      .filter((record) => options.includeInactive === true || record.validity === 'active');
  }

  public contest(workspaceId: string, memoryId: string, reason: string): AgentMemoryRecord {
    validateId(workspaceId, 'workspaceId');
    validateId(memoryId, 'memoryId');
    if (!reason.trim()) throw new TypeError('reason is required.');
    const state = this.readState(workspaceId);
    const record = state.records[memoryId];
    if (!record) throw new Error('Memory record was not found.');
    record.validity = 'contested';
    record.contestedReason = reason.trim();
    record.updatedAt = this.now().toISOString();
    this.writeState(workspaceId, state);
    return record;
  }

  public forget(workspaceId: string, memoryId: string): boolean {
    validateId(workspaceId, 'workspaceId');
    validateId(memoryId, 'memoryId');
    const state = this.readState(workspaceId);
    if (!state.records[memoryId]) return false;
    delete state.records[memoryId];
    this.writeState(workspaceId, state);
    return true;
  }

  private file(workspaceId: string): string {
    validateId(workspaceId, 'workspaceId');
    return path.join(this.root, 'data', 'runtime', 'memory', `${workspaceId}.json`);
  }

  private readState(workspaceId: string): MemoryState {
    const file = this.file(workspaceId);
    if (!fs.existsSync(file)) return { version: 1, records: {} };
    const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isState(value)) throw new Error('The memory state file is invalid.');
    return value;
  }

  private writeState(workspaceId: string, state: MemoryState): void {
    const file = this.file(workspaceId);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporary, file);
  }
}

function validateInput(input: AgentMemoryWriteInput): void {
  validateId(input.workspaceId, 'workspaceId');
  validateId(input.memoryId, 'memoryId');
  if (!input.text.trim() || input.text.length > 16_384) throw new TypeError('text must contain between 1 and 16384 characters.');
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) throw new TypeError('confidence must be between 0 and 1.');
  validateId(input.source.runtimeId, 'source.runtimeId');
  validateId(input.source.sessionId, 'source.sessionId');
  if (input.source.eventIds.length === 0 || input.source.references.length === 0) throw new TypeError('Memory provenance requires event IDs and references.');
  if (input.expiresAt && !Number.isFinite(Date.parse(input.expiresAt))) throw new TypeError('expiresAt must be a valid timestamp.');
}

function validateId(value: string, field: string): void {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/u.test(value)) throw new TypeError(`${field} is invalid.`);
}

function activeRecord(record: AgentMemoryRecord, now: number): AgentMemoryRecord {
  if (record.validity === 'active' && record.expiresAt && Date.parse(record.expiresAt) <= now) return { ...record, validity: 'expired' };
  return record;
}

function isState(value: unknown): value is MemoryState {
  return typeof value === 'object' && value !== null && (value as { version?: unknown }).version === 1
    && typeof (value as { records?: unknown }).records === 'object' && (value as { records?: unknown }).records !== null;
}
