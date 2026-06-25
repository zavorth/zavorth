import { Context } from 'grammy';
import { MemoryService } from '../../../../services/MemoryService.js';
import { SnippetService } from '../../../../services/SnippetService.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';

export class TelegramKnowledgeController {
  constructor(
    private memoryService: MemoryService,
    private snippetService: SnippetService,
  ) {}

  public async handleSave(ctx: Context, args: string, userId: string): Promise<void> {
    const trimmedArgs = String(args || '').trim();
    const separatorIndex = trimmedArgs.indexOf(' ');

    if (separatorIndex === -1) {
      await ctx.reply('Uso: /save <nome> <conteudo>');
      return;
    }

    const name = trimmedArgs.substring(0, separatorIndex).trim();
    const content = trimmedArgs.substring(separatorIndex + 1).trim();
    await this.snippetService.save(userId, name, content);
    await ctx.reply(`Snippet "${name}" salvo.`);
  }

  public async handleSnippet(ctx: Context, args: string, userId: string): Promise<void> {
    const name = String(args || '').trim();
    if (!name) {
      await ctx.reply('Uso: /snippet <nome>');
      return;
    }

    const snippet = await this.snippetService.get(userId, name);
    if (!snippet) {
      await ctx.reply(`Snippet "${name}" nao encontrado.`);
      return;
    }

    await SmartOutputService.reply(ctx, `Snippet: ${snippet.name}\n\n${snippet.content}`);
  }

  public async handleSnippets(ctx: Context, userId: string): Promise<void> {
    const snippets = await this.snippetService.list(userId);
    if (snippets.length === 0) {
      await ctx.reply('Nenhum snippet salvo. Use /save <nome> <conteudo>.');
      return;
    }

    const list = snippets
      .map((snippet) => `- ${snippet.name} (${snippet.content.length} chars)`)
      .join('\n');

    await ctx.reply(`Seus snippets (${snippets.length}):\n\n${list}`);
  }

  public async handleRemember(ctx: Context, args: string, userId: string): Promise<void> {
    const trimmedArgs = String(args || '').trim();
    const separatorIndex = trimmedArgs.indexOf(' ');

    if (separatorIndex === -1) {
      await ctx.reply('Uso: /remember <chave> <valor>');
      return;
    }

    const key = trimmedArgs.substring(0, separatorIndex).trim();
    const value = trimmedArgs.substring(separatorIndex + 1).trim();
    await this.memoryService.remember(userId, key, value);
    await ctx.reply(`Memorizado: ${key} = ${value}`);
  }

  public async handleRecall(ctx: Context, args: string, userId: string): Promise<void> {
    const key = String(args || '').trim();
    if (!key) {
      await ctx.reply('Uso: /recall <chave>');
      return;
    }

    const value = await this.memoryService.recall(userId, key);
    if (!value) {
      await ctx.reply(`Nao lembro de "${key}".`);
      return;
    }

    await ctx.reply(`${key}: ${value}`);
  }

  public async handleMemory(ctx: Context, userId: string): Promise<void> {
    const entries = await this.memoryService.listAll(userId);
    if (entries.length === 0) {
      await ctx.reply('Memoria vazia. Use /remember <chave> <valor>.');
      return;
    }

    const list = entries.map((entry) => `- [${entry.category}] ${entry.key}: ${entry.value}`).join('\n');
    await ctx.reply(`Minha memoria (${entries.length} fatos):\n\n${list}`);
  }

  public async handleForget(ctx: Context, args: string, userId: string): Promise<void> {
    const key = String(args || '').trim();
    if (!key) {
      await ctx.reply('Uso: /forget <chave>');
      return;
    }

    const removed = await this.memoryService.forget(userId, key);
    await ctx.reply(removed ? `Esqueci "${key}".` : `Nao encontrei "${key}" na memoria.`);
  }
}
