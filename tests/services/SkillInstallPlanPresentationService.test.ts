import { SkillInstallPlanPresentationService } from '../../src/services/SkillInstallPlanPresentationService.js';

describe('SkillInstallPlanPresentationService', () => {
  it('builds a recipe-focused plan with steps and caution', () => {
    const service = new SkillInstallPlanPresentationService({
      now: () => new Date('2026-04-08T13:00:00.000Z'),
      skillLibraryPresentationService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:59:00.000Z',
          catalog: {
            selected: null,
            selectedRecipe: {
              id: 'security-hardening',
              label: 'Hardening e audit de security',
              summary: 'Hardening antes de release.',
              rationale: 'Boa antes de abrir surfaces.',
              actionHint: 'Use em release.',
              tags: ['security'],
              recommendedFor: ['release'],
              skillIds: ['security-threat-model', 'web-quality-audit'],
              skillLabels: ['security-threat-model', 'web-quality-audit'],
              missingSkillIds: [],
              ready: true,
              steps: ['Modele ameacas.', 'Audite a web.'],
              searchText: 'security',
            },
            entries: [
              {
                id: 'skill:security-threat-model',
                name: 'security-threat-model',
                description: 'Modela ameacas.',
                sourceId: 'workspace-imported-library',
                sourceLabel: 'Workspace imported skill library',
                sourceTrust: 'trusted',
                license: 'MIT',
                imported: true,
                bundleTags: ['security'],
                supportFileCount: 2,
                dirPath: 'C:/skills/security-threat-model',
                skillFilePath: 'C:/skills/security-threat-model/SKILL.md',
                searchText: 'security threat model',
                provenance: null,
                metadata: {} as any,
              },
              {
                id: 'skill:web-quality-audit',
                name: 'web-quality-audit',
                description: 'Audita a web.',
                sourceId: 'workspace-imported-library',
                sourceLabel: 'Workspace imported skill library',
                sourceTrust: 'review',
                license: 'MIT',
                imported: true,
                bundleTags: ['security'],
                supportFileCount: 1,
                dirPath: 'C:/skills/web-quality-audit',
                skillFilePath: 'C:/skills/web-quality-audit/SKILL.md',
                searchText: 'web quality audit',
                provenance: null,
                metadata: {} as any,
              },
            ],
            recipes: [],
            recommendations: [],
          },
          mcp: {
            summary: {
              skills: 2,
              recipes: 1,
              importedSkills: 2,
              recommendations: 0,
              tools: 4,
              resources: 3,
            },
          },
          bundles: [],
          sources: [],
          trust: [],
          vendors: [
            {
              vendorId: 'omni-zavorth-bridge-remote-chat',
              displayName: 'Zavorth Bridge Remote Chat',
              status: 'update_available',
              ready: false,
              live: true,
              updateAvailable: true,
              baseUrl: 'http://127.0.0.1:4747',
              summary: 'warming-up | update disponivel.',
              recommendedAction: 'Manter isolado do core.',
              actionCommand: '/integrations omni-zavorth-bridge-remote-chat',
              licenseDecision: {
                vendorId: 'omni-zavorth-bridge-remote-chat',
                displayName: 'Zavorth Bridge Remote Chat',
                license: 'GPL-3.0-only',
                releaseIsolation: 'vendor-isolated',
                coreCopyPolicy: 'isolated-vendor-only',
                reviewRequired: true,
                allowVendorSync: true,
                allowCoreCopy: false,
                rationale: 'Vendor GPL isolado.',
                recommendedAction: 'Copy ideas, not code.',
                summary: 'Vendor isolado por licenca.',
              },
            },
          ],
          actions: [
            {
              id: 'skills-library',
              label: 'Abrir biblioteca',
              command: '/skills library',
              rationale: 'overview',
            },
          ],
          narrative: {
            headline: 'Biblioteca operacional',
            operatorSummary: '2 skills visible.',
            nextAction: '/skills plan recipe security-hardening',
          },
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ recipeId: 'security-hardening' });

    expect(snapshot.focus).toEqual(expect.objectContaining({
      kind: 'recipe',
      id: 'security-hardening',
    }));
    expect(snapshot.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Abrir recipe', command: '/skills recipe security-hardening' }),
      expect.objectContaining({ label: 'Step 1', detail: 'Modele ameacas.' }),
      expect.objectContaining({ label: 'Prepare Zavorth Bridge Remote Chat', optional: true }),
    ]));
    expect(snapshot.narrative.caution).toContain('permanece isolado por licenca');
    expect(service.renderReport({ recipeId: 'security-hardening' })).toContain('Plan de installation de skills');
  });
});
