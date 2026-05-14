import { ZavorthGovernanceRecipeApiService } from '../../src/services/ZavorthGovernanceRecipeApiService';
import { ZavorthGovernanceRecipeService } from '../../src/services/ZavorthGovernanceRecipeService';
import { GOVERNANCE_RECIPE_CONTRACT_VERSION } from '../../src/contracts/GovernanceRecipeContract';

describe('ZavorthGovernanceRecipeService', () => {
  it('builds governance plans with permission, budget, sandbox, receipts and rollback', () => {
    const service = new ZavorthGovernanceRecipeService({
      now: () => new Date('2026-05-07T13:00:00.000Z'),
      ...buildHubRuntime(),
    });

    const plan = service.buildPlan({
      targetItemId: 'channel:slack',
      recipeId: 'safe-channel-activation',
    });

    expect(plan).toMatchObject({
      contractVersion: GOVERNANCE_RECIPE_CONTRACT_VERSION,
      recipeId: 'safe-channel-activation',
      targetItemId: 'channel:slack',
      status: 'approval_required',
      dryRunOnly: true,
      permissions: {
        approvalRequired: true,
        allowedToolPolicy: 'approved_only',
        liveExecutionAllowed: false,
      },
      budget: {
        maxUsd: 1,
        maxToolCalls: 8,
        maxRuntimeMinutes: 10,
        withinDefaultBudget: true,
      },
      sandbox: {
        tier: 'local-jail',
      },
      rollback: {
        available: true,
        strategy: 'disable_capability',
        requiresExplicitCommand: true,
      },
    });
    expect(plan?.receipts.map((receipt) => receipt.kind)).toEqual(expect.arrayContaining([
      'setup-plan',
      'readiness-check',
      'approval-decision',
      'delivery-audit',
    ]));
    expect(plan?.steps.map((step) => step.kind)).toEqual(expect.arrayContaining([
      'readiness',
      'permission',
      'budget',
      'sandbox',
      'receipt',
      'rollback',
      'activation',
    ]));
  });

  it('executes a dry-run receipt without live side effects', () => {
    const api = new ZavorthGovernanceRecipeApiService({
      now: () => new Date('2026-05-07T13:00:00.000Z'),
      ...buildHubRuntime(),
    });

    const receipt = api.dryRun({
      targetItemId: 'skill:research-pack',
      recipeId: 'governed-skill-run',
      approvalId: 'approval-123',
    });

    expect(receipt).toMatchObject({
      contractVersion: GOVERNANCE_RECIPE_CONTRACT_VERSION,
      recipeId: 'governed-skill-run',
      targetItemId: 'skill:research-pack',
      status: 'dry_run_completed',
      dryRun: true,
      approvalId: 'approval-123',
      rollback: {
        available: true,
        strategy: 'restore_previous_config',
      },
    });
    expect(receipt?.receiptIds).toEqual(expect.arrayContaining([
      'receipt:governed-skill-run:skill:research-pack:tool-policy',
      'receipt:governed-skill-run:skill:research-pack:rollback-token',
    ]));
  });

  it('summarizes recipe coverage from the Capability Hub', () => {
    const service = new ZavorthGovernanceRecipeService({
      now: () => new Date('2026-05-07T13:00:00.000Z'),
      ...buildHubRuntime(),
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe(GOVERNANCE_RECIPE_CONTRACT_VERSION);
    expect(snapshot.summary.recipes).toBe(3);
    expect(snapshot.plans.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.plans.some((plan) => plan.targetItemId === 'provider:gemini')).toBe(true);
    expect(snapshot.narrative.operatorSummary).toContain('rollback');
  });
});

function buildHubRuntime() {
  return {
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
        generatedAt: '2026-05-07T13:00:00.000Z',
        summary: {
          total: 1,
          ready: 0,
          partial: 1,
          planned: 0,
          disabled: 0,
        },
        channels: [
          {
            id: 'slack',
            label: 'Slack',
            readiness: 'partial',
            configured: true,
            transport: 'web-api',
            notes: ['Slack needs live approval before send.'],
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
          operatorSummary: '1 partial',
        },
      }),
    },
    integrationHubService: {
      buildCatalogSnapshot: () => ({
        generatedAt: '2026-05-07T13:00:00.000Z',
        entries: [],
        featuredIds: [],
        templateIds: [],
        providers: {
          generatedAt: '2026-05-07T13:00:00.000Z',
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
          generatedAt: '2026-05-07T13:00:00.000Z',
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
          entries: [],
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
        generatedAt: '2026-05-07T13:00:00.000Z',
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
            id: 'research-pack',
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
