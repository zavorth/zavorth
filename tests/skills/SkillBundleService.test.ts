import { SkillBundleService } from '../../src/skills/SkillBundleService.js';

describe('SkillBundleService', () => {
  it('classifies local skills with semantic and support-file tags', () => {
    const service = new SkillBundleService();

    const tags = service.resolveBundleTags({
      name: 'system-design',
      description: 'Arquitetura, trade-offs e desenho de componentes.',
      supportFileCount: 2,
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
    });

    expect(tags).toEqual(expect.arrayContaining(['skill', 'local', 'architecture', 'with-support-files']));
  });

  it('marks imported browser skills distinctly', () => {
    const service = new SkillBundleService();

    const tags = service.resolveBundleTags({
      name: 'chrome-devtools',
      description: 'Browser debugging and devtools automation.',
      supportFileCount: 0,
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
        originDocumentPath: 'C:/repo/skill-library/imported/chrome-devtools/ORIGIN.json',
        attributionFilePath: 'C:/repo/skill-library/imported/chrome-devtools/ATTRIBUTION.md',
        upstreamSourceId: 'external-review-source',
        upstreamSourceLabel: 'External review source',
        upstreamSourceKind: 'repository',
        upstreamSourceTrust: 'review',
        upstreamRegistrySource: 'zavorth:test-review-source',
        upstreamRepository: null,
        upstreamLicense: 'mixed',
        upstreamSkillPath: 'C:/mirror/skills/chrome-devtools',
        upstreamRelativePath: 'skills/chrome-devtools',
      },
    });

    expect(tags).toEqual(expect.arrayContaining(['skill', 'imported', 'browser']));
  });
});
