import { ZavorthNativeBrowserComputerUseService } from '../../src/services/ZavorthNativeBrowserComputerUseService.js';

describe('ZavorthNativeBrowserComputerUseService', () => {
  it('exposes native browser and computer-use capabilities without faking live sidecar execution', async () => {
    const service = new ZavorthNativeBrowserComputerUseService({
      sidecar: null,
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = await service.execute({
      action: 'browser.extract',
      url: 'https://example.com',
      live: false,
    });

    expect(snapshot.contractVersion).toBe('2026-05-24.native-browser-computer-use-phase-5');
    expect(snapshot.status).toBe('preview');
    expect(snapshot.sidecar.cdpPlaywrightConfigured).toBe(false);
    expect(snapshot.sidecar.cdpPlaywrightUsed).toBe(false);
    expect(snapshot.sidecar.supportedActions).toEqual(['navigate', 'screenshot', 'click', 'type', 'extract']);
    expect(snapshot.safety.liveActionNotFaked).toBe(true);
    expect(snapshot.capabilities.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'browser-cdp-playwright-sidecar',
      'computer-use-adapter',
      'browser-domain-policy',
    ]));
  });

  it('requires approval before browser click/type actions', async () => {
    const service = new ZavorthNativeBrowserComputerUseService({
      sidecar: {
        isConfigured: () => true,
        execute: jest.fn(async () => ({
          ok: true,
          action: 'browser_click',
          payload: {},
          runtime: 'browser-sidecar',
          isolated: true,
        })),
      },
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = await service.execute({
      action: 'browser.click',
      url: 'https://example.com',
      selector: '#submit',
      live: true,
    });

    expect(snapshot.status).toBe('approval-required');
    expect(snapshot.sidecar.cdpPlaywrightUsed).toBe(false);
    expect(snapshot.policy.decision).toBe('require-owner-approval');
    expect(snapshot.visualReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'click',
        status: 'approval-required',
      }),
    ]));
  });

  it('blocks private network browser targets by default', async () => {
    const service = new ZavorthNativeBrowserComputerUseService({
      sidecar: null,
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = await service.execute({
      action: 'browser.extract',
      url: 'http://127.0.0.1:9222/json',
      live: true,
    });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.target.domainPolicy).toBe('blocked');
    expect(snapshot.policy.decision).toBe('deny');
    expect(snapshot.safety.noPrivateNetworkByDefault).toBe(true);
  });

  it('delegates computer plans to the governed computer control plane', async () => {
    const computer = {
      execute: jest.fn(async () => ({
        status: 'approval-required',
        watchMode: { used: false },
        plan: {
          steps: [{ id: 'step-1' }],
          approvalRequired: true,
        },
        policy: { reason: 'Desktop plan contains click/type actions.' },
        nextSafeAction: 'Approve the desktop plan.',
      })),
    };
    const service = new ZavorthNativeBrowserComputerUseService({
      sidecar: null,
      computer: computer as any,
      now: () => new Date('2026-05-24T12:00:00.000Z'),
    });

    const snapshot = await service.execute({
      action: 'computer.plan',
      targetKind: 'browser-tab',
      targetWindow: 'Example Browser',
      objective: 'Click the button',
    });

    expect(computer.execute).toHaveBeenCalledWith(expect.objectContaining({
      action: 'computer.plan',
      targetKind: 'browser-tab',
      targetWindow: 'Example Browser',
    }));
    expect(snapshot.computerUse.used).toBe(true);
    expect(snapshot.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'computer-use',
        status: 'approval-required',
      }),
    ]));
  });
});
