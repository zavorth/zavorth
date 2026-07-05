import { execCommandSync } from '../core/CommandSpawn.js';
import {
  RuntimeBootstrapService,
  type RuntimeBootstrapAction,
  type RuntimeBootstrapReport,
} from './RuntimeBootstrapService.js';

export type RuntimeBootstrapRepairStep = {
  actionId: string;
  title: string;
  command: string;
  blocking: boolean;
  status: 'executed' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  output?: string;
  error?: string;
};

export type RuntimeBootstrapRepairReport = {
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  initial: RuntimeBootstrapReport;
  steps: RuntimeBootstrapRepairStep[];
  final: RuntimeBootstrapReport;
  summary: string;
};

type BootstrapLike = Pick<RuntimeBootstrapService, 'inspect'> & Partial<Pick<RuntimeBootstrapService, 'inspectLive'>>;

type CommandRunner = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    encoding: BufferEncoding;
    stdio: 'pipe';
  },
) => string | Buffer;

type RuntimeBootstrapRepairOptions = {
  bootstrapService?: BootstrapLike;
  runCommand?: CommandRunner;
  now?: () => Date;
};

export class RuntimeBootstrapRepairService {
  private readonly bootstrapService: BootstrapLike;
  private readonly runCommand: CommandRunner;
  private readonly now: () => Date;

  constructor(options: RuntimeBootstrapRepairOptions = {}) {
    this.bootstrapService = options.bootstrapService || new RuntimeBootstrapService();
    this.runCommand = options.runCommand || execCommandSync;
    this.now = options.now || (() => new Date());
  }

  public repair(options: { dryRun?: boolean } = {}): RuntimeBootstrapRepairReport {
    const dryRun = options.dryRun === true;
    const initial = this.bootstrapService.inspect();
    const startedAt = this.now().toISOString();
    const repairableActions = initial.actions.filter((action) => action.autoFixCommand);
    const steps: RuntimeBootstrapRepairStep[] = [];

    if (repairableActions.length === 0) {
      const finishedAt = this.now().toISOString();
      return {
        startedAt,
        finishedAt,
        dryRun,
        initial,
        steps,
        final: initial,
        summary: 'Nenhuma correcao segura disponivel para execucao automatica no momento.',
      };
    }

    for (const action of repairableActions) {
      if (dryRun) {
        const started = this.now().toISOString();
        const finished = this.now().toISOString();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'skipped',
          startedAt: started,
          finishedAt: finished,
          durationMs: 0,
          output: 'Dry-run: a correcao segura foi planejada, mas nao executada.',
        });
        continue;
      }

      const stepStart = this.now();
      const started = stepStart.toISOString();

      try {
        const autoFixCommand = action.autoFixCommand!;
        const output = this.runCommand(autoFixCommand.command, autoFixCommand.args, {
          cwd: autoFixCommand.cwd || initial.projectRoot,
          encoding: 'utf8',
          stdio: 'pipe',
        });
        const finished = this.now();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'executed',
          startedAt: started,
          finishedAt: finished.toISOString(),
          durationMs: Math.max(0, finished.getTime() - stepStart.getTime()),
          output: String(output || '').trim() || undefined,
        });
      } catch (error: any) {
        const finished = this.now();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'failed',
          startedAt: started,
          finishedAt: finished.toISOString(),
          durationMs: Math.max(0, finished.getTime() - stepStart.getTime()),
          error: this.normalizeError(error),
        });

        if (action.blocking) {
          break;
        }
      }
    }

    const final = this.bootstrapService.inspect();
    const finishedAt = this.now().toISOString();
    return {
      startedAt,
      finishedAt,
      dryRun,
      initial,
      steps,
      final,
      summary: this.buildSummary(steps, final, dryRun),
    };
  }

  public async repairLive(options: { dryRun?: boolean } = {}): Promise<RuntimeBootstrapRepairReport> {
    const dryRun = options.dryRun === true;
    const initial = await this.inspectBootstrapLive();
    const startedAt = this.now().toISOString();
    const repairableActions = initial.actions.filter((action) => action.autoFixCommand);
    const steps: RuntimeBootstrapRepairStep[] = [];

    if (repairableActions.length === 0) {
      const finishedAt = this.now().toISOString();
      return {
        startedAt,
        finishedAt,
        dryRun,
        initial,
        steps,
        final: initial,
        summary: 'Nenhuma correcao segura disponivel para execucao automatica no momento.',
      };
    }

    for (const action of repairableActions) {
      if (dryRun) {
        const started = this.now().toISOString();
        const finished = this.now().toISOString();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'skipped',
          startedAt: started,
          finishedAt: finished,
          durationMs: 0,
          output: 'Dry-run: a correcao segura foi planejada, mas nao executada.',
        });
        continue;
      }

      const stepStart = this.now();
      const started = stepStart.toISOString();

      try {
        const autoFixCommand = action.autoFixCommand!;
        const output = this.runCommand(autoFixCommand.command, autoFixCommand.args, {
          cwd: autoFixCommand.cwd || initial.projectRoot,
          encoding: 'utf8',
          stdio: 'pipe',
        });
        const finished = this.now();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'executed',
          startedAt: started,
          finishedAt: finished.toISOString(),
          durationMs: Math.max(0, finished.getTime() - stepStart.getTime()),
          output: String(output || '').trim() || undefined,
        });
      } catch (error: any) {
        const finished = this.now();
        steps.push({
          actionId: action.id,
          title: action.title,
          command: action.command,
          blocking: action.blocking,
          status: 'failed',
          startedAt: started,
          finishedAt: finished.toISOString(),
          durationMs: Math.max(0, finished.getTime() - stepStart.getTime()),
          error: this.normalizeError(error),
        });

        if (action.blocking) {
          break;
        }
      }
    }

    const final = await this.inspectBootstrapLive();
    const finishedAt = this.now().toISOString();
    return {
      startedAt,
      finishedAt,
      dryRun,
      initial,
      steps,
      final,
      summary: this.buildSummary(steps, final, dryRun),
    };
  }

  private async inspectBootstrapLive(): Promise<RuntimeBootstrapReport> {
    if (this.bootstrapService.inspectLive) {
      return this.bootstrapService.inspectLive();
    }
    return this.bootstrapService.inspect();
  }

  private buildSummary(
    steps: RuntimeBootstrapRepairStep[],
    final: RuntimeBootstrapReport,
    dryRun: boolean,
  ): string {
    if (steps.length === 0) {
      return 'Nenhuma correcao segura disponivel para execucao automatica no momento.';
    }

    if (dryRun) {
      return `Plano de correcao gerado com ${steps.length} acao(oes) segura(s).`;
    }

    const failedStep = steps.find((step) => step.status === 'failed');
    if (failedStep) {
      return `Falha ao aplicar a correcao segura "${failedStep.title}". ${failedStep.error || 'Confira o ambiente antes de tentar novamente.'}`;
    }

    return `Correcoes seguras aplicadas. ${final.summary}`;
  }

  private normalizeError(error: unknown): string {
    if (!error) {
      return 'Falha desconhecida durante a correcao segura.';
    }

    const stderr = String((error as Record<string, unknown>)?.stderr || '').trim();
    if (stderr) {
      return stderr;
    }

    const stdout = String((error as Record<string, unknown>)?.stdout || '').trim();
    if (stdout) {
      return stdout;
    }

    const message = String((error as Record<string, unknown>)?.message || '').trim();
    return message || 'Falha desconhecida durante a correcao segura.';
  }
}
