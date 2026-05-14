import fs from 'fs';
import os from 'os';
import path from 'path';

describe('RuntimeArtifactMaintenanceService', () => {
  const tempRoots: string[] = [];

  function loadModule() {
    let RuntimeArtifactMaintenanceService: any;

    jest.isolateModules(() => {
      ({ RuntimeArtifactMaintenanceService } = require('../../src/services/RuntimeArtifactMaintenanceService'));
    });

    return { RuntimeArtifactMaintenanceService };
  }

  function createTempRoot(label: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `${label}-`));
    tempRoots.push(root);
    return root;
  }

  function writeProfile(root: string, name: string, size: number, modifiedAtMs: number): string {
    const targetDir = path.join(root, name);
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'artifact.txt'), 'x'.repeat(size), 'utf8');
    fs.utimesSync(targetDir, new Date(modifiedAtMs), new Date(modifiedAtMs));
    return targetDir;
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

  it('removes stale visual smoke profiles by TTL', () => {
    const root = createTempRoot('zavorth-visual-smoke-ttl');
    const now = Date.now();
    const staleDir = writeProfile(root, 'stale', 10, now - 10_000);
    const freshDir = writeProfile(root, 'fresh', 10, now);

    const { RuntimeArtifactMaintenanceService } = loadModule();
    const service = new RuntimeArtifactMaintenanceService({
      visualSmokeRoot: root,
      visualSmokeTtlMs: 1_000,
      visualSmokeMaxBytes: 1_000_000,
    });

    const summary = service.cleanupVisualSmokeProfiles();

    expect(summary.deletedEntries).toBe(1);
    expect(summary.freedBytes).toBeGreaterThan(0);
    expect(fs.existsSync(staleDir)).toBe(false);
    expect(fs.existsSync(freshDir)).toBe(true);
  });

  it('trims oldest visual smoke profiles when total size exceeds the limit', () => {
    const root = createTempRoot('zavorth-visual-smoke-size');
    const now = Date.now();
    const oldestDir = writeProfile(root, 'oldest', 6, now - 3_000);
    const middleDir = writeProfile(root, 'middle', 5, now - 2_000);
    const newestDir = writeProfile(root, 'newest', 4, now - 1_000);

    const { RuntimeArtifactMaintenanceService } = loadModule();
    const service = new RuntimeArtifactMaintenanceService({
      visualSmokeRoot: root,
      visualSmokeTtlMs: 60_000,
      visualSmokeMaxBytes: 8,
    });

    const summary = service.cleanupVisualSmokeProfiles();

    expect(summary.deletedEntries).toBe(2);
    expect(fs.existsSync(oldestDir)).toBe(false);
    expect(fs.existsSync(middleDir)).toBe(false);
    expect(fs.existsSync(newestDir)).toBe(true);
  });
});
