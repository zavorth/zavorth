import type { ZavorthCommandCenterProviderCockpitProjection } from '../../src/contracts/ZavorthCommandCenterProviderCockpitContract.js';
import { ZavorthCommandCenterVisualApprovalPackService } from '../../src/services/ZavorthCommandCenterVisualApprovalPackService.js';

describe('ZavorthCommandCenterVisualApprovalPackService', () => {
  it('builds an owner-gated visual proposal without mutating the dashboard', async () => {
    const service = new ZavorthCommandCenterVisualApprovalPackService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      cockpit: {
        buildProjection: jest.fn(async () => cockpitFixture()),
      },
    });

    const pack = await service.buildPack({
      providerId: 'openai',
      includeDetailsDrawer: true,
    });

    expect(pack).toEqual(expect.objectContaining({
      contractVersion: '2026-05-13.phase-7',
      surface: 'command-center-visual-approval-pack',
      approvalRequired: true,
      approved: false,
      visualMutationApplied: false,
      executionAuthority: false,
      sourceCockpitContractVersion: '2026-05-13.phase-6',
      target: expect.objectContaining({
        route: '/control',
        defaultDecision: 'do_not_render',
      }),
      safety: expect.objectContaining({
        noDashboardExecutionAuthority: true,
        noLayoutMutationBeforeApproval: true,
      }),
    }));
    expect(pack.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'provider-cockpit-summary-card',
        implementationStatus: 'proposal_only',
        userVisible: false,
        requiresOwnerApproval: true,
      }),
      expect.objectContaining({
        id: 'provider-cockpit-evidence-drawer',
        placement: 'details-drawer',
      }),
    ]));
    expect(pack.blocks.every((block) => block.interactionModel.every((action) => action.dashboardCanExecute === false))).toBe(true);
    expect(JSON.stringify(pack)).not.toContain('sk-test');
  });

  it('keeps details drawer optional for the first visual review', async () => {
    const service = new ZavorthCommandCenterVisualApprovalPackService({
      now: () => new Date('2026-05-13T12:00:00.000Z'),
      cockpit: {
        buildProjection: jest.fn(async () => cockpitFixture()),
      },
    });

    const pack = await service.buildPack();

    expect(pack.blocks.some((block) => block.id === 'provider-cockpit-evidence-drawer')).toBe(false);
    expect(pack.blocks.length).toBe(2);
    expect(pack.nextAction).toContain('Owner approval');
  });
});

function cockpitFixture(): ZavorthCommandCenterProviderCockpitProjection {
  return {
    contractVersion: '2026-05-13.phase-6',
    schemaVersion: 1,
    surface: 'command-center-provider-cockpit',
    generatedAt: '2026-05-13T12:00:00.000Z',
    status: 'ready',
    sourceMatrixContractVersion: '2026-05-13.phase-5',
    visualMutationApplied: false,
    executionAuthority: false,
    selectedProviderId: 'openai',
    summary: {
      totalProviders: 1,
      readyProviders: 1,
      livePassed: 1,
      liveFailed: 0,
      liveBlocked: 0,
      missingAuth: 0,
      missingBaseUrl: 0,
      needsProbe: 0,
    },
    cards: [],
    actions: [
      {
        id: 'providers:matrix',
        label: 'Provider matrix',
        command: 'zavorth providers',
        kind: 'read',
        providerId: null,
        risk: 'read',
        requiresApproval: false,
        dashboardCanExecute: false,
        summary: 'Read matrix.',
      },
      {
        id: 'providers:live-selected',
        label: 'Live probe selected',
        command: 'zavorth providers live --provider openai',
        kind: 'live_probe',
        providerId: 'openai',
        risk: 'sensitive',
        requiresApproval: false,
        dashboardCanExecute: false,
        summary: 'Live probe command.',
      },
    ],
    healthChecks: [],
    receipts: [],
    commandCenterProjection: {
      route: '/control',
      endpoint: '/api/providers/readiness',
      renderMode: 'projection-only',
      visualApprovalRequired: true,
      canRenderCardsAfterApproval: true,
    },
    safety: {
      noRawProviderSecrets: true,
      normalRenderMakesNoNetworkCalls: true,
      liveProbeRequiresExplicitOperatorAction: true,
      commandCenterCannotExecuteProviderCalls: true,
    },
    nextAction: 'Approve visual block.',
  };
}
