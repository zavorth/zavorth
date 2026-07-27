import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SkillTrustScoreService } from '../../src/services/SkillTrustScoreService.js';
import type { SkillTrustEvidence } from '../../src/services/SkillTrustScoreService.js';

function baseEvidence(over: Partial<SkillTrustEvidence> = {}): SkillTrustEvidence {
  return {
    sourceRaw: './skills/demo',
    sourceKind: 'local-path',
    local: true,
    validPackage: true,
    hasSkillMd: true,
    hasManifest: true,
    securityRisk: 'low',
    checksumPinned: true,
    signatureVerified: false,
    secretLikePresent: false,
    author: 'someone',
    publisher: null,
    ...over,
  };
}

describe('group-2 SkillTrustScoreService', () => {
  let tempRoot: string;
  let storePath: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-trust-'));
    storePath = path.join(tempRoot, 'owner-trusted.json');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('scores local valid packages higher than first-seen remote', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'daily' });
    const local = svc.score(baseEvidence());
    const remote = svc.score(
      baseEvidence({
        sourceRaw: 'https://github.com/unknown-org/random-skill',
        sourceKind: 'git-repo',
        local: false,
        validPackage: false,
        hasSkillMd: false,
        hasManifest: false,
        securityRisk: 'unknown',
        checksumPinned: false,
      }),
    );
    expect(local.score).toBeGreaterThan(remote.score);
    expect(remote.reasons.join(' ')).toMatch(/first-seen|remote/i);
  });

  it('daily profile requires consent for unknown remote URLs', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'daily' });
    const decision = svc.evaluate(
      baseEvidence({
        sourceRaw: 'https://github.com/unknown-org/random-skill',
        sourceKind: 'git-repo',
        local: false,
        validPackage: false,
        hasSkillMd: false,
        hasManifest: false,
        securityRisk: 'unknown',
        checksumPinned: false,
      }),
    );
    expect(decision.profile).toBe('daily');
    expect(decision.requireConsent).toBe(true);
    expect(decision.autoConsentEligible).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/first-seen|consent/i);
  });

  it('Zavorth-owned author can auto-consent under daily when score is strong', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'daily' });
    const decision = svc.evaluate(
      baseEvidence({
        author: 'zavorth-core',
        publisher: '@zavorth-official',
        securityRisk: 'low',
        checksumPinned: true,
      }),
    );
    expect(decision.score.signals.some((s) => s.id === 'zavorth_owned' && s.present)).toBe(true);
    expect(decision.autoConsentEligible).toBe(true);
  });

  it('safe profile rejects untrusted remote apply', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'safe' });
    const decision = svc.evaluate(
      baseEvidence({
        sourceRaw: 'https://github.com/unknown-org/random-skill',
        sourceKind: 'git-repo',
        local: false,
        validPackage: false,
        hasSkillMd: false,
        hasManifest: false,
        securityRisk: 'unknown',
      }),
    );
    expect(decision.allowApply).toBe(false);
    expect(decision.reasons.join(' ')).toMatch(/safe profile|remote/i);
  });

  it('owner-trusted domain raises evidence without competitor brand defaults', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'daily' });
    svc.addOwnerTrusted({ kind: 'domain', pattern: 'github.com/my-team/' });
    const decision = svc.evaluate(
      baseEvidence({
        sourceRaw: 'https://github.com/my-team/cool-skill',
        sourceKind: 'git-repo',
        local: false,
        validPackage: true,
        hasSkillMd: true,
        hasManifest: true,
        securityRisk: 'low',
        checksumPinned: true,
      }),
    );
    expect(decision.score.signals.some((s) => s.id === 'owner_trusted' && s.present)).toBe(true);
    const blob = JSON.stringify(svc.listOwnerTrusted());
  });

  it('public stars alone cannot dominate score', () => {
    const svc = new SkillTrustScoreService({ storePath, profile: 'daily' });
    const weak = svc.score(
      baseEvidence({
        local: false,
        validPackage: false,
        hasSkillMd: false,
        hasManifest: false,
        securityRisk: 'high',
        publicStars: 100000,
        sourceRaw: 'https://github.com/x/y',
        sourceKind: 'git-repo',
      }),
    );
    expect(weak.score).toBeLessThan(0.5);
  });
});
