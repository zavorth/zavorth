import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
} from '../../../src/runtime/agent/index.js';

describe('subagent escalation contracts', () => {
  it('keeps subagent capability scope closed by default', () => {
    const scope = createSubagentCapabilityScope({ roleId: 'planner' });

    expect(scope).toEqual(expect.objectContaining({
      roleId: 'planner',
      mode: 'blocked',
      allowedTools: [],
      allowedPaths: [],
      requiresApproval: true,
    }));
    expect(scope.deniedPaths).toEqual(expect.arrayContaining([
      '.git',
      'node_modules',
    ]));
    expect(scope.policyTags).toEqual(expect.arrayContaining([
      'subagent-tools:none',
      'subagent-paths:none',
      'subagent-approval:required',
    ]));
  });

  it('does not allow non-read-only scopes to bypass the approval boundary', () => {
    const scope = createSubagentCapabilityScope({
      roleId: 'patcher',
      mode: 'workspace_patch',
      allowedPaths: ['src/runtime/agent'],
      requiresApproval: false,
    });
    const budget = createSubagentBudget({ maxToolCalls: 1 });

    const boundary = createSubagentApprovalBoundary({
      scope,
      budget,
      requiresApproval: false,
      risk: 'danger',
    });

    expect(boundary).toEqual(expect.objectContaining({
      requiresApproval: true,
      risk: 'danger',
    }));
    expect(boundary.policyTags).toEqual(expect.arrayContaining([
      'subagent-approval-boundary',
      'subagent-approval:required',
    ]));
  });

  it('turns budget overflow into an auditable result receipt', () => {
    const scope = createSubagentCapabilityScope({
      roleId: 'runner',
      mode: 'tool_limited',
      allowedTools: ['shell'],
    });
    const budget = createSubagentBudget({
      maxToolCalls: 1,
      usedToolCalls: 2,
    });
    const boundary = createSubagentApprovalBoundary({
      scope,
      budget,
      risk: 'attention',
    });

    const receipt = createSubagentResultReceipt({
      roleId: 'runner',
      scope,
      budget,
      approvalBoundary: boundary,
    });

    expect(receipt).toEqual(expect.objectContaining({
      roleId: 'runner',
      status: 'budget_exceeded',
      budgetDecision: expect.objectContaining({
        ok: false,
        exceeded: 'tool_calls',
      }),
    }));
    expect(receipt.policyTags).toEqual(expect.arrayContaining([
      'subagent-result-receipt',
      'subagent-result:budget_exceeded',
      'subagent-budget:exceeded:tool_calls',
    ]));
  });
});
