import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthSessionContinuumService } from '../../../src/services/session/ZavorthSessionContinuumService';

describe('ZavorthSessionContinuumService', () => {
  let service: ZavorthSessionContinuumService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-session-test-'));
    service = new ZavorthSessionContinuumService({ storageDir: tempDir, maxSnapshots: 3 });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* intentionally empty */ }
  });

  it('should save and restore session snapshots transactionally', () => {
    const saved = service.saveSnapshot({
      sessionId: 'session-alpha-1',
      sessionTitle: 'Refactoring auth service',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      trackedFiles: ['src/auth.ts', 'src/tokens.ts'],
      metadata: { goal: 'Security upgrade' },
    });

    expect(saved).toBe(true);

    const restored = service.restoreSnapshot('session-alpha-1');
    expect(restored).not.toBeNull();
    expect(restored?.sessionTitle).toBe('Refactoring auth service');
    expect(restored?.trackedFiles).toContain('src/auth.ts');
  });

  it('should enforce circular LRU rotation when snapshots exceed max limit', () => {
    for (let i = 1; i <= 5; i++) {
      service.saveSnapshot({
        sessionId: `session-${i}`,
        createdAt: Date.now() + i * 100,
        updatedAt: Date.now() + i * 100,
      });
    }

    const list = service.listSnapshots();
    expect(list.length).toBeLessThanOrEqual(3);
    // Newest snapshots are kept
    expect(list.some((s) => s.sessionId === 'session-5')).toBe(true);
  });
});
