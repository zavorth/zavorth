import { SkillMcpSidecarService } from '../../src/services/SkillMcpSidecarService.js';

describe('SkillMcpSidecarService', () => {
  it('projects the skill catalog as an MCP-ready discovery surface', () => {
    const service = new SkillMcpSidecarService({
      now: () => new Date('2026-04-08T12:30:00.000Z'),
      skillCatalogApiService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:29:00.000Z',
          query: null,
          recommendFor: null,
          summary: {
            total: 2,
            local: 0,
            imported: 2,
            trusted: 0,
            review: 2,
            blocked: 0,
            withSupportFiles: 2,
            bundled: 2,
            visible: 2,
            recipes: 1,
            readyRecipes: 1,
            recommendations: 1,
          },
          entries: [
            {
              id: 'skill:chrome-devtools',
              name: 'chrome-devtools',
              description: 'Browser inspection.',
            },
            {
              id: 'skill:codenavi',
              name: 'codenavi',
              description: 'Code navigation.',
            },
          ],
          recipes: [
            {
              id: 'codebase-navigation',
              label: 'Navegacao e depuracao rapida',
              summary: 'Mapeamento e depuracao.',
            },
          ],
          selected: {
            id: 'skill:chrome-devtools',
            name: 'chrome-devtools',
            description: 'Browser inspection.',
          },
          selectedRecipe: null,
          recommendations: [
            {
              id: 'codebase-navigation',
              kind: 'recipe',
              label: 'Navegacao e depuracao rapida',
              reason: 'Recipe pronta.',
              score: 4,
            },
          ],
          narrative: {
            headline: 'Skill plane',
            operatorSummary: 'Tudo ok.',
          },
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.capability).toBe('skill-catalog');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        skills: 2,
        recipes: 1,
        tools: 4,
      }),
    );
    expect(snapshot.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'inspect-skill' }),
        expect.objectContaining({ id: 'recommend-skills' }),
      ]),
    );
    expect(snapshot.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'skill:chrome-devtools', kind: 'skill' }),
        expect.objectContaining({ id: 'recipe:codebase-navigation', kind: 'recipe' }),
      ]),
    );
  });
});
