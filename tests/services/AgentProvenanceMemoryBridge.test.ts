import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  retryGovernedMemoryProvenanceRepairs,
  writeGovernedMemoryProvenance,
} from '../../src/services/AgentProvenanceMemoryBridge';
import { AgentProvenanceMemoryService } from '../../src/services/AgentProvenanceMemoryService';

describe('AgentProvenanceMemoryBridge', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-provenance-bridge-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('records provenance without duplicating memory content or user identity', () => {
    const result = writeGovernedMemoryProvenance({
      userId: 'private-user@example.com',
      key: 'private preference',
      value: 'a sensitive value that must stay encrypted',
      category: 'preference',
      sessionId: 'private-session',
      surface: 'test',
      eventId: 'event-1',
      projectRoot: root,
    });

    expect(result.ok).toBe(true);
    expect(result.record?.text).toMatch(/^memory-content-sha256:[a-f0-9]{64}$/u);
    const serialized = JSON.stringify(result.record);
    expect(serialized).not.toContain('sensitive value');
    expect(serialized).not.toContain('private-user@example.com');
    expect(serialized).not.toContain('private-session');
  });

  it('queues a bounded repair record when the provenance store fails', () => {
    jest.spyOn(AgentProvenanceMemoryService.prototype, 'write').mockImplementationOnce(() => {
      const error = new Error('simulated failure') as NodeJS.ErrnoException;
      error.code = 'EIO';
      throw error;
    });

    const result = writeGovernedMemoryProvenance({
      userId: 'private-user@example.com',
      key: 'secret-key',
      value: 'secret-value',
      eventId: 'event-2',
      projectRoot: root,
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      errorCode: 'EIO',
      repairQueued: true,
    }));
    const queue = path.join(root, 'data', 'runtime', 'memory', 'provenance-repair.jsonl');
    const stored = fs.readFileSync(queue, 'utf8');
    expect(stored).not.toContain('private-user@example.com');
    expect(stored).not.toContain('secret-key');
    expect(stored).not.toContain('secret-value');

    const repair = retryGovernedMemoryProvenanceRepairs(root);
    expect(repair).toEqual({ attempted: 1, repaired: 1, remaining: 0 });
    expect(fs.existsSync(queue)).toBe(false);
  });

  it('rejects a tampered repair record instead of writing it to another workspace', () => {
    jest.spyOn(AgentProvenanceMemoryService.prototype, 'write').mockImplementationOnce(() => {
      const error = new Error('simulated failure') as NodeJS.ErrnoException;
      error.code = 'EIO';
      throw error;
    });
    writeGovernedMemoryProvenance({
      userId: 'user',
      key: 'preference',
      value: 'value',
      projectRoot: root,
    });
    const queue = path.join(root, 'data', 'runtime', 'memory', 'provenance-repair.jsonl');
    const entry = JSON.parse(fs.readFileSync(queue, 'utf8')) as Record<string, any>;
    entry.record.workspaceId = 'workspace-tampered';
    fs.writeFileSync(queue, `${JSON.stringify(entry)}\n`, 'utf8');
    const writeSpy = jest.spyOn(AgentProvenanceMemoryService.prototype, 'write').mockClear();

    expect(retryGovernedMemoryProvenanceRepairs(root)).toEqual({ attempted: 0, repaired: 0, remaining: 0 });
    expect(writeSpy).not.toHaveBeenCalled();
    expect(fs.existsSync(queue)).toBe(false);
  });
});
