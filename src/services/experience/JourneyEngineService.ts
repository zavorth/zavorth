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

function isExperienceJourneyKind(value: string): value is ExperienceJourneyKind {
  return [
    'conversation',
    'security-audit',
    'provider-setup',
    'channel-setup',
    'release',
    'learning',
    'workspace-review',
    'code-task',
  ].includes(value);
}

function defaultSteps(kind: ExperienceJourneyKind): ExperiencePlanStep[] {
  return [
    {
      id: 'intent',
      title: 'Intent',
      detail: `${kind} journey ready for natural language.`,
      status: 'done',
    },
    {
      id: 'plan',
      title: 'Plan',
      detail: 'Plan, risks, and next actions appear before sensitive effects.',
      status: 'pending',
    },
    {
      id: 'receipt',
      title: 'Receipt',
      detail: 'Every important action must leave readable evidence.',
      status: 'pending',
    },
  ];
}

export class JourneyEngineService {
  public buildSnapshot(
    input: {
      plan?: ExperiencePlan | null;
      activeRun?: UniversalAgentRun | null;
    } = {},
  ): ExperienceJourneySnapshot {
    const plan = input.plan || null;
    const activeRun = input.activeRun || null;
    const kind = plan?.kind || this.kindFromRun(activeRun);
    const status = plan
      ? plan.requiresApproval ? 'waiting_approval'
        : plan.shouldExecuteAgent ? 'planning'
          : 'idle'
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
    const metadataKind = String(run?.metadata?.journeyKind || run?.metadata?.kind || '').trim();
    if (isExperienceJourneyKind(metadataKind)) return metadataKind;
    return 'conversation';
  }

  private titleFor(kind: ExperienceJourneyKind): string {
    return kind === 'conversation'
      ? 'Natural conversation'
      : kind
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
  }

  private summaryFor(kind: ExperienceJourneyKind): string {
    if (kind === 'conversation') {
      return 'Speak naturally; Zavorth routes, executes, and explains when approval is needed.';
    }
    return 'Governed journey ready for plan, execution, validation, receipt, and learning.';
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
