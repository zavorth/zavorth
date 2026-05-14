import type {
  ChannelFeatureSet,
  ChannelMeshActionDescriptor,
  ChannelMeshSnapshot,
  ChannelMeshSnapshotEntry,
} from '../../src/contracts/ChannelMeshContract';
import { ChannelExperienceCertificationService } from '../../src/services/ChannelExperienceCertificationService';

const FIXED_NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ChannelExperienceCertificationService', () => {
  it('builds a release-ready certification for the channel UX baseline', () => {
    const service = buildService(buildSnapshot(buildCertifiedEntries()));

    const snapshot = service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('channel-experience-certification.v1');
    expect(snapshot.summary.releaseReady).toBe(true);
    expect(snapshot.summary.blockers).toBe(0);
    expect(snapshot.dashboardEvidence.status).toBe('contract-ready');
    expect(snapshot.smokePlan.globalCommands).toEqual(expect.arrayContaining([
      '/channels parity',
      '/models',
      '/gateway',
    ]));
    expect(snapshot.entries.filter((entry) => entry.status === 'certified').map((entry) => entry.channelId)).toEqual(
      expect.arrayContaining(['telegram', 'discord', 'whatsapp', 'slack', 'signal', 'imessage', 'instagram']),
    );
  });

  it('blocks certification when a required channel is missing', () => {
    const entries = buildCertifiedEntries().filter((entry) => entry.id !== 'instagram');
    const service = buildService(buildSnapshot(entries));

    const snapshot = service.buildSnapshot();
    const instagram = snapshot.entries.find((entry) => entry.channelId === 'instagram');

    expect(snapshot.summary.releaseReady).toBe(false);
    expect(instagram?.status).toBe('missing');
    expect(instagram?.blockers.join('\n')).toContain('Adapter/canal registrado');
  });

  it('keeps WhatsApp QR and Instagram webhook visible in the matrix', () => {
    const service = buildService(buildSnapshot(buildCertifiedEntries()));

    const snapshot = service.buildSnapshot();
    const whatsapp = snapshot.entries.find((entry) => entry.channelId === 'whatsapp');
    const instagram = snapshot.entries.find((entry) => entry.channelId === 'instagram');

    expect(whatsapp?.checks.find((check) => check.id === 'qr-login')?.status).toBe('pass');
    expect(whatsapp?.smokeCommands).toEqual(expect.arrayContaining(['/channels login-qr whatsapp']));
    expect(instagram?.checks.find((check) => check.id === 'webhook-status')?.status).toBe('pass');
    expect(instagram?.zavorthEvidence.join('\n')).toContain('provider=instagram-messaging-api');
  });

  it('renders a human-readable certification report', () => {
    const service = buildService(buildSnapshot(buildCertifiedEntries()));

    const report = service.renderReport({ selectedId: 'whatsapp' });

    expect(report).toContain('Certificacao de experiencia dos canais do Zavorth');
    expect(report).toContain('WhatsApp: certified');
    expect(report).toContain('Dashboard: contract-ready');
  });
});

function buildService(snapshot: ChannelMeshSnapshot): ChannelExperienceCertificationService {
  return new ChannelExperienceCertificationService({
    now: () => FIXED_NOW,
    channelMeshService: {
      buildSnapshot: ({ selectedId } = {}) => ({
        ...snapshot,
        generatedAt: FIXED_NOW.toISOString(),
        selected: selectedId
          ? snapshot.entries.find((entry) => entry.id === selectedId) || null
          : snapshot.selected,
      }),
    },
  });
}

function buildCertifiedEntries(): ChannelMeshSnapshotEntry[] {
  return [
    makeEntry('telegram', 'Telegram', {
      transport: 'native',
      features: { slashCommands: true, interactiveControls: true, richReplies: true, attachments: true, threads: true },
      interactiveSurface: { inlineButtons: true, slashCommands: true, richReplies: true, modelMenus: true },
    }),
    makeEntry('discord', 'Discord', {
      transport: 'native',
      features: { slashCommands: true, interactiveControls: true, richReplies: true, attachments: true, threads: true },
      interactiveSurface: { inlineButtons: true, slashCommands: true, richReplies: true, modelMenus: true },
    }),
    makeEntry('whatsapp', 'WhatsApp', {
      transport: 'local',
      setupMode: 'baileys',
      provider: 'local-provider',
      features: { qrLogin: true, richReplies: true, interactiveControls: true, attachments: true },
      interactiveSurface: { qrLogin: true, richReplies: true, modelMenus: true },
      loginQr: {
        supported: true,
        state: 'ready',
        source: 'fixture',
        dataUrl: 'data:image/png;base64,fixture',
        expiresAt: '2026-05-10T12:05:00.000Z',
        updatedAt: FIXED_NOW.toISOString(),
        nextStep: 'Escaneie o QR no dashboard.',
      },
    }),
    makeEntry('slack', 'Slack', {
      transport: 'native',
      provider: 'slack-web-api',
      webhookPath: '/api/webhooks/slack',
      features: { slashCommands: true, interactiveControls: true, richReplies: true, webhook: true, attachments: true, threads: true },
      interactiveSurface: { inlineButtons: true, slashCommands: true, richReplies: true, modelMenus: true },
    }),
    makeEntry('signal', 'Signal', {
      transport: 'bridge',
      setupMode: 'signal-cli',
      provider: 'signal-cli',
      features: { localBridge: true, richReplies: true, approvals: true },
      interactiveSurface: { richReplies: true, modelMenus: true },
    }),
    makeEntry('imessage', 'iMessage', {
      transport: 'local',
      setupMode: 'mac-bridge',
      provider: 'macos-node-host',
      features: { localBridge: true, richReplies: true, approvals: true },
      interactiveSurface: { richReplies: true, modelMenus: true },
    }),
    makeEntry('instagram', 'Instagram', {
      transport: 'webhook',
      setupMode: 'meta-messaging',
      provider: 'instagram-messaging-api',
      webhookPath: '/api/webhooks/instagram',
      features: { webhook: true, richReplies: true, interactiveControls: true, attachments: true },
      interactiveSurface: { richReplies: true, modelMenus: true },
    }),
    makeEntry('teams', 'Microsoft Teams', {
      transport: 'webhook',
      provider: 'microsoft-graph-bot-framework',
      webhookPath: '/api/webhooks/teams',
      features: { webhook: true, slashCommands: true, interactiveControls: true, richReplies: true, attachments: true, threads: true },
      interactiveSurface: { inlineButtons: true, slashCommands: true, richReplies: true, modelMenus: true },
    }),
    makeEntry('email', 'Email', {
      transport: 'local',
      provider: 'smtp-imap',
      features: { richReplies: true, approvals: true, attachments: true },
      interactiveSurface: { richReplies: true, modelMenus: true },
    }),
    makeEntry('web', 'Web', {
      transport: 'virtual',
      provider: 'dashboard',
      features: { richReplies: true, interactiveControls: true, sessionSpawn: true },
      interactiveSurface: { inlineButtons: true, richReplies: true, modelMenus: true },
    }),
  ];
}

function buildSnapshot(entries: ChannelMeshSnapshotEntry[]): ChannelMeshSnapshot {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    summary: {
      total: entries.length,
      ready: entries.length,
      partial: 0,
      planned: 0,
      disabled: 0,
      configured: entries.length,
      sessionSendReady: entries.length,
      attachments: entries.filter((entry) => entry.features.attachments).length,
      groupPolicy: entries.filter((entry) => entry.features.groupPolicy).length,
    },
    entries,
    selected: entries[0] || null,
    featuredIds: entries.slice(0, 4).map((entry) => entry.id),
    narrative: {
      headline: 'fixture',
      operatorSummary: 'fixture',
    },
  };
}

function makeEntry(
  id: string,
  label: string,
  overrides: Partial<ChannelMeshSnapshotEntry> & {
    features?: Partial<ChannelFeatureSet>;
    interactiveSurface?: Partial<NonNullable<ChannelMeshSnapshotEntry['interactiveSurface']>>;
  } = {},
): ChannelMeshSnapshotEntry {
  const features: ChannelFeatureSet = {
    inbound: true,
    outbound: true,
    sessionList: true,
    sessionHistory: true,
    sessionSend: true,
    sessionSpawn: false,
    attachments: false,
    threads: false,
    groupPolicy: true,
    identityHints: true,
    approvals: false,
    rateLimit: true,
    webhook: false,
    localBridge: false,
    doctor: true,
    interactiveControls: true,
    slashCommands: false,
    richReplies: true,
    qrLogin: false,
    ...(overrides.features || {}),
  };
  const actions = buildActions(id, features);
  const statusRows: ChannelMeshSnapshotEntry['statusRows'] = [
    { label: 'Readiness', value: 'ready', tone: 'success' },
    { label: 'Transporte', value: String(overrides.transport || 'native'), tone: 'neutral' },
    { label: 'Configurado', value: 'sim', tone: 'success' },
    { label: 'Envio', value: 'sim', tone: 'success' },
  ];
  const interactiveSurface: NonNullable<ChannelMeshSnapshotEntry['interactiveSurface']> = {
    statusCard: true,
    inlineButtons: Boolean(features.interactiveControls),
    slashCommands: Boolean(features.slashCommands),
    richReplies: Boolean(features.richReplies),
    modelMenus: true,
    qrLogin: Boolean(features.qrLogin),
    ...(overrides.interactiveSurface || {}),
  };
  const base: ChannelMeshSnapshotEntry = {
    id,
    label,
    readiness: 'ready',
    implementationState: 'full',
    configured: true,
    transport: 'native',
    notes: [`${label} fixture`],
    features,
    riskLevel: 'medium',
    setupMode: 'native',
    provider: id,
    webhookPath: null,
    doctorCommand: 'npm run test:channels:smoke',
    lastHealth: 'passed',
    lastEventAt: FIXED_NOW.toISOString(),
    operatorNextStep: `/channels doctor ${id}`,
    connection: {
      running: true,
      linked: true,
      connected: true,
      mode: overrides.setupMode || 'native',
      provider: overrides.provider || id,
      lastStartAt: FIXED_NOW.toISOString(),
      lastConnectedAt: FIXED_NOW.toISOString(),
      lastInboundAt: FIXED_NOW.toISOString(),
      lastOutboundAt: FIXED_NOW.toISOString(),
      lastError: null,
      authAgeMs: 1000,
    },
    statusRows,
    loginQr: null,
    interactiveSurface,
    source: 'runtime',
    summary: `${label} operational fixture`,
    operatorSummary: `${label} ready`,
    actionHint: `/channels status ${id}`,
    tags: ['fixture', 'channel-experience-certification'],
    actions,
    policy: {
      channelId: id,
      state: 'allowlist',
      isOpenAccess: false,
      allowedCount: 1,
      blockedCount: 0,
      summary: `${label} allowlist fixture`,
    },
  };
  return {
    ...base,
    ...overrides,
    features,
    interactiveSurface,
    statusRows: overrides.statusRows || statusRows,
    policy: overrides.policy === undefined ? base.policy : overrides.policy,
    connection: overrides.connection === undefined ? base.connection : overrides.connection,
    loginQr: overrides.loginQr === undefined ? base.loginQr : overrides.loginQr,
    actions: overrides.actions || actions,
  };
}

function buildActions(id: string, features: ChannelFeatureSet): ChannelMeshActionDescriptor[] {
  const actions: ChannelMeshActionDescriptor[] = [
    action(id, 'inspect', `/channels ${id}`),
    action(id, 'status', `/channels status ${id}`),
    action(id, 'policy', `/channels policy ${id}`),
    action(id, 'doctor', `/channels doctor ${id}`),
    action(id, 'send-test', `/channels send-test ${id}`),
  ];
  if (features.qrLogin) {
    actions.push(action(id, 'login-qr', `/channels login-qr ${id}`));
    actions.push(action(id, 'relink', `/channels relink ${id}`));
    actions.push(action(id, 'logout', `/channels logout ${id}`));
  }
  return actions;
}

function action(
  channelId: string,
  kind: ChannelMeshActionDescriptor['kind'],
  command: string,
): ChannelMeshActionDescriptor {
  return {
    id: `${channelId}:${kind}`,
    label: kind,
    kind,
    command,
  };
}
