import { ProviderP0ClosureService } from '../../src/services/ProviderP0ClosureService.js';
import { ProviderMeshReadinessService } from '../../src/services/ProviderMeshReadinessService.js';
import { ReleaseCertificationService } from '../../src/services/ReleaseCertificationService.js';

describe('ProviderP0ClosureService Intent model0', () => {
  it('closes the two provider P0 gaps by moving Anthropic-compatible routes to supported templates', () => {
    const snapshot = new ProviderP0ClosureService({
      now: () => new Date('2026-05-04T20:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.gate-10');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        closedProviders: 2,
        remainingProviderP0: 0,
        providerUnsupported: 0,
        providerTemplateReady: 0,
        certificationP0Gaps: 0,
        certificationStatus: 'certified',
        releaseReady: true,
        liveExternalCallRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerId: 'anthropic',
          previousBlocker: 'unsupported_anthropic',
          closureStrategy: 'anthropic-compatible-runtime',
          status: 'generic-compatible',
          runtimeSupported: true,
          adapterStrategy: 'anthropic-compatible-runtime',
          p0Closed: true,
          remainingTier: 'none',
        }),
        expect.objectContaining({
          providerId: 'anthropic-vertex',
          p0Closed: true,
          remainingTier: 'none',
        }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        closureIsClassificationOnly: true,
        noProviderCalls: true,
        noSecretsSerialized: true,
        remainingTemplatesStayVisible: true,
      }),
    );
  });

  it('makes Provider Mesh report zero unsupported providers', () => {
    const providerSnapshot = new ProviderMeshReadinessService({
      now: () => new Date('2026-05-04T20:10:00.000Z'),
    }).buildSnapshot();

    expect(providerSnapshot.summary).toEqual(
      expect.objectContaining({
        sourceProviders: 47,
        templateReady: 0,
        unsupported: 0,
        unmapped: 0,
        generatedPluginManifests: 47,
        secretValuesSerialized: false,
      }),
    );
    expect(providerSnapshot.unsupported).toEqual([]);
  });

  it('unblocks P0 certification and inherits final release readiness', () => {
    const certification = new ReleaseCertificationService({
      now: () => new Date('2026-05-04T20:20:00.000Z'),
    }).buildSnapshot();

    expect(certification.status).toBe('certified');
    expect(certification.summary).toEqual(
      expect.objectContaining({
        sourceP0Gaps: 0,
        sourceP1Gaps: 0,
        sourceP2Gaps: 0,
        failed: 0,
        warned: 0,
        blockingFailures: 0,
        releaseReady: true,
      }),
    );
    expect(certification.gates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'p0-gap-budget',
          status: 'pass',
          observed: 0,
        }),
      ]),
    );
  });
});
