import type { PermissionRequest } from '../../../../../contracts/PermissionRequest.js';
import type { SelfmodOptimizationAnalysis } from '../../../../../contracts/SelfmodOptimizationContract.js';

type PermissionListStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'all';

type SelfModificationPreviewResult = {
  success: boolean;
  mode: 'file' | 'goal' | 'multi';
  previewId?: string;
  relativePath?: string;
  relativePaths?: string[];
  summary: string;
  diffSummary?: string;
  validationPlan?: string[];
  changeCount?: number;
  resourceImpact?: string;
  optimizationAnalysis?: SelfmodOptimizationAnalysis;
};

type SelfModificationApplyResult = {
  success: boolean;
  mode: 'file' | 'goal' | 'multi';
  previewId: string;
  summary: string;
  relativePath?: string;
  relativePaths?: string[];
  diffSummary?: string;
  changeId?: string;
  changeCount?: number;
};

type SelfModificationRollbackResult = {
  success: boolean;
  changeId: string;
  summary: string;
  restoredFiles: number;
};

function shortPermissionRef(permissionId: string): string {
  const id = String(permissionId || '').trim();
  if (id.length <= 10) return id;
  return id.slice(0, 8);
}

export function formatPermissionListReply(permissions: PermissionRequest[], status: PermissionListStatus): string {
  const lines = ['Zavorth permissions', '', `Filter: ${status}.`, `Visible: ${permissions.length}.`];

  if (permissions.length === 0) {
    lines.push('', 'No permissions in this filter.');
    return lines.join('\n');
  }

  lines.push('', 'Items (use numbers — not long ids):');
  permissions.slice(0, 8).forEach((permission, index) => {
    const n = index + 1;
    const short = shortPermissionRef(permission.permission_id);
    lines.push(
      `${n}. ${permission.executor}/${permission.kind} · ${permission.status} · ref=${short}`,
      `   ${String(permission.reason || '').slice(0, 120)}`,
    );
  });
  lines.push('', 'Tip: /perm approve 1 · /perm reject 1 · /perm show 1 · /perm list pending');
  return lines.join('\n');
}

export function formatPermissionDetailsReply(permission: PermissionRequest): string {
  const short = shortPermissionRef(permission.permission_id);
  return [
    'Permission detail',
    '',
    `Ref: ${short}`,
    `Status: ${permission.status} | scope: ${permission.scope}.`,
    `Executor: ${permission.executor} | kind: ${permission.kind}.`,
    `Workspace: ${permission.workspace || 'n/a'}.`,
    `Requested: ${permission.requested_value || 'n/a'}.`,
    `Resolved: ${permission.resolved_value || 'n/a'}.`,
    `Requested by: ${permission.requested_by || 'n/a'} | decided by: ${permission.decided_by || 'n/a'}.`,
    `Reason: ${permission.reason}`,
    permission.decision_note ? `Note: ${permission.decision_note}` : null,
    '',
    'Tip: /perm list pending · /perm approve 1',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatPermissionDecisionReply(permission: PermissionRequest, action: 'approve' | 'reject'): string {
  const short = shortPermissionRef(permission.permission_id);
  return [
    action === 'approve' ? 'Permission approved.' : 'Permission rejected.',
    '',
    `Ref: ${short}`,
    `Status: ${permission.status}.`,
    `Executor: ${permission.executor} | kind: ${permission.kind}.`,
    permission.decision_note ? `Note: ${permission.decision_note}` : null,
    'Tip: /perm list pending',
  ]
    .filter(Boolean)
    .join('\n');
}

export function renderSelfModificationUsage(): string {
  return [
    'Guarded selfmod usage:',
    'selfmod <relative_file> -- <instruction>',
    'selfmod preview <relative_file> -- <instruction>',
    'selfmod goal -- <goal>',
    'selfmod apply <preview_id>',
    'selfmod rollback <change_id>',
  ].join('\n');
}

export function formatSelfModificationPreviewReply(result: SelfModificationPreviewResult): string {
  const shortPreview = result.previewId
    ? result.previewId.length <= 12
      ? result.previewId
      : result.previewId.slice(0, 8)
    : null;
  const lines = [
    result.success ? 'Self-modification preview ready.' : 'Self-modification preview blocked.',
    '',
    result.summary,
    shortPreview ? `Preview ref: ${shortPreview}.` : null,
    result.relativePath ? `File: ${result.relativePath}.` : null,
    result.changeCount ? `Planned changes: ${result.changeCount}.` : null,
    result.resourceImpact ? `Estimated impact: ${result.resourceImpact}.` : null,
    ...formatSelfmodOptimizationAnalysis(result.optimizationAnalysis),
    // Proposal-time next action: buttons when available, else explicit slash — never free-text "Approve".
    result.success && result.previewId ? `Next: tap Apply on the card, or /selfmod apply ${result.previewId}` : null,
    result.validationPlan?.length ? `Validation: ${result.validationPlan.slice(0, 4).join(' | ')}` : null,
    result.diffSummary ? ['', result.diffSummary] : null,
  ]
    .flat()
    .filter(Boolean) as string[];
  return lines.join('\n');
}

export function formatSelfmodOptimizationAnalysis(analysis?: SelfmodOptimizationAnalysis): Array<string | null> {
  if (!analysis) {
    return [];
  }

  const rollbackPercent = Math.round(analysis.rollbackConfidence * 100);
  return [
    `Resource delta: ${analysis.resourceDelta.summary}.`,
    analysis.resourceDelta.notes.length ? `Impact notes: ${analysis.resourceDelta.notes.slice(0, 2).join(' | ')}`
      : null,
    `Runtime risk: ${analysis.runtimeRisk.level} (score ${analysis.runtimeRisk.score}).`,
    analysis.runtimeRisk.reasons.length ? `Why this is heavy: ${analysis.runtimeRisk.reasons.slice(0, 2).join(' | ')}`
      : null,
    analysis.companionImpact.companionIds.length ? `Companion impact: ${analysis.companionImpact.summary}` : null,
    analysis.companionImpact.recommendedActions.length ? `Suggested actions: ${analysis.companionImpact.recommendedActions.slice(0, 2).join(' | ')}`
      : null,
    `Rollback confidence: ${rollbackPercent}% (${analysis.rollbackConfidenceLabel}).`,
    analysis.patternSignals.length ? `Pattern memory: ${analysis.patternSignals
          .slice(0, 2)
          .map((entry) => entry.summary)
          .join(' | ')}`
      : null,
    analysis.opportunities.length ? `Suggested optimizations: ${analysis.opportunities
          .slice(0, 2)
          .map((entry) => entry.title)
          .join(' | ')}`
      : null,
  ];
}

export function formatSelfModificationApplyReply(result: SelfModificationApplyResult): string {
  return [
    result.success ? 'Self-modification applied.' : 'Self-modification not applied.',
    '',
    result.summary,
    `Preview: ${result.previewId}.`,
    result.relativePath ? `File: ${result.relativePath}.` : null,
    result.changeId ? `Change ID: ${result.changeId}.` : null,
    result.changeCount ? `Files changed: ${result.changeCount}.` : null,
    result.changeId ? `Rollback: selfmod rollback ${result.changeId}` : null,
    result.diffSummary ? ['', result.diffSummary] : null,
  ]
    .flat()
    .filter(Boolean)
    .join('\n');
}

export function formatSelfModificationRollbackReply(result: SelfModificationRollbackResult): string {
  return [
    result.success ? 'Selfmod rollback completed.' : 'Selfmod rollback not completed.',
    '',
    result.summary,
    `Change ID: ${result.changeId}.`,
    `Files restored: ${result.restoredFiles}.`,
  ].join('\n');
}
