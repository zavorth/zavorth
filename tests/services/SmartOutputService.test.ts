import { SmartOutputService } from '../../src/services/SmartOutputService';

describe('SmartOutputService', () => {
  it('falls back to chunked replies when the context cannot upload documents', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await SmartOutputService.reply(ctx, 'A'.repeat(8000), { includeDeleteAction: false });

    expect(ctx.reply).toHaveBeenCalledTimes(3);
    expect(ctx.reply.mock.calls[0][0]).toContain('Parte 1/3');
    expect(ctx.reply.mock.calls[1][0]).toContain('Parte 2/3');
    expect(ctx.reply.mock.calls[2][0]).toContain('Parte 3/3');
  });

  it('retries without parse mode when Telegram rejects malformed markdown', async () => {
    const sendMessage = jest
      .fn()
      .mockRejectedValueOnce(new Error("Call to 'sendMessage' failed! (400: Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 12)"))
      .mockResolvedValueOnce(undefined);

    await SmartOutputService.send(
      { sendMessage } as any,
      '42',
      'Texto com _markdown quebrado',
      { parse_mode: 'Markdown' },
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(
      1,
      '42',
      'Texto com _markdown quebrado',
      expect.objectContaining({ parse_mode: 'Markdown' }),
    );
    expect(sendMessage).toHaveBeenNthCalledWith(
      2,
      '42',
      'Texto com _markdown quebrado',
      expect.not.objectContaining({ parse_mode: 'Markdown' }),
    );
  }, 15000);
});
