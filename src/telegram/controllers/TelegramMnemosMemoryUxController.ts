import type { Context } from 'grammy';
import { ZavorthMnemosMemoryUxService } from '../../services/ZavorthMnemosMemoryUxService.js';
import { ZavorthMnemosProceduralMemoryService } from '../../services/ZavorthMnemosProceduralMemoryService.js';
import { ZavorthMnemosQueryService } from '../../services/ZavorthMnemosQueryService.js';

type TelegramMnemosMemoryUxControllerDeps = {
  memoryUxService?: ZavorthMnemosMemoryUxService;
  proceduralMemoryService?: ZavorthMnemosProceduralMemoryService;
  queryService?: ZavorthMnemosQueryService;
};

export class TelegramMnemosMemoryUxController {
  private readonly memoryUxService: ZavorthMnemosMemoryUxService;
  private readonly proceduralMemoryService: ZavorthMnemosProceduralMemoryService;
  private readonly queryService: ZavorthMnemosQueryService;

  constructor(deps: TelegramMnemosMemoryUxControllerDeps = {}) {
    this.memoryUxService = deps.memoryUxService || new ZavorthMnemosMemoryUxService();
    this.proceduralMemoryService = deps.proceduralMemoryService || new ZavorthMnemosProceduralMemoryService();
    this.queryService = deps.queryService || new ZavorthMnemosQueryService();
  }

  public async handleMnemos(ctx: Context, args: string, userId: string): Promise<void> {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const first = String(tokens[0] || '').toLowerCase();
    if (first === 'procedural') {
      const snapshot = this.proceduralMemoryService.list();
      await ctx.reply([
        `Mnemos procedural: ${snapshot.status}`,
        `Regras: ${snapshot.summary.active}/${snapshot.summary.total} ativa(s)`,
        `Usuario: ${userId}`,
        '',
        'Para criar regra: zavorth memory procedural preview <texto>',
        'Para aplicar: zavorth memory procedural apply --approval-id <id> <texto>',
      ].join('\n'));
      return;
    }
    if (first === 'query') {
      const queryText = tokens.slice(1).join(' ').trim();
      const snapshot = this.queryService.query({ query: queryText });
      const hits = snapshot.hits.slice(0, 5).map((hit) => `- ${hit.title}: ${hit.path}`).join('\n');
      await ctx.reply([
        `Mnemos query: ${snapshot.status}`,
        `Hits: ${snapshot.summary.hits}/${snapshot.summary.pagesScanned}`,
        hits || 'Nenhuma pagina encontrada.',
      ].join('\n'));
      return;
    }
    if (first === 'revoke') {
      const ruleId = tokens[1] || '<rule-id>';
      await ctx.reply([
        'Revogacao Mnemos exige approval governado.',
        `Regra: ${ruleId}`,
        '',
        `Use na CLI: zavorth memory procedural revoke --id ${ruleId} --approval-id <id>`,
      ].join('\n'));
      return;
    }
    const snapshot = this.memoryUxService.buildSnapshot();
    await ctx.reply(this.memoryUxService.formatTelegram(snapshot));
  }
}
