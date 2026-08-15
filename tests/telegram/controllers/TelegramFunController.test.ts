import { TelegramFunController } from '../../../src/telegram/controllers/TelegramFunController';

describe('TelegramFunController', () => {
  it('renders a joke flow with loading state and message edit', async () => {
    const funGamesService = {
      tellAJoke: jest.fn().mockResolvedValue('Piada final'),
    } as any;
    const botApi = {
      editMessageText: jest.fn().mockResolvedValue(undefined),
    } as any;
    const ctx = {
      chat: { id: 42 },
      message: { message_id: 10 },
      reply: jest.fn().mockResolvedValue({ message_id: 99 }),
    } as any;

    const controller = new TelegramFunController(funGamesService, botApi);
    await controller.handle(ctx, '/joke');

    expect(ctx.reply).toHaveBeenCalledWith('Thinking of something mildly cursed and funny...');
    expect(funGamesService.tellAJoke).toHaveBeenCalledTimes(1);
    expect(botApi.editMessageText).toHaveBeenCalledWith(42, 99, 'Piada final', { parse_mode: 'Markdown' });
  });
});
