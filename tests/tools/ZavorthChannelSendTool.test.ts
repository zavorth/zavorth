import { ZavorthChannelSendTool } from '../../src/tools/ZavorthChannelSendTool';

describe('ZavorthChannelSendTool', () => {
  const tool = new ZavorthChannelSendTool();

  it('exposes correct name', () => {
    expect(tool.name).toBe('zavorth_channel_send');
  });

  it('returns error when required params missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Erro');
  });

  it('returns error when message is missing', async () => {
    const result = await tool.execute({ channel: 'telegram', recipient: '123' });
    expect(result).toContain('Erro');
    expect(result).toContain('message');
  });

  it('returns error for invalid channel', async () => {
    const result = await tool.execute({
      channel: 'carrier_pigeon',
      recipient: '123',
      message: 'Hello',
    });
    expect(result).toContain('Erro');
    expect(result).toContain('invalido');
  });

  it('sends to telegram', async () => {
    const result = await tool.execute({
      channel: 'telegram',
      recipient: '123456',
      message: 'Hello from Zavorth',
    });
    expect(result).toContain('Telegram');
    expect(result).toContain('enviada');
  });

  it('sends to discord', async () => {
    const result = await tool.execute({
      channel: 'discord',
      recipient: '789',
      message: 'Hello Discord',
    });
    expect(result).toContain('Discord');
  });

  it('sends to email', async () => {
    const result = await tool.execute({
      channel: 'email',
      recipient: 'test@example.com',
      message: 'Hello Email',
    });
    expect(result).toContain('SMTP');
  });

  it('sends to whatsapp', async () => {
    const result = await tool.execute({
      channel: 'whatsapp',
      recipient: '+5511999999999',
      message: 'Hello WhatsApp',
    });
    expect(result).toContain('WhatsApp');
  });

  it('handles multi-channel send', async () => {
    const result = await tool.execute({
      channel: 'telegram',
      recipient: '123',
      message: 'Multi test',
      multi_channel: JSON.stringify([
        { channel: 'telegram', recipient: '111' },
        { channel: 'discord', recipient: '222' },
        { channel: 'slack', recipient: '333' },
      ]),
    });
    expect(result).toContain('multi-canal');
    expect(result).toContain('3');
  });

  it('handles silent flag', async () => {
    const result = await tool.execute({
      channel: 'telegram',
      recipient: '123',
      message: 'Silent message',
      silent: true,
    });
    expect(result).toContain('enviada');
  });

  it('handles reply_to', async () => {
    const result = await tool.execute({
      channel: 'telegram',
      recipient: '123',
      message: 'Reply test',
      reply_to: 'msg_456',
    });
    expect(result).toContain('enviada');
  });
});
