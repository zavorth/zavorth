import { ZavorthChannelActionService } from '../../src/services/ZavorthChannelActionService.js';

function buildChannelSnapshot(selectedId = 'telegram') {
  const entries = [
    {
      id: 'telegram',
      label: 'Telegram',
      readiness: 'ready',
      implementationState: 'full',
      configured: true,
      transport: 'native',
      notes: ['Gateway Telegram configurado.'],
      features: {
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
      },
      source: 'runtime',
      summary: 'Canal ready.',
      operatorSummary: 'sessions_send ready.',
      actionHint: 'Use /help no Telegram.',
      tags: ['native'],
      actions: [
        { id: 'telegram:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels telegram' },
        { id: 'telegram:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy telegram' },
        { id: 'telegram:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test telegram' },
      ],
    },
    {
      id: 'web',
      label: 'Web',
      readiness: 'ready',
      implementationState: 'full',
      configured: true,
      transport: 'virtual',
      notes: ['Canal virtual.'],
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: true,
        attachments: false,
        threads: false,
        groupPolicy: false,
        identityHints: true,
      },
      source: 'runtime',
      summary: 'Canal virtual.',
      operatorSummary: 'sessions_send ready.',
      actionHint: 'Abra o app.',
      tags: ['virtual'],
      actions: [
        { id: 'web:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels web' },
        { id: 'web:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy web' },
      ],
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      readiness: 'ready',
      implementationState: 'partial',
      configured: true,
      transport: 'local',
      notes: ['Stub local saudavel.'],
      features: {
        inbound: true,
        outbound: true,
        sessionList: true,
        sessionHistory: true,
        sessionSend: true,
        sessionSpawn: false,
        attachments: true,
        threads: false,
        groupPolicy: true,
        identityHints: true,
        richReplies: true,
        qrLogin: true,
      },
      loginQr: {
        supported: true,
        state: 'pending',
        source: null,
        dataUrl: null,
        expiresAt: null,
        updatedAt: '2026-04-02T12:00:00.000Z',
        nextStep: 'Aguardando QR da bridge local.',
      },
      source: 'runtime',
      summary: 'Canal ready.',
      operatorSummary: 'stub local ready.',
      actionHint: 'Use /channels broadcast-test whatsapp para validar o outbox local.',
      tags: ['local'],
      actions: [
        { id: 'whatsapp:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels whatsapp' },
        { id: 'whatsapp:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy whatsapp' },
        { id: 'whatsapp:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test whatsapp' },
      ],
    },
    {
      id: 'slack',
      label: 'Slack',
      readiness: 'planned',
      implementationState: 'planned',
      configured: false,
      transport: 'planned',
      notes: ['Planeje o adapter e a policy antes do onboarding.'],
      features: {
        inbound: false,
        outbound: false,
        sessionList: true,
        sessionHistory: true,
        sessionSend: false,
        sessionSpawn: false,
        attachments: true,
        threads: true,
        groupPolicy: true,
        identityHints: true,
      },
      source: 'roadmap',
      summary: 'Canal planejado.',
      operatorSummary: 'Slack ainda was not conectado ao runtime principal.',
      actionHint: 'Planejar o adapter de Slack e o contract de mensagens antes do onboarding.',
      tags: ['roadmap'],
      actions: [
        { id: 'slack:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels slack' },
        { id: 'slack:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy slack' },
        { id: 'slack:prepare', label: 'Preparar onboarding', kind: 'prepare', command: '/channels prepare slack' },
      ],
    },
  ];

  const enrichedEntries = entries.map((entry) => ({
    ...entry,
    liveReady: entry.id !== 'slack',
    defaultRouteAllowed: entry.id !== 'slack',
    readinessProof: entry.id === 'slack' ? 'none' : 'health',
    defaultBlockReason: entry.id === 'slack' ? 'Channel is not ready; use prepare/doctor before enabling live actions.'
      : null,
  }));

  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    summary: {
      total: entries.length,
      ready: 2,
      partial: 0,
      planned: 0,
      disabled: 0,
      configured: 2,
      sessionSendReady: 2,
      attachments: 0,
      groupPolicy: 1,
      liveReady: 3,
      catalogReadyButNotLive: 0,
      defaultRouteAllowed: 3,
    },
    entries: enrichedEntries,
    selected: enrichedEntries.find((entry) => entry.id === selectedId) || enrichedEntries[0],
    featuredIds: ['telegram'],
    liveCompletion: {
      channelSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      sensitiveActionsRequireLiveProof: true,
      liveBridgeRequiresExplicitOperatorAction: true,
      rawSecretsSerialized: false,
      publicApiChannelActionEndpoint: '/api/v1/channels/:id/action',
      defaultRoutingPolicy: 'ready-and-live-proof',
      counts: {
        catalogReady: 2,
        liveReady: 3,
        catalogReadyButNotLive: 0,
        defaultRouteAllowed: 3,
      },
    },
    narrative: {
      headline: 'Channel Mesh do Zavorth',
      operatorSummary: '2 canais readys.',
    },
  };
}

describe('ZavorthChannelActionService', () => {
  it('returns an inspect execution for manual channel inspection', async () => {
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'telegram')),
      } as any,
    });

    const result = await service.execute({
      channelId: 'telegram',
      actionId: 'inspect',
      requestedBy: 'operator-1',
    });

    expect(result.status).toBe('manual');
    expect(result.summary).toContain('Inspecao');
    expect(result.selected?.id).toBe('telegram');
  });

  it('reloads channel policies through the existing channel mesh action plane', async () => {
    const buildSnapshot = jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'telegram'));
    const reloadChannelPolicies = jest.fn(async ({ selectedId }: any) => ({
      generatedAt: '2026-04-02T12:01:00.000Z',
      selectedId,
      receipt: {
        actor: 'operator-1',
        reason: 'channel-mesh-action',
        reloadedAt: '2026-04-02T12:01:00.000Z',
        source: 'env-defaults',
        cacheWindowMs: 1000,
        previousUpdatedAt: '2026-04-02T12:00:00.000Z',
        nextUpdatedAt: '2026-04-02T12:01:00.000Z',
        previousPolicyCount: 1,
        nextPolicyCount: 2,
        changedChannels: ['telegram'],
      },
      selected: buildChannelSnapshot(selectedId || 'telegram').selected,
      snapshot: buildChannelSnapshot(selectedId || 'telegram'),
    }));
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:01:00.000Z'),
      channelMeshService: {
        buildSnapshot,
        reloadChannelPolicies,
      } as any,
    });

    const result = await service.execute({
      channelId: 'telegram',
      actionId: 'policy-reload',
      requestedBy: 'operator-1',
    });

    expect(buildSnapshot).toHaveBeenCalledWith({ selectedId: 'telegram' });
    expect(reloadChannelPolicies).toHaveBeenCalledWith({
      selectedId: 'telegram',
      actor: 'operator-1',
      reason: 'channel-mesh-action',
    });
    expect(result.status).toBe('applied');
    expect(result.summary).toContain('sem reiniciar gateways actives');
    expect(result.policyReloadReceipt?.changedChannels).toEqual(['telegram']);
  });

  it('broadcasts a test payload through a registered channel gateway', async () => {
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['chat-1', 'chat-2']);
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'telegram')),
      } as any,
      broadcastGateways: {
        telegram: {
          supportsRoleAwareBroadcast: true,
          resolveBroadcastRecipients,
          broadcast,
        },
      },
    });

    const result = await service.execute({
      channelId: 'telegram',
      actionId: 'broadcast-test',
      requestedBy: 'operator-1',
    });

    expect(resolveBroadcastRecipients).toHaveBeenCalledWith(['admin', 'operator']);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em Telegram'), ['admin', 'operator']);
    expect(result.status).toBe('applied');
    expect(result.summary).toContain('Teste de broadcast sent');
  });

  it('broadcasts a WhatsApp test payload through the late-bound stub gateway', async () => {
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['whatsapp:chat-1']);
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'whatsapp')),
      } as any,
      broadcastGateways: {
        whatsapp: {
          supportsRoleAwareBroadcast: false,
          resolveBroadcastRecipients,
          broadcast,
        },
      },
    });

    const result = await service.execute({
      channelId: 'whatsapp',
      actionId: 'broadcast-test',
      requestedBy: 'operator-1',
    });

    expect(resolveBroadcastRecipients).toHaveBeenCalledWith([]);
    expect(broadcast).toHaveBeenCalledWith(expect.stringContaining('Teste do Channel Mesh em WhatsApp'), []);
    expect(result.summary).toContain('WhatsApp');
    expect(result.status).toBe('applied');
  });

  it('returns a WhatsApp QR login receipt through the channel action plane', async () => {
    const requestLoginQr = jest.fn(async () => ({
      ok: true,
      status: 'ready',
      summary: 'QR de login do WhatsApp ready para exibicao no operador.',
      details: ['Show the image for the authorized user to scan in WhatsApp.'],
      loginQr: {
        supported: true,
        state: 'ready',
        source: 'test-session',
        dataUrl: 'data:image/png;base64,abc123',
        expiresAt: null,
        updatedAt: '2026-04-02T12:00:00.000Z',
        nextStep: 'Escaneie o QR.',
      },
    }));
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'whatsapp')),
      } as any,
      broadcastGateways: {
        whatsapp: {
          supportsRoleAwareBroadcast: false,
          resolveBroadcastRecipients: jest.fn(() => ['whatsapp:chat-1']),
          broadcast: jest.fn(async () => undefined),
          requestLoginQr,
        },
      },
    });

    const result = await service.execute({
      channelId: 'whatsapp',
      actionId: 'login-qr',
      requestedBy: 'operator-1',
    });

    expect(requestLoginQr).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('applied');
    expect(result.loginQr).toEqual(expect.objectContaining({
      state: 'ready',
      dataUrl: expect.stringMatching(/^data:image\/png;base64,/),
    }));
  });

  it('executes WhatsApp relink and logout through the shared channel action plane', async () => {
    const relink = jest.fn(async () => ({
      ok: true,
      summary: 'Pareamento local do WhatsApp preparado com receipt auditavel.',
      details: ['Receipt: whatsapp-relink.json.'],
    }));
    const logout = jest.fn(async () => ({
      ok: true,
      summary: 'Session local do WhatsApp encerrada no runtime supervisionado.',
      details: ['Receipt: whatsapp-logout.json.'],
    }));
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'whatsapp')),
      } as any,
      broadcastGateways: {
        whatsapp: {
          supportsRoleAwareBroadcast: false,
          resolveBroadcastRecipients: jest.fn(() => ['whatsapp:chat-1']),
          broadcast: jest.fn(async () => undefined),
          relink,
          logout,
        },
      },
    });

    const relinkResult = await service.execute({
      channelId: 'whatsapp',
      actionId: 'relink',
      requestedBy: 'operator-1',
    });
    const logoutResult = await service.execute({
      channelId: 'whatsapp',
      actionId: 'logout',
      requestedBy: 'operator-1',
    });

    expect(relink).toHaveBeenCalledTimes(1);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(relinkResult.status).toBe('applied');
    expect(logoutResult.status).toBe('applied');
    expect(relinkResult.summary).toContain('Pareamento local');
    expect(logoutResult.summary).toContain('Session local');
  });

  it('blocks a Slack test payload when the channel has no live proof', async () => {
    const broadcast = jest.fn(async () => undefined);
    const resolveBroadcastRecipients = jest.fn(() => ['slack:ops']);
    const slackSnapshot = {
      ...buildChannelSnapshot('slack'),
      selected: {
        id: 'slack',
        label: 'Slack',
        readiness: 'partial',
        implementationState: 'partial',
        configured: true,
        transport: 'local',
        notes: ['Stub local com onboarding em andamento.'],
        features: {
          inbound: true,
          outbound: true,
          sessionList: true,
          sessionHistory: true,
          sessionSend: false,
          sessionSpawn: false,
          attachments: true,
          threads: true,
          groupPolicy: true,
          identityHints: true,
        },
        source: 'runtime',
        summary: 'Canal parcial, mas com outbox local ready para teste.',
        operatorSummary: 'Slack local ready para um smoke de outbound.',
        actionHint: 'Use /channels prepare slack e depois /channels broadcast-test slack.',
        tags: ['local'],
        actions: [
          { id: 'slack:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels slack' },
          { id: 'slack:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy slack' },
          { id: 'slack:prepare', label: 'Preparar onboarding', kind: 'prepare', command: '/channels prepare slack' },
          { id: 'slack:broadcast-test', label: 'Testar broadcast', kind: 'broadcast-test', command: '/channels broadcast-test slack' },
        ],
      },
    };
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(() => slackSnapshot),
      } as any,
      broadcastGateways: {
        slack: {
          supportsRoleAwareBroadcast: false,
          resolveBroadcastRecipients,
          broadcast,
        },
      },
    });

    const result = await service.execute({
      channelId: 'slack',
      actionId: 'broadcast-test',
      requestedBy: 'operator-1',
    });

    expect(resolveBroadcastRecipients).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
    expect(result.summary).toContain('Slack');
    expect(result.status).toBe('manual');
    expect(result.summary).toContain('live-ready');
  });

  it('returns a guided preparation plan for planned channels like Slack', async () => {
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'slack')),
      } as any,
    });

    const result = await service.execute({
      channelId: 'slack',
      actionId: 'prepare',
      requestedBy: 'operator-1',
    });

    expect(result.status).toBe('manual');
    expect(result.summary).toContain('Slack preparado');
    expect(result.details.join(' ')).toContain('Defina o transporte inicial do Slack');
  });

  it('returns a native Slack checklist when the channel already uses the Web API path', async () => {
    const slackNativeSnapshot = {
      ...buildChannelSnapshot('slack'),
      selected: {
        id: 'slack',
        label: 'Slack',
        readiness: 'partial',
        implementationState: 'full',
        configured: true,
        transport: 'native',
        notes: ['Slack nactive esta configurado e o runtime ja confirmou outbound real pela Web API.'],
        features: {
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
        },
        source: 'runtime',
        summary: 'Canal operacional via Slack Web API.',
        operatorSummary: 'sessions_send ready.',
        actionHint: 'Use /channels broadcast-test slack e aponte o Slack para /api/webhooks/slack.',
        tags: ['native'],
        actions: [
          { id: 'slack:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels slack' },
          { id: 'slack:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy slack' },
          { id: 'slack:prepare', label: 'Preparar onboarding', kind: 'prepare', command: '/channels prepare slack' },
        ],
      },
    };
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(() => slackNativeSnapshot),
      } as any,
    });

    const result = await service.execute({
      channelId: 'slack',
      actionId: 'prepare',
      requestedBy: 'operator-1',
    });

    expect(result.details.join(' ')).toContain('SLACK_SIGNING_SECRET');
    expect(result.details.join(' ')).toContain('/api/webhooks/slack');
  });

  it('returns a Cloud API WhatsApp checklist when the channel already uses the webhook path', async () => {
    const whatsAppCloudSnapshot = {
      ...buildChannelSnapshot('whatsapp'),
      selected: {
        id: 'whatsapp',
        label: 'WhatsApp',
        readiness: 'partial',
        implementationState: 'full',
        configured: true,
        transport: 'webhook',
        notes: ['WhatsApp Cloud API esta configurada e o runtime ja confirmou inbound/outbound oficial pelo webhook da Meta.'],
        features: {
          inbound: true,
          outbound: true,
          sessionList: true,
          sessionHistory: true,
          sessionSend: true,
          sessionSpawn: false,
          attachments: true,
          threads: false,
          groupPolicy: true,
          identityHints: true,
        },
        source: 'runtime',
        summary: 'Canal operacional via WhatsApp Cloud API.',
        operatorSummary: 'sessions_send ready.',
        actionHint: 'Use /channels broadcast-test whatsapp e confirme o callback em /api/webhooks/whatsapp.',
        tags: ['webhook'],
        actions: [
          { id: 'whatsapp:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels whatsapp' },
          { id: 'whatsapp:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy whatsapp' },
          { id: 'whatsapp:prepare', label: 'Preparar canal', kind: 'prepare', command: '/channels prepare whatsapp' },
        ],
      },
    };
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(() => whatsAppCloudSnapshot),
      } as any,
    });

    const result = await service.execute({
      channelId: 'whatsapp',
      actionId: 'prepare',
      requestedBy: 'operator-1',
    });

    expect(result.details.join(' ')).toContain('WHATSAPP_PHONE_NUMBER_ID');
    expect(result.details.join(' ')).toContain('/api/webhooks/whatsapp');
  });

  it('returns a Meta Instagram checklist when the channel uses the webhook path', async () => {
    const instagramSnapshot = {
      ...buildChannelSnapshot('instagram'),
      selected: {
        id: 'instagram',
        label: 'Instagram',
        readiness: 'partial',
        implementationState: 'full',
        configured: true,
        transport: 'webhook',
        notes: ['Instagram Messaging API esta configurada para inbound/outbound via Meta Graph.'],
        features: {
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
        },
        source: 'runtime',
        summary: 'Canal operacional via Instagram Messaging API.',
        operatorSummary: 'sessions_send ready.',
        actionHint: 'Use /channels broadcast-test instagram e confirme o callback em /api/webhooks/instagram.',
        tags: ['webhook'],
        actions: [
          { id: 'instagram:inspect', label: 'Inspecionar', kind: 'inspect', command: '/channels instagram' },
          { id: 'instagram:policy', label: 'Ver policy', kind: 'policy', command: '/channels policy instagram' },
          { id: 'instagram:prepare', label: 'Preparar canal', kind: 'prepare', command: '/channels prepare instagram' },
        ],
      },
    };
    const service = new ZavorthChannelActionService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      channelMeshService: {
        buildSnapshot: jest.fn(() => instagramSnapshot),
      } as any,
    });

    const result = await service.execute({
      channelId: 'instagram',
      actionId: 'prepare',
      requestedBy: 'operator-1',
    });

    expect(result.details.join(' ')).toContain('INSTAGRAM_BUSINESS_ACCOUNT_ID');
    expect(result.details.join(' ')).toContain('/api/webhooks/instagram');
    expect(result.details.join(' ')).toContain('INSTAGRAM_ALLOWED_RECIPIENT_IDS');
  });

  it('fails honestly when the runtime has no broadcast bridge for the channel', async () => {
    const service = new ZavorthChannelActionService({
      channelMeshService: {
        buildSnapshot: jest.fn(({ selectedId }: any) => buildChannelSnapshot(selectedId || 'telegram')),
      } as any,
    });

    await expect(service.execute({
      channelId: 'telegram',
      actionId: 'broadcast-test',
      requestedBy: 'operator-1',
    })).rejects.toThrow('bridge de broadcast operacional');
  });
});
