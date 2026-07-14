import type {
  ExperienceReasoningSummary,
  ExperienceTimelineItem,
  ExperienceTrustLens,
} from './ExperienceContracts.js';
import type {
  UniversalAgentRun,
  UniversalToolRiskLevel,
} from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

export type ReasoningSummaryBuildInput = {
  activeRun?: UniversalAgentRun | null;
  timeline?: ExperienceTimelineItem[];
  trust?: ExperienceTrustLens | null;
  fallbackText?: string | null;
};

function summarize(text: string, fallback: string, limit = 220): string {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim() || fallback;
  return normalized.length > limit ? `${normalized.slice(0, limit - 3)}...` : normalized;
}

function highestRisk(risks: UniversalToolRiskLevel[]): UniversalToolRiskLevel {
  if (risks.includes('danger')) return 'danger';
  if (risks.includes('attention')) return 'attention';
  if (risks.includes('unknown')) return 'unknown';
  return 'safe';
}

export class ReasoningSummaryService {
  public build(input: ReasoningSummaryBuildInput = {}): ExperienceReasoningSummary {
    const run = input.activeRun || null;
    const timeline = input.timeline || [];
    const tools = this.toolsFor(run, timeline);
    const risk = highestRisk([
      input.trust?.risk || 'safe',
      ...(run?.approvals || []).map((approval) => approval.risk),
    ]);
    const pendingApproval = (run?.approvals || []).find((approval) => approval.status === 'pending');
    const lastTimeline = timeline[timeline.length - 1] || null;

    return {
      understood: summarize(run?.input || input.fallbackText || '', 'Waiting for um pedido natural do usuario.'),
      risk,
      tools,
      approvalReason: pendingApproval?.reason || (input.trust?.approvalCount ? input.trust.summary : null),
      result: summarize(run?.summary || lastTimeline?.detail || '', 'Ainda sem resultado de execucao nesta sessao.'),
      nextAction: pendingApproval
        ? `Decida a aprovacao ${pendingApproval.id}.`
        : input.trust?.actions?.[0]?.command || 'Envie um pedido natural ou abra /zavorthControl.',
    };
  }

  private toolsFor(run: UniversalAgentRun | null, timeline: ExperienceTimelineItem[]): string[] {
    const fromExposure = (run?.toolExposure.tools || []).map((tool) => tool.label || tool.id);
    const fromTimeline = timeline
      .filter((item) => item.kind === 'tool')
      .map((item) => item.title);
    return [...fromExposure, ...fromTimeline]
      .map((tool) => String(tool || '').trim())
      .filter(Boolean)
      .filter((tool, index, all) => all.indexOf(tool) === index)
      .slice(0, 8);
  }
}
