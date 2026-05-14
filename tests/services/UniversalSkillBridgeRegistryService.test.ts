import { UniversalSkillBridgeRegistryService } from '../../src/services/UniversalSkillBridgeRegistryService.js';
import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';

function entry(overrides: Partial<SkillCatalogEntry>): SkillCatalogEntry {
  const name = overrides.name || 'research-pack';
  return {
    id: `skill:${name}`,
    name,
    description: overrides.description || 'Research local documents.',
    sourceId: overrides.sourceId ?? 'workspace-imported-library',
    sourceLabel: overrides.sourceLabel ?? 'Workspace imported skill library',
    sourceTrust: overrides.sourceTrust ?? 'review',
    license: overrides.license ?? 'MIT',
    imported: overrides.imported ?? true,
    bundleTags: overrides.bundleTags || ['research'],
    supportFileCount: overrides.supportFileCount ?? 1,
    dirPath: overrides.dirPath || `C:/skills/${name}`,
    skillFilePath: overrides.skillFilePath || `C:/skills/${name}/SKILL.md`,
    searchText: overrides.searchText || `${name} research imported`,
    provenance: overrides.provenance ?? {
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Workspace imported skill library',
      sourceKind: 'workspace',
      sourceTrust: 'review',
      registrySource: 'zavorth:curated-import',
      ownership: 'curated-import',
      license: 'MIT',
      importMode: 'imported-copy',
      imported: true,
      importedAt: '2026-05-10T15:00:00.000Z',
      originDocumentPath: `C:/skills/${name}/ORIGIN.json`,
      attributionFilePath: `C:/skills/${name}/ATTRIBUTION.md`,
      upstreamSourceId: 'universal-source:fixture',
      upstreamSourceLabel: 'Fixture',
      upstreamSourceKind: 'repository',
      upstreamSourceTrust: 'review',
      upstreamRegistrySource: 'zavorth:universal-skill-intake',
      upstreamRepository: 'C:/fixtures/source',
      upstreamLicense: 'MIT',
      upstreamSkillPath: `${name}/SKILL.md`,
      upstreamRelativePath: name,
    },
    risk: overrides.risk ?? {
      score: 20,
      level: 'low',
      reviewRequired: true,
      reasons: ['review source'],
    },
    licensePolicy: overrides.licensePolicy ?? {
      label: 'permissive',
      allowImport: true,
      allowRuntimeUse: true,
      allowCoreCopy: false,
      reviewRequired: false,
      summary: 'MIT.',
    },
    audit: overrides.audit ?? null,
    metadata: overrides.metadata || ({} as any),
  };
}

describe('UniversalSkillBridgeRegistryService Phase 4', () => {
  it('projects imported skills into bridge-ready catalog actions without executing them', async () => {
    const invoke = jest.fn();
    const service = new UniversalSkillBridgeRegistryService({
      now: () => new Date('2026-05-10T16:00:00.000Z'),
      skillCatalogService: {
        listEntries: jest.fn(() => [
          entry({ name: 'research-pack' }),
          entry({
            name: 'local-pack',
            imported: false,
            provenance: null,
            sourceId: 'workspace-library',
            sourceTrust: 'trusted',
          }),
          entry({
            name: 'restricted-pack',
            licensePolicy: {
              label: 'restricted',
              allowImport: true,
              allowRuntimeUse: false,
              allowCoreCopy: false,
              reviewRequired: true,
              summary: 'Runtime denied.',
            },
          }),
        ]),
      },
      bridgeRuntimeService: {
        invoke,
      },
    });

    const snapshot = await service.buildSnapshot({ selectedId: 'research-pack' });

    expect(snapshot.summary).toEqual(expect.objectContaining({
      total: 3,
      imported: 2,
      localOnly: 1,
      approvalRequired: 1,
      blocked: 1,
      invocationPrepared: false,
    }));
    expect(snapshot.selected).toEqual(expect.objectContaining({
      skillName: 'research-pack',
      runtimeEligible: true,
      dryRunReady: true,
      liveRequiresApproval: true,
    }));
    expect(snapshot.selected?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'dry-run', safeDefault: true }),
      expect.objectContaining({ kind: 'live-prepare', requiresApproval: true }),
    ]));
    expect(invoke).not.toHaveBeenCalled();
  });

  it('invokes the governed Phase 3 bridge only when explicitly requested', async () => {
    const invoke = jest.fn(async () => ({
      status: 'dry-run',
      promptEnvelope: { text: '<untrusted_skill_content>safe</untrusted_skill_content>' },
      receipts: [{ id: 'receipt-1' }],
    }));
    const service = new UniversalSkillBridgeRegistryService({
      now: () => new Date('2026-05-10T16:00:00.000Z'),
      skillCatalogService: {
        listEntries: jest.fn(() => [entry({ name: 'research-pack' })]),
      },
      bridgeRuntimeService: { invoke },
    });

    const snapshot = await service.buildSnapshot({
      selectedId: 'research-pack',
      invoke: true,
      channel: 'telegram',
      intent: 'Use research pack.',
    });

    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      skillName: 'research-pack',
      channel: 'telegram',
      mode: 'dry-run',
      persistReceipt: false,
    }));
    expect(snapshot.invocation).toEqual(expect.objectContaining({
      status: 'dry-run',
    }));
    expect(snapshot.summary.invocationPrepared).toBe(true);
  });

  it('marks local skills and runtime-denied licenses as non-eligible', () => {
    const service = new UniversalSkillBridgeRegistryService({
      skillCatalogService: {
        listEntries: jest.fn(() => [
          entry({
            name: 'local-pack',
            imported: false,
            provenance: null,
            sourceId: 'workspace-library',
            sourceTrust: 'trusted',
          }),
          entry({
            name: 'restricted-pack',
            licensePolicy: {
              label: 'restricted',
              allowImport: true,
              allowRuntimeUse: false,
              allowCoreCopy: false,
              reviewRequired: true,
              summary: 'Runtime denied.',
            },
          }),
        ]),
      },
      bridgeRuntimeService: {
        invoke: jest.fn(),
      },
    });

    const snapshot = service.buildProjection();

    expect(snapshot.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        skillName: 'local-pack',
        status: 'local-only',
        runtimeEligible: false,
      }),
      expect.objectContaining({
        skillName: 'restricted-pack',
        status: 'blocked',
        runtimeEligible: false,
      }),
    ]));
  });
});
