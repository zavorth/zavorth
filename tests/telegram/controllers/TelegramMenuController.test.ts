import { TelegramMenuController } from '../../../src/telegram/controllers/TelegramMenuController';

describe('TelegramMenuController', () => {
  it('keeps the help text natural-first and presents the hub as manual support', () => {
    const controller = new TelegramMenuController({ api: {} } as any);
    const help = controller.getHelpText();

    expect(help).toMatch(/Start with natural language|Fale normal primeiro/i);
    expect(help).toMatch(/normal path remains free text|caminho normal continua sendo texto livre/i);
    expect(help).toMatch(/connect me to Discord|quero conectar voce ao Discord/i);
    expect(help).toMatch(/\/setupagent <request>|\/setupagent <pedido>/);
    expect(help).toContain('/perm list');
    expect(help).toMatch(/\/zavorthControl|\/dashboard/);
    expect(help).not.toContain('/miniapp');
    expect(help).toMatch(/\/swarm <objective>|\/swarm <objetivo>/);
    expect(help).toContain('/channels');
    expect(help).toMatch(/Use `\/zavorth` as a manual fallback|Use `\/zavorth` como fallback manual/);
    expect(help).not.toContain('Use `/zavorth` para abrir o hub com botoes');
  });

  it('registers private and group command menus', async () => {
    const setMyCommands = jest.fn().mockResolvedValue(undefined);
    const controller = new TelegramMenuController({
      api: { setMyCommands },
    } as any);

    await controller.registerTelegramMenu();

    expect(setMyCommands).toHaveBeenCalledTimes(3);
    expect(setMyCommands.mock.calls[1][1]).toEqual({ scope: { type: 'all_private_chats' } });
    expect(setMyCommands.mock.calls[2][1]).toEqual({ scope: { type: 'all_group_chats' } });
    expect(setMyCommands.mock.calls[1][0].length).toBeLessThanOrEqual(10);
    expect(setMyCommands.mock.calls[2][0].length).toBeLessThanOrEqual(10);
    expect(setMyCommands.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'status' }),
        expect.objectContaining({ command: 'commands' }),
        expect.objectContaining({ command: 'zavorthControl' }),
        expect.objectContaining({ command: 'perm' }),
        expect.objectContaining({ command: 'echoapprovals' }),
        expect.objectContaining({ command: 'trust' }),
        expect.objectContaining({ command: 'lock' }),
      ]),
    );
    expect(setMyCommands.mock.calls[1][0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'zavorth' }),
        expect.objectContaining({ command: 'setupagent' }),
        expect.objectContaining({ command: 'plan' }),
        expect.objectContaining({ command: 'swarm' }),
        expect.objectContaining({ command: 'automations' }),
        expect.objectContaining({ command: 'watchmode' }),
        expect.objectContaining({ command: 'channels' }),
        expect.objectContaining({ command: 'ban' }),
        expect.objectContaining({ command: 'warn' }),
        expect.objectContaining({ command: 'regras' }),
      ]),
    );
    expect(setMyCommands.mock.calls[2][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'ban' }),
        expect.objectContaining({ command: 'warn' }),
        expect.objectContaining({ command: 'rules' }),
      ]),
    );
    expect(setMyCommands.mock.calls[2][0]).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: 'zavorth' }),
        expect.objectContaining({ command: 'plan' }),
        expect.objectContaining({ command: 'swarm' }),
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
    expect(ctx.reply.mock.calls[0][0]).toMatch(/Start with natural language|Fale normal primeiro/i);
    expect(ctx.reply.mock.calls[0][1]).not.toHaveProperty('parse_mode');
    expect(ctx.reply.mock.calls[0][1].reply_markup.inline_keyboard.flat()).toEqual(expect.arrayContaining([
      expect.objectContaining({
        text: expect.stringMatching(/Quick guide|Guia rapido/i),
        callback_data: 'hub:page:quickstart',
      }),
      expect.objectContaining({
        text: expect.stringMatching(/Commands|Comandos/i),
        callback_data: '/commands',
      }),
      expect.objectContaining({ text: 'Status', callback_data: 'hub:action:status' }),
      expect.objectContaining({
        text: expect.stringMatching(/Permissions|Permissoes/i),
        callback_data: 'hub:page:permissions',
      }),
    ]));
  });
});
