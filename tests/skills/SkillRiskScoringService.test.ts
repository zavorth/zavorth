import { SkillRiskScoringService } from '../../src/skills/SkillRiskScoringService.js';

describe('SkillRiskScoringService', () => {
  it('keeps permissive, clean imports in low risk', () => {
    const result = new SkillRiskScoringService().assessImport({
      sourceTrust: 'trusted',
      sourceAllowed: true,
      scanIssues: [],
      license: 'MIT',
      licenseConfidence: 'high',
      licensePolicy: {
        label: 'permissive',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: true,
        reviewRequired: false,
        summary: 'ok',
      },
      importableFileCount: 3,
      skippedFileCount: 0,
    });

    expect(result).toEqual(
      expect.objectContaining({
        level: 'low',
        reviewRequired: false,
      }),
    );
  });

  it('raises review-level risk for mixed licensing and partial intake', () => {
    const result = new SkillRiskScoringService().assessImport({
      sourceTrust: 'review',
      sourceAllowed: true,
      scanIssues: [],
      license: 'mixed',
      licenseConfidence: 'low',
      licensePolicy: {
        label: 'review',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: false,
        reviewRequired: true,
        summary: 'mixed',
      },
      importableFileCount: 2,
      skippedFileCount: 3,
    });

    expect(result).toEqual(
      expect.objectContaining({
        level: 'medium',
        reviewRequired: true,
      }),
    );
    expect(result.score).toBeGreaterThanOrEqual(25);
  });

  it('blocks imports when the license policy denies import', () => {
    const result = new SkillRiskScoringService().assessImport({
      sourceTrust: 'review',
      sourceAllowed: true,
      scanIssues: [],
      license: 'All Rights Reserved',
      licenseConfidence: 'high',
      licensePolicy: {
        label: 'restricted',
        allowImport: false,
        allowRuntimeUse: false,
        allowCoreCopy: false,
        reviewRequired: true,
        summary: 'blocked',
      },
      importableFileCount: 1,
      skippedFileCount: 0,
    });

    expect(result).toEqual(
      expect.objectContaining({
        level: 'blocked',
        score: 100,
        reviewRequired: true,
      }),
    );
  });
});
