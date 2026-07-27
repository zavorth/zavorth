import fs from 'fs';
import os from 'os';
import path from 'path';
import { TelegramOutputHandler } from '../../src/telegram/TelegramOutputHandler';

describe('TelegramOutputHandler', () => {
  it('sends wav as audio in Telegram instead of a voice note', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-telegram-output-'));
    const wavPath = path.join(tempDir, 'reply.wav');
    await fs.promises.writeFile(wavPath, 'wav');

    const audioHandler = {
      synthesize: jest.fn(async () => wavPath),
      cleanup: jest.fn(),
    } as any;

    const handler = new TelegramOutputHandler(audioHandler);
    const ctx = {
      chat: { id: 42 },
      api: {
        sendChatAction: jest.fn().mockResolvedValue(undefined),
      },
      replyWithAudio: jest.fn().mockResolvedValue(undefined),
      replyWithVoice: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await handler.sendAudio(ctx, 'Audio response.');

    expect(ctx.api.sendChatAction).toHaveBeenCalledWith(42, 'record_voice');
    expect(ctx.replyWithAudio).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      caption: 'Audio response',
    }));
    expect(ctx.replyWithVoice).not.toHaveBeenCalled();
    expect(audioHandler.cleanup).toHaveBeenCalledWith(wavPath);

    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });
});
