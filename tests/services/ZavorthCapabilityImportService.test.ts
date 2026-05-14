import type { CapabilityImportManifest } from '../../src/contracts/CapabilityImportContract';
import { CAPABILITY_IMPORT_CONTRACT_VERSION } from '../../src/contracts/CapabilityImportContract';
import { ZavorthCapabilityHubApiService } from '../../src/services/ZavorthCapabilityHubApiService';
import { ZavorthCapabilityImportApiService } from '../../src/services/ZavorthCapabilityImportApiService';
import { ZavorthCapabilityImportService } from '../../src/services/ZavorthCapabilityImportService';

describe('ZavorthCapabilityImportService', () => {
  it('normalizes external-style manifest entries into safe Capability Hub items', () => {
    const service = new ZavorthCapabilityImportService({
      now: () => new Date('2026-05-07T16:00:00.000Z'),
    });

    const snapshot = service.buildSnapshot({ manifest: buildManifest() });

    expect(snapshot.contractVersion).toBe(CAPABILITY_IMPORT_CONTRACT_VERSION);
    expect(snapshot.policy).toMatchObject({
      canonicalRootOnly: true,
      externalCapabilityRootsAllowed: false,
      importsMustNormalizeToCapabilityHub: true,
      dryRunOnly: true,
      liveActivation: false,
      secretsSerialized: false,
    });
    expect(snapshot.summary).toMatchObject({
      receivedItems: 2,
      normalizedItems: 2,
      rejectedItems: 0,
    });
    expect(snapshot.items.map((item) => item.id)).toEqual([
      'skill:daily-brief',
      'integration:calendar-sync',
    ]);
    expect(snapshot.items.every((item) => item.source === 'imported')).toBe(true);
    expect(snapshot.items.every((item) => item.provenance.canonicalRootOnly)).toBe(true);
    expect(snapshot.items.every((item) => item.activation.liveAllowed === false)).toBe(true);
    expect(snapshot.items.every((item) => item.activation.defaultEnabled === false)).toBe(true);
    expect(snapshot.items[0].governance.requiresApproval).toBe(true);
  });

  it('rejects manifests that contain raw secret-looking values', () => {
    const service = new ZavorthCapabilityImportService({
      now: () => new Date('2026-05-07T16:00:00.000Z'),
    });

    const manifest = {
      ...buildManifest(),
      summary: 'bad manifest sk-test-secret-value-1234567890',
    };
    const snapshot = service.buildSnapshot({ manifest });

    expect(snapshot.summary.receivedItems).toBe(2);
    expect(snapshot.summary.normalizedItems).toBe(0);
    expect(snapshot.summary.rejectedItems).toBe(2);
    expect(snapshot.issues.some((issue) => issue.code === 'manifest.raw_secret_detected')).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('sk-test-secret-value-1234567890');
  });

  it('is consumable by the Capability Hub instead of creating a parallel catalog', () => {
    const importer = new ZavorthCapabilityImportApiService({
      now: () => new Date('2026-05-07T16:00:00.000Z'),
      manifests: [buildManifest()],
    });
    const hub = new ZavorthCapabilityHubApiService({
      ...buildEmptyHubRuntime(),
      now: () => new Date('2026-05-07T16:00:00.000Z'),
      capabilityImportService: importer,
    });

    const imported = hub.list({ search: 'daily brief' });
    const inspected = hub.inspect('skill:daily-brief');

    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      id: 'skill:daily-brief',
      kind: 'skill',
      source: 'imported',
    });
    expect(inspected.found).toBe(true);
    expect(inspected.item?.provenance.sourceService).toBe('ZavorthCapabilityImportService');
  });
});

function buildManifest(): CapabilityImportManifest {
  return {
    packId: 'team-ops-pack',
    label: 'Team Ops Pack',
    summary: 'Team operations capabilities.',
    source: {
      label: 'team-curated',
      externalRuntimeDependency: true,
    },
    items: [
      {
        id: 'daily-brief',
        kind: 'skill',
        label: 'Daily Brief',
        summary: 'Prepare a governed daily brief.',
        description: 'Collects inputs and produces an artifact-first daily summary.',
        tags: ['ops', 'briefing'],
        requirements: {
          secretRefs: ['calendar.oauth'],
          manualSteps: ['choose calendars'],
        },
        governance: {
          risk: 'medium',
          requiresApproval: true,
          networkScope: 'external-policy',
        },
        activation: {
          readiness: 'needs_configuration',
          installed: true,
          configured: true,
          readinessChecks: ['calendar-token', 'workspace-policy'],
        },
      },
      {
        id: 'calendar-sync',
        kind: 'integration',
        label: 'Calendar Sync',
        summary: 'Sync calendar events into governed memory receipts.',
        tags: ['calendar', 'memory'],
        requirements: {
          secretRefs: ['calendar.oauth'],
        },
      },
    ],
  };
}

function buildEmptyHubRuntime() {
  return {
    capabilityRegistry: {
      getAll: () => [],
    },
    channelRegistryService: {
      buildSnapshot: () => ({
        generatedAt: '2026-05-07T16:00:00.000Z',
        summary: {
          total: 0,
          ready: 0,
          partial: 0,
          planned: 0,
          disabled: 0,
        },
        channels: [],
        narrative: {
          headline: 'channels',
          operatorSummary: 'none',
        },
      }),
    },
    integrationHubService: {
      buildCatalogSnapshot: () => ({
        generatedAt: '2026-05-07T16:00:00.000Z',
        entries: [],
        featuredIds: [],
        templateIds: [],
        providers: {
          generatedAt: '2026-05-07T16:00:00.000Z',
          activeProviderName: 'none',
          activeModelName: 'none',
          preferredZavorthBridgeModel: null,
          recommendedProfile: {
            id: 'none',
            label: 'None',
            providerName: 'none',
            modelName: null,
            fallbackOrder: [],
          },
          ready: [],
          needsConfiguration: [],
          needsProbe: [],
          profiles: [],
          usageTargets: [],
          recommendations: [],
        },
        mcp: {
          generatedAt: '2026-05-07T16:00:00.000Z',
          manifestPath: 'config/mcp-servers.json',
          summary: {
            total: 0,
            enabled: 0,
            connected: 0,
            failed: 0,
            disabled: 0,
            stopped: 0,
            toolCount: 0,
            capabilityCount: 0,
          },
          capabilities: [],
          entries: [],
          recommendations: [],
          narrative: {
            headline: 'mcp',
            operatorSummary: 'none',
          },
        },
        selected: null,
      }),
    },
    skillCatalogService: {
      buildSnapshot: () => ({
        generatedAt: '2026-05-07T16:00:00.000Z',
        summary: {
          total: 0,
          local: 0,
          imported: 0,
          trusted: 0,
          review: 0,
          blocked: 0,
          withSupportFiles: 0,
          bundled: 0,
        },
        bundles: [],
        entries: [],
      }),
    },
    skillRecipeService: {
      buildRecipes: () => [],
    },
  };
}
