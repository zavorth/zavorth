import { Context } from 'grammy';
import { CommandParser } from '../CommandParser.js';
import { MemoryService } from '../../services/MemoryService.js';
import { SmartOutputService } from '../../services/SmartOutputService.js';
import { SnippetService } from '../../services/SnippetService.js';

type ChainArtifact = {
  index: number;
  alias: string | null;
  command: string;
  output: string;
  summary: string;
};

type ProcessTextMessageFn = (ctx: Context, text: string) => Promise<void>;
type TelegramTruncator = (content: string, maxLength: number) => string;

export type TelegramChainControllerDeps = {
  parser: CommandParser;
  processTextMessage: ProcessTextMessageFn;
  truncateForTelegram: TelegramTruncator;
};

export class TelegramChainController {
  constructor(private deps: TelegramChainControllerDeps) {}

  public async handleCommandChain(ctx: Context, segments: string[]): Promise<void> {
    const maxChainSegments = 5;
    const allowedCommands = new Set([
      '/status',
      '/help',
      '/menu',
      '/zavorth',
      '/settings',
      '/research',
      '/deepresearch',
      '/save',
      '/remember',
      '/memory',
      '/recall',
      '/forget',
      '/snippet',
      '/snippets',
      '/models',
      '/model',
      '/wsl',
      '/audit',
      '/dashboard',
    ]);

    if (segments.length > maxChainSegments) {
      await ctx.reply(`Chains aceitam no maximo ${maxChainSegments} comandos por vez.`);
      return;
    }

    for (const segment of segments) {
      const parsed = this.deps.parser.parse(segment);
      if (!allowedCommands.has(parsed.command_type)) {
        await ctx.reply(
          `O comando \`${parsed.command_type}\` nao pode participar de chain por seguranca.\n\nPermitidos: ${Array.from(allowedCommands).join(', ')}`,
          { parse_mode: 'Markdown' },
        );
        return;
      }
    }

    const summaries: string[] = [];
    const chainArtifacts: ChainArtifact[] = [];
    let previousOutput = '';
    const userId = ctx.from?.id?.toString() || '';

    for (let i = 0; i < segments.length; i += 1) {
      const segmentDefinition = this.parseChainSegment(segments[i]);
      let command = await this.resolveChainTemplates(segmentDefinition.command, chainArtifacts, userId);

      if (i > 0 && previousOutput && !/{{[^}]+}}/.test(segmentDefinition.command)) {
        command = `${command}\n\nContexto do passo anterior:\n${previousOutput.slice(0, 500)}`;
      }

      const capturedOutputs: string[] = [];
      const chainedCtx: Context = Object.create(ctx);
      (chainedCtx as any).reply = async (message: string, options?: any) => {
        if (typeof message === 'string') {
          capturedOutputs.push(message);
        }
        return { message_id: 0, text: message, options };
      };
      (chainedCtx as any).replyWithDocument = async (_file: any, extra?: any) => {
        const summary = extra?.caption || '[documento enviado]';
        capturedOutputs.push(summary);
        return { message_id: 0, caption: summary };
      };

      try {
        await this.deps.processTextMessage(chainedCtx, command);
        previousOutput = capturedOutputs.join('\n').trim();
        const summary = this.summarizeChainArtifact(previousOutput);
        chainArtifacts.push({
          index: i + 1,
          alias: segmentDefinition.alias,
          command,
          output: previousOutput,
          summary,
        });
        const aliasSuffix = segmentDefinition.alias ? ` => ${segmentDefinition.alias}` : '';
        summaries.push(
          `Passo ${i + 1}${aliasSuffix}: ${segments[i]}${
            previousOutput
              ? `\n${this.deps.truncateForTelegram(previousOutput, 700)}`
              : '\nSem resposta textual.'
          }`,
        );
      } catch (error: any) {
        summaries.push(`Passo ${i + 1}: ${segments[i]}\nFalhou: ${error?.message || error}`);
        previousOutput = '';
      }
    }

    await SmartOutputService.reply(ctx, `Chain concluida.\n\n${summaries.join('\n\n---\n\n')}`);
  }

  public parseChainSegment(rawSegment: string): { command: string; alias: string | null } {
    const match = rawSegment.match(/^(.*?)(?:\s+=>\s+([A-Za-z][\w-]{1,31}))$/);
    if (!match) {
      return { command: rawSegment.trim(), alias: null };
    }

    return {
      command: match[1].trim(),
      alias: match[2].trim().toLowerCase(),
    };
  }

  public async resolveChainTemplates(
    rawCommand: string,
    artifacts: ChainArtifact[],
    userId: string,
  ): Promise<string> {
    const memoryService = new MemoryService();
    const snippetService = new SnippetService();

    const resolved = await this.replaceAsync(rawCommand, /{{\s*([^}]+)\s*}}/g, async (_match, token) => {
      const normalized = String(token || '').trim().toLowerCase();
      if (!normalized) {
        return '';
      }

      if (normalized === 'prev' || normalized === 'last_output') {
        return artifacts[artifacts.length - 1]?.output || '';
      }

      if (normalized === 'prev_summary' || normalized === 'last_summary') {
        return artifacts[artifacts.length - 1]?.summary || '';
      }

      const stepMatch = normalized.match(/^step(\d+)(?:\.(summary|command))?$/);
      if (stepMatch) {
        const artifact = artifacts.find((item) => item.index === Number(stepMatch[1]));
        if (!artifact) {
          return '';
        }

        if (stepMatch[2] === 'summary') {
          return artifact.summary;
        }
        if (stepMatch[2] === 'command') {
          return artifact.command;
        }
        return artifact.output;
      }

      const variableMatch = normalized.match(/^var:(.+)$/);
      if (variableMatch) {
        const alias = variableMatch[1].trim().toLowerCase();
        const artifact = artifacts.find((item) => item.alias === alias);
        return artifact?.output || '';
      }

      const memoryMatch = normalized.match(/^memory:(.+)$/);
      if (memoryMatch && userId) {
        return (await memoryService.recall(userId, memoryMatch[1].trim())) || '';
      }

      const snippetMatch = normalized.match(/^snippet:(.+)$/);
      if (snippetMatch && userId) {
        const snippet = await snippetService.get(userId, snippetMatch[1].trim());
        return snippet?.content || '';
      }

      return '';
    });

    return resolved.trim();
  }

  private summarizeChainArtifact(output: string): string {
    const normalized = String(output || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized) {
      return '';
    }
    return normalized.length <= 220 ? normalized : `${normalized.slice(0, 220)}...`;
  }

  private async replaceAsync(
    input: string,
    regex: RegExp,
    replacer: (match: string, token: string) => Promise<string>,
  ): Promise<string> {
    const matches = Array.from(input.matchAll(regex));
    if (matches.length === 0) {
      return input;
    }

    const replacements = await Promise.all(matches.map((match) => replacer(match[0], match[1])));
    let result = input;
    matches.forEach((match, index) => {
      result = result.replace(match[0], replacements[index]);
    });
    return result;
  }
}
