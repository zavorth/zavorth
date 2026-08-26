import type { ParsedCommand } from '../../../../channels/commands/ChannelCommandParser.js';
import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type {
  SurfaceDecisionChoice,
  SurfaceDecisionType,
} from '../../../../services/approvals/SurfaceDecisionContract.js';
import type { SurfaceDecisionSpine } from '../../../../services/approvals/SurfaceDecisionSpine.js';

export type SharedSurfaceDecisionCommandPackDeps = {
  decisionSpine?: SurfaceDecisionSpine | null;
};

const APPROVAL_SCOPE_WORDS = new Set(['once', 'session', 'always']);

/**
 * Cross-surface decision commands (the Hermes property): `/approve`, `/reject`
 * and `/approvals` resolve every pending decision through the universal
 * surface decision spine instead of a transport-specific controller. The pack
 * is registered LAST in the command chain, so it only claims these commands
 * when no earlier pack did; without a spine it stays inert.
 */
export class SharedSurfaceDecisionCommandPack {
  public readonly commandNames: readonly string[] = ['/approvals', '/approve', '/reject'];

  public constructor(private readonly deps: SharedSurfaceDecisionCommandPackDeps) {}

  public async handle(input: { context: IMessageContext; parsedCommand: ParsedCommand }): Promise<boolean> {
    const spine = this.deps.decisionSpine;
    const commandType = String(input.parsedCommand?.command_type || '').trim().toLowerCase();
    if (!spine || !this.commandNames.includes(commandType)) {
      return false;
    }

    if (commandType === '/approvals') {
      await this.replyWithPendingDecisions(input.context, spine);
      return true;
    }

    await this.resolveDecision(input.context, spine, commandType, String(input.parsedCommand.command_args || ''));
    return true;
  }

  private async replyWithPendingDecisions(ctx: IMessageContext, spine: SurfaceDecisionSpine): Promise<void> {
    const entries = spine.listPending();
    if (entries.length === 0) {
      await ctx.reply('No pending decisions across registered surfaces.');
      return;
    }
    const lines = [`Pending decisions (${entries.length})`];
    for (const entry of entries) {
      lines.push(`- [${entry.decisionType}] ${entry.ref}`);
    }
    await ctx.reply(lines.join('\n'));
  }

  private async resolveDecision(
    ctx: IMessageContext,
    spine: SurfaceDecisionSpine,
    commandType: string,
    rawArgs: string,
  ): Promise<void> {
    try {
      if (commandType === '/reject') {
        const ref = rawArgs.trim().split(/\s+/).filter(Boolean)[0] || '';
        const claimedType = ref ? (spine.findClaimingType(ref) ?? 'task') : 'task';
        await this.resolveAndReply(ctx, spine, {
          decisionType: claimedType,
          decisionRef: ref,
          choice: 'deny',
        });
        return;
      }

      const tokens = rawArgs.trim().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) {
        await this.resolveAndReply(ctx, spine, { decisionType: 'task', rawArgs: '' });
        return;
      }

      const ref = tokens[0];
      const claimedType = spine.findClaimingType(ref) ?? 'task';
      const scopeWord = tokens[1] ?? '';
      if (APPROVAL_SCOPE_WORDS.has(scopeWord.toLowerCase())) {
        await this.resolveAndReply(ctx, spine, {
          decisionType: claimedType,
          decisionRef: ref,
          choice: scopeWord.toLowerCase() as SurfaceDecisionChoice,
        });
        return;
      }

      await this.resolveAndReply(ctx, spine, {
        decisionType: claimedType,
        rawArgs: rawArgs.trim(),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown error';
      await ctx.reply(`Could not resolve that approval right now.\n\nReason: ${message}`);
    }
  }

  private async resolveAndReply(
    ctx: IMessageContext,
    spine: SurfaceDecisionSpine,
    request:
      | { decisionType: SurfaceDecisionType; decisionRef: string; choice: SurfaceDecisionChoice }
      | { decisionType: SurfaceDecisionType; rawArgs: string },
  ): Promise<void> {
    const receipt =
      'choice' in request
        ? await spine.resolve({
            decisionType: request.decisionType,
            decisionRef: request.decisionRef,
            surface: ctx.platform,
            chatId: ctx.chatId,
            userId: ctx.userId || null,
            choice: request.choice,
          })
        : await spine.resolve({
            decisionType: request.decisionType,
            decisionRef: '',
            surface: ctx.platform,
            chatId: ctx.chatId,
            userId: ctx.userId || null,
            rawArgs: request.rawArgs,
          });
    if (receipt.receiptText != null) {
      await ctx.reply(receipt.receiptText);
      return;
    }
    if (!receipt.resolved) {
      await ctx.reply('No pending decision found for that reference.');
    }
  }
}
