import { NodeOnboardingService } from '../../src/services/NodeOnboardingService.js';

describe('NodeOnboardingService', () => {
  it('builds a guided snapshot for a pending desktop companion draft', () => {
    const service = new NodeOnboardingService();

    const snapshot = service.buildOnboardingSnapshot({
      now: new Date('2026-04-13T12:00:00.000Z'),
      selectedNodeId: 'desktop-bridge',
      nodeMeshSnapshot: {
        entries: [
          {
            id: 'desktop-bridge',
            profileId: 'desktop-companion',
            kind: 'desktop',
            status: 'pairing',
            pairingStatus: 'pending',
            paired: false,
            capabilityIds: ['screen.capture', 'clipboard.write'],
            approvedCapabilityIds: [],
          } as any,
        ],
      },
      bootstrapDraft: {
        bootstrap: {
          packageScript: 'companion:start',
          command: 'npm run companion:start -- --passcode "desktop-bridge:PAIR-1"',
          fallbackCommand: 'node apps/zavorth-companion/index.js "desktop-bridge:PAIR-1"',
          pairingToken: 'desktop-bridge:PAIR-1',
        },
      } as any,
    });

    expect(snapshot.state).toBe('draft');
    expect(snapshot.nodeId).toBe('desktop-bridge');
    expect(snapshot.bootstrap.available).toBe(true);
    expect(snapshot.bootstrap.bundleUrl).toBe('/api/web/nodes/companion/download');
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        declaredCapabilities: 2,
        approvedCapabilities: 0,
        needsReview: true,
      }),
    );
    expect(snapshot.nextStep).toEqual(
      expect.objectContaining({
        id: 'claim_pairing',
        status: 'current',
      }),
    );
  });

  it('marks an online paired node as ready when policy and heartbeat are present', () => {
    const service = new NodeOnboardingService();

    const snapshot = service.buildOnboardingSnapshot({
      now: new Date('2026-04-13T12:05:00.000Z'),
      selectedNodeId: 'desktop-bridge',
      nodeMeshSnapshot: {
        selected: {
          id: 'desktop-bridge',
          profileId: 'desktop-companion',
          kind: 'desktop',
          status: 'online',
          pairingStatus: 'paired',
          paired: true,
          lastSeenAt: '2026-04-13T12:04:59.000Z',
          capabilityIds: ['device.info', 'clipboard.write'],
          approvedCapabilityIds: ['device.info'],
          canInvoke: true,
        } as any,
        entries: [],
      },
    });

    expect(snapshot.state).toBe('ready');
    expect(snapshot.progress).toBe(100);
    expect(snapshot.nextStep).toBeNull();
    expect(snapshot.narrative.operatorSummary).toBe('Onboarding do node esta completo.');
  });
});
