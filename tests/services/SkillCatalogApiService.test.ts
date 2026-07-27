import { SkillCatalogApiService } from '../../src/services/SkillCatalogApiService.js';

describe('SkillCatalogApiService', () => {
  it('selects skills and surfaces recipe recommendations from the shared catalog', () => {
    const service = new SkillCatalogApiService({
      now: () => new Date('2026-04-08T12:00:00.000Z'),
      skillCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T11:59:00.000Z',
          summary: {
            total: 3,
            local: 0,
            imported: 3,
            trusted: 0,
            review: 3,
            blocked: 0,
            withSupportFiles: 3,
            bundled: 3,
          },
          bundles: [],
          entries: [
            {
              id: 'skill:chrome-devtools',
              name: 'chrome-devtools',
              description: 'Browser inspection.',
              sourceId: 'workspace-imported-library',
              sourceLabel: 'Imported',
              sourceTrust: 'review',
              license: 'MIT',
              imported: true,
              bundleTags: ['browser'],
              supportFileCount: 1,
              dirPath: 'C:/skills/chrome-devtools',
              skillFilePath: 'C:/skills/chrome-devtools/SKILL.md',
              searchText: 'chrome devtools browser inspection security',
              provenance: null,
              metadata: {} as any,
            },
            {
              id: 'skill:security-threat-model',
              name: 'security-threat-model',
              description: 'Threat modeling.',
              sourceId: 'workspace-imported-library',
              sourceLabel: 'Imported',
              sourceTrust: 'review',
              license: 'Apache-2.0',
              imported: true,
              bundleTags: ['security'],
              supportFileCount: 1,
              dirPath: 'C:/skills/security-threat-model',
              skillFilePath: 'C:/skills/security-threat-model/SKILL.md',
              searchText: 'security threat model release hardening',
              provenance: null,
              metadata: {} as any,
            },
            {
              id: 'skill:web-quality-audit',
              name: 'web-quality-audit',
              description: 'Web auditing.',
              sourceId: 'workspace-imported-library',
              sourceLabel: 'Imported',
              sourceTrust: 'review',
              license: 'MIT',
              imported: true,
              bundleTags: ['web', 'audit'],
              supportFileCount: 1,
              dirPath: 'C:/skills/web-quality-audit',
              skillFilePath: 'C:/skills/web-quality-audit/SKILL.md',
              searchText: 'web quality audit security release',
              provenance: null,
              metadata: {} as any,
            },
          ],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({
      selectedId: 'chrome-devtools',
      recommendFor: 'release de security na web',
    });

    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        name: 'chrome-devtools',
      }),
    );
    expect(snapshot.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'security-hardening',
        }),
      ]),
    );
    expect(snapshot.recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'security-hardening',
          kind: 'recipe',
        }),
      ]),
    );
  });
});
