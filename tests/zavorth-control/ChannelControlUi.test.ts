import {
  buildChannelCatalogView,
  normalizeChannelQrDataUrl,
  renderChannelCatalogHtml,
} from '../../apps/zavorth-control-vite-shell/src/channel-control';

describe('channel control catalog', () => {
  it('keeps catalog, configuration, connection and probe as independent states', () => {
    const view = buildChannelCatalogView({
      generatedAt: '2026-07-16T10:00:00.000Z',
      entries: [
        {
          id: 'telegram',
          label: 'Telegram',
          readiness: 'ready',
          configured: true,
          transport: 'native',
          lastHealth: 'unknown',
          readinessProof: 'configuration',
          liveReady: false,
          connection: { connected: false, running: false, linked: false },
          actions: [{ id: 'telegram:status', kind: 'status' }],
        },
        {
          id: 'web',
          label: 'Web',
          readiness: 'ready',
          configured: true,
          transport: 'native',
          lastHealth: 'passed',
          readinessProof: 'health',
          liveReady: true,
          connection: null,
          actions: [{ id: 'web:status', kind: 'status' }],
        },
      ],
    });

    expect(view).toEqual(expect.objectContaining({
      total: 2,
      configured: 2,
      connected: 1,
      liveReady: 1,
    }));
    expect(view.rows[0]).toEqual(expect.objectContaining({
      catalog: { label: 'Ready', tone: 'ok' },
      configuration: { label: 'Configured', tone: 'ok' },
      connection: { label: 'Not connected', tone: 'info' },
      probe: { label: 'Not probed', tone: 'warn' },
    }));
  });

  it('uses explicit doctor evidence without treating partial inventory as a live probe', () => {
    const view = buildChannelCatalogView(
      {
        entries: [
          { id: 'discord', readiness: 'partial', configured: false, transport: 'bridge' },
          { id: 'matrix', readiness: 'partial', configured: false, transport: 'native' },
        ],
      },
      {
        checkedAt: '2026-07-16T11:00:00.000Z',
        status: 'failed',
        items: [
          { channelId: 'discord', status: 'failed' },
          { channelId: 'matrix', status: 'partial' },
        ],
      },
    );

    expect(view.rows.find((row) => row.id === 'discord')?.probe).toEqual({ label: 'Failed', tone: 'danger' });
    expect(view.rows.find((row) => row.id === 'matrix')?.probe).toEqual({ label: 'Partial', tone: 'warn' });
    expect(view.probeLabel).toContain('Failed');
  });

  it('escapes runtime-provided labels and never renders credential inputs', () => {
    const view = buildChannelCatalogView({
      entries: [
        {
          id: 'unsafe',
          label: '<img src=x onerror=alert(1)>',
          readiness: 'planned',
          configured: false,
          transport: 'stub',
          actions: [],
        },
      ],
    });
    const html = renderChannelCatalogHtml(view);

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('type="password"');
    expect(html).toContain('Prepare in chat');
  });

  it('accepts only bounded base64 PNG data for login QR rendering', () => {
    expect(normalizeChannelQrDataUrl('data:image/png;base64,YWJjMTIz')).toBe('data:image/png;base64,YWJjMTIz');
    expect(normalizeChannelQrDataUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBeNull();
    expect(normalizeChannelQrDataUrl('data:image/png;base64,abc<script>')).toBeNull();
    expect(normalizeChannelQrDataUrl(`data:image/png;base64,${'A'.repeat(1_500_001)}`)).toBeNull();
  });
});
