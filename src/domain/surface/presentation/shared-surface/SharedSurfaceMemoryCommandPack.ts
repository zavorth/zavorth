import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthLayeredMemoryService } from '../../../../services/ZavorthLayeredMemoryService.js';
import type { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
import { tSurface } from '../../../../i18n/surface.js';
type SharedSurfaceMemoryCommandPackDeps = {
  memoryPlaneService: Pick<ZavorthMemoryPlaneService, 'buildSnapshot'> | null;
  layeredMemoryService: Pick<ZavorthLayeredMemoryService, 'buildStatus' | 'readProcedures' | 'search'>;
};

export class SharedSurfaceMemoryCommandPack {
  constructor(private readonly deps: SharedSurfaceMemoryCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    switch (commandType) {
      case '/memory':
        await this.handleLayeredMemory(ctx, args);
        return true;
      case '/memoryplane':
        await this.handleMemoryPlane(ctx);
        return true;
      default:
        return false;
    }
  }

  private async handleMemoryPlane(ctx: IMessageContext): Promise<void> {
    if (!this.deps.memoryPlaneService) {
      await ctx.reply('Memory plane unavailable in this shared runtime.');
      return;
    }

    try {
      const snapshot = await this.deps.memoryPlaneService.buildSnapshot({
        userId: String(ctx.userId || '').trim() || null,
        platform: ctx.platform,
        chatId: String(ctx.chatId || '').trim() || null,
        sessionId: String(ctx.chatId || '').trim() || null,
        sourceUserId: String(ctx.userId || '').trim() || null,
      });

      const lines = [
        'Zavorth resume and deliveries',
        '',
        snapshot.narrative.headline,
        snapshot.narrative.operatorSummary,
        '',
        `Persisted memories: ${snapshot.summary.persistedMemories}.`,
        `Visible replay: ${snapshot.summary.replayTasks} task(s) | ${snapshot.summary.workflowRuns} workflow(s).`,
        `Recent deliveries: ${snapshot.summary.artifacts}.`,
      ];

      if (snapshot.artifacts.recent.length > 0) {
        lines.push('', 'Deliveries in focus:');
        for (const artifact of snapshot.artifacts.recent.slice(0, 3)) {
          lines.push(`- ${artifact.label}: ${artifact.summary || artifact.path || 'No extra summary.'}`);
        }
      }

      if (snapshot.memory.relevant.length > 0) {
        lines.push('', 'Relevant memories:');
        for (const entry of snapshot.memory.relevant.slice(0, 3)) {
          lines.push(`- ${entry.key}: ${entry.value}`);
        }
      }

      if (snapshot.suggestedActions.length > 0) {
        lines.push('', 'Next step:');
        for (const action of snapshot.suggestedActions.slice(0, 3)) {
          lines.push(`- ${action.label}: ${action.command}`);
        }
      }

      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {
      await ctx.reply(errorMessage(error, tSurface('error_memory_plane')));
    }
  }

  private async handleLayeredMemory(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const mode =
      String(tokens[0] || 'status')
        .trim()
        .toLowerCase() || 'status';
    const commonInput = {
      userId: String(ctx.userId || '').trim() || null,
      platform: ctx.platform,
      chatId: String(ctx.chatId || '').trim() || null,
      sessionId: String(ctx.chatId || '').trim() || null,
      workspaceHint: null,
    };

    try {
      if (mode === 'search') {
        const query = tokens.slice(1).join(' ').trim();
        if (!query) {
          await ctx.reply('Use /memory search <query>.');
          return;
        }
        const results = await this.deps.layeredMemoryService.search({
          ...commonInput,
          query,
        });
        const lines = ['Zavorth layered memory', '', `Query: ${results.query}.`, `Results: ${results.total}.`];
        for (const entry of results.data.slice(0, 6)) {
          lines.push(`- ${entry.label} [${entry.memoryLayer}] (${entry.source}) conf=${entry.confidence.toFixed(2)}`);
          lines.push(`  ${entry.summary}`);
        }
        await ctx.reply(lines.join('\n'));
        return;
      }

      if (mode === 'procedures' || mode === 'procedure') {
        const procedures = await this.deps.layeredMemoryService.readProcedures({
          workspaceHint: null,
        });
        const lines = ['Zavorth procedural memory', '', `Procedures: ${procedures.total}.`];
        for (const procedure of procedures.data.slice(0, 5)) {
          lines.push(`- ${procedure.label} (${procedure.source}) conf=${procedure.confidence.toFixed(2)}`);
          lines.push(`  ${procedure.summary}`);
          for (const step of procedure.steps.slice(0, 3)) {
            lines.push(`  -> ${step}`);
          }
        }
        await ctx.reply(lines.join('\n'));
        return;
      }

      const status = await this.deps.layeredMemoryService.buildStatus(commonInput);
      await ctx.reply(
        [
          'Zavorth layered memory',
          '',
          status.narrative.headline,
          status.narrative.operatorSummary,
          '',
          `Total: ${status.summary.total}.`,
          `Episodic: ${status.summary.episodic} | semantic: ${status.summary.semantic} | procedural: ${status.summary.procedural}.`,
          `Budget per layer: ${status.budgets.perLayer}.`,
        ].join('\n'),
      );
    } catch (error: unknown) {
      if (mode === 'status' && this.deps.memoryPlaneService) {
        await this.handleMemoryPlane(ctx);
        return;
      }
      await ctx.reply(errorMessage(error, tSurface('error_layered_memory')));
    }
  }
}
