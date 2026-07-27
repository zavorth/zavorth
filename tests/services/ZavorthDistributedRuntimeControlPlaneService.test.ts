import { ZavorthDistributedRuntimeControlPlaneService } from '../../src/services/ZavorthDistributedRuntimeControlPlaneService.js';

describe('ZavorthDistributedRuntimeControlPlaneService', () => {
  it('builds a healthy Distributed runtime snapshot when channels, fleet, transports and surfaces are ready', async () => {
    const service = new ZavorthDistributedRuntimeControlPlaneService({
      now: () => new Date('2026-04-12T20:00:00.000Z'),
      workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      channelMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 8,
            ready: 8,
            partial: 0,
          },
          entries: [
            { id: 'slack', label: 'Slack', readiness: 'ready', summary: 'Slack ready.', features: { attachments: true, threads: true } },
            { id: 'whatsapp', label: 'WhatsApp', readiness: 'ready', summary: 'WhatsApp ready.', features: { attachments: true, threads: false } },
            { id: 'signal', label: 'Signal', readiness: 'ready', summary: 'Signal ready.', features: { attachments: false, threads: false } },
            { id: 'imessage', label: 'iMessage', readiness: 'ready', summary: 'iMessage ready.', features: { attachments: false, threads: false } },
            { id: 'teams', label: 'Teams', readiness: 'ready', summary: 'Teams ready.', features: { attachments: true, threads: true } },
            { id: 'email', label: 'Email', readiness: 'ready', summary: 'Email ready.', features: { attachments: true, threads: false } },
          ],
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 2,
            online: 2,
            queued: 0,
            staleQueued: 0,
          },
          entries: [
            { id: 'node-1', label: 'Node 1', capabilityIds: ['browser.proxy', 'screen.capture', 'files.watch', 'notifications.send'] },
            { id: 'node-2', label: 'Node 2', capabilityIds: ['camera.capture', 'location.read', 'clipboard.read', 'clipboard.write', 'node.maintenance'] },
          ],
          capabilityCatalog: [
            { id: 'browser.proxy', label: 'Browser Proxy', category: 'browser', risky: false, actionHint: 'Use browser.' },
            { id: 'screen.capture', label: 'Screen Capture', category: 'device', risky: false, actionHint: 'Capture screen.' },
            { id: 'files.watch', label: 'Files Watch', category: 'files', risky: false, actionHint: 'Observe files.' },
            { id: 'notifications.send', label: 'Notifications', category: 'notifications', risky: false, actionHint: 'Envie sinais.' },
            { id: 'camera.capture', label: 'Camera Capture', category: 'device', risky: true, actionHint: 'Camera supervisionada.' },
            { id: 'location.read', label: 'Location Read', category: 'location', risky: true, actionHint: 'Use com approval.' },
            { id: 'clipboard.read', label: 'Clipboard Read', category: 'device', risky: true, actionHint: 'Leia clipboard.' },
            { id: 'clipboard.write', label: 'clipboard.write', category: 'device', risky: true, actionHint: 'Escreva clipboard.' },
          ],
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 4,
            ready: 4,
            live: 4,
            attentionRequired: 0,
            partial: 0,
          },
          entries: [],
          suggestedActions: [],
        })),
      } as any,
      runtimeAccessManifestService: {
        buildManifest: jest.fn(async () => ({
          remote: { ready: true },
          commands: { go: 'npm run ops:go', remoteGo: 'npm run ops:remote:go' },
          warnings: [],
          surfaces: [
            { id: 'control', label: 'Shell web', surface: 'web', primary: true, ready: true, entry: 'http://127.0.0.1:33333/dashboard', remoteEntry: 'https://zavorth.app/app', description: 'Cockpit web.' },
            { id: 'cli', label: 'CLI', surface: 'cli', primary: false, ready: true, entry: 'npm run cli -- status', remoteEntry: null, description: 'CLI oficial.' },
            { id: 'telegram', label: 'Telegram', surface: 'telegram', primary: false, ready: true, entry: '/start', remoteEntry: null, description: 'Superficie Telegram.' },
          ],
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot({ selectedId: 'signal' });

    expect(snapshot.generatedAt).toBe('2026-04-12T20:00:00.000Z');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.focus).toEqual(expect.objectContaining({
      kind: 'channel',
      id: 'signal',
    }));
    expect(snapshot.summary.advancedCapabilityCoverage).toBe(8);
    expect(snapshot.cards.find((entry) => entry.id === 'fleet')?.posture).toBe('healthy');
    expect(await service.renderReport({ selectedId: 'signal' })).toContain(
      'Distributed runtime: Runtime distribuido e surfaces avancadas',
    );
  });

  it('promotes attention when advanced channels are pending, fleet is stale and surfaces are incomplete', async () => {
    const service = new ZavorthDistributedRuntimeControlPlaneService({
      now: () => new Date('2026-04-12T21:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 6,
            ready: 2,
            partial: 2,
          },
          entries: [
            {
              id: 'slack',
              label: 'Slack',
              readiness: 'partial',
              summary: 'Slack em preparo.',
              operatorNextStep: 'Close bot token e signing secret.',
              features: { attachments: true, threads: true },
              actions: [{ kind: 'prepare', command: '/channels prepare slack' }],
            },
            {
              id: 'signal',
              label: 'Signal',
              readiness: 'partial',
              summary: 'Signal em preparo.',
              operatorNextStep: 'Close signal-cli.',
              features: { attachments: false, threads: false },
              actions: [{ kind: 'prepare', command: '/channels prepare signal' }],
            },
            {
              id: 'teams',
              label: 'Teams',
              readiness: 'planned',
              summary: 'Teams ainda pendente.',
              actionHint: 'Configure Graph.',
              features: { attachments: true, threads: true },
            },
          ],
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            paired: 1,
            online: 1,
            queued: 3,
            staleQueued: 2,
          },
          entries: [
            { id: 'node-1', label: 'Node 1', capabilityIds: ['browser.proxy'] },
          ],
          capabilityCatalog: [
            { id: 'browser.proxy', label: 'Browser Proxy', category: 'browser', risky: false, actionHint: 'Browser supervisionado.' },
          ],
        })),
      } as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 4,
            ready: 2,
            live: 2,
            attentionRequired: 2,
            partial: 1,
          },
          entries: [],
          suggestedActions: [
            {
              label: 'Revisar Discord transport',
              reason: 'Bridge is still not ready.',
              command: '/transports discord-transport',
            },
          ],
        })),
      } as any,
      runtimeAccessManifestService: {
        buildManifest: jest.fn(async () => ({
          remote: { ready: false },
          commands: { go: 'npm run ops:go', remoteGo: 'npm run ops:remote:go' },
          warnings: ['Remote pendente.'],
          surfaces: [
            { id: 'control', label: 'Shell web', surface: 'web', primary: true, ready: true, entry: 'http://127.0.0.1:33333/dashboard', remoteEntry: null, description: 'Cockpit web.' },
            { id: 'discord', label: 'Discord', surface: 'discord', primary: false, ready: false, entry: '/status', remoteEntry: null, description: 'Discord ainda pendente.' },
          ],
        })),
      } as any,
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.posture).toBe('attention');
    expect(snapshot.cards.find((entry) => entry.id === 'channels')?.posture).toBe('attention');
    expect(snapshot.cards.find((entry) => entry.id === 'fleet')?.posture).toBe('attention');
    expect(snapshot.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'advanced-channel-prepare', label: 'Prepare Slack', command: '/channels prepare slack' }),
        expect.objectContaining({ id: 'repair-node-queue' }),
        expect.objectContaining({ id: 'transport-attention' }),
        expect.objectContaining({ id: 'remote-rollout' }),
      ]),
    );
  });
});

