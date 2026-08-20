import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { ShadowCheckpointStoreService } from '../../../src/services/snapshot/ShadowCheckpointStoreService.js';

describe('ShadowCheckpointStoreService', () => {
  let tempRoot: string;
  let tempStore: string;
  let service: ShadowCheckpointStoreService;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ckpt-proj-'));
    tempStore = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ckpt-store-'));
    service = new ShadowCheckpointStoreService({
      projectRoot: tempRoot,
      storeRoot: tempStore,
    });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
      fs.rmSync(tempStore, { recursive: true, force: true });
    } catch {
      // Cleanup fail-safe
    }
  });

  it('creates a checkpoint manifest and stores content-addressed blobs', () => {
    const file1 = path.join(tempRoot, 'src', 'index.ts');
    fs.mkdirSync(path.dirname(file1), { recursive: true });
    fs.writeFileSync(file1, 'export const version = "1.0.0";\n', 'utf8');

    const manifest = service.createCheckpoint([file1], 'Initial release');

    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0].filePath).toBe(path.join('src', 'index.ts'));
    expect(manifest.description).toBe('Initial release');

    const checkpoints = service.listCheckpoints();
    expect(checkpoints).toHaveLength(1);
    expect(checkpoints[0].checkpointId).toBe(manifest.checkpointId);
  });

  it('rolls back modified files to exact checkpoint state', () => {
    const file1 = path.join(tempRoot, 'file.txt');
    fs.writeFileSync(file1, 'original content', 'utf8');

    const manifest = service.createCheckpoint([file1], 'Before edit');

    // Mutate file
    fs.writeFileSync(file1, 'corrupted content after bad edit', 'utf8');
    expect(fs.readFileSync(file1, 'utf8')).toBe('corrupted content after bad edit');

    const rollbackResult = service.rollbackCheckpoint(manifest.checkpointId);
    expect(rollbackResult.success).toBe(true);
    expect(rollbackResult.restoredFiles).toContain('file.txt');
    expect(fs.readFileSync(file1, 'utf8')).toBe('original content');
  });

  it('computes diff status accurately against current workspace state', () => {
    const file1 = path.join(tempRoot, 'a.txt');
    const file2 = path.join(tempRoot, 'b.txt');
    fs.writeFileSync(file1, 'hello', 'utf8');
    fs.writeFileSync(file2, 'world', 'utf8');

    const manifest = service.createCheckpoint([file1, file2], 'Two files');

    // Mutate file1 and delete file2
    fs.writeFileSync(file1, 'hello modified', 'utf8');
    fs.rmSync(file2);

    const diffs = service.getDiff(manifest.checkpointId);
    const diff1 = diffs.find((d) => d.filePath === 'a.txt');
    const diff2 = diffs.find((d) => d.filePath === 'b.txt');

    expect(diff1?.status).toBe('modified');
    expect(diff2?.status).toBe('deleted');
  });

  it('rolls back the last checkpoint using rollbackLastCheckpoint', () => {
    const file = path.join(tempRoot, 'state.json');
    fs.writeFileSync(file, JSON.stringify({ count: 1 }), 'utf8');

    service.createCheckpoint([file], 'Count 1');

    fs.writeFileSync(file, JSON.stringify({ count: 99 }), 'utf8');

    const result = service.rollbackLastCheckpoint();
    expect(result.success).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe(JSON.stringify({ count: 1 }));
  });
});
