import { VendorLicenseGuardService } from '../../src/services/VendorLicenseGuardService.js';

describe('VendorLicenseGuardService', () => {
  it('maps permissive and copyleft contracts into sync/copy decisions', () => {
    const service = new VendorLicenseGuardService({
      contractService: {
        readContracts: jest.fn(() => [
          {
            id: 'AIGateway',
            displayName: 'AIGateway',
            license: 'MIT',
            releaseIsolation: 'core-safe',
            coreCopyPolicy: 'allow-with-attribution',
            reviewRequired: false,
            rationale: 'Permissiva.',
            recommendedAction: 'Sync normal.',
          },
          {
            id: 'omni-zavorth-bridge-remote-chat',
            displayName: 'Zavorth Remote Terminal Sidecar',
            license: 'GPL-3.0-only',
            releaseIsolation: 'vendor-isolated',
            coreCopyPolicy: 'isolated-vendor-only',
            reviewRequired: true,
            rationale: 'Copyleft forte.',
            recommendedAction: 'Isolar vendor.',
          },
        ]),
        getContract: jest.fn((vendorId: string) => ({
          id: vendorId,
          displayName: vendorId === 'AIGateway' ? 'AIGateway' : 'Zavorth Remote Terminal Sidecar',
          license: vendorId === 'AIGateway' ? 'MIT' : 'GPL-3.0-only',
          releaseIsolation: vendorId === 'AIGateway' ? 'core-safe' : 'vendor-isolated',
          coreCopyPolicy: vendorId === 'AIGateway' ? 'allow-with-attribution' : 'isolated-vendor-only',
          reviewRequired: vendorId !== 'AIGateway',
          rationale: 'policy',
          recommendedAction: 'action',
        })),
      } as any,
    });

    const decisions = service.listDecisions();

    expect(decisions).toHaveLength(2);
    expect(service.getDecision('AIGateway')).toEqual(
      expect.objectContaining({
        allowVendorSync: true,
        allowCoreCopy: true,
        reviewRequired: false,
      }),
    );
    expect(service.getDecision('omni-zavorth-bridge-remote-chat')).toEqual(
      expect.objectContaining({
        allowVendorSync: true,
        allowCoreCopy: false,
        reviewRequired: true,
      }),
    );
  });
});
