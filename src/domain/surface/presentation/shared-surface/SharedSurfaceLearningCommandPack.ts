import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import { errorMessage } from '../../../../utils/errorLike.js';
export type NaturalLearningCommandIntent = {

  args: string;

  intro: string;
};

type SharedSurfaceLearningCommandPackDeps = {
  learningPlaneService: Pick<ZavorthLearningPlaneService, 'buildSnapshot' | 'executeAction'>;
};

export class SharedSurfaceLearningCommandPack {
  constructor(private readonly deps: SharedSurfaceLearningCommandPackDeps) {}

  public async maybeHandle(ctx: IMessageContext, commandType: string, args: string): Promise<boolean> {
    if (commandType !== '/learning') {
      return false;
    }

    await this.handleLearning(ctx, args);
    return true;
  }

  public async handleNaturalLearningIntent(
    ctx: IMessageContext,
    intent: NaturalLearningCommandIntent,
  ): Promise<void> {
    await ctx.reply(intent.intro);
    await this.handleLearning(ctx, intent.args);
  }

  private async handleLearning(ctx: IMessageContext, args: string): Promise<void> {
    const normalizedArgs = String(args || '').trim();
    const tokens = normalizedArgs.split(/\s+/).filter(Boolean);
    const actionId = this.normalizeActionId(tokens[0]);
    const candidateId = tokens.slice(1).join(' ').trim();

    try {
      if (actionId) {
        if (!candidateId) {
          await ctx.reply('Use /learning <approve|reject|promote|forget|promote-skill|promote-procedure> <candidateId>.');
          return;
        }
        const execution = this.deps.learningPlaneService.executeAction({
          candidateId,
          actionId,
        });
        const lines = [
          'Learning plane do Zavorth',
          '',
          execution.summary,
          `Status: ${execution.status}.`,
          `Candidato: ${execution.candidateId}.`,
          `Acao: ${execution.actionId}.`,
          ...execution.details.slice(0, 4),
        ];
        await ctx.reply(lines.join('\n'));
        return;
      }

      const snapshot = this.deps.learningPlaneService.buildSnapshot();
      const lines = [
        'Learning plane do Zavorth',
        '',
        snapshot.narrative.headline,
        snapshot.narrative.operatorSummary,
        '',
        `Candidatos: ${snapshot.summary.total} | pendentes: ${snapshot.summary.pending} | aprovados: ${snapshot.summary.approved}.`,
        `Promovidos: ${snapshot.summary.promoted} | publicados: ${snapshot.summary.published} | quarentena: ${snapshot.summary.quarantined}.`,
      ];

      if (snapshot.candidates.length > 0) {
        lines.push('', tokens[0]?.toLowerCase() === 'candidates' ? 'Candidatos em foco:' : 'Top candidates:');
        for (const candidate of snapshot.candidates.slice(0, 5)) {
          lines.push(
            `- ${candidate.title} [${candidate.kind}] score=${candidate.score.toFixed(2)} `
            + `review=${candidate.reviewState} lifecycle=${candidate.lifecycle}`,
          );
          lines.push(`  ${candidate.summary}`);
        }
      }

      await ctx.reply(lines.join('\n'));
    } catch (error: unknown) {await ctx.reply(errorMessage(error, 'Nao consegui montar o learning plane agora.'));
    }
  }

  private normalizeActionId(value: unknown):
    | 'approve'
    | 'reject'
    | 'promote'
    | 'forget'
    | 'promoteProcedure'
    | 'promoteSkill'
    | null {
    const normalized = String(value || '').trim().replace(/_/g, '-').toLowerCase();
    if (normalized === 'approve' || normalized === 'reject' || normalized === 'promote' || normalized === 'forget') {
      return normalized;
    }
    if (normalized === 'promote-procedure' || normalized === 'promoteprocedure') {
      return 'promoteProcedure';
    }
    if (normalized === 'promote-skill' || normalized === 'promoteskill') {
      return 'promoteSkill';
    }
    return null;
  }
}
