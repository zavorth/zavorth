import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ZavorthSnapshotRollbackTool } from '../../src/tools/ZavorthSnapshotRollbackTool';
import { ZavorthSnapshotRollbackService } from '../../src/services/snapshot/ZavorthSnapshotRollbackService';

describe('ZavorthSnapshotRollbackTool', () => {
  let tool: ZavorthSnapshotRollbackTool;
  let service: ZavorthSnapshotRollbackService;
  let tempDir: string;
  let sampleFile: string;

  beforeEach(() => {
    service = new ZavorthSnapshotRollbackService();
    tool = new ZavorthSnapshotRollbackTool(service);
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-tool-snap-'));
    sampleFile = path.join(tempDir, 'file.txt');
    fs.writeFileSync(sampleFile, 'Original Text', 'utf8');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch { /* intentionally empty */ }
  });

  it('should take a shadow snapshot and rollback files surgically via tool execution', async () => {
    const snapRes = await tool.execute({
      action: 'create_snapshot',
      snapshotId: 'tool-snap-1',
      filePaths: [sampleFile],
    });

    const parsedSnap = JSON.parse(snapRes);
    expect(parsedSnap.success).toBe(true);
    expect(parsedSnap.trackedFilesCount).toBe(1);

    // Modify file
    fs.writeFileSync(sampleFile, 'Modified Text', 'utf8');

    // Rollback via tool
    const rollbackRes = await tool.execute({
      action: 'rollback_files',
      snapshotId: 'tool-snap-1',
      filePaths: [sampleFile],
    });

    const parsedRollback = JSON.parse(rollbackRes);
    expect(parsedRollback.success).toBe(true);
    expect(parsedRollback.restoredFiles).toContain(sampleFile);
    expect(fs.readFileSync(sampleFile, 'utf8')).toBe('Original Text');
  });
});
