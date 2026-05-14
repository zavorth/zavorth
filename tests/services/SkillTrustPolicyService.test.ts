import { SkillTrustPolicyService } from '../../src/services/SkillTrustPolicyService.js';

describe('SkillTrustPolicyService', () => {
  it('allows workspace sources by default and denies unknown sources', () => {
    const service = new SkillTrustPolicyService({
      policyFile: 'X:/missing/skill-allowlist.json',
      existsSync: jest.fn(() => false),
    });

    expect(service.evaluateSource('workspace-agents')).toEqual(
      expect.objectContaining({
        allowed: true,
        sourceId: 'workspace-agents',
      }),
    );
    expect(service.evaluateSource('unknown-repository')).toEqual(
      expect.objectContaining({
        allowed: false,
        sourceId: 'unknown-repository',
        policyAction: 'require_admin_policy',
        policyReceipt: expect.objectContaining({
          surface: 'skill',
          action: 'require_admin_policy',
        }),
      }),
    );
  });

  it('enforces explicit allowlists per source', () => {
    const service = new SkillTrustPolicyService({
      policyFile: 'X:/tmp/skill-allowlist.json',
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() =>
        JSON.stringify({
          version: 1,
          defaultPolicy: 'deny',
          rules: [
            {
              sourceId: 'external-review-source',
              mode: 'explicit',
              skillNames: ['security-threat-model', 'skill-architect'],
            },
          ],
        }),
      ) as any,
    });

    expect(service.evaluateSource('external-review-source')).toEqual(
      expect.objectContaining({
        allowed: true,
        mode: 'explicit',
      }),
    );
    expect(service.evaluateSkill('external-review-source', 'security-threat-model')).toEqual(
      expect.objectContaining({
        allowed: true,
        skillName: 'security-threat-model',
      }),
    );
    expect(service.evaluateSkill('external-review-source', 'chrome-devtools')).toEqual(
      expect.objectContaining({
        allowed: false,
        skillName: 'chrome-devtools',
        policyAction: 'require_admin_policy',
      }),
    );
  });

  it('persists default policy updates back to the policy file', () => {
    const writeFileSync = jest.fn();
    const service = new SkillTrustPolicyService({
      policyFile: 'X:/tmp/skill-allowlist.json',
      existsSync: jest.fn(() => false),
      writeFileSync: writeFileSync as any,
      mkdirSync: jest.fn() as any,
      now: () => new Date('2026-04-12T11:30:00.000Z'),
    });

    const updated = service.setDefaultPolicy('allow');

    expect(updated.defaultPolicy).toBe('allow');
    expect(writeFileSync).toHaveBeenCalledWith(
      'X:/tmp/skill-allowlist.json',
      expect.stringContaining('"defaultPolicy": "allow"'),
      'utf8',
    );
  });
});
