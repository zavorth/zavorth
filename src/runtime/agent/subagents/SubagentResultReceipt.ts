import {
  evaluateSubagentBudget,
  type SubagentBudget,
  type SubagentBudgetDecision,
} from './SubagentBudget.js';
import type { SubagentApprovalBoundary } from './SubagentApprovalBoundary.js';
import type { SubagentCapabilityScope } from './SubagentCapabilityScope.js';

export type SubagentResultStatus = 'planned' | 'completed' | 'blocked' | 'budget_exceeded' | 'failed';

export interface SubagentResultReceipt {
  id: string;
  roleId: string;
  status: SubagentResultStatus;
  summary: string;
  scope: SubagentCapabilityScope;
  budget: SubagentBudget;
  approvalBoundary: SubagentApprovalBoundary;
  budgetDecision: SubagentBudgetDecision;
  artifacts: string[];
  risks: string[];
  policyTags: string[];
  metadata: Record<string, unknown>;
}

export interface SubagentResultReceiptInput {
  id?: string | null;
  roleId: string;
  status?: SubagentResultStatus | null;
  summary?: string | null;
  scope: SubagentCapabilityScope;
  budget: SubagentBudget;
  approvalBoundary: SubagentApprovalBoundary;
  budgetDecision?: SubagentBudgetDecision | null;
  artifacts?: readonly string[] | null;
  risks?: readonly string[] | null;
  policyTags?: readonly string[] | null;
  metadata?: Record<string, unknown> | null;
}

export function createSubagentResultReceipt(
  input: SubagentResultReceiptInput,
): SubagentResultReceipt {
  const roleId = normalizeText(input.roleId) || input.scope.roleId;
  const budgetDecision = input.budgetDecision ?? evaluateSubagentBudget(input.budget);
  const status = input.status ?? (budgetDecision.ok ? 'planned' : 'budget_exceeded');

  return {
    id: normalizeText(input.id) || `subagent-receipt:${roleId}:${status}`,
    roleId,
    status,
    summary:
      normalizeText(input.summary) ||
      (budgetDecision.ok
        ? 'Subagent result is represented as an auditable receipt.'
        : `Subagent stopped before execution because budget exceeded ${budgetDecision.exceeded}.`),
    scope: input.scope,
    budget: input.budget,
    approvalBoundary: input.approvalBoundary,
    budgetDecision,
    artifacts: uniqueSorted(input.artifacts),
    risks: uniqueSorted(input.risks),
    policyTags: uniqueSorted([
      ...(input.policyTags ?? []),
      ...input.scope.policyTags,
      ...input.budget.policyTags,
      ...input.approvalBoundary.policyTags,
      ...budgetDecision.policyTags,
      'subagent-result-receipt',
      `subagent-result:${status}`,
    ]),
    metadata: input.metadata ? { ...input.metadata } : {},
  };
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values?: readonly string[] | null): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort();
}
