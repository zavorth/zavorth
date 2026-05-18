import { describe, expect, it } from '@jest/globals';
import { ZavorthProviderModelCatalogService } from '../../src/services/ZavorthProviderModelCatalogService.js';
import { ZavorthProviderCapabilityCatalogService } from '../../src/services/ZavorthProviderCapabilityCatalogService.js';

describe('ZavorthProviderCapabilityCatalogService', () => {
  it('preserves the Zavorth provider, model and media capability catalog without live execution', () => {
    const service = new ZavorthProviderCapabilityCatalogService({
      now: () => new Date('2026-05-17T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.extensionPackageJsonCount).toBeGreaterThanOrEqual(122);
    expect(snapshot.summary.providerLikeExtensionCount).toBeGreaterThanOrEqual(65);
    expect(snapshot.summary.providerDirectoryEntries).toBeGreaterThanOrEqual(52);
    expect(snapshot.summary.staticCatalogProviderCount).toBeGreaterThanOrEqual(26);
    expect(snapshot.summary.staticCatalogModelCount).toBeGreaterThanOrEqual(260);
    expect(snapshot.summary.catalogModelEntries).toBeGreaterThanOrEqual(300);
    expect(snapshot.summary.registeredCapabilityRoutes).toBe(snapshot.summary.capabilityManifests);
    expect(snapshot.modalities.image.providerCount).toBeGreaterThanOrEqual(10);
    expect(snapshot.modalities.video.providerCount).toBeGreaterThanOrEqual(16);
    expect(snapshot.modalities.music.providerCount).toBeGreaterThanOrEqual(3);
    expect(snapshot.modalities.tts.providerCount).toBeGreaterThanOrEqual(15);
    expect(snapshot.modalities.transcription.providerCount).toBeGreaterThanOrEqual(6);
    expect(snapshot.safety).toMatchObject({
      inventoryOnly: true,
      noProviderSecrets: true,
      noLiveNetworkCalls: true,
      noHiddenAgentProcessLaunch: true,
      liveExecutionRequiresProviderCredentialAndExplicitProof: true,
    });
  });

  it('feeds the unified provider model catalog with native capability models and routes', async () => {
    const service = new ZavorthProviderModelCatalogService({
      now: () => new Date('2026-05-17T12:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot({ live: false });

    expect(snapshot.summary.providerRoutes).toBeGreaterThanOrEqual(70);
    expect(snapshot.summary.staticCatalogModels).toBeGreaterThanOrEqual(300);
    expect(snapshot.summary.modalityCounts.video).toBeGreaterThan(0);
    expect(snapshot.summary.modalityCounts.audio).toBeGreaterThan(0);
    expect(snapshot.sections.mediaCapable).toEqual(expect.arrayContaining([
      'fal',
      'runway',
      'azure-speech',
      'elevenlabs',
    ]));
    const openAi = snapshot.providers.find((provider) => provider.id === 'openai');
    expect(openAi?.effectiveModelCount).toBeGreaterThanOrEqual(41);
    expect(openAi?.modalities).toEqual(expect.arrayContaining(['video', 'audio']));
    expect(snapshot.safety.liveProbeRequiresExplicitOperatorAction).toBe(true);
  });
});
