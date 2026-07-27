import { ChannelProgressSurfaceService, type ChannelProgressSender } from '../../src/services/ChannelProgressSurfaceService';

describe('ChannelProgressSurfaceService', () => {
  it('edits one Telegram progress message across lifecycle updates', async () => {
    const sends: any[] = [];
    const edits: any[] = [];
    let now = new Date('2026-06-01T10:00:00.000Z');
    const sender: ChannelProgressSender = {
      async sendMessage(input) {
        sends.push(input);
        return { messageId: 42 };
      },
      async editMessage(input) {
        edits.push(input);
        return { messageId: input.messageId };
      },
    };
    const service = new ChannelProgressSurfaceService({
      sender,
      stateFile: null,
      minEditIntervalMs: 0,
      now: () => now,
    });

    const first = await service.publish({
      runId: 'run-1',
      channel: 'telegram',
      chatId: 'chat-1',
      stage: 'accepted',
      title: 'Pedido recebido',
      detail: 'Preparando o run.',
    });
    now = new Date('2026-06-01T10:00:02.000Z');
    const second = await service.publish({
      runId: 'run-1',
      channel: 'telegram',
      chatId: 'chat-1',
      stage: 'tool_started',
      toolName: 'composio.gmail',
      detail: 'Invoking external tool.',
    });

    expect(first.status).toBe('sent');
    expect(second.status).toBe('edited');
    expect(sends).toHaveLength(1);
    expect(edits).toHaveLength(1);
    expect(edits[0].messageId).toBe(42);
    expect(edits[0].text).toContain('Using tool');
  });

  it('falls back to send-only progress for channels without edit support', async () => {
    const sends: any[] = [];
    const service = new ChannelProgressSurfaceService({
      sender: {
        async sendMessage(input) {
          sends.push(input);
          return { messageId: `msg-${sends.length}` };
        },
      },
      stateFile: null,
    });

    const first = await service.publish({
      runId: 'run-2',
      channel: 'whatsapp',
      chatId: 'chat-2',
      stage: 'accepted',
      detail: 'Recebido.',
    });
    const second = await service.publish({
      runId: 'run-2',
      channel: 'whatsapp',
      chatId: 'chat-2',
      stage: 'tool_progress',
      detail: 'Working.',
    });

    expect(first.transport).toBe('send');
    expect(second.transport).toBe('send');
    expect(sends).toHaveLength(2);
  });

  it('redacts tokens from rendered progress text', () => {
    const service = new ChannelProgressSurfaceService({ sender: null, stateFile: null });

    const rendered = service.render({
      runId: 'run-3',
      channel: 'telegram',
      chatId: 'chat-3',
      stage: 'integration_auth_link',
      detail: 'token=secret-value',
      link: 'https://example.test/oauth-access_token=secret-value',
    });

    expect(rendered).not.toContain('secret-value');
    expect(rendered).toContain('[redacted]');
  });
});
