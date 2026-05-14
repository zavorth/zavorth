import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProcessLockService } from '../../src/services/ProcessLockService';

describe('ProcessLockService', () => {
  it('recreates a missing lock file while the owner is still active', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-lock-'));
    const lockFilePath = path.join(tempDir, 'host-supervisor.lock.json');
    const service = new ProcessLockService(lockFilePath, {
      pid: 4242,
      kill: () => undefined,
    });

    service.acquire('host-supervisor');
    expect(fs.existsSync(lockFilePath)).toBe(true);

    fs.rmSync(lockFilePath, { force: true });
    expect(fs.existsSync(lockFilePath)).toBe(false);

    service.ensure('host-supervisor');

    const restored = JSON.parse(fs.readFileSync(lockFilePath, 'utf8')) as {
      pid: number;
      owner: string;
    };
    expect(restored.pid).toBe(4242);
    expect(restored.owner).toBe('host-supervisor');

    service.release();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
