import {
  ToolChainBudgetGuard,
} from '../../../src/runtime/agent/index.js';

describe('ToolChainBudgetGuard', () => {
  it('allows a small approved tool chain without becoming a tool exposure gate', () => {
    const guard = new ToolChainBudgetGuard({
      maxToolCalls: 3,
      maxToolRounds: 2,
      maxEstimatedCostUnits: 10,
    });

    const decision = guard.evaluate({
      toolExposure: {
        mode: 'safe',
        summary: 'Duas tools expostas.',
        tools: [
          {
            id: 'read_file',
            label: 'Read file',
            risk: 'safe',
            requiresApproval: false,
          },
          {
            id: 'shell.exec',
            label: 'Shell exec',
            risk: 'danger',
            requiresApproval: true,
          },
        ],
      },
      calls: [
        {
          toolId: 'read_file',
          round: 1,
          estimatedCostUnits: 1,
        },
        {
          toolId: 'shell.exec',
          round: 2,
          estimatedCostUnits: 2,
        },
      ],
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: true,
      degraded: false,
      reason: null,
      blockedToolIds: [],
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      source: 'ToolChainBudgetGuard',
      callCount: 2,
      maxRound: 2,
      dangerousToolCount: 1,
      toolExposureGatedByToolChainBudget: false,
    }));
  });

  it('degrades dangerous unapproved tool chains before execution', () => {
    const guard = new ToolChainBudgetGuard();

    const decision = guard.evaluate({
      calls: [
        {
          toolId: 'shell.exec',
          risk: 'danger',
          requiresApproval: false,
        },
      ],
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      degraded: true,
      reason: 'dangerous-tool-without-approval',
      summary: 'Tool chain degraded before execution: dangerous-tool-without-approval.',
      blockedToolIds: ['shell.exec'],
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      unapprovedDangerousToolCount: 1,
      toolExposureGatedByToolChainBudget: false,
    }));
  });

  it('degrades chains that exceed round or cost budget without executing tools', () => {
    const guard = new ToolChainBudgetGuard({
      maxToolRounds: 2,
      maxEstimatedCostUnits: 4,
    });

    const decision = guard.evaluate({
      calls: [
        {
          toolId: 'read_file',
          risk: 'safe',
          round: 3,
          estimatedCostUnits: 5,
        },
      ],
    });

    expect(decision).toEqual(expect.objectContaining({
      allowed: false,
      degraded: true,
      reason: 'tool-round-count-too-high',
      blockedToolIds: ['read_file'],
    }));
    expect(decision.metadata).toEqual(expect.objectContaining({
      maxRound: 3,
      estimatedCostUnits: 5,
      allReasons: ['tool-round-count-too-high', 'tool-chain-cost-too-high'],
    }));
  });
});
