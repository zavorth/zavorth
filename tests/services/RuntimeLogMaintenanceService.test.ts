import fs from 'fs';
import os from 'os';
import path from 'path';
import { RuntimeLogMaintenanceService } from '../../src/services/RuntimeLogMaintenanceService';

describe('RuntimeLogMaintenanceService', () => {
  const tempRoots: string[] = [];

  function loadModule() {
    return { RuntimeLogMaintenanceService };
  }

  function createTempRoot(label: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
    tempRoots.push(root);
    return root;
  }

  afterEach(() => {
    jest.resetModules();
    while (tempRoots.length > 0) {
      const target = tempRoots.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('rotates oversized nested runtime logs and caps retained files', () => {
    const root = createTempRoot('zavorth-runtime-logs');
    const nestedDir = path.join(root, 'workers');
    const targetLog = path.join(nestedDir, 'worker.log');
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(targetLog, '0123456789abcdef', 'utf8');
    fs.writeFileSync(`${targetLog}.1`, 'older', 'utf8');
    fs.writeFileSync(`${targetLog}.2`, 'oldest', 'utf8');

    const { RuntimeLogMaintenanceService } = loadModule();
    const service = new RuntimeLogMaintenanceService({
      runtimeDir: root,
      maxBytes: 8,
      maxFiles: 2,
    });

    const results = service.rotateOversizedLogs();

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      file: targetLog,
      rotated: true,
    });
    expect(fs.readFileSync(targetLog, 'utf8')).toBe('');
    expect(fs.readFileSync(`${targetLog}.1`, 'utf8')).toBe('0123456789abcdef');
    expect(fs.readFileSync(`${targetLog}.2`, 'utf8')).toBe('older');
    expect(fs.existsSync(`${targetLog}.3`)).toBe(false);
  });
});
