import type { SkillMetadata } from '../../src/skills/SkillLoader.js';
import { SkillCatalogService } from '../../src/skills/SkillCatalogService.js';

describe('SkillCatalogService', () => {
  it('builds a catalog snapshot with bundle and provenance summaries', () => {
    const skills: SkillMetadata[] = [
      {
        name: 'system-design',
        description: 'Arquitetura e trade-offs.',
        dirPath: 'C:/skills/system-design',
        skillFilePath: 'C:/skills/system-design/SKILL.md',
        supportFilePaths: ['C:/skills/system-design/references/design-checklist.md'],
        supportFiles: [
          {
            path: 'C:/skills/system-design/references/design-checklist.md',
            relativePath: 'references/design-checklist.md',
            kind: 'reference',
            external: false,
          },
        ],
        sourceId: 'workspace-library',
        sourceLabel: 'Workspace skill library',
        sourceKind: 'workspace',
        sourceTrust: 'trusted',
        sourceRegistrySource: 'zavorth:local-workspace',
        license: null,
        bundleTags: ['skill', 'architecture', 'local', 'with-support-files'],
        provenance: {
          sourceId: 'workspace-library',
          sourceLabel: 'Workspace skill library',
          sourceKind: 'workspace',
          sourceTrust: 'trusted',
          registrySource: 'zavorth:local-workspace',
          ownership: 'workspace',
          license: null,
          importMode: 'local-scan',
          imported: false,
          importedAt: null,
          originDocumentPath: null,
          attributionFilePath: null,
          upstreamSourceId: null,
          upstreamSourceLabel: null,
          upstreamSourceKind: null,
          upstreamSourceTrust: null,
          upstreamRegistrySource: null,
          upstreamRepository: null,
          upstreamLicense: null,
          upstreamSkillPath: null,
          upstreamRelativePath: null,
        },
      },
      {
        name: 'security-threat-model',
        description: 'Threat model to review risks.',
        dirPath: 'C:/skills/imported/security-threat-model',
        skillFilePath: 'C:/skills/imported/security-threat-model/SKILL.md',
        supportFilePaths: [],
        sourceId: 'workspace-imported-library',
        sourceLabel: 'Workspace imported skill library',
        sourceKind: 'workspace',
        sourceTrust: 'review',
        sourceRegistrySource: 'zavorth:curated-import',
        license: 'mixed',
        bundleTags: ['skill', 'security', 'imported'],
        provenance: {
          sourceId: 'workspace-imported-library',
          sourceLabel: 'Workspace imported skill library',
          sourceKind: 'workspace',
          sourceTrust: 'review',
          registrySource: 'zavorth:curated-import',
          ownership: 'curated-import',
          license: 'mixed',
          importMode: 'imported-copy',
          imported: true,
          importedAt: '2026-04-07T00:00:00.000Z',
          originDocumentPath: 'C:/skills/imported/security-threat-model/ORIGIN.json',
          attributionFilePath: 'C:/skills/imported/security-threat-model/ATTRIBUTION.md',
          upstreamSourceId: 'external-review-source',
          upstreamSourceLabel: 'External review source',
          upstreamSourceKind: 'repository',
          upstreamSourceTrust: 'review',
          upstreamRegistrySource: 'zavorth:test-review-source',
          upstreamRepository: null,
          upstreamLicense: 'mixed',
          upstreamSkillPath: 'C:/mirror/security-threat-model',
          upstreamRelativePath: 'skills/security-threat-model',
          risk: {
            score: 39,
            level: 'medium',
            reviewRequired: true,
            reasons: ['Fonte exige review manual.'],
          },
          licensePolicy: {
            label: 'review',
            allowImport: true,
            allowRuntimeUse: true,
            allowCoreCopy: false,
            reviewRequired: true,
            summary: 'mixed',
          },
          audit: {
            lastEventId: 'import-20260407000000-1',
            trailFilePath: 'C:/skills/imported/.zavorth-import-audit.json',
            lastAction: 'import',
            lastRecordedAt: '2026-04-07T00:00:00.000Z',
          },
        },
      },
    ];
    const service = new SkillCatalogService({
      now: () => new Date('2026-04-07T12:00:00.000Z'),
      skillLoader: {
        loadAll: () => skills,
      },
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        total: 2,
        local: 1,
        imported: 1,
        trusted: 1,
        review: 1,
        withSupportFiles: 1,
      }),
    );
    expect(snapshot.bundles.find((entry) => entry.tag === 'security')).toEqual(
      expect.objectContaining({
        skillCount: 1,
        skillNames: ['security-threat-model'],
      }),
    );
    expect(snapshot.entries.find((entry) => entry.name === 'security-threat-model')).toEqual(
      expect.objectContaining({
        imported: true,
        license: 'mixed',
        risk: expect.objectContaining({
          level: 'medium',
        }),
        licensePolicy: expect.objectContaining({
          label: 'review',
        }),
        audit: expect.objectContaining({
          lastEventId: 'import-20260407000000-1',
        }),
      }),
    );
  });
});
