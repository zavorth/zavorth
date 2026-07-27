import type { ChannelAdapterStatus, ChannelFeatureSet } from '../../src/contracts/ChannelMeshContract.js';
import { ChannelExperienceConsistencyService } from '../../src/services/ChannelExperienceConsistencyService';
import { ZavorthChannelMeshService } from '../../src/services/ZavorthChannelMeshService';

const features = (overrides: Partial<ChannelFeatureSet> = {}): ChannelFeatureSet => ({
  inbound: true,
  outbound: true,
  sessionList: true,
  sessionHistory: true,
  sessionSend: true,
  sessionSpawn: false,
  attachments: true,
  threads: true,
  groupPolicy: true,
  identityHints: true,
  approvals: true,
  rateLimit: true,
  webhook: false,
  localBridge: false,
  doctor: true,
  interactiveControls: true,
  slashCommands: true,
  richReplies: true,
  qrLogin: false,
  ...overrides,
});

const adapter = (overrides: Partial<ChannelAdapterStatus>): ChannelAdapterStatus => ({
  id: 'telegram',
  label: 'Telegram',
  readiness: 'ready',
  implementationState: 'full',
  configured: true,
  transport: 'native',
  notes: [],
  features: features(),
  interactiveSurface: {
    statusCard: true,
    inlineButtons: true,
    slashCommands: true,
    richReplies: true,
    modelMenus: true,
    qrLogin: false,
  },
  ...overrides,
});

describe('ChannelExperienceConsistencyService', () => {
  it('certifies rich channel experience coverage without claiming missing Instagram support', () => {
    const channelMeshService = new ZavorthChannelMeshService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
      channelAdapterRegistryService: {
        listAdapters: () => [
          adapter({ id: 'telegram', label: 'Telegram' }),
          adapter({ id: 'discord', label: 'Discord' }),
          adapter({
            id: 'whatsapp',
            label: 'WhatsApp',
            transport: 'local',
            features: features({ slashCommands: false, qrLogin: true }),
            interactiveSurface: {
              statusCard: true,
              inlineButtons: false,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: true,
            },
            loginQr: {
              supported: true,
              state: 'ready',
              source: 'session-dir',
              dataUrl: 'data:image/png;base64,abc123',
              expiresAt: null,
              updatedAt: '2026-05-10T12:00:00.000Z',
              nextStep: 'Escaneie o QR.',
            },
          }),
          adapter({
            id: 'signal',
            label: 'Signal',
            transport: 'bridge',
            implementationState: 'partial',
            features: features({ slashCommands: false, localBridge: true }),
            interactiveSurface: {
              statusCard: true,
              inlineButtons: false,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: false,
            },
          }),
          adapter({
            id: 'imessage',
            label: 'iMessage',
            transport: 'bridge',
            implementationState: 'partial',
            features: features({ slashCommands: false, localBridge: true, attachments: false }),
            interactiveSurface: {
              statusCard: true,
              inlineButtons: false,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: false,
            },
          }),
          adapter({
            id: 'instagram',
            label: 'Instagram',
            transport: 'webhook',
            implementationState: 'full',
            provider: 'instagram-messaging-api',
            setupMode: 'meta-messaging',
            webhookPath: '/api/webhooks/instagram',
            features: features({ webhook: true, slashCommands: false, attachments: false }),
            interactiveSurface: {
              statusCard: true,
              inlineButtons: false,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: false,
            },
          }),
        ],
        getAdapter: jest.fn(),
      } as any,
    });
    const service = new ChannelExperienceConsistencyService({
      now: () => new Date('2026-05-10T12:00:00.000Z'),
      channelMeshService,
      targetChannelIds: ['telegram', 'discord', 'whatsapp', 'signal', 'imessage', 'instagram'],
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('channel-experience-consistency.v1');
    expect(snapshot.summary.total).toBe(6);
    expect(snapshot.summary.richRepliesReady).toBe(6);
    expect(snapshot.entries.find((entry) => entry.channelId === 'whatsapp')).toEqual(
      expect.objectContaining({
        status: 'complete',
        checks: expect.arrayContaining([
          expect.objectContaining({ id: 'qr-login', status: 'pass' }),
        ]),
      }),
    );
    expect(snapshot.entries.find((entry) => entry.channelId === 'instagram')).toEqual(
      expect.objectContaining({
        status: 'complete',
        present: true,
        checks: expect.arrayContaining([
          expect.objectContaining({ id: 'webhook-status', status: 'pass' }),
        ]),
      }),
    );
    expect(snapshot.narrative.nextAction).not.toContain('Instagram DM');
  });

  it('renders a selected channel consistency report for operators', () => {
    const channelMeshService = new ZavorthChannelMeshService({
      channelAdapterRegistryService: {
        listAdapters: () => [adapter({ id: 'telegram', label: 'Telegram' })],
        getAdapter: jest.fn(),
      } as any,
    });
    const service = new ChannelExperienceConsistencyService({
      channelMeshService,
      targetChannelIds: ['telegram'],
    });

    const report = service.renderReport({ selectedId: 'telegram' });

    expect(report).toContain('Zavorth channel experience parity');
    expect(report).toContain('Telegram: complete');
    expect(report).toContain('Next:');
  });

  it('does not require QR login when WhatsApp is operating through the Cloud API webhook path', () => {
    const channelMeshService = new ZavorthChannelMeshService({
      channelAdapterRegistryService: {
        listAdapters: () => [
          adapter({
            id: 'whatsapp',
            label: 'WhatsApp',
            readiness: 'ready',
            implementationState: 'full',
            transport: 'webhook',
            provider: 'meta-cloud-api',
            webhookPath: '/api/webhooks/whatsapp',
            features: features({ webhook: true, qrLogin: false, slashCommands: false }),
            interactiveSurface: {
              statusCard: true,
              inlineButtons: true,
              slashCommands: false,
              richReplies: true,
              modelMenus: false,
              qrLogin: false,
            },
          }),
        ],
        getAdapter: jest.fn(),
      } as any,
    });
    const service = new ChannelExperienceConsistencyService({
      channelMeshService,
      targetChannelIds: ['whatsapp'],
    });

    const snapshot = service.buildSnapshot();
    const whatsapp = snapshot.entries[0];

    expect(whatsapp.status).toBe('complete');
    expect(whatsapp.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'qr-login', status: 'na' }),
      expect.objectContaining({ id: 'webhook-status', status: 'pass' }),
    ]));
  });
});
