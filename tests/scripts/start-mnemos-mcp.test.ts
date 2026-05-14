import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

function readLauncherPlan(env: Record<string, string>) {
  const output = execFileSync(
    process.execPath,
    ['scripts/start-mnemos-mcp.mjs', '--print-args'],
    {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      encoding: 'utf8',
    },
  );
  return JSON.parse(output) as { args: string[]; scanDirs: string[]; vaultDir: string; dbDir: string };
}

describe('start-mnemos-mcp launcher', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  function tempDir(name: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), name));
    tempDirs.push(dir);
    return dir;
  }

  it('mounts multiple scan directories as indexed read-only volumes', () => {
    const vault = tempDir('mnemos-vault-');
    const db = tempDir('mnemos-db-');
    const scanA = tempDir('mnemos-scan-a-');
    const scanB = tempDir('mnemos-scan-b-');

    const plan = readLauncherPlan({
      MNEMOS_VAULT_DIR: vault,
      MNEMOS_DB_DIR: db,
      MNEMOS_SCAN_DIRS: `${scanA};${scanB}`,
    });

    expect(plan.args).toEqual(expect.arrayContaining(['--network', 'none']));
    expect(plan.args).toEqual(expect.arrayContaining(['-e', 'HF_HUB_OFFLINE=1']));
    expect(plan.args).toEqual(expect.arrayContaining(['-e', 'TRANSFORMERS_OFFLINE=1']));
    expect(plan.args).toContain(`${path.resolve(scanA)}:/scan_volumes/0:ro`);
    expect(plan.args).toContain(`${path.resolve(scanB)}:/scan_volumes/1:ro`);
    expect(plan.args).toContain(`${path.resolve(vault)}:/app/data/vault`);
    expect(plan.args).toContain(`${path.resolve(db)}:/app/data/vector_db`);
  });

  it('supports a single scan directory', () => {
    const scan = tempDir('mnemos-scan-single-');
    const plan = readLauncherPlan({
      MNEMOS_SCAN_DIRS: scan,
    });

    expect(plan.scanDirs).toEqual([path.resolve(scan)]);
    expect(plan.args).toContain(`${path.resolve(scan)}:/scan_volumes/0:ro`);
  });

  it('starts with no scan mounts when scan dirs are absent', () => {
    const plan = readLauncherPlan({
      MNEMOS_SCAN_DIRS: '',
    });

    expect(plan.scanDirs).toEqual([]);
    expect(plan.args.some((arg) => arg.includes('/scan_volumes/0'))).toBe(false);
  });
});
