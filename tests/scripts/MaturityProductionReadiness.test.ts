import { spawnSync } from 'node:child_process';
import path from 'node:path';


const root = path.resolve(__dirname, '..', '..');
const scriptPath = path.join(root, 'scripts', 'maturity-production-readiness.mjs');

function runCli(args: string[] = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
}

/**
 * Import the pure check via a short ESM eval (Jest cannot dynamic-import .mjs
 * without --experimental-vm-modules).
 */
function runExportedCheck(): {
  status: number | null;
  stdout: string;
  stderr: string;
  report: any;
} {
  const scriptUrl = path.resolve(scriptPath).replace(/\\/g, '/');
  const href = `file:///${scriptUrl}`;
  const evalSource = [
    `import { runMaturityProductionReadiness } from ${JSON.stringify(href)};`,
    `const report = runMaturityProductionReadiness({ root: __dirname, env: process.env });`,
    `process.stdout.write(JSON.stringify(report));`,
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', evalSource], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });

  let report: any = null;
  if (result.status === 0 && result.stdout) {
    report = JSON.parse(result.stdout);
  }

  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    report,
  };
}

describe('maturity-production-readiness', () => {
  it('exports runMaturityProductionReadiness with contractVersion and pass checks', () => {
    const { status, stderr, report } = runExportedCheck();
    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(report).toBeTruthy();
    expect(report.contractVersion).toBe('maturity-production-readiness/1');
    expect(report.generatedAt).toEqual(expect.any(String));
    expect(['ready', 'needs_attention']).toContain(report.status);
    expect(Array.isArray(report.checks)).toBe(true);
    expect(report.checks.length).toBeGreaterThanOrEqual(7);

    const requiredIds = [
      'product-governance-doc',
      'react-island-sources',
      'desktop-electron-updater-modules',
      'memory-backend-v2',
      'natural-schedule-parser',
      'session-persistence-sqlite',
      'root-gate-scripts',
    ];
    for (const id of requiredIds) {
      const check = report.checks.find((entry: { id: string }) => entry.id === id);
      expect(check).toBeDefined();
      expect(check.status).toBe('pass');
    }

    const passCount = report.checks.filter((c: { status: string }) => c.status === 'pass').length;
    expect(passCount).toBeGreaterThanOrEqual(7);
    expect(report.message).toEqual(expect.any(String));
  });

  it('CLI --json prints the same contract and exits 0 by default', () => {
    const result = runCli(['--json']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.contractVersion).toBe('maturity-production-readiness/1');
    expect(payload.checks.some((c: { status: string }) => c.status === 'pass')).toBe(true);
    expect(payload.checks.map((c: { id: string }) => c.id)).toEqual(
      expect.arrayContaining(['product-governance-doc', 'react-island-sources', 'root-gate-scripts']),
    );
  });

  it('CLI --strict exits 0 when required checks pass', () => {
    const result = runCli(['--strict', '--json']);
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    const requiredFails = payload.checks.filter(
      (c: { required?: boolean; status: string }) => c.required && c.status === 'fail',
    );
    expect(requiredFails).toEqual([]);
  });
});
