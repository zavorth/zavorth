import {
  countA2UIComponents,
  renderA2UICanvasHtml,
  selectA2UISurface,
} from '../../../apps/zavorth-control-vite-shell/src/a2ui-renderer';

describe('zavorth-control A2UI renderer', () => {
  it('renders declarative components with data bindings and action hooks', () => {
    const html = renderA2UICanvasHtml({
      activeSurfaceId: 'cockpit',
      snapshot: {
        generatedAt: '2026-05-31T00:00:00.000Z',
        protocolVersion: 'a2ui.v1',
        capabilities: ['snapshot', 'action', 'stream'],
        allowedComponents: ['stack', 'text', 'button', 'metric'],
        surfaces: [{
          surfaceId: 'cockpit',
          lastUpdated: '2026-05-31T00:01:00.000Z',
          dataModel: { status: 'ready', counters: { tasks: 3 } },
          components: [{
            type: 'stack',
            id: 'root',
            props: { direction: 'column' },
            children: [
              { type: 'text', id: 'headline', props: { text: 'Status: {{status}}' } },
              { type: 'metric', id: 'tasks', props: { label: 'Tasks', value: '${counters.tasks}' } },
              { type: 'button', id: 'refresh-button', props: { label: 'Refresh', actionId: 'refresh' } },
            ],
          }],
        }],
      },
      stream: {
        generatedAt: '2026-05-31T00:02:00.000Z',
        protocolVersion: 'a2ui.v1',
        surfaceId: 'cockpit',
        items: [{
          id: 'evt-1',
          surfaceId: 'cockpit',
          eventType: 'snapshot_updated',
          createdAt: '2026-05-31T00:01:00.000Z',
          payload: {},
        }],
      },
    });

    expect(html).toContain('Z-Canvas A2UI');
    expect(html).toContain('Status: ready');
    expect(html).toContain('>3<');
    expect(html).toContain('data-a2ui-action="refresh"');
    expect(html).toContain('snapshot_updated');
  });

  it('selects the preferred surface and counts nested components', () => {
    const snapshot = {
      generatedAt: '2026-05-31T00:00:00.000Z',
      protocolVersion: 'a2ui.v1' as const,
      surfaces: [
        { surfaceId: 'first', components: [], dataModel: {} },
        {
          surfaceId: 'second',
          components: [{ type: 'panel', id: 'a', children: [{ type: 'text', id: 'b' }] }],
          dataModel: {},
        },
      ],
    };

    const selected = selectA2UISurface(snapshot, 'second');
    expect(selected?.surfaceId).toBe('second');
    expect(countA2UIComponents(selected?.components || [])).toBe(2);
  });
});
