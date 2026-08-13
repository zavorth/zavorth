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
const PRESET_PATH = path.join(ROOT, 'config', 'security-operational-preset.json');

function securityEnv(): Record<string, string> {
  return {
    ZAVORTH_SECURITY_PROFILE: 'professional',
    ZAVORTH_TOOL_APPROVAL_SIGNING_KEY: 'c'.repeat(64),
  };
}

function withAlignedProfessionalPreset<T>(run: () => T): T {
  const mcpPath = path.join(ROOT, 'config', 'mcp-tool-policy.json');
  const skillPath = path.join(ROOT, 'config', 'skill-allowlist.json');
  const originals = {
    preset: fs.existsSync(PRESET_PATH) ? fs.readFileSync(PRESET_PATH) : null,
    mcp: fs.existsSync(mcpPath) ? fs.readFileSync(mcpPath) : null,
    skill: fs.existsSync(skillPath) ? fs.readFileSync(skillPath) : null,
  };
  fs.mkdirSync(path.dirname(PRESET_PATH), { recursive: true });
  fs.writeFileSync(
    PRESET_PATH,
    `${JSON.stringify({
      version: 1,
      activePreset: 'professional',
      appliedAt: '2026-05-09T12:00:00.000Z',
      appliedBy: 'ContinuousSecurityMonitor.test',
      securityProfile: 'professional',
      mcpProfile: 'safe',
      mcpAllowlist: ['create_file'],
      skillDefaultPolicy: 'deny',
      skillAllowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      continuousSecurity: {
        strictByDefault: false,
        requireBaseline: false,
      },
      receipt: {
        id: 'security-preset:professional:continuous-test',
        summary: 'Preset professional for deterministic continuous security tests.',
      },
    }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    mcpPath,
    `${JSON.stringify({
      version: 1,
      updatedAt: '2026-05-09T12:00:00.000Z',
      profile: 'safe',
      allowlist: ['create_file'],
    }, null, 2)}\n`,
    'utf8',
  );
  fs.writeFileSync(
    skillPath,
    `${JSON.stringify({
      version: 1,
      updatedAt: '2026-05-09T12:00:00.000Z',
      defaultPolicy: 'deny',
      allowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      rules: [
        { sourceId: 'zavorth-native', mode: 'all', reason: 'Official Zavorth-owned native intelligence pack.' },
        { sourceId: 'workspace-agents', mode: 'all', reason: 'Fonte principal de autoria local.' },
        { sourceId: 'workspace-library', mode: 'all', reason: 'Biblioteca local curada e mantida no proprio workspace.' },
        { sourceId: 'workspace-imported-library', mode: 'review', reason: 'Imports permanecem em revisao ate promocao explicita para uma fonte nativa ou curada.' },
      ],
    }, null, 2)}\n`,
    'utf8',
  );
  try {
    return run();
  } finally {
    if (originals.preset) fs.writeFileSync(PRESET_PATH, originals.preset);
    else fs.rmSync(PRESET_PATH, { force: true });
    if (originals.mcp) fs.writeFileSync(mcpPath, originals.mcp);
    if (originals.skill) fs.writeFileSync(skillPath, originals.skill);
  }
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
    withAlignedProfessionalPreset(() => {
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
        summary: expect.stringContaining('Fingerprint changed'),
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
    withAlignedProfessionalPreset(() => {
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
});
