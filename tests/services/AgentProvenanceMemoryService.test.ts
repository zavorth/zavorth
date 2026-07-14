import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgentProvenanceMemoryService } from '../../src/services/AgentProvenanceMemoryService.js';

describe('AgentProvenanceMemoryService', () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-memory-')); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it('persists provenance and isolates records by workspace', () => {
    const service = new AgentProvenanceMemoryService({ workspaceRoot: root, now: () => new Date('2026-07-14T00:00:00.000Z') });
    service.write({
      workspaceId: 'alpha', memoryId: 'preference-1', kind: 'preference', text: 'Use concise replies.', confidence: 0.9,
      source: { runtimeId: 'zavorth', sessionId: 'session-1', eventIds: ['event-1'], references: ['session:event-1'] },
    });
    expect(service.list('alpha')).toEqual([expect.objectContaining({ memoryId: 'preference-1', validity: 'active' })]);
    expect(service.list('beta')).toEqual([]);
  });

  it('rejects hidden memory without complete provenance', () => {
    const service = new AgentProvenanceMemoryService({ workspaceRoot: root });
    expect(() => service.write({
      workspaceId: 'alpha', memoryId: 'fact-1', kind: 'fact', text: 'A fact', confidence: 1,
      source: { runtimeId: 'zavorth', sessionId: 'session-1', eventIds: [], references: [] },
    })).toThrow('provenance');
  });

  it('expires, contests, and forgets records', () => {
    const service = new AgentProvenanceMemoryService({ workspaceRoot: root, now: () => new Date('2026-07-14T00:00:00.000Z') });
    service.write({ workspaceId: 'alpha', memoryId: 'context-1', kind: 'context', text: 'Temporary', confidence: 0.7,
      source: { runtimeId: 'zavorth', sessionId: 's1', eventIds: ['e1'], references: ['r1'] }, expiresAt: '2026-07-13T00:00:00.000Z' });
    expect(service.list('alpha')).toEqual([]);
    expect(service.list('alpha', { includeInactive: true })[0]?.validity).toBe('expired');
    expect(service.contest('alpha', 'context-1', 'User correction').validity).toBe('contested');
    expect(service.forget('alpha', 'context-1')).toBe(true);
    expect(service.list('alpha', { includeInactive: true })).toEqual([]);
  });
});
