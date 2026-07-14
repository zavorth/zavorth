import type { SessionContinuitySnapshot, SessionContinuityTask } from './SessionContinuityService.js';
import type { SessionReplaySnapshot } from './SessionReplayService.js';
import type { WorkflowRunSnapshot } from '../runtime/workflows/WorkflowRunService.js';

export type SessionHandoffSurfaceSnapshot = {
  source: string;
  label: string;
  activity: string;
  linked: boolean;
};

export type SessionHandoffCarryForward = {
  label: string;
  detail: string;
};

export type SessionHandoffSnapshot = {
  generatedAt: string;
  status: 'aligned' | 'resume-required' | 'fresh';
  headline: string;
  operatorSummary: string;
  canonicalTarget: {
    kind: 'task' | 'workflow' | 'fresh';
    id: string | null;
    label: string;
    source: string | null;
  };
  handoffPrompt: string;
  handoffCommand: string;
  checkpoints: {
    tasks: number;
    workflowRuns: number;
    pendingPermissions: number;
    artifacts: number;
    linkedSurfaces: number;
  };
  carryForward: SessionHandoffCarryForward[];
  surfaces: SessionHandoffSurfaceSnapshot[];
};

type SessionHandoffRuntime = {
  now?: () => Date;
};

export class SessionHandoffService {
  private readonly now: () => Date;

  constructor(runtime: SessionHandoffRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: {
    continuity?: SessionContinuitySnapshot | null;
    replay?: SessionReplaySnapshot | null;
    workflowRuns?: WorkflowRunSnapshot[] | null;
  }): SessionHandoffSnapshot {
    const continuity = input.continuity || null;
    const replay = input.replay || null;
    const workflowRuns = Array.isArray(input.workflowRuns) ? input.workflowRuns : [];
    const resumableWorkflow = workflowRuns.find((run) => Boolean(run.resume_stage)) || null;
    const canonicalTarget = this.resolveCanonicalTarget(continuity, replay, resumableWorkflow);
    const checkpoints = {
      tasks: Number(replay?.stats?.tasks || continuity?.recentTasks?.length || 0),
      workflowRuns: Number(replay?.stats?.workflowRuns || workflowRuns.length || 0),
      pendingPermissions: Number(replay?.stats?.pendingPermissions || 0),
      artifacts: Number(replay?.stats?.artifacts || 0),
      linkedSurfaces: Number(replay?.stats?.linkedSurfaces || continuity?.linkedSurfaces?.length || 0),
    };
    const status = this.resolveStatus(canonicalTarget.kind, checkpoints);

    return {
      generatedAt: this.now().toISOString(),
      status,
      headline: this.buildHeadline(canonicalTarget, status),
      operatorSummary: this.buildOperatorSummary(status, checkpoints, continuity),
      canonicalTarget,
      handoffPrompt: this.buildHandoffPrompt(canonicalTarget, continuity, replay, resumableWorkflow),
      handoffCommand: this.buildHandoffCommand(canonicalTarget),
      checkpoints,
      carryForward: this.buildCarryForward(continuity, replay, resumableWorkflow),
      surfaces: this.buildSurfaceSnapshots(continuity),
    };
  }

  private resolveCanonicalTarget(
    continuity: SessionContinuitySnapshot | null,
    replay: SessionReplaySnapshot | null,
    resumableWorkflow: WorkflowRunSnapshot | null,
  ): SessionHandoffSnapshot['canonicalTarget'] {
    const recommended = replay?.recommendedEntry || null;
    if (recommended?.kind === 'workflow' && recommended.targetId) {
      return {
        kind: 'workflow',
        id: recommended.targetId,
        label: recommended.label || 'Resume workflow',
        source: null,
      };
    }

    if (recommended?.kind === 'task' && recommended.targetId) {
      return {
        kind: 'task',
        id: recommended.targetId,
        label: recommended.label || continuity?.focusTask?.shortId || 'Retomar tarefa',
        source: continuity?.focusTask?.source || continuity?.activeTask?.source || null,
      };
    }

    const focusTask = continuity?.focusTask || continuity?.activeTask || continuity?.currentSurfaceTask || null;
    if (focusTask?.taskId) {
      return {
        kind: 'task',
        id: focusTask.taskId,
        label: continuity?.suggestedAction?.label || `Retomar ${focusTask.shortId}`,
        source: focusTask.source || null,
      };
    }

    if (resumableWorkflow?.workflow_run_id) {
      return {
        kind: 'workflow',
        id: resumableWorkflow.workflow_run_id,
        label: `Retomar ${String(resumableWorkflow.workflow_name || 'workflow').trim()}`,
        source: null,
      };
    }

    return {
      kind: 'fresh',
      id: null,
      label: 'Iniciar nova sessao',
      source: null,
    };
  }

  private resolveStatus(
    kind: SessionHandoffSnapshot['canonicalTarget']['kind'],
    checkpoints: SessionHandoffSnapshot['checkpoints'],
  ): SessionHandoffSnapshot['status'] {
    if (kind === 'fresh') {
      return 'fresh';
    }
    if (checkpoints.pendingPermissions > 0 || checkpoints.workflowRuns > 0) {
      return 'resume-required';
    }
    return 'aligned';
  }

  private buildHeadline(
    canonicalTarget: SessionHandoffSnapshot['canonicalTarget'],
    status: SessionHandoffSnapshot['status'],
  ): string {
    if (canonicalTarget.kind === 'fresh') {
      return 'Nenhum handoff forte encontrado entre as superficies.';
    }
    if (status === 'resume-required') {
      return `Handoff pronto para retomar ${canonicalTarget.label}.`;
    }
    return `Sessao compartilhada alinhada em ${canonicalTarget.label}.`;
  }

  private buildOperatorSummary(
    status: SessionHandoffSnapshot['status'],
    checkpoints: SessionHandoffSnapshot['checkpoints'],
    continuity: SessionContinuitySnapshot | null,
  ): string {
    const parts = [
      status === 'fresh' ? 'sem handoff pendente' : (status === 'resume-required' ? 'retomada sugerida' : 'contexto alinhado'),
      `${checkpoints.tasks} task(s)`,
      `${checkpoints.workflowRuns} workflow(s)`,
      `${checkpoints.pendingPermissions} confirmacao(oes)`,
    ];
    if (continuity?.focusTask?.source) {
      parts.push(`current focus: ${continuity.focusTask.source}`);
    }
    if (checkpoints.linkedSurfaces > 0) {
      parts.push(`${checkpoints.linkedSurfaces} superficie(s) ligada(s)`);
    }
    return parts.join(' | ');
  }

  private buildHandoffPrompt(
    canonicalTarget: SessionHandoffSnapshot['canonicalTarget'],
    continuity: SessionContinuitySnapshot | null,
    replay: SessionReplaySnapshot | null,
    resumableWorkflow: WorkflowRunSnapshot | null,
  ): string {
    if (continuity?.suggestedAction?.prompt) {
      return continuity.suggestedAction.prompt;
    }

    if (canonicalTarget.kind === 'workflow' && resumableWorkflow) {
      return [
        `Retome o workflow ${String(resumableWorkflow.workflow_name || 'composto').trim()} no run ${resumableWorkflow.workflow_run_id}.`,
        resumableWorkflow.resume_stage?.label
          ? `Comece da etapa ${String(resumableWorkflow.resume_stage.label).trim()}.`
          : '',
        resumableWorkflow.resume_stage?.reason || '',
      ].filter(Boolean).join(' ');
    }

    if (canonicalTarget.kind === 'task' && continuity?.focusTask) {
      return [
        `Retome ${continuity.focusTask.shortId} em ${String(continuity.focusTask.source || 'runtime').trim()}.`,
        continuity.focusTask.summary || '',
        'Explique o que ja foi feito, o que esta em aberto e o proximo passo mais util.',
      ].filter(Boolean).join(' ');
    }

    if (replay?.headline) {
      return `${replay.headline} ${replay.operatorSummary || ''}`.trim();
    }

    return 'Abra uma nova sessao e siga do melhor ponto atual.';
  }

  private buildHandoffCommand(canonicalTarget: SessionHandoffSnapshot['canonicalTarget']): string {
    if (canonicalTarget.kind === 'workflow' && canonicalTarget.id) {
      return `Retome o workflow ${canonicalTarget.id} e siga da etapa interrompida.`;
    }
    if (canonicalTarget.kind === 'task' && canonicalTarget.id) {
      return `Retome a tarefa ${canonicalTarget.id} e continue do ponto atual.`;
    }
    return 'Inicie uma nova sessao com contexto limpo.';
  }

  private buildCarryForward(
    continuity: SessionContinuitySnapshot | null,
    replay: SessionReplaySnapshot | null,
    resumableWorkflow: WorkflowRunSnapshot | null,
  ): SessionHandoffCarryForward[] {
    const items: SessionHandoffCarryForward[] = [];
    const add = (label: string, detail: string | null | undefined) => {
      const normalized = String(detail || '').trim();
      if (!normalized) {
        return;
      }
      items.push({ label, detail: normalized });
    };

    add('Foco atual', continuity?.focusTask?.summary || this.describeTask(continuity?.focusTask || null));
    add('Ultimo Telegram', continuity?.latestTelegramTask?.summary || this.describeTask(continuity?.latestTelegramTask || null));
    add('Ultima Web', continuity?.latestWebTask?.summary || this.describeTask(continuity?.latestWebTask || null));
    add('Workflow retomavel', resumableWorkflow?.resume_stage?.reason || resumableWorkflow?.objective || null);
    add('Replay', replay?.operatorSummary || null);

    return items.slice(0, 4);
  }

  private buildSurfaceSnapshots(continuity: SessionContinuitySnapshot | null): SessionHandoffSurfaceSnapshot[] {
    if (!continuity) {
      return [];
    }

    const linkedSources = new Set(
      Array.isArray(continuity.linkedSurfaces)
        ? continuity.linkedSurfaces.map((entry) => String(entry.source || '').trim()).filter(Boolean)
        : [],
    );

    const tasks = [
      continuity.latestTelegramTask,
      continuity.latestWebTask,
      continuity.latestDiscordTask,
      continuity.latestWhatsAppTask,
    ].filter((task): task is SessionContinuityTask => Boolean(task));

    return tasks.map((task) => ({
      source: task.source,
      label: this.getSurfaceLabel(task.source),
      activity: `${task.shortId} · ${task.status}`,
      linked: linkedSources.has(task.source),
    }));
  }

  private describeTask(task: SessionContinuityTask | null): string {
    if (!task) {
      return '';
    }
    return `${task.shortId} em ${String(task.source || 'runtime').trim()} · ${String(task.status || 'n/d').trim()}`;
  }

  private getSurfaceLabel(source: string | null | undefined): string {
    const normalized = String(source || '').trim().toLowerCase();
    if (normalized === 'telegram') {
      return 'Telegram';
    }
    if (normalized === 'web') {
      return 'Web';
    }
    if (normalized === 'discord') {
      return 'Discord';
    }
    if (normalized === 'whatsapp') {
      return 'WhatsApp';
    }
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Runtime';
  }
}
