import {
  AgentRunService,
  CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION,
  CrossChannelContinuityService,
} from '../../../src/runtime/agent/index.js';

describe('CrossChannelContinuityService Channel mesh1', () => {
  it('builds bridged continuity with approval-first handoffs without sending messages', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cross-channel',
      text: 'continue esta session no telegram',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        channelMeshBridge: {
          source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
          channels: [
            {
              id: 'telegram:ops',
              label: 'Telegram Ops',
              kind: 'telegram',
              status: 'available',
              canResume: true,
            },
          ],
        },
        nodeMesh: {
          nodeId: 'node-control',
          status: 'available',
          summary: 'node mesh connected',
        },
        crossChannelHandoffs: [
          {
            id: 'handoff:web-to-telegram',
            fromChannel: 'web',
            toChannel: 'telegram',
            reason: 'Operador quer track pelo Telegram.',
            requiresApproval: true,
          },
        ],
      },
    });

    const snapshot = new CrossChannelContinuityService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: CROSS_CHANNEL_CONTINUITY_CONTRACT_VERSION,
      source: 'CrossChannelContinuityService',
      status: 'handoff-ready',
      summary: expect.objectContaining({
        channelCount: expect.any(Number),
        handoffCount: expect.any(Number),
        bridgeDetected: true,
        nodeMeshLinked: true,
        sameGateway: true,
      }),
      policy: expect.objectContaining({
        noCrossChannelMessageSent: true,
        noSessionForkCreated: true,
        approvalRequiredForChannelSwitch: true,
        originalChannelPreserved: true,
        sameGatewayRequired: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.channels.some((channel) => channel.kind === 'telegram')).toBe(true);
    expect(snapshot.handoffs.some((handoff) => handoff.toChannel === 'telegram' && handoff.requiresApproval)).toBe(true);
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'channel-mesh')).toBe(true);
  });

  it('publishes single-channel continuity when no handoff is needed', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cross-channel-single',
      text: 'continue aqui',
      requestedTools: ['workspace.read'],
    });

    const snapshot = new CrossChannelContinuityService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.status).toBe('single-channel');
    expect(snapshot.summary.channelCount).toBe(1);
    expect(snapshot.summary.handoffCount).toBe(0);
    expect(snapshot.policy.noCrossChannelMessageSent).toBe(true);
  });

  it('maps slack, whatsapp, signal, email and teams as first-class continuity kinds', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'slack',
      sessionId: 'session-cross-channel-fabric',
      text: 'resume across mesh',
      requestedTools: ['workspace.read'],
      metadata: {
        channels: [
          { id: 'wa:ops', kind: 'whatsapp', label: 'WhatsApp Ops', status: 'available' },
          { id: 'sig:ops', kind: 'signal', label: 'Signal Ops', status: 'available' },
          { id: 'mail:ops', kind: 'email', label: 'Email Ops', status: 'degraded' },
          { id: 'teams:ops', kind: 'msteams', label: 'Teams Ops', status: 'available' },
        ],
        crossChannelHandoffs: [
          {
            id: 'handoff:slack-to-teams',
            fromChannel: 'slack',
            toChannel: 'teams',
            reason: 'Operator wants Teams',
            requiresApproval: true,
          },
        ],
      },
    });

    const snapshot = new CrossChannelContinuityService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot.session.activeChannel).toBe('slack');
    expect(snapshot.channels.some((channel) => channel.kind === 'whatsapp')).toBe(true);
    expect(snapshot.channels.some((channel) => channel.kind === 'signal')).toBe(true);
    expect(snapshot.channels.some((channel) => channel.kind === 'email')).toBe(true);
    expect(snapshot.channels.some((channel) => channel.kind === 'teams')).toBe(true);
    expect(snapshot.handoffs.some((handoff) =>
      handoff.toChannel === 'teams' && handoff.requiresApproval === true)).toBe(true);
    expect(snapshot.policy.noCrossChannelMessageSent).toBe(true);
    expect(snapshot.policy.approvalRequiredForChannelSwitch).toBe(true);
  });
});
