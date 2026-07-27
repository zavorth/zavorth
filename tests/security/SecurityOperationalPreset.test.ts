import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  applySecurityOperationalPreset,
  formatApplySecurityOperationalPresetResult,
  formatSecurityOperationalPresetInspection,
  getSecurityOperationalPreset,
  inspectSecurityOperationalPreset,
  listSecurityOperationalPresets,
} from '../../src/security/SecurityOperationalPreset';
import { resolveSecurityProfile } from '../../src/security/SecurityProfile';

import { McpToolPolicy } from '../../src/mcp/McpToolPolicy';
import { SkillTrustPolicyService } from '../../src/services/SkillTrustPolicyService';

describe('SecurityOperationalPreset', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-security-preset-'));
    fs.mkdirSync(path.join(root, 'config'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lists real presets for personal, professional and enterprise operation', () => {
    expect(listSecurityOperationalPresets().map((preset) => preset.id)).toEqual([
      'personal',
      'professional',
      'enterprise',
    ]);
    expect(getSecurityOperationalPreset('dona maria')?.id).toBe('personal');
    expect(getSecurityOperationalPreset('bigtech')?.id).toBe('enterprise');
  });

  it('applies the professional preset across profile, MCP and skill trust policy', () => {
    const result = applySecurityOperationalPreset({
      preset: 'professional',
      projectRoot: root,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
      appliedBy: 'test',
    });

    expect(result.state).toEqual(expect.objectContaining({
      activePreset: 'professional',
      securityProfile: 'professional',
      mcpProfile: 'safe',
      mcpAllowlist: ['create_file'],
      skillDefaultPolicy: 'deny',
    }));
    expect(formatApplySecurityOperationalPresetResult(result)).toContain('preset aplicado');

    expect(resolveSecurityProfile({ projectRoot: root, env: {} }).source).toBe('preset');
    expect(resolveSecurityProfile({ projectRoot: root, env: {} }).profile.id).toBe('professional');

    const mcpPolicy = McpToolPolicy.fromEnv({}, {
      policyFile: path.join(root, 'config', 'mcp-tool-policy.json'),
    });
    expect(mcpPolicy.decide('create_file').allowed).toBe(true);
    expect(mcpPolicy.decide('remote_shell').allowed).toBe(false);

    const skillPolicy = new SkillTrustPolicyService({
      projectRoot: root,
      policyFile: path.join(root, 'config', 'skill-allowlist.json'),
    });
    expect(skillPolicy.evaluateSkill('zavorth-native', 'task-planning').allowed).toBe(true);
    expect(skillPolicy.evaluateSource('workspace-imported-library').allowed).toBe(true);
    expect(skillPolicy.evaluateSkill('workspace-imported-library', 'security-threat-model').allowed).toBe(false);
    expect(skillPolicy.evaluateSkill('external-review-source', 'security-threat-model').allowed).toBe(false);
  });

  it('keeps enterprise signals stronger than a personal preset', () => {
    applySecurityOperationalPreset({
      preset: 'personal',
      projectRoot: root,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    const resolution = resolveSecurityProfile({
      projectRoot: root,
      env: {
        ZAVORTH_ENTERPRISE_MODE: '1',
      },
    });

    expect(resolution.profile.id).toBe('enterprise');
    expect(resolution.source).toBe('enterprise-signal');
  });

  it('inspects missing and active presets in user-readable form', () => {
    expect(inspectSecurityOperationalPreset({ projectRoot: root }).status).toBe('attention');

    applySecurityOperationalPreset({
      preset: 'enterprise',
      projectRoot: root,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });

    const inspection = inspectSecurityOperationalPreset({ projectRoot: root });
    expect(inspection.status).toBe('ready');
    expect(inspection.preset?.id).toBe('enterprise');
    expect(formatSecurityOperationalPresetInspection(inspection)).toContain('Preset active');
  });

  it('detects semantic drift after a preset policy file is edited', () => {
    applySecurityOperationalPreset({
      preset: 'professional',
      projectRoot: root,
      now: () => new Date('2026-05-09T12:00:00.000Z'),
    });
    fs.writeFileSync(path.join(root, 'config', 'mcp-tool-policy.json'), JSON.stringify({
      version: 1,
      profile: 'dangerous',
      allowlist: ['remote_shell'],
    }, null, 2), 'utf8');

    const inspection = inspectSecurityOperationalPreset({ projectRoot: root });

    expect(inspection.status).toBe('attention');
    expect(inspection.evidence.join(' ')).toContain('mcp.profile=dangerous');
    expect(inspection.recommendations.join(' ')).toContain('professional --apply');
  });
});
