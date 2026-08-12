import type { SkillCatalogEntry } from '../../src/skills/SkillCatalogContract.js';
import type { ZavorthProviderModelCatalogSnapshot } from '../../src/contracts/ZavorthProviderModelCatalogContract.js';
import { ZavorthSmartCommandSurfaceService } from '../../src/services/ZavorthSmartCommandSurfaceService.js';

describe('ZavorthSmartCommandSurfaceService', () => {
  it('handles every official smart slash command with shared safety guarantees', async () => {
    const service = createService();
    const commands = [
      '/new',
      '/reset',
      '/model gemini:gemini-2.5-pro',
      '/personality faculdade',
      '/retry',
      '/undo',
      '/compress',
      '/usage',
      '/insights 14',
      '/skills security',
      '/stop',
      '/platforms',
      '/status',
      '/sethome C:/Users/test/Documents',
    ];

    for (const command of commands) {
      const snapshot = await service.buildSnapshot({ rawText: command, channel: 'telegram', sessionId: 's1' });
      expect(snapshot.surface).toBe('smart-command-surface');
      expect(snapshot.command.id).not.toBeNull();
      expect(snapshot.safety).toEqual(expect.objectContaining({
        noShellExecution: true,
        noNetworkProbe: true,
        noSecretSerialization: true,
        noFilesystemMutationWithoutApproval: true,
        noRuntimeAdapterInvocation: true,
      }));
      expect(snapshot.policy.crossSurfaceAliasesStable).toBe(true);
    }
  });

  it('requires approval for rollback/personality/stop and apply-style state changes', async () => {
    const service = createService();

    await expect(service.buildSnapshot({ rawText: '/undo' })).resolves.toEqual(expect.objectContaining({
      status: 'approval-required',
      action: expect.objectContaining({ requiresApproval: true }),
    }));
    await expect(service.buildSnapshot({ rawText: '/sethome C:/safe/path', apply: true })).resolves.toEqual(expect.objectContaining({
      status: 'approval-required',
      action: expect.objectContaining({ requiresApproval: true }),
    }));
    await expect(service.buildSnapshot({ rawText: '/sethome C:/safe/path', apply: true, approvalId: 'appr-1' })).resolves.toEqual(expect.objectContaining({
      status: 'handled',
    }));
  });

  it('uses catalog context for model, usage and skills without executing providers', async () => {
    const service = createService({
      skills: [skill('security-review', 'Review TypeScript security risks')],
    });

    const model = await service.buildSnapshot({ rawText: '/model' });
    const usage = await service.buildSnapshot({ rawText: '/usage' });
    const skills = await service.buildSnapshot({ rawText: '/skills security' });

    expect(model.reply.body).toContain('gemini');
    expect(usage.inventory.providersKnown).toBe(2);
    expect(skills.reply.body).toContain('security-review');
    expect(skills.action.performed).toBe(false);
  });

  it('leaves unknown text for the natural runtime', async () => {
    const snapshot = await createService().buildSnapshot({ rawText: 'analise este repositorio' });

    expect(snapshot.status).toBe('not-handled');
    expect(snapshot.command.id).toBeNull();
  });
});

function createService(input: { skills?: SkillCatalogEntry[] } = {}): ZavorthSmartCommandSurfaceService {
  return new ZavorthSmartCommandSurfaceService({
    now: () => new Date('2026-05-18T12:00:00.000Z'),
    skillCatalogService: {
      listEntries: () => input.skills || [],
    },
    providerModelCatalogService: {
      buildSnapshot: async () => providerCatalog(),
    },
  });
}

function skill(name: string, description: string): SkillCatalogEntry {
  return {
    id: `skill:${name}`,
    name,
    description,
    sourceId: null,
    sourceLabel: null,
    sourceTrust: null,
    license: null,
    imported: false,
    bundleTags: ['security'],
    supportFileCount: 0,
    dirPath: `/skills/${name}`,
    skillFilePath: `/skills/${name}/SKILL.md`,
    searchText: `${name} ${description}`.toLowerCase(),
    provenance: null,
    risk: null,
    licensePolicy: null,
    audit: null,
    metadata: {
      name,
      description,
      dirPath: `/skills/${name}`,
      skillFilePath: `/skills/${name}/SKILL.md`,
      supportFilePaths: [],
    },
  };
}

function providerCatalog(): ZavorthProviderModelCatalogSnapshot {
  return {
    contractVersion: '2026-05-17.provider-model-catalog.v1',
    schemaVersion: 1,
    surface: 'provider-model-catalog',
    generatedAt: '2026-05-18T12:00:00.000Z',
    status: 'ready',
    source: {
      readinessSurface: 'provider-readiness-matrix',
      staticCatalog: 'provider-integration-registry',
      liveEvidence: 'sanitized-provider-proof-store',
    },
    activeProvider: 'gemini',
    activeModel: 'gemini-2.5-pro',
    summary: {
      providerRoutes: 2,
      catalogReadyRoutes: 2,
      liveReadyRoutes: 1,
      defaultRouteAllowed: 1,
      catalogReadyButNotLive: 1,
      missingAuth: 0,
      missingBaseUrl: 0,
      staticCatalogModels: 8,
      liveDiscoveredModels: 3,
      effectiveModelSurface: 9,
      modalityCounts: { unknown: 0, text: 2, image: 1, audio: 0, video: 0, embedding: 0, tool: 1 },
      capabilityCounts: { chat: 2 },
    },
    sections: {
      liveValidated: ['gemini'],
      readyButNotLive: ['openrouter'],
      needsCredentials: [],
      needsBaseUrl: [],
      aggregators: ['openrouter'],
      localPrivate: [],
      mediaCapable: ['gemini'],
    },
    providers: [],
    commands: [],
    dashboardProjection: {
      route: '/zavorthControl',
      endpoint: '/api/providers/model-catalog',
      executionAuthority: false,
      normalRenderMakesNoNetworkCalls: true,
    },
    safety: {
      noRawProviderSecrets: true,
      catalogIsNotLiveProof: true,
      liveProbeRequiresExplicitOperatorAction: true,
      dashboardCannotExecuteProviderCalls: true,
      modelListingMayBeDynamicThroughAggregators: true,
    },
    nextAction: 'Ready.',
  };
}
