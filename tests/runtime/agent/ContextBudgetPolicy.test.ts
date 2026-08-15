import {
  ContextBudgetPolicy,
} from '../../../src/runtime/agent/index.js';

function createPolicy() {
  return new ContextBudgetPolicy({
    tokenBudgetService: {
      evaluateText: (text, limit = 100) => {
        const used = String(text || '').length;
        return {
          used,
          limit,
          withinBudget: used <= limit,
        };
      },
    },
    costBudgetService: {
      evaluateTokens: (tokenCount, limitUsd = 1) => {
        const estimatedCostUsd = Number((tokenCount / 100).toFixed(6));
        return {
          estimatedCostUsd,
          limitUsd,
          withinBudget: estimatedCostUsd <= limitUsd,
        };
      },
    },
  });
}

describe('ContextBudgetPolicy', () => {
  it('keeps cold context when cumulative hot/warm/cold fits token and cost budgets', () => {
    const policy = createPolicy();

    const decision = policy.evaluate({
      profile: 'cold',
      hot: 'hot',
      warm: 'warm',
      cold: 'cold',
      tokenLimit: 32,
      costLimitUsd: 1,
    });

    expect(decision).toEqual(expect.objectContaining({
      requestedDepth: 'cold',
      allowedDepth: 'cold',
      degraded: false,
      withinBudget: true,
      gatesToolExposure: false,
    }));
    expect(decision.layers.map((layer) => ({
      layer: layer.layer,
      requested: layer.requested,
      withinBudget: layer.token.withinBudget && layer.cost.withinBudget,
    }))).toEqual([
      {
        layer: 'hot',
        requested: true,
        withinBudget: true,
      },
      {
        layer: 'warm',
        requested: true,
        withinBudget: true,
      },
      {
        layer: 'cold',
        requested: true,
        withinBudget: true,
      },
    ]);
  });

  it('degrades requested cold context to the deepest layer that fits the existing budget services', () => {
    const policy = createPolicy();

    const decision = policy.evaluate({
      profile: 'cold',
      hot: '12345',
      warm: '12345',
      cold: 'this cold context is too large',
      tokenLimit: 13,
      costLimitUsd: 1,
    });

    expect(decision).toEqual(expect.objectContaining({
      requestedDepth: 'cold',
      allowedDepth: 'warm',
      degraded: true,
      withinBudget: false,
      gatesToolExposure: false,
    }));
    expect(decision.reason).toContain('cold to warm');
    expect(decision.layers[2]).toEqual(expect.objectContaining({
      layer: 'cold',
      requested: true,
      token: expect.objectContaining({
        withinBudget: false,
      }),
    }));
  });

  it('never turns budget pressure into a tool exposure gate, even when hot exceeds budget', () => {
    const policy = createPolicy();

    const decision = policy.evaluate({
      profile: 'hot',
      hot: 'hot-context-larger-than-limit',
      tokenLimit: 3,
      costLimitUsd: 1,
    });

    expect(decision).toEqual(expect.objectContaining({
      requestedDepth: 'hot',
      allowedDepth: 'hot',
      degraded: false,
      withinBudget: false,
      gatesToolExposure: false,
    }));
    expect(decision.reason).toContain('exceeds the minimum budget');
    expect(decision.layers[0]).toEqual(expect.objectContaining({
      layer: 'hot',
      requested: true,
      token: expect.objectContaining({
        withinBudget: false,
      }),
    }));
  });
});
