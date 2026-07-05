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
      await ctx.reply('Usage: /save <name> <content>');
      return;
    }

    const name = trimmedArgs.substring(0, separatorIndex).trim();
    const content = trimmedArgs.substring(separatorIndex + 1).trim();
    await this.snippetService.save(userId, name, content);
    await ctx.reply(`Snippet "${name}" saved.`);
  }

  public async handleSnippet(ctx: Context, args: string, userId: string): Promise<void> {
    const name = String(args || '').trim();
    if (!name) {
      await ctx.reply('Usage: /snippet <name>');
      return;
    }

    const snippet = await this.snippetService.get(userId, name);
    if (!snippet) {
      await ctx.reply(`Snippet "${name}" was not found.`);
      return;
    }

    await SmartOutputService.reply(ctx, `Snippet: ${snippet.name}\n\n${snippet.content}`);
  }

  public async handleSnippets(ctx: Context, userId: string): Promise<void> {
    const snippets = await this.snippetService.list(userId);
    if (snippets.length === 0) {
      await ctx.reply('No saved snippets. Use /save <name> <content>.');
      return;
    }

    const list = snippets
      .map((snippet) => `- ${snippet.name} (${snippet.content.length} chars)`)
      .join('\n');

    await ctx.reply(`Your snippets (${snippets.length}):\n\n${list}`);
  }

  public async handleRemember(ctx: Context, args: string, userId: string): Promise<void> {
    const trimmedArgs = String(args || '').trim();
    const separatorIndex = trimmedArgs.indexOf(' ');

    if (separatorIndex === -1) {
      await ctx.reply('Usage: /remember <key> <value>');
      return;
    }

    const key = trimmedArgs.substring(0, separatorIndex).trim();
    const value = trimmedArgs.substring(separatorIndex + 1).trim();
    await this.memoryService.remember(userId, key, value);
    await ctx.reply(`Remembered: ${key} = ${value}`);
  }

  public async handleRecall(ctx: Context, args: string, userId: string): Promise<void> {
    const key = String(args || '').trim();
    if (!key) {
      await ctx.reply('Usage: /recall <key>');
      return;
    }

    const value = await this.memoryService.recall(userId, key);
    if (!value) {
      await ctx.reply(`I do not remember "${key}".`);
      return;
    }

    await ctx.reply(`${key}: ${value}`);
  }

  public async handleMemory(ctx: Context, userId: string): Promise<void> {
    const entries = await this.memoryService.listAll(userId);
    if (entries.length === 0) {
      await ctx.reply('Memory is empty. Use /remember <key> <value>.');
      return;
    }

    const list = entries.map((entry) => `- [${entry.category}] ${entry.key}: ${entry.value}`).join('\n');
    await ctx.reply(`My memory (${entries.length} facts):\n\n${list}`);
  }

  public async handleForget(ctx: Context, args: string, userId: string): Promise<void> {
    const key = String(args || '').trim();
    if (!key) {
      await ctx.reply('Usage: /forget <key>');
      return;
    }

    const removed = await this.memoryService.forget(userId, key);
    await ctx.reply(removed ? `Forgot "${key}".` : `I did not find "${key}" in memory.`);
  }
}
