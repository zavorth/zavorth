import type { ExperienceAction, ExperiencePlan, ExperienceTrustLens } from './ExperienceContracts.js';
import type { UniversalAgentRun, UniversalApprovalRequest } from '../../runtime/agent/UniversalAgentRuntimeTypes.js';

function makeAction(input: {
  id: string;
  label: string;
  kind: ExperienceAction['kind'];
  reason: string;
  command?: string | null;
  route?: string | null;
  risk?: ExperienceAction['risk'];
  requiresApproval?: boolean;
}): ExperienceAction {
  return {
    id: input.id,
    label: input.label,
    kind: input.kind,
    command: input.command ?? null,
    route: input.route ?? null,
    risk: input.risk || 'safe',
    requiresApproval: input.requiresApproval === true,
    reason: input.reason,
  };
}

export class TrustLensService {
  public build(
    input: {
      plan?: ExperiencePlan | null;
      activeRun?: UniversalAgentRun | null;
      approvals?: UniversalApprovalRequest[];
      sandboxMode?: string | null;
    } = {},
  ): ExperienceTrustLens {
    const approvals = input.approvals || input.activeRun?.approvals || [];
    const pending = approvals.filter((approval) => approval.status === 'pending');
    const planRisk = input.plan?.risk || 'safe';
    const runRisk = this.highestApprovalRisk(approvals);
    const risk =
      runRisk === 'danger' || planRisk === 'danger'
        ? 'danger'
        : runRisk === 'attention' || planRisk === 'attention'
          ? 'attention'
          : 'safe';
    const status =
      pending.length > 0 || risk === 'danger'
        ? 'attention'
        : input.activeRun?.status === 'failed'
          ? 'blocked'
          : 'ready';
    const sandboxMode = input.sandboxMode || String(input.activeRun?.metadata?.sandboxIsolation || 'governed-local');

    return {
      status,
      title: pending.length > 0 ? 'Pending approval' : 'Trust Lens active',
      summary:
        pending.length > 0
          ? `${pending.length} action(s) waiting for your decision.`
          : 'Sensitive actions continue to pass through preview, policy, and receipts.',
      risk,
      approvalCount: pending.length,
      sandbox: {
        mode: sandboxMode,
        available: sandboxMode !== 'none',
        detail:
          sandboxMode === 'none' ? 'Sandbox not announced for this journey.' : `Governed execution via ${sandboxMode}.`,
      },
      preferences: [
        {
          id: 'workspace.read.always',
          label: 'Always allow reads in this workspace',
          enabled: false,
          revocable: true,
        },
        {
          id: 'shell.ask.always',
          label: 'Always ask before shell',
          enabled: true,
          revocable: true,
        },
        {
          id: 'mutation.sandbox.always',
          label: 'Always use sandbox for mutations',
          enabled: true,
          revocable: true,
        },
        {
          id: 'external.never.raw',
          label: 'Never send external data without approval',
          enabled: true,
          revocable: true,
        },
      ],
      actions: [
        ...pending.slice(0, 3).flatMap((approval) => [
          makeAction({
            id: `approval.approve.${approval.id}`,
            label: `Approve ${approval.title}`,
            kind: 'approval',
            command: `zavorth approve ${approval.id}`,
            risk: approval.risk,
            reason: approval.reason,
          }),
          makeAction({
            id: `approval.reject.${approval.id}`,
            label: `Reject ${approval.title}`,
            kind: 'approval',
            command: `zavorth reject ${approval.id}`,
            risk: approval.risk,
            reason: 'Keeps the action blocked and records a decision receipt.',
          }),
        ]),
        makeAction({
          id: 'trust.review',
          label: 'Review security',
          kind: 'safety',
          command: 'zavorth trust',
          risk,
          reason: 'Shows scope, policy, and revocable preferences.',
        }),
      ],
    };
  }

  private highestApprovalRisk(approvals: UniversalApprovalRequest[]): ExperienceAction['risk'] {
    if (approvals.some((approval) => approval.risk === 'danger')) return 'danger';
    if (approvals.some((approval) => approval.risk === 'attention')) return 'attention';
    if (approvals.some((approval) => approval.risk === 'unknown')) return 'unknown';
    return 'safe';
  }
}
