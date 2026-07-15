import {
  EXPERIENCE_CONTEXT_RECOVERY_CONTRACT_VERSION,
  type ExperienceActionCard,
  type ExperienceContextRecovery,
  type ExperienceContextRecoveryOption,
  type ExperienceSurface,
} from './ExperienceContracts.js';
import type { UniversalAgentRun, UniversalApprovalRequest } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ContextRecoveryBuildInput = {
  text?: string | null;
  activeRun?: UniversalAgentRun | null;
  runs?: UniversalAgentRun[];
  approvals?: UniversalApprovalRequest[];
  actionCards?: ExperienceActionCard[];
  surface?: ExperienceSurface;
  maxOptions?: number;
};

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function uniqueOptions(options: ExperienceContextRecoveryOption[]): ExperienceContextRecoveryOption[] {
  const seen = new Set<string>();
  return options
    .filter((option) => {
      const key = `${option.label}:${option.command}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => right.confidence - left.confidence);
}

export class ContextRecoveryService {
  public build(input: ContextRecoveryBuildInput = {}): ExperienceContextRecovery {
    const text = String(input.text || '').trim();
    const normalized = normalizeText(text);
    const allOptions = uniqueOptions([
      ...this.approvalOptions(input.approvals || []),
      ...this.cardOptions(input.actionCards || []),
      ...this.runOptions(input.activeRun, input.runs || []),
    ]);
    const optionLimit = this.optionLimit(input.surface, input.maxOptions);
    const options = allOptions.slice(0, optionLimit);
    const ambiguous = this.isAmbiguous(normalized, allOptions.length);

    return {
      contractVersion: EXPERIENCE_CONTEXT_RECOVERY_CONTRACT_VERSION,
      id: `context-recovery:${this.stableId(text || allOptions.map((option) => option.id).join('|') || 'idle')}`,
      status: ambiguous ? 'needs-selection' : 'idle',
      question: ambiguous
        ? allOptions.length > options.length
          ? `I found ${allOptions.length} possible targets. Showing the ${options.length} most relevant here; see all in ZavorthControl.`
          : 'I found more than one possible target. Which one do you want to use?'
        : 'Enough context to continue without an extra question.',
      options: ambiguous ? options : [],
      overflow: {
        totalOptions: allOptions.length,
        shownOptions: ambiguous ? options.length : 0,
        hasOverflow: ambiguous && allOptions.length > options.length,
        dashboardCommand: 'zavorth open',
        zavorthControlCommand: 'zavorth open',
      },
    };
  }

  private isAmbiguous(normalized: string, optionCount: number): boolean {
    if (optionCount < 2) return false;
    if (!normalized) return false;
    // Pronoun / anaphora detection for continuity only — recovers context and does
    // not activate approve/reject or other product features from free text.
    return /\b(isso|isto|aquilo|esse|essa|aquele|aquela|ele|ela|la|ali|this|that|it|those|these|them)\b/.test(
      normalized,
    );
  }

  private approvalOptions(approvals: UniversalApprovalRequest[]): ExperienceContextRecoveryOption[] {
    return approvals
      .filter((approval) => approval.status === 'pending')
      .map((approval, index) => ({
        id: `approval-${index + 1}`,
        label: approval.title || `Approval ${index + 1}`,
        detail: approval.reason || 'Pending approval.',
        command: `zavorth approve ${approval.id}`,
        confidence: 0.9 - index * 0.05,
      }));
  }

  private cardOptions(cards: ExperienceActionCard[]): ExperienceContextRecoveryOption[] {
    return cards
      .filter((card) => card.status === 'pending')
      .map((card, index) => ({
        id: `card-${index + 1}`,
        label: card.title,
        detail: card.summary,
        command: card.actions[0]?.command || `zavorth ask "${card.title.replace(/"/g, '\\"')}"`,
        confidence: 0.82 - index * 0.04,
      }));
  }

  private runOptions(
    activeRun: UniversalAgentRun | null | undefined,
    runs: UniversalAgentRun[],
  ): ExperienceContextRecoveryOption[] {
    const sourceRuns = activeRun ? [activeRun, ...runs.filter((run) => run.id !== activeRun.id)] : runs;
    return sourceRuns.map((run, index) => ({
      id: `run-${index + 1}`,
      label: run.title || run.id,
      detail: run.summary || run.input || `Status ${run.status}.`,
      command: `zavorth ask "continue journey ${run.id}"`,
      confidence: activeRun?.id === run.id ? 0.86 : 0.72 - index * 0.04,
    }));
  }

  private stableId(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  private optionLimit(surface: ExperienceSurface | undefined, explicitLimit: number | undefined): number {
    if (typeof explicitLimit === 'number' && Number.isFinite(explicitLimit)) {
      return Math.max(1, Math.min(10, Math.floor(explicitLimit)));
    }
    if (surface === 'telegram' || surface === 'discord') return 5;
    return 6;
  }
}
