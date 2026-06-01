import { ZavorthA2UIService } from '../../src/services/ZavorthA2UIService.js';

describe('ZavorthA2UIService', () => {
  it('builds canonical snapshots with allowlisted components, assets, and events', () => {
    const service = new ZavorthA2UIService({
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });

    service.beginRendering('cockpit', { ready: true }, { owner: 'echo' });
    service.updateSurface('cockpit', [
      {
        type: 'panel',
        id: 'summary',
        props: { title: 'Summary' },
        children: [
          {
            type: 'text',
            id: 'summary-text',
            props: { value: 'All systems nominal' },
          },
        ],
      },
      {
        type: 'script',
        id: 'unsafe',
        props: {},
      },
    ]);
    service.updateDataModel('cockpit', { mode: 'live' });
    service.writeAsset('cockpit', {
      kind: 'screenshot',
      mimeType: 'image/png',
      contentUrl: 'file:///tmp/cockpit.png',
    });

    const snapshot = service.readSnapshot('cockpit');
    const events = service.listEvents('cockpit', 10);
    const assets = service.listAssets('cockpit');

    expect(snapshot.protocolVersion).toBe('a2ui.v1');
    expect(snapshot.capabilities).toEqual(['snapshot', 'action', 'event', 'stream', 'asset', 'risk-simulation']);
    expect(snapshot.security).toEqual(expect.objectContaining({
      hostAccess: 'blocked',
      tokenAccess: 'blocked',
      filesystemAccess: 'blocked',
      actionDispatch: 'transaction-plane',
    }));
    expect(snapshot.allowedComponents).toContain('panel');
    expect(snapshot.surfaces[0].components).toEqual([
      expect.objectContaining({
        type: 'panel',
        id: 'summary',
      }),
    ]);
    expect(snapshot.surfaces[0].metadata).toEqual({ owner: 'echo' });
    expect(snapshot.surfaces[0].dataModel).toEqual({ ready: true, mode: 'live' });
    expect(events.map((event) => event.eventType)).toEqual([
      'surface_initialized',
      'snapshot_updated',
      'data_model_updated',
      'asset_linked',
    ]);
    expect(events[1].payload).toEqual(expect.objectContaining({
      blockedTypes: ['script'],
    }));
    expect(assets).toEqual([
      expect.objectContaining({
        surfaceId: 'cockpit',
        kind: 'screenshot',
        mimeType: 'image/png',
      }),
    ]);
  });

  it('strips inline handlers and dangerous URLs from widget props', () => {
    const service = new ZavorthA2UIService({
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });

    service.beginRendering('risk-preview');
    service.updateSurface('risk-preview', [
      {
        type: 'button',
        id: 'run',
        props: {
          label: 'Run',
          onClick: 'steal()',
          href: 'javascript:alert(1)',
          nested: {
            srcDoc: '<script>steal()</script>',
            safe: 'value',
          },
        },
      },
    ]);

    const props = service.readSnapshot('risk-preview').surfaces[0].components[0].props;
    expect(props).toEqual({
      label: 'Run',
      nested: {
        safe: 'value',
      },
    });
  });

  it('dispatches registered actions and exposes a bounded stream', async () => {
    const service = new ZavorthA2UIService({
      now: () => new Date('2026-04-18T12:00:00.000Z'),
    });

    service.beginRendering('cockpit');
    service.registerActionHandler('cockpit', 'refresh', async (request) => ({
      echoed: request.payload?.intent || null,
    }));

    const accepted = await service.dispatchAction({
      surfaceId: 'cockpit',
      actionId: 'refresh',
      requestedBy: 'dashboard',
      payload: { intent: 'reload' },
    });
    const blocked = await service.dispatchAction({
      surfaceId: 'cockpit',
      actionId: 'missing',
      requestedBy: 'dashboard',
    });
    const stream = service.readStream('cockpit', 10);

    expect(accepted).toEqual(expect.objectContaining({
      ok: true,
      status: 'accepted',
      actionId: 'refresh',
      data: { echoed: 'reload' },
    }));
    expect(blocked).toEqual(expect.objectContaining({
      ok: false,
      status: 'blocked',
      actionId: 'missing',
    }));
    expect(stream.items.map((item) => item.eventType)).toEqual([
      'surface_initialized',
      'action_dispatched',
      'action_completed',
      'action_blocked',
    ]);
  });
});
