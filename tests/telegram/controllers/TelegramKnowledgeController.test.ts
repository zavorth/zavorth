import { TelegramKnowledgeController } from '../../../src/telegram/controllers/TelegramKnowledgeController';

describe('TelegramKnowledgeController', () => {
  it('saves a snippet through the snippet service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const snippetService = {
      save: jest.fn().mockResolvedValue(undefined),
    } as any;
    const controller = new TelegramKnowledgeController({} as any, snippetService);

    await controller.handleSave(ctx, 'deploy npm run build', '42');

    expect(snippetService.save).toHaveBeenCalledWith('42', 'deploy', 'npm run build');
    expect(ctx.reply).toHaveBeenCalledWith('Snippet "deploy" saved.');
  });

  it('lists memory entries using the memory service', async () => {
    const ctx = {
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;
    const memoryService = {
      listAll: jest.fn().mockResolvedValue([
        { category: 'contexto', key: 'projeto', value: 'Zavorth' },
      ]),
    } as any;
    const controller = new TelegramKnowledgeController(memoryService, {} as any);

    await controller.handleMemory(ctx, '42');

    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('[contexto] projeto: Zavorth');
  });
});
