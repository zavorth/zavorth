import { FinalAbsorptionCertificationService } from '../../src/services/FinalAbsorptionCertificationService.js';

describe('FinalAbsorptionCertificationService Worker 7', () => {
  it('certifies Worker 1 through Worker 6 as one final closure chain', () => {
    const snapshot = new FinalAbsorptionCertificationService({
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-7');
    expect(snapshot.status).toBe('certified');
    expect(snapshot.claim).toBe('tracked-private-inventory-certified');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        evidenceItems: 7,
        passed: 7,
        failed: 0,
        normalizedSourceModules: 125,
        primitives: 24,
        codexRuntimeFeatures: 14,
        openshellSandboxFeatures: 11,
        sdkSubpaths: 8,
        providerRoutes: 47,
        channelRoutes: 23,
        runtimeFamilyPrimitives: 11,
        runtimeFamilySourceModules: 35,
        runtimeFamilyModeProofs: 37,
        p0Gaps: 0,
        p1Gaps: 0,
        p2Gaps: 0,
        totalReceipts: 125,
      }),
    );
    expect(snapshot.evidence.map((item) => item.id)).toEqual([
      'worker-1-normalization',
      'worker-2-codex-runtime',
      'worker-3-openshell-sandbox',
      'worker-4-module-sdk-export',
      'worker-5-provider-channel-smoke',
      'worker-6-runtime-family',
      'public-launch-certification',
    ]);
    expect(snapshot.evidence.every((item) => item.status === 'passed')).toBe(true);
    expect(snapshot.receipts).toHaveLength(7);
  });

  it('keeps the final claim precise and no-live-IO', () => {
    const snapshot = new FinalAbsorptionCertificationService({
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.statement).toEqual(
      expect.objectContaining({
        trackedInventory: '125 normalized source modules are covered by the Worker 1 through Worker 6 closure chain.',
        liveEndToEndConsistency: 'not-claimed-by-this-certificate',
        publicLaunch: 'certified-by-static-and-no-live-IO-profile',
      }),
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        filesystemWriteRequired: false,
        artifactBodyReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        finalCertificateOnly: true,
        noLiveProviderCalls: true,
        noLiveChannelSends: true,
        noLiveDeviceAccess: true,
        noLiveMemoryWrites: true,
        noFilesystemWrites: true,
        noArtifactBodyReads: true,
        noSecretValuesSerialized: true,
        liveEndToEndConsistencyRequiresSeparateOperatorRun: true,
      }),
    );
  });

  it('exposes source snapshot summaries for audit without serializing bulky bodies', () => {
    const snapshot = new FinalAbsorptionCertificationService({
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.sourceSnapshots.capabilityNormalization.summary.normalized).toBe(125);
    expect(snapshot.sourceSnapshots.codexRuntime.status).toBe('closed');
    expect(snapshot.sourceSnapshots.openshellSandbox.status).toBe('closed');
    expect(snapshot.sourceSnapshots.moduleSdkExport.status).toBe('closed');
    expect(snapshot.sourceSnapshots.providerChannelSmoke.status).toBe('closed');
    expect(snapshot.sourceSnapshots.runtimeFamilyClosure.status).toBe('closed');
    expect(snapshot.sourceSnapshots.releaseCertification).toEqual(
      expect.objectContaining({
        profile: 'public-launch',
        status: 'certified',
      }),
    );
  });

  it('formats a final operator report', () => {
    const service = new FinalAbsorptionCertificationService({
      now: () => new Date('2026-05-04T23:59:00.000Z'),
    });
    const text = service.formatCertificationText();

    expect(text).toContain('Zavorth Final Absorption Certification');
    expect(text).toContain('Status: certified');
    expect(text).toContain('Tracked inventory: 125 source modules, 24 primitives');
    expect(text).toContain('Live E2E consistency: not-claimed-by-this-certificate');
    expect(text).toContain('Next: No next worker in this closure chain');
  });
});
