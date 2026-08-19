import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthSnapshotRollbackService } from '../../../src/services/snapshot/ZavorthSnapshotRollbackService';

describe('ZavorthSnapshotRollbackService', () => {
  let service: ZavorthSnapshotRollbackService;
  let tempDir: string;
  let fileA: string;
  let fileB: string;

  beforeEach(() => {
    service = new ZavorthSnapshotRollbackService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-snapshot-test-'));
    fileA = path.join(tempDir, 'fileA.txt');
    fileB = path.join(tempDir, 'fileB.txt');
    fs.writeFileSync(fileA, 'Initial Content A', 'utf8');
    fs.writeFileSync(fileB, 'Initial Content B', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Cleanup safety
    }
  });

  it('should take shadow snapshot and calculate SHA-256 checksums', () => {
    const snap = service.createSnapshot('snap-1', [fileA, fileB], 'Pre-test snapshot');

    expect(snap.entries.size).toBe(2);
    expect(snap.entries.get(fileA)?.originalContent).toBe('Initial Content A');
    expect(snap.entries.get(fileA)?.sha256Checksum.length).toBe(64);
  });

  it('should surgically rollback only selected failing files while preserving valid edits on other files', () => {
    service.createSnapshot('snap-2', [fileA, fileB]);

    // Modify both files
    fs.writeFileSync(fileA, 'Corrupted Content A', 'utf8');
    fs.writeFileSync(fileB, 'Valid Updated Content B', 'utf8');

    // Surgically rollback ONLY fileA
    const rollback = service.rollbackSpecificFiles('snap-2', [fileA]);

    expect(rollback.success).toBe(true);
    expect(rollback.restoredFiles).toContain(fileA);
    expect(rollback.skippedFiles).not.toContain(fileA);

    // Verify fileA was restored and fileB was untouched
    expect(fs.readFileSync(fileA, 'utf8')).toBe('Initial Content A');
    expect(fs.readFileSync(fileB, 'utf8')).toBe('Valid Updated Content B');
  });

  it('should return failure if attempting to rollback from non-existent snapshot', () => {
    const result = service.rollbackSpecificFiles('non-existent-snap', [fileA]);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
