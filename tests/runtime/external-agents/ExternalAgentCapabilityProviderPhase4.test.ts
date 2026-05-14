import {
  buildDashboardCommandCenterViewModel,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import {
  ExternalAgentCapabilityProvider,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';

describe('Plan 111 Phase 4 external capability provider', () => {
  function createProvider() {
    const adapter = new QuarantinedExternalExecutorSidecarAdapter({
      client: new FixtureExternalExecutorSidecarClient(),
      now: () => new Date('2026-04-27T18:00:00.000Z'),
    });
    return new ExternalAgentCapabilityProvider({
      adapter,
      now: () => new Date('2026-04-27T18:01:00.000Z'),
    });
  }

  it('imports source capabilities and skill manifests into Zavorth inventory with risk and policy', async () => {
    const provider = createProvider();
    const snapshot = await provider.buildInventory({
      skillManifests: [
        {
          id: 'write-plan-skill',
          name: 'WritePlanSkill',
          title: 'Workspace write planner',
          description: 'Fixture skill that drafts a workspace write and must require approval.',
          tools: ['write_file'],
          risk: 'safe',
          trustState: 'safe',
          sourceRuntimeName: 'ExternalExecutor',
          sourceCapabilityName: 'skills/write-plan',
          sourceManifestPath: 'skills/write-plan/SKILL.md',
          observedAt: '2026-04-27T18:00:00.000Z',
        },
        {
          id: 'legacy-webhook-skill',
          name: 'LegacyWebhookSkill',
          title: 'Legacy webhook skill',
          description: 'Unavailable fixture skill should fail honestly.',
          tools: ['webhook.send'],
          risk: 'attention',
          trustState: 'safe',
          available: false,
          sourceRuntimeName: 'ExternalExecutor',
          sourceCapabilityName: 'skills/legacy-webhook',
          sourceManifestPath: 'skills/legacy-webhook/SKILL.md',
          observedAt: '2026-04-27T18:00:00.000Z',
        },
      ],
    });

    const writePlanner = snapshot.items.find((item) => item.id === 'external-capability:write-plan-skill');
    const unavailable = snapshot.items.find((item) => item.id === 'external-capability:legacy-webhook-skill');
    const quarantined = snapshot.items.find((item) => item.id === 'external-capability:source-tool-exec');

    expect(snapshot.summary).toEqual({
      total: 5,
      available: 4,
      degraded: 0,
      unavailable: 1,
      approvalRequired: 4,
      blocked: 1,
      dangerous: 2,
    });
    expect(writePlanner).toEqual(expect.objectContaining({
      label: 'Workspace write planner',
      risk: 'danger',
      requiresApproval: true,
      toolNames: ['write_file'],
      policy: {
        exposure: 'approval-required',
      },
    }));
    expect(unavailable).toEqual(expect.objectContaining({
      status: 'unavailable',
      policy: {
        exposure: 'unavailable',
        blockedReason: 'external-capability-unavailable',
      },
    }));
    expect(quarantined).toEqual(expect.objectContaining({
      trustState: 'quarantined',
      policy: {
        exposure: 'blocked',
        blockedReason: 'blocked-by-external-capability-quarantine',
      },
    }));
    expect(snapshot.toolExposureProfile.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'write_file',
        risk: 'danger',
        requiresApproval: true,
      }),
    ]));
    expect(snapshot.toolExposureProfile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'shell.exec',
        reason: 'blocked-by-external-adapter-quarantine',
      }),
    ]);
    expect(snapshot.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: 'external-capability:legacy-webhook-skill',
        reason: 'unavailable',
      }),
      expect.objectContaining({
        capabilityId: 'external-capability:source-tool-exec',
        reason: 'quarantined',
      }),
    ]));
    expect(JSON.stringify(snapshot)).not.toContain('ExternalExecutor');
    expect(JSON.stringify(snapshot.commandCenter)).not.toContain('ExternalExecutor');
  });

  it('makes imported capabilities visible through the Command Center adapter without source naming leaks', async () => {
    const provider = createProvider();
    const snapshot = await provider.buildInventory({
      skillManifests: [
        {
          id: 'write-plan-skill',
          title: 'Workspace write planner',
          tools: ['write_file'],
          risk: 'danger',
          trustState: 'safe',
          sourceRuntimeName: 'ExternalExecutor',
          observedAt: '2026-04-27T18:00:00.000Z',
        },
      ],
    });

    const viewModel = buildDashboardCommandCenterViewModel({
      ...provider.buildCommandCenterAdapterInput(snapshot),
      wsStatus: 'connected',
      runtime: {
        status: 'degraded',
        providerLabel: 'Zavorth',
        modelLabel: 'external-capability-provider',
      },
    });

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth External Capability Provider',
      version: 'phase-4',
    }));
    expect(viewModel.counts.capabilities).toBe(snapshot.items.length);
    expect(viewModel.sectors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'skills',
        badgeCount: snapshot.items.length,
      }),
    ]));
    expect(viewModel.integrations).toEqual([
      expect.objectContaining({
        id: 'external-runtime:primary-sidecar:capabilities',
        label: 'External capability provider',
        category: 'runtime',
        status: 'degraded',
      }),
    ]);
    expect(viewModel.toolExposure.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'write_file',
        risk: 'danger',
        requiresApproval: true,
      }),
    ]));
    expect(JSON.stringify(viewModel)).not.toContain('ExternalExecutor');
  });
});
