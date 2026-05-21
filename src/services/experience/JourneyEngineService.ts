import type {
  ExperienceJourneyKind,
  ExperienceJourneySnapshot,
  ExperiencePlan,
  ExperiencePlanStep,
} from './ExperienceContracts.js';
import type { UniversalAgentRun } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

function statusFromRun(run: UniversalAgentRun | null): ExperienceJourneySnapshot['status'] {
  if (!run) return 'idle';
  if (run.status === 'thinking') return 'planning';
  if (run.status === 'running' || run.status === 'queued') return 'running';
  if (run.status === 'waiting_approval') return 'waiting_approval';
  if (run.status === 'completed') return 'completed';
  return 'blocked';
}

function defaultSteps(kind: ExperienceJourneyKind): ExperiencePlanStep[] {
  return [
    {
      id: 'intent',
      title: 'Intencao',
      detail: `Jornada ${kind} pronta para linguagem natural.`,
      status: 'done',
    },
    {
      id: 'plan',
      title: 'Plano',
      detail: 'Plano, riscos e proximas acoes aparecem antes de efeitos sensiveis.',
      status: 'pending',
    },
    {
      id: 'receipt',
      title: 'Receipt',
      detail: 'Cada acao importante precisa deixar evidencias legiveis.',
      status: 'pending',
    },
  ];
}

export class JourneyEngineService {
  public buildSnapshot(input: {
    plan?: ExperiencePlan | null;
    activeRun?: UniversalAgentRun | null;
  } = {}): ExperienceJourneySnapshot {
    const plan = input.plan || null;
    const activeRun = input.activeRun || null;
    const kind = plan?.kind || this.kindFromRun(activeRun);
    const status = plan
      ? (plan.requiresApproval ? 'waiting_approval' : plan.shouldExecuteAgent ? 'planning' : 'idle')
      : statusFromRun(activeRun);

    return {
      id: plan?.id || activeRun?.id || `journey:${kind}:idle`,
      kind,
      title: plan?.title || activeRun?.title || this.titleFor(kind),
      summary: plan?.summary || activeRun?.summary || this.summaryFor(kind),
      status,
      steps: plan?.steps?.length ? plan.steps : this.stepsFromRun(activeRun, kind),
    };
  }

  private kindFromRun(run: UniversalAgentRun | null): ExperienceJourneyKind {
    const text = `${run?.title || ''} ${run?.input || ''}`.toLowerCase();
    if (/security|seguranca|audit/.test(text)) return 'security-audit';
    if (/provider|model|modelo/.test(text)) return 'provider-setup';
    if (/telegram|discord|slack|email|channel|canal/.test(text)) return 'channel-setup';
    if (/release|ship|deploy/.test(text)) return 'release';
    if (/learn|learning|aprend/.test(text)) return 'learning';
    if (/review|revis/.test(text)) return 'workspace-review';
    if (/fix|bug|feature|code|codigo/.test(text)) return 'code-task';
    return 'conversation';
  }

  private titleFor(kind: ExperienceJourneyKind): string {
    return kind === 'conversation'
      ? 'Conversa natural'
      : kind.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  private summaryFor(kind: ExperienceJourneyKind): string {
    if (kind === 'conversation') {
      return 'Fale normalmente; o Zavorth roteia, executa e explica quando precisa de aprovacao.';
    }
    return 'Jornada governada pronta para plano, execucao, validacao, receipt e aprendizado.';
  }

  private stepsFromRun(run: UniversalAgentRun | null, kind: ExperienceJourneyKind): ExperiencePlanStep[] {
    if (!run) return defaultSteps(kind);
    const events = run.events.slice(-6);
    if (!events.length) return defaultSteps(kind);
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      detail: event.detail || event.kind,
      status: event.status === 'failed' ? 'blocked' : event.status,
    }));
  }
}
