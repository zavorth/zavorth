import { SkillLibraryPresentationService } from '../../src/services/SkillLibraryPresentationService.js';

describe('SkillLibraryPresentationService', () => {
  function createVendorEntry(overrides: Record<string, any> = {}) {
    return {
      vendorId: 'AIGateway',
      displayName: 'AIGateway',
      license: 'MIT',
      integrationMode: 'vendor',
      upstream: 'https://github.com/example/AIGateway',
      resolvedSourceType: 'local',
      resolvedSource: 'C:/vendors/AIGateway',
      mirrorDir: 'C:/vendors/zavorth-ai-gateway-mirror.git',
      worktreeDir: 'C:/vendors/AIGateway',
      lockedCommit: 'abc123',
      sourceHead: 'def456',
      mirrorHead: 'def456',
      worktreeCommit: 'abc123',
      status: 'update_available',
      updateAvailable: true,
      live: true,
      ready: false,
      baseUrl: 'http://127.0.0.1:20128',
      port: 20128,
      statusFile: 'C:/tmp/status.json',
      healthFile: 'C:/tmp/health.json',
      syncStatus: 'inspected',
      syncSummary: 'Update pendente do vendor.',
      healthSummary: 'Gateway ainda nao esta pronto.',
      lastAction: {
        type: 'update',
        createdAt: '2026-04-08T12:00:00.000Z',
        trimmed: 'git fetch',
      },
      diff: {
        vendorId: 'AIGateway',
        displayName: 'AIGateway',
        status: 'update_available',
        changed: true,
        lockedCommit: 'abc123',
        worktreeCommit: 'abc123',
        sourceHead: 'def456',
        currentCommit: 'abc123',
        targetCommit: 'def456',
        currentShort: 'abc123',
        targetShort: 'def456',
        lastActionType: 'update',
        lastActionAt: '2026-04-08T12:00:00.000Z',
        trimmed: 'git fetch',
        summary: 'Existe update pendente.',
      },
      licenseDecision: {
        vendorId: 'AIGateway',
        displayName: 'AIGateway',
        license: 'MIT',
        releaseIsolation: 'core-safe',
        coreCopyPolicy: 'allow-with-attribution',
        reviewRequired: false,
        allowVendorSync: true,
        allowCoreCopy: true,
        rationale: 'Licenca compativel com o core.',
        recommendedAction: 'Sincronizar o vendor antes de promover.',
        summary: 'Licenca compativel com sync no core.',
      },
      ...overrides,
    };
  }

  it('builds a library snapshot with bundles, trust and vendor actions', () => {
    const service = new SkillLibraryPresentationService({
      now: () => new Date('2026-04-08T12:30:00.000Z'),
      skillCatalogApiService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:00:00.000Z',
          query: 'security',
          recommendFor: null,
          summary: {
            total: 3,
            visible: 2,
            local: 0,
            imported: 3,
            trusted: 2,
            review: 1,
            blocked: 0,
            recipes: 2,
            readyRecipes: 1,
            recommendations: 1,
          },
          entries: [
            {
              id: 'skill:security-threat-model',
              name: 'security-threat-model',
              description: 'Modela ameacas e trust boundaries.',
              sourceId: 'workspace-imported-library',
              sourceLabel: 'Workspace imported skill library',
              sourceTrust: 'trusted',
              license: 'MIT',
              imported: true,
              bundleTags: ['security', 'audit'],
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
              description: 'Audita a superficie web.',
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
          recipes: [
            {
              id: 'security-hardening',
              label: 'Hardening e auditoria de seguranca',
              summary: 'Hardening antes de release.',
              rationale: 'Boa antes de abrir superficies.',
              actionHint: 'Use em releases publicos.',
              tags: ['security'],
              recommendedFor: ['release'],
              skillIds: ['security-threat-model', 'web-quality-audit'],
              skillLabels: ['security-threat-model', 'web-quality-audit'],
              missingSkillIds: [],
              ready: true,
              steps: ['Modele ameacas.', 'Audite a web.'],
              searchText: 'security',
            },
          ],
          selected: null,
          selectedRecipe: null,
          recommendations: [
            {
              id: 'security-hardening',
              kind: 'recipe',
              label: 'Hardening e auditoria de seguranca',
              reason: 'Recipe pronta com as skills certas.',
              score: 5,
            },
          ],
          narrative: {
            headline: 'headline',
            operatorSummary: 'operator summary',
          },
        })),
      } as any,
      skillCatalogService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:00:00.000Z',
          summary: {
            total: 3,
            local: 0,
            imported: 3,
            trusted: 2,
            review: 1,
            blocked: 0,
            withSupportFiles: 3,
            bundled: 2,
          },
          bundles: [
            {
              tag: 'security',
              skillCount: 2,
              skillNames: ['security-threat-model', 'web-quality-audit'],
            },
            {
              tag: 'audit',
              skillCount: 1,
              skillNames: ['security-threat-model'],
            },
          ],
          entries: [],
        })),
      } as any,
      skillMcpSidecarService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:00:00.000Z',
          capability: 'skill-catalog',
          summary: {
            skills: 2,
            recipes: 1,
            importedSkills: 2,
            recommendations: 1,
            tools: 4,
            resources: 3,
          },
          tools: [],
          resources: [],
          selectedSkill: null,
          selectedRecipe: null,
          recommendations: [],
          narrative: {
            headline: 'mcp',
            operatorSummary: 'mcp summary',
          },
        })),
      } as any,
      vendorReleaseIndexService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-08T12:00:00.000Z',
          summary: {
            total: 1,
            updateAvailable: 1,
            live: 1,
            ready: 0,
            reviewRequired: 0,
            blockedForCoreCopy: 0,
          },
          entries: [createVendorEntry()],
        })),
      } as any,
    });

    const snapshot = service.buildSnapshot({ query: 'security' });

    expect(snapshot.bundles[0]?.tag).toBe('security');
    expect(snapshot.sources[0]).toEqual(expect.objectContaining({
      sourceId: 'workspace-imported-library',
      imported: 2,
    }));
    expect(snapshot.trust).toEqual(expect.arrayContaining([
      expect.objectContaining({ trust: 'trusted', count: 1 }),
      expect.objectContaining({ trust: 'review', count: 1 }),
    ]));
    expect(snapshot.vendors[0]).toEqual(expect.objectContaining({
      vendorId: 'AIGateway',
      actionCommand: '/AIGateway sync',
    }));
    expect(snapshot.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ command: '/skills library' }),
      expect.objectContaining({ command: '/skills plan recipe security-hardening' }),
      expect.objectContaining({ command: '/AIGateway sync' }),
    ]));
    expect(service.renderReport({ query: 'security' })).toContain('Vendors de apoio');
  });
});
