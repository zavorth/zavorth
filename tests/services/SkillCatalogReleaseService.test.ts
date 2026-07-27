import { SkillCatalogReleaseService } from '../../src/services/SkillCatalogReleaseService.js';

describe('SkillCatalogReleaseService', () => {
  it('builds a combined release snapshot for catalog and MCP', () => {
    const service = new SkillCatalogReleaseService({
      now: () => new Date('2026-04-08T18:00:00.000Z'),
      skillCatalogApiService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T17:59:00.000Z',
          query: null,
          recommendFor: null,
          summary: {
            total: 4,
            local: 1,
            imported: 3,
            trusted: 1,
            review: 3,
            blocked: 0,
            withSupportFiles: 4,
            bundled: 3,
            visible: 4,
            recipes: 2,
            readyRecipes: 1,
            recommendations: 2,
          },
          entries: [
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
              searchText: 'security',
              provenance: null,
              risk: {
                score: 39,
                level: 'medium',
                reviewRequired: true,
                reasons: ['Fonte exige review.'],
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
                lastEventId: 'import-1',
                trailFilePath: 'C:/skills/imported/.zavorth-import-audit.json',
                lastAction: 'import',
                lastRecordedAt: '2026-04-08T17:00:00.000Z',
              },
              metadata: {} as any,
            },
          ],
          recipes: [
            {
              id: 'security-hardening',
              label: 'Security hardening',
              summary: 'Checklist de endurecimento.',
              ready: true,
              searchText: 'security',
              skillIds: ['skill:security-threat-model'],
              skillLabels: ['security-threat-model'],
              missingSkillIds: [],
              steps: ['Mapear ameacas'],
            },
          ],
          selected: null,
          selectedRecipe: null,
          recommendations: [
            {
              id: 'security-hardening',
              kind: 'recipe',
              label: 'Security hardening',
              reason: 'Bom para release.',
            },
          ],
          narrative: {
            headline: 'Skill plane do Zavorth',
            operatorSummary: 'ok',
          },
        })),
        renderReport: jest.fn(() => 'catalog report'),
      } as any,
      skillMcpSidecarService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T17:59:00.000Z',
          capability: 'skill-catalog',
          summary: {
            skills: 4,
            recipes: 2,
            importedSkills: 3,
            recommendations: 2,
            tools: 4,
            resources: 6,
          },
          tools: [],
          resources: [],
          selectedSkill: null,
          selectedRecipe: null,
          recommendations: [],
          narrative: {
            headline: 'mcp',
            operatorSummary: 'ok',
          },
        })),
        renderReport: jest.fn(() => 'mcp report'),
      } as any,
    });

    const snapshot = service.buildSnapshot();
    const markdown = service.renderMarkdown();

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        importedSkills: 3,
        readyRecipes: 1,
        reviewRequiredSkills: 1,
        mcpResources: 6,
      }),
    );
    expect(markdown).toContain('# Zavorth Skill Catalog Release');
    expect(markdown).toContain('catalog report');
    expect(markdown).toContain('mcp report');
  });
});
