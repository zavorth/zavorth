import { ChannelConnectionPlaybookService } from '../../src/services/ChannelConnectionPlaybookService.js';
import type { ChannelSetupAssistantSession } from '../../src/services/ChannelSetupAssistantService.js';
import type { ChannelMeshSnapshot, ChannelMeshSnapshotEntry } from '../../src/contracts/ChannelMeshContract.js';
import { PLATFORM_KEYS, type PlatformKey } from '../../src/contracts/PlatformContract.js';

describe('ChannelConnectionPlaybookService', () => {
  const now = () => new Date('2026-06-04T10:00:00.000Z');

  function createService(overrides: {
    session-: Partial<ChannelSetupAssistantSession>;
    meshEntry-: Partial<ChannelMeshSnapshotEntry>;
  } = {}) {
    const setupAssistant = {
      buildSession: jest.fn((input: { channelId-: string | null; mode-: string | null }) => {
        const channelId = input.channelId as PlatformKey;
        const mode = (input.mode || defaultMode(channelId)) as any;
        const missingEnvKeys = channelId === 'telegram' ? ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALLOWED_USER_IDS']
          : channelId === 'whatsapp' && mode === 'cloud-api' ? ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ALLOWED_CHAT_IDS']
            : channelId === 'signal' ? ['SIGNAL_ACCOUNT_NUMBER', 'SIGNAL_ALLOWED_RECIPIENTS']
              : [`${channelId.toUpperCase()}_TOKEN`];
        const selected = {
          channelId,
          label: label(channelId),
          readiness: 'partial' as const,
          configured: false,
          currentMode: null,
          recommendedMode: defaultMode(channelId) as any,
          setupMode: mode,
          missingEnvKeys,
          requiredEnvKeys: missingEnvKeys,
          webhookUrl: channelId === 'whatsapp' && mode === 'cloud-api' ? 'https://zavorth.example/api/webhooks/whatsapp'
            : null,
          summary: `${label(channelId)} setup.`,
          operatorNextStep: 'Aplicar scaffold.',
          commands: {
            inspect: 'npm run channels:install -- --json',
            apply: `npm run channels:install -- --channel ${channelId} --mode ${mode} --apply`,
            doctor: 'npm run test:channels:smoke',
          },
        };
        return {
          generatedAt: '2026-06-04T10:00:00.000Z',
          status: selected.missingEnvKeys.length > 0 ? 'needs_config' : 'ready_to_validate',
          selected,
          options: [selected],
          envFilePath: '.env',
          localBaseUrl: 'http://127.0.0.1:3000',
          publicBaseUrl: 'https://zavorth.example',
          naturalReply: 'ok',
          nextQuestions: [],
          nextActions: [],
          report: {} as any,
          channels: null,
          ...overrides.session,
        };
      }),
    };
    const channelMeshService = {
      buildSnapshot: jest.fn(() => {
        const entries = PLATFORM_KEYS.map((channelId) => ({
          id: channelId,
          label: label(channelId),
          readiness: 'partial',
          implementationState: 'partial',
          configured: false,
          transport: 'stub',
          notes: [],
          features: {
            inbound: true,
            outbound: true,
            sessionList: false,
            sessionHistory: false,
            sessionSend: true,
            sessionSpawn: false,
            attachments: false,
            threads: false,
            groupPolicy: true,
            identityHints: true,
          },
          source: 'runtime',
          summary: `${label(channelId)} summary.`,
          operatorSummary: `${label(channelId)} operator.`,
          actionHint: 'prepare',
          tags: [],
          actions: [],
          liveReady: false,
          defaultRouteAllowed: false,
          readinessProof: 'none',
          defaultBlockReason: 'Missing live proof.',
          ...(channelId === overrides.meshEntry?.id ? overrides.meshEntry : {}),
        })) as ChannelMeshSnapshotEntry[];
        return {
          generatedAt: '2026-06-04T10:00:00.000Z',
          summary: {} as any,
          entries,
          selected: null,
          featuredIds: [],
          liveCompletion: {} as any,
          narrative: {} as any,
        } satisfies ChannelMeshSnapshot;
      }),
    };
    return new ChannelConnectionPlaybookService({
      now,
      setupAssistant: setupAssistant as any,
      channelMeshService: channelMeshService as any,
    });
  }

  it('builds a playbook for every supported channel without serializing secret values', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.version).toBe('channel-connection-playbook/v1');
    expect(snapshot.playbooks.map((entry) => entry.channelId).sort()).toEqual([...PLATFORM_KEYS].sort());
    expect(snapshot.playbooks.every((entry) => entry.safety.rawSecretsSerialized === false)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('secret-value');
  });

  it('keeps WhatsApp Cloud API blocked until live proof exists', () => {
    const snapshot = createService().buildSnapshot({
      selectedId: 'whatsapp',
      mode: 'cloud-api',
    });

    expect(snapshot.selected).toEqual(expect.objectContaining({
      channelId: 'whatsapp',
      mode: 'cloud-api',
      webhookUrl: 'https://zavorth.example/api/webhooks/whatsapp',
    }));
    expect(snapshot.selected?.requiredInputKeys).toEqual(expect.arrayContaining([
      'WHATSAPP_ACCESS_TOKEN',
      'WHATSAPP_PHONE_NUMBER_ID',
      'WHATSAPP_ALLOWED_CHAT_IDS',
    ]));
    expect(snapshot.selected?.readiness.defaultRouteAllowed).toBe(false);
    expect(snapshot.selected?.steps.find((step) => step.id === 'prove-live')?.details.join(' ')).toContain('outbox not contam como live');
  });

  it('marks a live and default-route-ready channel only when the mesh proves it', () => {
    const snapshot = createService({
      meshEntry: {
        id: 'telegram',
        configured: true,
        readiness: 'ready',
        liveReady: true,
        defaultRouteAllowed: true,
        readinessProof: 'health',
        defaultBlockReason: null,
        lastHealth: 'passed',
      },
    }).buildSnapshot({ selectedId: 'telegram' });

    expect(snapshot.selected?.status).toBe('default-route-ready');
    expect(snapshot.selected?.readiness).toEqual(expect.objectContaining({
      liveReady: true,
      defaultRouteAllowed: true,
      readinessProof: 'health',
    }));
    expect(snapshot.selected?.steps.find((step) => step.id === 'send-test')?.status).toBe('done');
  });

  it('does not promote stub or local-outbox modes to live routes', () => {
    const snapshot = createService({
      meshEntry: {
        id: 'email',
        configured: true,
        readiness: 'ready',
        liveReady: true,
        defaultRouteAllowed: true,
        readinessProof: 'health',
        defaultBlockReason: null,
        lastHealth: 'passed',
      },
    }).buildSnapshot({ selectedId: 'email' });

    expect(snapshot.selected?.mode).toBe('local-outbox');
    expect(snapshot.selected?.readiness.liveReady).toBe(false);
    expect(snapshot.selected?.readiness.defaultRouteAllowed).toBe(false);
    expect(snapshot.selected?.readiness.defaultBlockReason).toContain('stub/local-outbox');
  });

  it('documents Signal as a conservative local bridge path', () => {
    const snapshot = createService().buildSnapshot({ selectedId: 'signal' });
    const detailText = snapshot.selected?.steps.flatMap((step) => step.details).join(' ');

    expect(snapshot.selected?.channelId).toBe('signal');
    expect(snapshot.selected?.safety.outboxOnlyIsNotLive).toBe(true);
    expect(detailText).toContain('signal-cli');
    expect(snapshot.selected?.readiness.defaultRouteAllowed).toBe(false);
  });
});

function defaultMode(channelId: PlatformKey): string {
  if (channelId === 'whatsapp') return 'stub';
  if (channelId === 'signal') return 'signal-cli';
  if (channelId === 'imessage') return 'mac-bridge';
  if (channelId === 'teams') return 'graph-bot';
  if (channelId === 'email') return 'local-outbox';
  return 'native';
}

function label(channelId: PlatformKey): string {
  return {
    telegram: 'Telegram',
    discord: 'Discord',
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    slack: 'Slack',
    signal: 'Signal',
    imessage: 'iMessage',
    teams: 'Microsoft Teams',
    email: 'Email',
  }[channelId];
}
