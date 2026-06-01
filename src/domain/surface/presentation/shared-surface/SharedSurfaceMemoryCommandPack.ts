import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthLayeredMemoryService } from '../../../../services/ZavorthLayeredMemoryService.js';
import type { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';

export type NaturalMemoryCommandIntent = {
  command: 'memory' | 'memoryplane';
  args: string;
  intro: string;
};

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

  public async handleNaturalMemoryIntent(
    ctx: IMessageContext,
    intent: NaturalMemoryCommandIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    if (intent.command === 'memoryplane') {
      await this.handleMemoryPlane(ctx);
      return;
    }
    await this.handleLayeredMemory(ctx, intent.args);
  }

  private async handleMemoryPlane(ctx: IMessageContext): Promise<void> {
    if (!this.deps.memoryPlaneService) {
      await ctx.reply('Memory plane indisponivel neste runtime compartilhado.');
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
        'Retomada e entregas do Zavorth',
        '',
        snapshot.narrative.headline,
        snapshot.narrative.operatorSummary,
        '',
        `Memorias persistentes: ${snapshot.summary.persistedMemories}.`,
        `Replay visivel: ${snapshot.summary.replayTasks} tarefa(s) | ${snapshot.summary.workflowRuns} workflow(s).`,
        `Entregas recentes: ${snapshot.summary.artifacts}.`,
      ];

      if (snapshot.artifacts.recent.length > 0) {
        lines.push('', 'Entregas em foco:');
        for (const artifact of snapshot.artifacts.recent.slice(0, 3)) {
          lines.push(`- ${artifact.label}: ${artifact.summary || artifact.path || 'Sem resumo adicional.'}`);
        }
      }

      if (snapshot.memory.relevant.length > 0) {
        lines.push('', 'Memorias relevantes:');
        for (const entry of snapshot.memory.relevant.slice(0, 3)) {
          lines.push(`- ${entry.key}: ${entry.value}`);
        }
      }

      if (snapshot.suggestedActions.length > 0) {
        lines.push('', 'Proximo passo:');
        for (const action of snapshot.suggestedActions.slice(0, 3)) {
          lines.push(`- ${action.label}: ${action.command}`);
        }
      }

      await ctx.reply(lines.join('\n'));
    } catch (error: any) {
      await ctx.reply(error?.message || 'Nao consegui montar o memory plane agora.');
    }
  }

  private async handleLayeredMemory(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const mode = String(tokens[0] || 'status').trim().toLowerCase() || 'status';
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
          await ctx.reply('Use /memory search <consulta>.');
          return;
        }
        const results = await this.deps.layeredMemoryService.search({
          ...commonInput,
          query,
        });
        const lines = [
          'Layered memory do Zavorth',
          '',
          `Consulta: ${results.query}.`,
          `Resultados: ${results.total}.`,
        ];
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
        const lines = [
          'Procedural memory do Zavorth',
          '',
          `Procedimentos: ${procedures.total}.`,
        ];
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
      await ctx.reply([
        'Layered memory do Zavorth',
        '',
        status.narrative.headline,
        status.narrative.operatorSummary,
        '',
        `Total: ${status.summary.total}.`,
        `Episodica: ${status.summary.episodic} | semantica: ${status.summary.semantic} | procedural: ${status.summary.procedural}.`,
        `Budget por camada: ${status.budgets.perLayer}.`,
      ].join('\n'));
    } catch (error: any) {
      if (mode === 'status' && this.deps.memoryPlaneService) {
        await this.handleMemoryPlane(ctx);
        return;
      }
      await ctx.reply(error?.message || 'Nao consegui consultar a layered memory agora.');
    }
  }
}
