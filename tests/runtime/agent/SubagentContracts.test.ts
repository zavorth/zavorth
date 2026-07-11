import {
  applySubagentBudgetUsage,
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  evaluateSubagentBudget,
  wouldExceedToolCallBudget,
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

  it('evaluates wall_clock_ms and output_bytes limits, treating max 0 as unenforced', () => {
    const unlimited = createSubagentBudget({
      usedToolCalls: 5,
      elapsedMs: 50_000,
      outputBytes: 9_000,
    });
    expect(evaluateSubagentBudget(unlimited).ok).toBe(true);

    const wall = createSubagentBudget({ maxWallClockMs: 1_000, elapsedMs: 1_001 });
    expect(evaluateSubagentBudget(wall)).toEqual(expect.objectContaining({
      ok: false,
      exceeded: 'wall_clock_ms',
    }));

    let bytes = createSubagentBudget({ maxOutputBytes: 100 });
    bytes = applySubagentBudgetUsage(bytes, { outputBytes: 120 });
    expect(evaluateSubagentBudget(bytes)).toEqual(expect.objectContaining({
      ok: false,
      exceeded: 'output_bytes',
    }));

    const tools = createSubagentBudget({ maxToolCalls: 2, usedToolCalls: 2 });
    expect(wouldExceedToolCallBudget(tools, 1)).toBe(true);
    expect(evaluateSubagentBudget(tools).ok).toBe(true);
  });
});
