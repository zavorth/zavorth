import type { SubagentBudget } from './SubagentBudget.js';
import type { SubagentCapabilityScope } from './SubagentCapabilityScope.js';

export type SubagentApprovalRisk = 'safe' | 'attention' | 'danger' | 'unknown';

export interface SubagentApprovalBoundary {
  requiresApproval: boolean;
  approvalReason: string;
  risk: SubagentApprovalRisk;
  inheritedApprovalId: string | null;
  policyTags: string[];
  metadata: Record<string, unknown>;
}

export interface SubagentApprovalBoundaryInput {
  scope: SubagentCapabilityScope;
  budget?: SubagentBudget | null;
  requiresApproval?: boolean | null;
  approvalReason?: string | null;
  risk?: SubagentApprovalRisk | string | null;
  inheritedApprovalId?: string | null;
  policyTags?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
}

export function createSubagentApprovalBoundary(
  input: SubagentApprovalBoundaryInput,
): SubagentApprovalBoundary {
  const risk = normalizeRisk(input.risk);
  const explicitPreclear = input.requiresApproval === false;
  const canPreclear = input.scope.mode === 'read_only' && input.scope.allowedTools.length === 0;
  const requiresApproval = explicitPreclear && canPreclear ? false : true;

  return {
    requiresApproval,
    approvalReason:
      normalizeText(input.approvalReason) ||
      (requiresApproval ? 'Subagent execution requires explicit approval before leaving the proposal boundary.'
        : 'Read-only subagent scope was explicitly precleared.'),
    risk,
    inheritedApprovalId: normalizeText(input.inheritedApprovalId) || null,
    policyTags: uniqueSorted([
      ...(input.policyTags ?? []),
      ...input.scope.policyTags,
      ...(input.budget?.policyTags ?? []),
      'subagent-approval-boundary',
      `subagent-risk:${risk}`,
      requiresApproval ? 'subagent-approval:required' : 'subagent-approval:precleared',
    ]),
    metadata: input.metadata ? { ...input.metadata } : {},
  };
}

function normalizeRisk(risk?: string | null): SubagentApprovalRisk {
  switch (normalizeText(risk)) {
    case 'safe':
    case 'attention':
    case 'danger':
      return risk as SubagentApprovalRisk;
    case 'unknown':
    default:
      return 'unknown';
  }
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}
