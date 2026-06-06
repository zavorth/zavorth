import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildContinuousSecurityMonitorReport,
  fingerprintContinuousSecurityText,
  formatContinuousSecurityMonitorReport,
  writeContinuousSecurityBaseline,
} from '../../src/security/ContinuousSecurityMonitor';

const ROOT = path.resolve(__dirname, '..', '..');

function securityEnv(): Record<string, string> {
  return {
    ZAVORTH_SECURITY_PROFILE: 'professional',
    ZAVORTH_TOOL_APPROVAL_SIGNING_KEY: 'c'.repeat(64),
  };
}

describe('ContinuousSecurityMonitor', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-continuous-security-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('passes strict mode when doctor, commands, hooks, CI and baseline agree', () => {
    const baselinePath = path.join(tempDir, 'security-continuous-baseline.json');
    writeContinuousSecurityBaseline({
      projectRoot: ROOT,
      baselinePath,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    const report = buildContinuousSecurityMonitorReport({
      projectRoot: ROOT,
      baselinePath,
      strict: true,
      env: securityEnv(),
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe('healthy');
    expect(report.summary.drift).toBe(0);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'operational-security-doctor', status: 'pass' }),
      expect.objectContaining({ id: 'security-baseline', status: 'pass' }),
      expect.objectContaining({ id: 'security-command-catalog', status: 'pass' }),
      expect.objectContaining({ id: 'security-package-scripts', status: 'pass' }),
    ]));
    expect(formatContinuousSecurityMonitorReport(report)).toContain('[zavorth-security] continuous security monitor');
  });

  it('fails strict mode when a protected control drifts from the approved baseline', () => {
    const baselinePath = path.join(tempDir, 'security-continuous-baseline.json');
    writeContinuousSecurityBaseline({
      projectRoot: ROOT,
      baselinePath,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    baseline.snapshot.controls[0].sha256 = 'tampered-baseline-fingerprint';
    fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');

    const report = buildContinuousSecurityMonitorReport({
      projectRoot: ROOT,
      baselinePath,
      strict: true,
      env: securityEnv(),
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe('blocked');
    expect(report.drift).toEqual(expect.arrayContaining([
      expect.objectContaining({
        severity: 'warn',
        summary: expect.stringContaining('Fingerprint mudou'),
      }),
    ]));
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'security-baseline', status: 'fail' }),
    ]));
  });

  it('keeps fingerprints stable across Windows and Unix line endings', () => {
    expect(fingerprintContinuousSecurityText('line one\r\nline two\r\n')).toBe(
      fingerprintContinuousSecurityText('line one\nline two\n'),
    );
  });

  it('keeps missing baseline low-friction by default but can require it for CI', () => {
    const baselinePath = path.join(tempDir, 'missing-baseline.json');
    const dailyReport = buildContinuousSecurityMonitorReport({
      projectRoot: ROOT,
      baselinePath,
      env: securityEnv(),
    });
    const strictReport = buildContinuousSecurityMonitorReport({
      projectRoot: ROOT,
      baselinePath,
      requireBaseline: true,
      env: securityEnv(),
    });

    expect(dailyReport.ok).toBe(true);
    expect(dailyReport.status).toBe('attention');
    expect(strictReport.ok).toBe(false);
    expect(strictReport.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'security-baseline', status: 'fail' }),
    ]));
  });

  it('does not block strict CI when the approval key is ready on demand', () => {
    const baselinePath = path.join(tempDir, 'security-continuous-baseline.json');
    const approvalKeyPath = path.join(tempDir, 'approval-signing-key');
    writeContinuousSecurityBaseline({
      projectRoot: ROOT,
      baselinePath,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    const report = buildContinuousSecurityMonitorReport({
      projectRoot: ROOT,
      baselinePath,
      strict: true,
      env: {
        ZAVORTH_SECURITY_PROFILE: 'professional',
        ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE: approvalKeyPath,
      },
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'operational-security-doctor',
        status: 'pass',
        evidence: expect.arrayContaining(['approval-signing-key=ready-on-demand']),
      }),
    ]));
    expect(fs.existsSync(approvalKeyPath)).toBe(false);
  });
});
