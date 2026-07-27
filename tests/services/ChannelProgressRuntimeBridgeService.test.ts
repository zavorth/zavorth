import { ChannelProgressRuntimeBridgeService } from '../../src/services/ChannelProgressRuntimeBridgeService';

describe('ChannelProgressRuntimeBridgeService', () => {
  it('turns agent runtime events into editable channel progress updates', async () => {
    const published: any[] = [];
    const bridge = new ChannelProgressRuntimeBridgeService({
      now: () => new Date('2026-06-01T12:00:00.000Z'),
      progressSurface: {
        publish: jest.fn(async (event) => {
          published.push(event);
          return {} as any;
        }),
        snapshot: () => ({
          contractVersion: 'channel-progress-surface/1',
          generatedAt: '2026-06-01T12:00:00.000Z',
          capabilities: [],
          sessions: [],
          receipts: [],
        }),
      },
    });

    await bridge.emit('agent.run.created', {
      runId: 'run-1',
      channel: 'telegram',
      sessionId: '4242',
    });
    await bridge.emit('agent.stream.tool', {
      runId: 'run-1',
      channel: 'telegram',
      sessionId: '4242',
      toolName: 'composio.connect',
    });
    await bridge.emit('agent.run.completed', {
      runId: 'run-1',
      channel: 'telegram',
      sessionId: '4242',
    });

    expect(published).toEqual([
      expect.objectContaining({
        runId: 'run-1',
        channel: 'telegram',
        chatId: '4242',
        stage: 'accepted',
      }),
      expect.objectContaining({
        stage: 'tool_progress',
        toolName: 'composio.connect',
      }),
      expect.objectContaining({
        stage: 'final',
        finalText: expect.stringContaining('Response ready'),
      }),
    ]);
  });

  it('ignores web events and channels outside the bridge allowlist', async () => {
    const progressSurface = {
      publish: jest.fn(),
      snapshot: jest.fn(() => ({
        contractVersion: 'channel-progress-surface/1',
        generatedAt: '2026-06-01T12:00:00.000Z',
        capabilities: [],
        sessions: [],
        receipts: [],
      })),
    };
    const bridge = new ChannelProgressRuntimeBridgeService({
      progressSurface: progressSurface as any,
      enabledChannels: ['telegram'],
    });

    await bridge.emit('agent.run.created', {
      runId: 'run-1',
      channel: 'web',
      sessionId: 'session-web',
    });
    await bridge.emit('agent.run.created', {
      runId: 'run-2',
      channel: 'discord',
      sessionId: 'discord-session',
    });

    expect(progressSurface.publish).not.toHaveBeenCalled();
  });
});
