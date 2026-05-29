import type { ZavorthControlProviderCockpitProjection } from '../../src/contracts/ZavorthControlProviderCockpitContract.js';
import { ZavorthControlVisualApprovalPackService } from '../../src/services/ZavorthControlVisualApprovalPackService.js';

describe('ZavorthControlVisualApprovalPackService', () => {
  it('builds an owner-gated visual proposal without mutating the zavorthControl', async () => {
    const service = new ZavorthControlVisualApprovalPackService({
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
      contractVersion: '2026-05-13.checkpoint-7',
      surface: 'zavorthControl-visual-approval-pack',
      approvalRequired: true,
      approved: false,
      visualMutationApplied: false,
      executionAuthority: false,
      sourceCockpitContractVersion: '2026-05-13.checkpoint-6',
      target: expect.objectContaining({
        route: '/control',
        defaultDecision: 'do_not_render',
      }),
      safety: expect.objectContaining({
        noZavorthControlExecutionAuthority: true,
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
    expect(pack.blocks.every((block) => block.interactionModel.every((action) => action.zavorthControlCanExecute === false))).toBe(true);
    expect(JSON.stringify(pack)).not.toContain('sk-test');
  });

  it('keeps details drawer optional for the first visual review', async () => {
    const service = new ZavorthControlVisualApprovalPackService({
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

function cockpitFixture(): ZavorthControlProviderCockpitProjection {
  return {
    contractVersion: '2026-05-13.checkpoint-6',
    schemaVersion: 1,
    surface: 'zavorthControl-provider-cockpit',
    generatedAt: '2026-05-13T12:00:00.000Z',
    status: 'ready',
    sourceMatrixContractVersion: '2026-05-13.checkpoint-5',
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
        zavorthControlCanExecute: false,
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
        zavorthControlCanExecute: false,
        summary: 'Live probe command.',
      },
    ],
    healthChecks: [],
    receipts: [],
    zavorthControlProjection: {
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
      zavorthControlCannotExecuteProviderCalls: true,
    },
    nextAction: 'Approve visual block.',
  };
}
