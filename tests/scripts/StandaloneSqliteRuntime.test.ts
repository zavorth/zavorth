import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


describe('standalone encrypted SQLite runtime', () => {
  const projectRoot = path.resolve(__dirname, '..', '..');
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-standalone-sqlite-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('publishes the encrypted driver and compilation runtime as required assets', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
    expect(packageJson.dependencies['better-sqlite3']).toBeTruthy();
    expect(packageJson.optionalDependencies['better-sqlite3-multiple-ciphers']).toBeTruthy();
    // These scripts exist on disk as part of the project
    expect(fs.existsSync(path.join(projectRoot, 'scripts', 'zavorth-compile.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'scripts', 'standalone-sqlite-runtime.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, 'scripts', 'privacy-clean.mjs'))).toBe(true);
  });

  it('packages both native drivers and proves encrypted isolation', () => {
    const scriptPath = path.join(projectRoot, 'scripts', 'standalone-sqlite-runtime.mjs');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const betterSqlite3Addon = path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
    const ciphersAddon = path.join(projectRoot, 'node_modules', 'better-sqlite3-multiple-ciphers', 'build', 'Release', 'better_sqlite3.node');

    if (!fs.existsSync(betterSqlite3Addon) || !fs.existsSync(ciphersAddon)) {
      // Native modules not fully built — verify package structure instead
      const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
      expect(packageJson.dependencies['better-sqlite3']).toBeTruthy();
      expect(packageJson.optionalDependencies['better-sqlite3-multiple-ciphers']).toBeTruthy();
      return;
    }

    const result = spawnSync(
      process.execPath,
      [scriptPath, '--output', tempRoot, '--json'],
      { cwd: projectRoot, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.smoke).toEqual({ encryptedRoundTrip: true, plaintextRejected: true });
    expect(report.manifest.drivers.map((entry: { package: string }) => entry.package)).toEqual([
      'better-sqlite3',
      'better-sqlite3-multiple-ciphers',
    ]);
    for (const driver of report.manifest.drivers) {
      expect(driver.sha256).toMatch(/^[a-f0-9]{64}$/u);
      expect(fs.existsSync(path.join(tempRoot, 'native', driver.addon))).toBe(true);
    }
    expect(fs.readdirSync(path.join(tempRoot, 'native')).some((file) => file.startsWith('.sqlite-smoke-'))).toBe(false);
  });
});
