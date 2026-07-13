import { TelegramMenuController } from '../../../src/telegram/controllers/TelegramMenuController';

describe('TelegramMenuController', () => {
  it('keeps help natural-first with short human menu (phase 1)', () => {
    const controller = new TelegramMenuController({ api: {} } as any);
    const help = controller.getHelpText();

    expect(help).toMatch(/Fale normal primeiro|Start with natural language/i);
    expect(help).toMatch(/texto livre|free text/i);
    expect(help).toMatch(/o que voce sabe fazer/i);
    expect(help).toMatch(/o que voce aprendeu/i);
    expect(help).toMatch(/desfazer aprendizado/i);
    expect(help).toContain('/status');
    expect(help).toContain('/help');
    expect(help).toMatch(/\/zavorthControl|\/dashboard/);
    expect(help).toContain('/commands');
    expect(help).toMatch(/anyone digest|zavorth learn/);
    expect(help).toMatch(/help advanced|avancado/i);
    // Ops jargon out of default help
    expect(help).not.toContain('/swarm');
    expect(help).not.toContain('/setupagent');
    expect(help).not.toContain('/watchmode');
    expect(help).not.toContain('/miniapp');
  });

  it('registers private and group command menus (max 8 human-first)', async () => {
    const setMyCommands = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramMenuController({
      api: { setMyCommands },
    } as any);

    await controller.registerTelegramMenu();

    expect(setMyCommands).toHaveBeenCalledTimes(3);
    expect(setMyCommands.mock.calls[1][1]).toEqual({ scope: { type: 'all_private_chats' } });
    expect(setMyCommands.mock.calls[2][1]).toEqual({ scope: { type: 'all_group_chats' } });
    expect(setMyCommands.mock.calls[1][0].length).toBeLessThanOrEqual(8);
    expect(setMyCommands.mock.calls[2][0].length).toBeLessThanOrEqual(8);
    expect(setMyCommands.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'help' }),
        expect.objectContaining({ command: 'status' }),
        expect.objectContaining({ command: 'zavorthControl' }),
        expect.objectContaining({ command: 'commands' }),
        expect.objectContaining({ command: 'perm' }),
        expect.objectContaining({ command: 'trust' }),
        expect.objectContaining({ command: 'lock' }),
      ]),
    );
    // Platform slash stays out of the native menu
    expect(setMyCommands.mock.calls[1][0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'setupagent' }),
        expect.objectContaining({ command: 'plan' }),
        expect.objectContaining({ command: 'swarm' }),
        expect.objectContaining({ command: 'automations' }),
        expect.objectContaining({ command: 'watchmode' }),
        expect.objectContaining({ command: 'channels' }),
        expect.objectContaining({ command: 'echoapprovals' }),
        expect.objectContaining({ command: 'ban' }),
      ]),
    );
    expect(setMyCommands.mock.calls[2][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'help' }),
        expect.objectContaining({ command: 'status' }),
        expect.objectContaining({ command: 'ban' }),
        expect.objectContaining({ command: 'warn' }),
      ]),
    );
    expect(setMyCommands.mock.calls[2][0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'swarm' }),
        expect.objectContaining({ command: 'plan' }),
      ]),
    );
  });

  it('renders /help through the shared Surface Response Telegram renderer', async () => {
    const controller = new TelegramMenuController({ api: {} } as any);
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.renderHelpCard(ctx);

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toMatch(
      /Zavorth - (Quick Guide|Guia rapido)/,
    );
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Fale normal primeiro|Start with natural language/i);
    expect(ctx.reply.mock.calls[0][1]).not.toHaveProperty('parse_mode');
    expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringMatching(/Status/i),
        callback_data: 'hub:action:status',
      }),
      expect.objectContaining({
        text: expect.stringMatching(/Comandos|Commands/i),
        callback_data: '/commands',
      }),
    ]));
  });
});
