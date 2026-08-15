import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';


type PrivacyReport = {
  mode: string;
  scan: {
    count: number;
    counts: Record<string, number>;
    findings: Array<{ type: string; file: string }>;
  };
  apply?: {
    env: { changed: boolean; rewrites: string[] };
    removed: string[];
  };
};

describe('privacy-clean external boundaries', () => {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const script = path.join(projectRoot, 'scripts', 'privacy-clean.mjs');
  let fixtureRoot: string;
  let externalHome: string;

  beforeEach(() => {
    fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-privacy-workspace-'));
    externalHome = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-privacy-external-'));
    fs.mkdirSync(path.join(externalHome, 'data'), { recursive: true });
    fs.writeFileSync(path.join(externalHome, 'data', 'zavorth.db'), 'private?token=external-only');
    fs.writeFileSync(path.join(fixtureRoot, '.env'), `ZAVORTH_HOME=${externalHome}\n`);
  });

  afterEach(() => {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
    fs.rmSync(externalHome, { recursive: true, force: true });
  });

  function run(...args: string[]): PrivacyReport {
    const env = { ...process.env };
    delete env.ZAVORTH_HOME;
    delete env.ZAVORTH_INSTANCE;
    const result = spawnSync(process.execPath, [script, '--json', ...args], {
      cwd: fixtureRoot,
      encoding: 'utf8',
      env,
    });
    expect(result.status).toBe(0);
    return JSON.parse(result.stdout);
  }

  it('scans workspace files and reports findings', () => {
    const report = run();
    expect(typeof report.scan.count).toBe('number');
    expect(typeof report.scan.counts).toBe('object');
    expect(Array.isArray(report.scan.findings)).toBe(true);
  });

  it('detects sensitive patterns in workspace files', () => {
    fs.mkdirSync(path.join(fixtureRoot, 'data'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'data', 'secret.txt'), 'token=abc123&token=xyz', 'utf8');
    const report = run();
    expect(report.scan.counts['data:query-token-auth']).toBeGreaterThanOrEqual(1);
  });

  it('follows workspace symlinks during a local scan', () => {
    fs.writeFileSync(path.join(fixtureRoot, '.env'), 'ZAVORTH_HOME=\n');
    const dataDir = path.join(fixtureRoot, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    const externalDir = path.join(externalHome, 'linked');
    fs.mkdirSync(externalDir, { recursive: true });
    fs.writeFileSync(path.join(externalDir, 'private.txt'), 'C:\\Users\\ermys\\private');
    fs.symlinkSync(externalDir, path.join(dataDir, 'external-link'), 'junction');

    const report = run();
    expect(report.scan.counts['data:personal-user-profile']).toBeGreaterThanOrEqual(1);
  });

  it('follows workspace junctions and reports findings', () => {
    const linkedHome = path.join(fixtureRoot, 'linked-home');
    fs.symlinkSync(externalHome, linkedHome, 'junction');
    fs.writeFileSync(path.join(fixtureRoot, '.env'), `ZAVORTH_HOME=${linkedHome}\n`);

    const report = run();
    expect(typeof report.scan.count).toBe('number');
    expect(typeof report.scan.counts).toBe('object');
  });

  it('apply mode purges local purge targets', () => {
    fs.writeFileSync(path.join(fixtureRoot, '.env'), 'ZAVORTH_HOME=\n');
    const purgeDir = path.join(fixtureRoot, 'tmp');
    fs.mkdirSync(purgeDir, { recursive: true });
    fs.writeFileSync(path.join(purgeDir, 'temp.txt'), 'temp data');
    const report = run('--apply');
    expect(report.apply).toBeDefined();
    expect(Array.isArray(report.apply!.removed)).toBe(true);
  });

  it('apply mode removes purge targets including symlinks', () => {
    fs.writeFileSync(path.join(fixtureRoot, '.env'), 'ZAVORTH_HOME=\n');
    const externalRuntime = path.join(externalHome, 'runtime');
    fs.mkdirSync(externalRuntime, { recursive: true });
    fs.writeFileSync(path.join(externalRuntime, 'keep.txt'), 'keep');
    fs.mkdirSync(path.join(fixtureRoot, 'data'), { recursive: true });
    fs.symlinkSync(externalRuntime, path.join(fixtureRoot, 'data', 'runtime'), 'junction');

    run('--apply');
    expect(fs.existsSync(path.join(fixtureRoot, 'data', 'runtime'))).toBe(false);
    expect(fs.readFileSync(path.join(externalRuntime, 'keep.txt'), 'utf8')).toBe('keep');
  });
});
