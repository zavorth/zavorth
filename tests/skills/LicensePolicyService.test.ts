import { LicensePolicyService } from '../../src/skills/LicensePolicyService.js';

describe('LicensePolicyService', () => {
  it('treats MIT as permissive when the evidence is strong', () => {
    const result = new LicensePolicyService().evaluateClassification({
      license: 'MIT',
      confidence: 'high',
      evidence: ['EXTERNAL_SOURCE.json:source_license_spdx'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        label: 'permissive',
        allowImport: true,
        allowRuntimeUse: true,
        allowCoreCopy: true,
        reviewRequired: false,
      }),
    );
  });

  it('requires review for mixed licensing', () => {
    const result = new LicensePolicyService().evaluateClassification({
      license: 'mixed',
      confidence: 'low',
      evidence: ['source-registry:license'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        label: 'review',
        allowImport: true,
        allowCoreCopy: false,
        reviewRequired: true,
      }),
    );
  });

  it('blocks clearly restricted licenses', () => {
    const result = new LicensePolicyService().evaluateClassification({
      license: 'All Rights Reserved',
      confidence: 'high',
      evidence: ['LICENSE.txt'],
    });

    expect(result).toEqual(
      expect.objectContaining({
        label: 'restricted',
        allowImport: false,
        allowRuntimeUse: false,
        reviewRequired: true,
      }),
    );
  });
});
