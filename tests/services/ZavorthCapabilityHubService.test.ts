import { ZavorthCapabilityHubApiService } from '../../src/services/ZavorthCapabilityHubApiService';
import { ZavorthCapabilityHubService } from '../../src/services/ZavorthCapabilityHubService';
import { CAPABILITY_HUB_CONTRACT_VERSION } from '../../src/contracts/CapabilityHubContract';

describe('ZavorthCapabilityHubService', () => {
  it('builds the canonical Security contract catalog across channels, skills, MCP, providers and recipes', () => {
    const service = new ZavorthCapabilityHubService(buildRuntime());

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(CAPABILITY_HUB_CONTRACT_VERSION);
    expect(snapshot.rootPolicy).toMatchObject({
      canonicalRoot: 'zavorth-core/Zavorth',
      externalCapabilityRootsAllowed: false,
      importsMustNormalizeToZavorthContract: true,
      secretsSerialized: false,
    });
    expect(snapshot.items.map((item) => item.kind)).toEqual(expect.arrayContaining([
      'runtime-capability',
      'channel',
      'integration',
      'provider',
      'mcp',
      'skill',
      'recipe',
    ]));
    expect(snapshot.summary.total).toBeGreaterThanOrEqual(7);
    expect(snapshot.summary.approvalGated).toBeGreaterThan(0);
    expect(snapshot.items.every((item) => item.provenance.canonicalRootOnly)).toBe(true);
  });

  it('filters and inspects items through the API facade', () => {
    const api = new ZavorthCapabilityHubApiService(buildRuntime());

    const filtered = api.list({ kind: 'channel', search: 'slack' });
    const inspected = api.inspect('slack');

    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('channel:slack');
    expect(inspected.found).toBe(true);
    expect(inspected.item?.id).toBe('channel:slack');
    expect(inspected.related.length).toBeGreaterThan(0);
  });
});

function buildRuntime() {
  return {
    now: () => new Date('2026-05-07T12:00:00.000Z'),
    capabilityRegistry: {
      getAll: () => ([
        {
          id: 'runtime-research',
          label: 'Runtime Research',
          type: 'research',
          description: 'Research capability.',
          intent: 'research',
          executor_preference: 'agent',
          dispatch_mode: 'planning',
          enabled: true,
          tags: ['research'],
          command: {
            command: '/research',
            description: 'Run governed research.',
          },
          matchers: [],
          policy: {
            executor: 'agent',
            requiresApproval: false,
            dangerLevel: 'low',
            networkScope: 'external-policy',
          },
          source: 'builtin',
        },
      ] as any),
    },
    channelRegistryService: {
      buildSnapshot: () => ({
        generatedAt: '2026-05-07T12:00:00.000Z',
        summary: {
          total: 1,
          ready: 1,
          partial: 0,
          planned: 0,
          disabled: 0,
        },
        channels: [
          {
            id: 'slack',
            label: 'Slack',
            readiness: 'ready',
            configured: true,
            transport: 'web-api',
            notes: ['Slack bot token configured.'],
            features: {
              sessionList: true,
              sessionHistory: true,
              sessionSend: true,
              sessionSpawn: false,
              attachments: true,
              threads: true,
              groupPolicy: true,
            },
          },
        ],
        narrative: {
          headline: 'channels',
          operatorSummary: '1 ready',
        },
      }),
    },
    integrationHubService: {
      buildCatalogSnapshot: () => ({
        generatedAt: '2026-05-07T12:00:00.000Z',
        entries: [
          {
            manifest: {
              id: 'github',
              label: 'GitHub',
              aliases: ['gh'],
              summary: 'Governed GitHub integration.',
              description: 'Creates issues and reads pull requests through policy.',
              supportLevel: 'native',
              category: 'remote',
              tags: ['code', 'issues'],
              modes: [
                {
                  id: 'api',
                  label: 'API',
                  summary: 'GitHub API',
                  autoInstallable: false,
                  safeByDefault: true,
                },
              ],
              defaultMode: 'api',
              capabilities: ['code', 'automation'],
              binding: {
                kind: 'service',
                key: 'github',
                status: 'ready',
                summary: 'GitHub service',
              },
              requirements: [
                {
                  id: 'github.token',
                  type: 'env',
                  label: 'Token',
                  description: 'GitHub token.',
                  required: true,
                  secret: true,
                  envKey: 'GITHUB_TOKEN',
                },
              ],
              onboardingQuestions: [],
              installSteps: [
                {
                  id: 'verify',
                  title: 'Verify token',
                  description: 'Check API auth.',
                  kind: 'verification',
                },
              ],
              safetyNotes: ['Approval required for writes.'],
              goodFor: ['issues'],
            },
            installed: {
              configuredAt: '2026-05-07T12:00:00.000Z',
            },
            doctor: {},
            readiness: 'ready',
          },
        ],
        featuredIds: ['github'],
        templateIds: [],
        providers: {
          generatedAt: '2026-05-07T12:00:00.000Z',
          activeProviderName: 'gemini',
          activeModelName: 'gemini-2.5-flash',
          preferredZavorthBridgeModel: null,
          recommendedProfile: {
            id: 'coding',
            label: 'Coding',
            providerName: 'gemini',
            modelName: 'gemini-2.5-flash',
            fallbackOrder: [],
          },
          ready: [
            {
              id: 'gemini',
              label: 'Gemini',
              effectiveProviderName: 'gemini',
              mode: 'cloud',
              readiness: 'ready',
              currentModel: 'gemini-2.5-flash',
              summary: 'Ready provider.',
              issue: null,
            },
          ],
          needsConfiguration: [],
          needsProbe: [],
          profiles: [],
          usageTargets: [],
          recommendations: [],
        },
        mcp: {
          generatedAt: '2026-05-07T12:00:00.000Z',
          manifestPath: 'config/mcp-servers.json',
          summary: {
            total: 1,
            enabled: 1,
            connected: 1,
            failed: 0,
            disabled: 0,
            stopped: 0,
            toolCount: 2,
            capabilityCount: 1,
          },
          capabilities: ['filesystem'],
          entries: [
            {
              id: 'filesystem',
              capability: 'filesystem',
              enabled: true,
              status: 'connected',
              toolCount: 2,
              toolNames: ['read', 'write'],
              summary: 'Filesystem MCP connected.',
              issue: null,
              lastAttemptedAt: '2026-05-07T12:00:00.000Z',
              lastConnectedAt: '2026-05-07T12:00:00.000Z',
            },
          ],
          recommendations: [],
          narrative: {
            headline: 'mcp',
            operatorSummary: 'connected',
          },
        },
        selected: null,
      } as any),
    },
    skillCatalogService: {
      buildSnapshot: () => ({
        generatedAt: '2026-05-07T12:00:00.000Z',
        summary: {
          total: 1,
          local: 1,
          imported: 0,
          trusted: 1,
          review: 0,
          blocked: 0,
          withSupportFiles: 1,
          bundled: 1,
        },
        bundles: [],
        entries: [
          {
            id: 'skill-research',
            name: 'research-pack',
            description: 'Research workflow skill.',
            sourceId: 'local',
            sourceLabel: 'Local',
            sourceTrust: 'trusted',
            license: 'MIT',
            imported: false,
            bundleTags: ['research'],
            supportFileCount: 1,
            dirPath: 'skill-library/research-pack',
            skillFilePath: 'skill-library/research-pack/SKILL.md',
            searchText: 'research workflow',
            provenance: null,
            risk: {
              score: 1,
              level: 'low',
              reviewRequired: false,
              reasons: [],
            },
            licensePolicy: null,
            audit: null,
            metadata: {},
          },
        ],
      } as any),
    },
    skillRecipeService: {
      buildRecipes: () => ([
        {
          id: 'research-governed',
          label: 'Governed Research',
          summary: 'Research with receipts.',
          rationale: 'Keeps research auditable.',
          actionHint: 'Use for evidence-first research.',
          tags: ['research'],
          recommendedFor: ['research'],
          skillIds: ['research-pack'],
          skillLabels: ['research-pack'],
          missingSkillIds: [],
          ready: true,
          steps: ['Search', 'Receipt', 'Summarize'],
          searchText: 'research receipts',
        },
      ]),
    },
  };
}
