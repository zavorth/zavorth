import { CAPABILITY_PACK_CATALOG_CONTRACT_VERSION } from '../../src/contracts/CapabilityPackCatalogContract';
import { ZavorthCapabilityActivationFlowService } from '../../src/services/ZavorthCapabilityActivationFlowService';
import { ZavorthCapabilityImportService } from '../../src/services/ZavorthCapabilityImportService';
import { ZavorthCapabilityPackCatalogApiService } from '../../src/services/ZavorthCapabilityPackCatalogApiService';
import { ZavorthCapabilityPackCatalogService } from '../../src/services/ZavorthCapabilityPackCatalogService';

describe('ZavorthCapabilityPackCatalogService', () => {
  it('lists official local packs with safe default policy', () => {
    const service = new ZavorthCapabilityPackCatalogService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(CAPABILITY_PACK_CATALOG_CONTRACT_VERSION);
    expect(snapshot.policy).toMatchObject({
      canonicalRoot: 'zavorth-core/Zavorth',
      officialPacksOnly: true,
      externalRootsAllowed: false,
      importsMustUseCapabilityImporter: true,
      liveActivationByDefault: false,
      secretsSerialized: false,
    });
    expect(snapshot.packs.map((pack) => pack.id)).toEqual([
      'official-communication-channels',
      'official-ai-access',
      'official-tool-bridges',
      'official-ops-skills',
    ]);
    expect(snapshot.summary.manifestItems).toBeGreaterThanOrEqual(12);
    expect(JSON.stringify(snapshot)).not.toContain('sk-');
    expect(JSON.stringify(snapshot)).not.toContain('xoxb-');
  });

  it('exports official pack manifests that can pass through the Capability Importer', () => {
    const catalog = new ZavorthCapabilityPackCatalogApiService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });
    const importer = new ZavorthCapabilityImportService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const manifests = catalog.listManifests({ packId: 'official-ops-skills' });
    const importSnapshot = importer.buildSnapshot({ manifests });

    expect(manifests).toHaveLength(1);
    expect(importSnapshot.summary.receivedItems).toBe(4);
    expect(importSnapshot.summary.normalizedItems).toBe(4);
    expect(importSnapshot.summary.rejectedItems).toBe(0);
    expect(importSnapshot.items.some((item) => item.id === 'skill:daily-brief')).toBe(true);
  });

  it('feeds official packs into the activation flow by packId', () => {
    const flow = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const snapshot = flow.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:daily-brief',
      text: 'ative daily brief',
    });

    expect(snapshot.importSnapshot.summary.normalizedItems).toBe(4);
    expect(snapshot.target?.id).toBe('skill:daily-brief');
    expect(snapshot.status).toBe('waiting_secret_input');
    expect(snapshot.setupSnapshot?.secretPlan.missingRefs).toEqual([
      'calendar.oauth',
      'mail.oauth',
    ]);
    expect(snapshot.activation.liveActivationApplied).toBe(false);
  });

  it('can reach controlled activation readiness for a no-secret official skill after approval', () => {
    const flow = new ZavorthCapabilityActivationFlowService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
    });

    const snapshot = flow.buildSnapshot({
      packId: 'official-ops-skills',
      targetItemId: 'skill:release-readiness',
      text: 'ative release readiness',
      approvalId: 'approval-release',
      completedManualSteps: ['review scope and approval budget'],
      completedReadinessChecks: ['release-readiness-readiness', 'artifact-receipt-policy'],
    });

    expect(snapshot.target?.id).toBe('skill:release-readiness');
    expect(snapshot.status).toBe('ready_for_controlled_activation');
    expect(snapshot.activation.approvalId).toBe('approval-release');
    expect(snapshot.activation.liveActivationApplied).toBe(false);
  });
});
