import { Context } from 'grammy';
import { MultiAgentPipeline } from '../../runtime/workflows/MultiAgentPipeline.js';
import type {
  WorkflowRunCreateOptions,
  WorkflowWorkspaceContext,
} from '../../runtime/workflows/WorkflowRunService.js';

type PipelineFactory = () => Pick<MultiAgentPipeline, 'runReviewPipeline' | 'runWorkflow' | 'resumeWorkflow' | 'closeWorkflowRun' | 'runSddLoop'>;
type WorkspaceResolver = (commandType: string) => string;

export class TelegramPipelineController {
  constructor(
    private createPipeline: PipelineFactory,
    private getDefaultWorkspace: WorkspaceResolver,
  ) {}

  public async handleExternalExecutorReview(ctx: Context, args: string): Promise<void> {
    const objective = String(args || '').trim() || 'Sem objetivo';
    const workspace = this.getDefaultWorkspace('/external_review');
    await this.createPipeline().runReviewPipeline(ctx, objective, workspace);
  }

  public async handleWorkflow(ctx: Context, args: string): Promise<void> {
    const trimmed = String(args || '').trim();
    if (!trimmed) {
      await ctx.reply(
        [
          'Use /workflow <tipo> <objetivo>.',
          '',
          'Workflows disponiveis:',
          '- review: executa, revisa e fecha com um parecer final',
          '- ship: implementa, revisa e deixa pronto para entrega',
          '- research: pesquisa, sintetiza e devolve um briefing claro',
          '- sdd: roda o proximo papel do loop spec/plan/tasks de uma feature',
          '- resume: retoma um workflow existente pelo run id e, se quiser, por uma etapa especifica',
          '- restart-stage: reexecuta uma etapa especifica de um workflow existente',
          '- close: encerra um workflow bloqueado ou com falha para ele deixar de aparecer como retomada',
          '',
          'Exemplo de retomada:',
          '/workflow resume wf-ship-abc123 review',
          '/workflow restart-stage wf-ship-abc123 draft',
        ].join('\n'),
      );
      return;
    }

    const [workflowRaw, ...rest] = trimmed.split(/\s+/);
    const pipeline = this.createPipeline();
    const workflowCommand = String(workflowRaw || '').trim().toLowerCase();
    if (workflowCommand === 'resume' || workflowCommand === 'restart-stage' || workflowCommand === 'restart-phase') {
      const isRestart = workflowCommand === 'restart-stage' || workflowCommand === 'restart-phase';
      const { workflowRunId, stageId } = this.parseResumeArgs(rest);
      if (!workflowRunId) {
        await ctx.reply(
          isRestart
            ? 'Faltou o identificador do workflow. Exemplo: /workflow restart-stage wf-ship-abc123 <etapa>'
            : 'Faltou o identificador do workflow. Exemplo: /workflow resume wf-ship-abc123 [etapa]',
        );
        return;
      }
      if (isRestart && !stageId) {
        await ctx.reply('Faltou a etapa para reiniciar. Exemplo: /workflow restart-stage wf-ship-abc123 <etapa>');
        return;
      }
      await pipeline.resumeWorkflow(ctx, workflowRunId, stageId ? { stageId } : undefined);
      return;
    }
    if (workflowCommand === 'close') {
      const { workflowRunId } = this.parseResumeArgs(rest);
      if (!workflowRunId) {
        await ctx.reply('Faltou o identificador do workflow. Exemplo: /workflow close wf-ship-abc123');
        return;
      }
      await pipeline.closeWorkflowRun(ctx, workflowRunId, {
        surface: 'telegram',
      });
      return;
    }

    const workflow = this.normalizeWorkflow(workflowRaw);
    const objective = rest.join(' ').trim();

    if (!workflow) {
      await ctx.reply('Workflow desconhecido. Use /workflow review, /workflow ship, /workflow research, /workflow sdd, /workflow resume, /workflow restart-stage ou /workflow close.');
      return;
    }

    if (!objective) {
      const example = workflow === 'sdd'
        ? '/workflow sdd multisurface/shared-command-contract'
        : `/workflow ${workflow} revise este modulo e entregue um resumo final.`;
      await ctx.reply(`Faltou o objetivo. Exemplo: ${example}`);
      return;
    }

    const workspace = this.getDefaultWorkspace('/workflow');
    if (workflow === 'sdd') {
      await pipeline.runSddLoop(ctx, objective, workspace);
      return;
    }

    await pipeline.runWorkflow(ctx, workflow, objective, workspace);
  }

  public async handleNamedWorkflow(
    ctx: Context,
    workflow: string,
    objective: string,
    workspace?: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
    launchOptions: WorkflowRunCreateOptions = {},
  ): Promise<void> {
    const normalized = this.normalizeWorkflow(workflow);
    if (!normalized) {
      await ctx.reply('Workflow desconhecido. Use review, ship, research ou sdd.');
      return;
    }

    const finalObjective = String(objective || '').trim();
    if (!finalObjective) {
      await ctx.reply(`Faltou o objetivo para o workflow ${normalized}.`);
      return;
    }

    if (normalized === 'sdd') {
      await this.createPipeline().runSddLoop(
        ctx,
        finalObjective,
        workspace || this.getDefaultWorkspace('/workflow'),
        workspaceContext,
        launchOptions,
      );
      return;
    }

    await this.createPipeline().runWorkflow(
      ctx,
      normalized,
      finalObjective,
      workspace || this.getDefaultWorkspace('/workflow'),
      workspaceContext,
      launchOptions,
    );
  }

  private normalizeWorkflow(input: string): 'review' | 'ship' | 'research' | 'sdd' | null {
    const normalized = String(input || '').trim().toLowerCase();
    if (['review', 'revisao', 'revisar'].includes(normalized)) {
      return 'review';
    }
    if (['ship', 'dev', 'build', 'entregar'].includes(normalized)) {
      return 'ship';
    }
    if (['research', 'pesquisa', 'pesquisar'].includes(normalized)) {
      return 'research';
    }
    if (['sdd', 'spec-loop', 'specs'].includes(normalized)) {
      return 'sdd';
    }
    return null;
  }

  private parseResumeArgs(parts: string[]): {
    workflowRunId: string;
    stageId: string | null;
  } {
    const tokens = Array.isArray(parts)
      ? parts.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    const workflowRunId = tokens[0] || '';
    if (!workflowRunId) {
      return {
        workflowRunId: '',
        stageId: null,
      };
    }

    let stageId = '';
    if (tokens[1] === '--phase') {
      stageId = tokens[2] || '';
    } else if (tokens.length > 1) {
      stageId = tokens[1] || '';
    }

    return {
      workflowRunId,
      stageId: stageId || null,
    };
  }
}
