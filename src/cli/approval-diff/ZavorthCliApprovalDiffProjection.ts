import type { ZavorthMutationPlaneService } from '../../services/ZavorthMutationPlaneService.js';
import type { ZavorthMutationPlan } from '../../contracts/ZavorthMutationPlaneContract.js';
import type {
  ZavorthCliApprovalCard,
  ZavorthCliApprovalDiffSnapshot,
  ZavorthCliDiffEntry,
} from './ZavorthCliApprovalDiffTypes.js';

export type BuildZavorthCliApprovalDiffSnapshotInput = {
  projectRoot: string;
  view: 'approvals' | 'diff';
  targetPlanId?: string | null;
  now?: () => Date;
  mutationPlane: Pick<ZavorthMutationPlaneService, 'listPlans' | 'readPlan' | 'approvePlan'>;
  approve?: boolean;
  approvedBy?: string | null;
  scope?: 'once' | 'session' | 'host';
};

export function buildZavorthCliApprovalDiffSnapshot(
  input: BuildZavorthCliApprovalDiffSnapshotInput,
): ZavorthCliApprovalDiffSnapshot {
  const targetPlanId = normalizeOptional(input.targetPlanId);
  const allPlans = targetPlanId
    ? [input.mutationPlane.readPlan(targetPlanId)].filter((plan): plan is ZavorthMutationPlan => Boolean(plan))
    : input.mutationPlane
      .listPlans({ limit: 50, includeExpired: false })
      .filter((plan) => plan.status === 'waiting_approval' || plan.status === 'draft' || plan.approval.status === 'pending');
  let decision: ZavorthCliApprovalDiffSnapshot['decision'] = {
    attempted: false,
    status: 'none',
    planId: null,
    message: 'No approval decision requested.',
  };

  if (input.approve) {
    decision = approveTargetPlan(input);
  } else if (targetPlanId && allPlans.length === 0) {
    decision = {
      attempted: false,
      status: 'not_found',
      planId: targetPlanId,
      message: `Plan not found: ${targetPlanId}.`,
    };
  }

  const refreshedPlans = decision.status === 'approved' && targetPlanId
    ? [input.mutationPlane.readPlan(targetPlanId)].filter((plan): plan is ZavorthMutationPlan => Boolean(plan))
    : allPlans;
  const cards = refreshedPlans.map(projectCard);
  const diffs = refreshedPlans.flatMap(projectDiffs);
  const summary = {
    total: refreshedPlans.length,
    pending: refreshedPlans.filter((plan) => plan.status === 'waiting_approval' || plan.approval.status === 'pending').length,
    approved: refreshedPlans.filter((plan) => plan.status === 'approved' || plan.approval.status === 'approved').length,
    blocked: refreshedPlans.filter((plan) => plan.status === 'blocked').length,
    expired: refreshedPlans.filter((plan) => plan.status === 'expired').length,
    diffEntries: diffs.length,
  };

  return {
    contractVersion: 'zavorth-cli-approval-diff/1',
    generatedAt: (input.now || (() => new Date()))().toISOString(),
    projectRoot: input.projectRoot,
    view: input.view,
    targetPlanId,
    summary,
    cards,
    diffs,
    decision,
    safety: {
      noHostApply: true,
      approvalRequiresYes: true,
      secretsRedacted: true,
      diffIsPreviewOnly: true,
    },
    nextActions: buildNextActions(input.view, cards, diffs, decision),
  };
}

function approveTargetPlan(
  input: BuildZavorthCliApprovalDiffSnapshotInput,
): ZavorthCliApprovalDiffSnapshot['decision'] {
  const planId = normalizeOptional(input.targetPlanId);
  if (!planId) {
    return {
      attempted: true,
      status: 'missing_confirmation',
      planId: null,
      message: 'Approval requires a plan id and --yes.',
    };
  }
  const plan = input.mutationPlane.readPlan(planId);
  if (!plan) {
    return {
      attempted: true,
      status: 'not_found',
      planId,
      message: `Plan not found: ${planId}.`,
    };
  }
  if (!['waiting_approval', 'draft'].includes(plan.status) && plan.approval.status !== 'pending') {
    return {
      attempted: true,
      status: 'unsupported',
      planId,
      message: `Plan is ${plan.status}; no approval transition was applied.`,
    };
  }
  const approved = input.mutationPlane.approvePlan(planId, {
    approvedBy: input.approvedBy || 'cli',
    scope: input.scope || 'once',
  });
  return {
    attempted: true,
    status: 'approved',
    planId: approved.id,
    message: `Plan approved only. No host apply was performed: ${approved.title}.`,
  };
}

function projectCard(plan: ZavorthMutationPlan): ZavorthCliApprovalCard {
  const diffs = projectDiffs(plan);
  return {
    id: plan.id,
    title: redact(String(plan.title || plan.id)),
    summary: redact(String(plan.summary || '')),
    domain: plan.domain,
    actionId: plan.actionId,
    status: plan.status,
    riskLevel: plan.riskLevel,
    approvalStatus: plan.approval.status,
    approvalReason: redact(plan.approval.reason),
    requestedBy: plan.requestedBy,
    sourceSurface: plan.sourceSurface,
    expiresAt: plan.expiresAt,
    resourceImpact: {
      ramMb: plan.resourceImpact.ramMb,
      diskMb: plan.resourceImpact.diskMb,
      processCount: plan.resourceImpact.processCount,
      externalExposure: plan.resourceImpact.externalExposure,
      recurring: plan.resourceImpact.recurring,
    },
    readiness: {
      total: plan.readinessGates.length,
      blocked: plan.readinessGates.filter((gate) => gate.status === 'blocked' || gate.status === 'failed').length,
      warning: plan.readinessGates.filter((gate) => gate.status === 'warning').length,
      passed: plan.readinessGates.filter((gate) => gate.status === 'passed').length,
    },
    validationPlan: plan.validationPlan.map(redact).slice(0, 6),
    rollbackPlan: plan.rollbackPlan.map(redact).slice(0, 6),
    commands: extractStringList(plan.payload, ['commands', 'shellCommands', 'validationCommands']).slice(0, 8),
    files: extractStringList(plan.payload, ['files', 'paths', 'affectedFiles', 'writeFiles']).slice(0, 12),
    diffCount: diffs.length,
  };
}

function projectDiffs(plan: ZavorthMutationPlan): ZavorthCliDiffEntry[] {
  const raw = findDiffEntries(plan.payload);
  return raw.map((entry, index) => ({
    id: `${plan.id}:diff:${index + 1}`,
    planId: plan.id,
    path: redact(String(entry.path || entry.file || entry.filePath || entry.target || 'unknown')),
    riskLevel: String(entry.riskLevel || entry.risk || plan.riskLevel),
    summary: redact(String(entry.summary || entry.description || entry.message || 'Diff preview entry')),
    before: valuePreview(entry.before ?? entry.oldValue ?? entry.from),
    after: valuePreview(entry.after ?? entry.newValue ?? entry.to),
  }));
}

function findDiffEntries(payload: Record<string, unknown>): Array<Record<string, unknown>> {
  const candidates = [
    payload.diff,
    payload.diffs,
    payload.diffPreview,
    (payload.diffPreview as Record<string, unknown> | undefined)?.entries,
    payload.entries,
    payload.changes,
    payload.patch,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
    }
    if (candidate && typeof candidate === 'object') {
      const record = candidate as Record<string, unknown>;
      if (Array.isArray(record.entries)) {
        return record.entries.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'));
      }
      if ('before' in record || 'after' in record || 'path' in record) {
        return [record];
      }
    }
  }
  return [];
}

function extractStringList(payload: Record<string, unknown>, keys: string[]): string[] {
  const values: string[] = [];
  const visit = (value: unknown, key = ''): void => {
    if (values.length >= 20) {
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) {
        visit(entry, key);
      }
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(childValue, childKey);
      }
      return;
    }
    if (keys.includes(key) && value !== null && value !== undefined) {
      values.push(redact(String(value)));
    }
  };
  visit(payload);
  return [...new Set(values)];
}

function buildNextActions(
  view: 'approvals' | 'diff',
  cards: ZavorthCliApprovalCard[],
  diffs: ZavorthCliDiffEntry[],
  decision: ZavorthCliApprovalDiffSnapshot['decision'],
): ZavorthCliApprovalDiffSnapshot['nextActions'] {
  if (decision.status === 'approved') {
    return [
      { label: 'Review approved plan', command: `zavorth diff ${decision.planId}`, detail: 'preview only' },
      { label: 'Open ZavorthControl', command: 'zavorth open', detail: 'visual approval flow' },
    ];
  }
  const pending = cards.find((card) => card.status === 'waiting_approval' || card.approvalStatus === 'pending');
  if (pending) {
    return [
      { label: 'Inspect diff', command: `zavorth diff ${pending.id}`, detail: `${pending.diffCount} preview entries` },
      { label: 'Approve plan only', command: `zavorth approve ${pending.id} --yes`, detail: 'does not apply to host' },
      { label: 'Open ZavorthControl', command: 'zavorth open', detail: 'visual review' },
    ];
  }
  if (view === 'diff' && diffs.length === 0) {
    return [
      { label: 'List approvals', command: 'zavorth approve', detail: 'find pending plans' },
      { label: 'Open ZavorthControl', command: 'zavorth open', detail: 'visual review' },
    ];
  }
  return [
    { label: 'Return home', command: 'zavorth', detail: 'daily state' },
    { label: 'Hatch session', command: 'zavorth hatch', detail: 'first-run cockpit' },
  ];
}

function normalizeOptional(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function valuePreview(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return redact(text).slice(0, 240);
}

function redact(value: string): string {
  return String(value || '')
    .replace(/(sk|pk|ghp|gho|xox[baprs]|bot|token)[-_a-z0-9]{8,}/giu, '[redacted]')
    .replace(/([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})/giu, '[redacted-email]');
}
