import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildOperationalSecurityDoctorReport,
  formatOperationalSecurityDoctorReport,
} from '../../src/security/OperationalSecurityDoctor';

const ROOT = path.resolve(__dirname, '..', '..');
const PRESET_PATH = path.join(ROOT, 'config', 'security-operational-preset.json');

function withAlignedProfessionalPreset<T>(run: () => T): T {
  const hadPreset = fs.existsSync(PRESET_PATH);
  const original = hadPreset ? fs.readFileSync(PRESET_PATH) : null;
  fs.mkdirSync(path.dirname(PRESET_PATH), { recursive: true });
  fs.writeFileSync(
    PRESET_PATH,
    `${JSON.stringify({
      version: 1,
      activePreset: 'professional',
      appliedAt: '2026-05-09T12:00:00.000Z',
      appliedBy: 'OperationalSecurityDoctor.test',
      securityProfile: 'professional',
      mcpProfile: 'safe',
      mcpAllowlist: [],
      skillDefaultPolicy: 'deny',
      skillAllowedSourceIds: ['zavorth-native', 'workspace-agents', 'workspace-library'],
      continuousSecurity: {
        strictByDefault: false,
        requireBaseline: false,
      },
      receipt: {
        id: 'security-preset:professional:test',
        summary: 'Preset professional for deterministic security doctor tests.',
      },
    }, null, 2)}\n`,
    'utf8',
  );
  try {
    return run();
  } finally {
    if (original) {
      fs.writeFileSync(PRESET_PATH, original);
    } else if (hadPreset === false) {
      fs.rmSync(PRESET_PATH, { force: true });
    }
  }
}

describe('OperationalSecurityDoctor', () => {
  it('reports a healthy daily posture when profile, approvals and controls are ready', () => {
    withAlignedProfessionalPreset(() => {
      const report = buildOperationalSecurityDoctorReport({
        projectRoot: ROOT,
        now: () => new Date('2026-05-09T12:00:00.000Z'),
        env: {
          ZAVORTH_SECURITY_PROFILE: 'professional',
          ZAVORTH_TOOL_APPROVAL_SIGNING_KEY: 's'.repeat(64),
        },
      });

      expect(report.ok).toBe(true);
      expect(report.status).toBe('healthy');
      expect(report.profile.id).toBe('professional');
      expect(report.summary.failed).toBe(0);
      expect(report.checks).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'security-profile', status: 'pass' }),
        expect.objectContaining({ id: 'approval-signing-key', status: 'pass' }),
        expect.objectContaining({ id: 'dangerous-env-overrides', status: 'pass' }),
        expect.objectContaining({ id: 'core-security-controls', status: 'pass' }),
        expect.objectContaining({ id: 'agent-security-inventory', status: 'pass' }),
      ]));
      expect(formatOperationalSecurityDoctorReport(report)).toContain('[zavorth-security] status: saudavel');
    });
  });

  it('warns on invalid security profile values without blocking normal use', () => {
    const report = buildOperationalSecurityDoctorReport({
      projectRoot: ROOT,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
      env: {
        ZAVORTH_SECURITY_PROFILE: 'enterprisee',
        ZAVORTH_TOOL_APPROVAL_SIGNING_KEY: 's'.repeat(64),
      },
    });

    expect(report.ok).toBe(true);
    expect(report.status).toBe('attention');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'security-profile',
        status: 'attention',
      }),
    ]));
    expect(report.nextSteps.map((step) => step.id)).toContain('security-profile');
  });

  it('blocks posture when dangerous egress overrides are enabled', () => {
    const report = buildOperationalSecurityDoctorReport({
      projectRoot: ROOT,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
      env: {
        ZAVORTH_SECURITY_PROFILE: 'enterprise',
        ZAVORTH_TOOL_APPROVAL_SIGNING_KEY: 's'.repeat(64),
        ALLOW_PRIVATE_EGRESS_TARGETS: 'true',
      },
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe('blocked');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'dangerous-env-overrides',
        status: 'fail',
        evidence: expect.arrayContaining([
          expect.stringContaining('ALLOW_PRIVATE_EGRESS_TARGETS'),
        ]),
      }),
    ]));
  });

  it('keeps missing local approval key ready on demand instead of creating files during doctor', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-security-doctor-'));
    const keyFile = path.join(tempDir, 'approval-signing-key');
    try {
      withAlignedProfessionalPreset(() => {
        const report = buildOperationalSecurityDoctorReport({
          projectRoot: ROOT,
          env: {
            ZAVORTH_SECURITY_PROFILE: 'professional',
            ZAVORTH_TOOL_APPROVAL_SIGNING_KEY_FILE: keyFile,
          },
        });

        expect(report.ok).toBe(true);
        expect(report.status).toBe('healthy');
        expect(report.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'approval-signing-key',
            status: 'pass',
            summary: expect.stringMatching(/sera criada automaticamente|será criada automaticamente|ready on demand|automaticamente/i),
          }),
        ]));
        expect(fs.existsSync(keyFile)).toBe(false);
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
