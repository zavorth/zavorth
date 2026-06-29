import * as fs from 'fs';
import * as path from 'path';
import { TimeMachine } from '../../src/autonomy/TimeMachine';

describe('TimeMachine', () => {
  const tempDir = path.resolve(__dirname, 'temp-tm-workspace');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw on invalid workspace paths', async () => {
    await expect(TimeMachine.createSnapshot('')).rejects.toThrow('Invalid workspace path');
    await expect(TimeMachine.createSnapshot('   ')).rejects.toThrow('Invalid workspace path');
    await expect(TimeMachine.rollback('', 'id')).rejects.toThrow('Invalid workspace path');
    await expect(TimeMachine.rollback('   ', 'id')).rejects.toThrow('Invalid workspace path');
  });

  it('should throw when workspace path does not exist', async () => {
    const nonExistent = path.join(tempDir, 'does-not-exist');
    await expect(TimeMachine.createSnapshot(nonExistent)).rejects.toThrow('Workspace path does not exist');
    await expect(TimeMachine.rollback(nonExistent, 'id')).rejects.toThrow('Workspace path does not exist');
  });

  it('should backup and rollback files using local fallback when not a git repo', async () => {
    // 1. Setup files
    const file1 = path.join(tempDir, 'file1.txt');
    const file2 = path.join(tempDir, 'sub', 'file2.txt');
    fs.mkdirSync(path.dirname(file2), { recursive: true });
    fs.writeFileSync(file1, 'content1', 'utf8');
    fs.writeFileSync(file2, 'content2', 'utf8');

    // 2. Create snapshot
    const snapshotId = await TimeMachine.createSnapshot(tempDir);
    expect(snapshotId).toBeDefined();
    expect(snapshotId.startsWith('tm-')).toBe(true);

    // 3. Modify workspace
    fs.writeFileSync(file1, 'modified-content1', 'utf8');
    const file3 = path.join(tempDir, 'file3.txt');
    fs.writeFileSync(file3, 'content3', 'utf8');
    fs.unlinkSync(file2);

    expect(fs.readFileSync(file1, 'utf8')).toBe('modified-content1');
    expect(fs.existsSync(file2)).toBe(false);
    expect(fs.existsSync(file3)).toBe(true);

    // 4. Rollback
    const success = await TimeMachine.rollback(tempDir, snapshotId);
    expect(success).toBe(true);

    // 5. Verify restored state
    expect(fs.readFileSync(file1, 'utf8')).toBe('content1');
    expect(fs.readFileSync(file2, 'utf8')).toBe('content2');
    expect(fs.existsSync(file3)).toBe(false);
  });
});
