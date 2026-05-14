import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';
import { SkillRecipeService } from '../../src/services/SkillRecipeService.js';

describe('SkillRecipeService', () => {
  const entries: SkillCatalogEntry[] = [
    {
      id: 'skill:tlc-spec-driven',
      name: 'tlc-spec-driven',
      description: 'Spec-driven discovery.',
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Imported',
      sourceTrust: 'review',
      license: 'MIT',
      imported: true,
      bundleTags: ['spec'],
      supportFileCount: 2,
      dirPath: 'C:/skills/tlc-spec-driven',
      skillFilePath: 'C:/skills/tlc-spec-driven/SKILL.md',
      searchText: 'tlc spec driven discovery',
      provenance: null,
      metadata: {} as any,
    },
    {
      id: 'skill:technical-design-doc-creator',
      name: 'technical-design-doc-creator',
      description: 'Technical design docs.',
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Imported',
      sourceTrust: 'review',
      license: 'MIT',
      imported: true,
      bundleTags: ['design'],
      supportFileCount: 1,
      dirPath: 'C:/skills/technical-design-doc-creator',
      skillFilePath: 'C:/skills/technical-design-doc-creator/SKILL.md',
      searchText: 'technical design docs',
      provenance: null,
      metadata: {} as any,
    },
    {
      id: 'skill:skill-architect',
      name: 'skill-architect',
      description: 'Skill composition.',
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Imported',
      sourceTrust: 'review',
      license: 'MIT',
      imported: true,
      bundleTags: ['architecture'],
      supportFileCount: 1,
      dirPath: 'C:/skills/skill-architect',
      skillFilePath: 'C:/skills/skill-architect/SKILL.md',
      searchText: 'skill architect architecture',
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
      searchText: 'security threat model hardening',
      provenance: null,
      metadata: {} as any,
    },
    {
      id: 'skill:web-quality-audit',
      name: 'web-quality-audit',
      description: 'Auditoria web.',
      sourceId: 'workspace-imported-library',
      sourceLabel: 'Imported',
      sourceTrust: 'review',
      license: 'MIT',
      imported: true,
      bundleTags: ['web', 'audit'],
      supportFileCount: 1,
      dirPath: 'C:/skills/web-quality-audit',
      skillFilePath: 'C:/skills/web-quality-audit/SKILL.md',
      searchText: 'web quality audit security',
      provenance: null,
      metadata: {} as any,
    },
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
      searchText: 'chrome devtools browser inspection',
      provenance: null,
      metadata: {} as any,
    },
  ];

  it('builds ready recipes from the curated imported skill set', () => {
    const service = new SkillRecipeService();

    const recipes = service.buildRecipes(entries);

    expect(recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'spec-driven-delivery',
          ready: true,
          skillLabels: expect.arrayContaining([
            'tlc-spec-driven',
            'technical-design-doc-creator',
            'skill-architect',
          ]),
        }),
        expect.objectContaining({
          id: 'security-hardening',
          ready: true,
          skillLabels: expect.arrayContaining([
            'security-threat-model',
            'web-quality-audit',
            'chrome-devtools',
          ]),
        }),
      ]),
    );
  });

  it('recommends the security recipe for security-oriented prompts', () => {
    const service = new SkillRecipeService();
    const recipes = service.buildRecipes(entries);

    const recommendations = service.buildRecommendations({
      entries,
      recipes,
      query: 'release de seguranca para a web',
      selectedEntry: null,
      selectedRecipe: null,
    });

    expect(recommendations[0]).toEqual(
      expect.objectContaining({
        id: 'security-hardening',
        kind: 'recipe',
      }),
    );
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'skill',
          label: 'security-threat-model',
        }),
      ]),
    );
  });
});
