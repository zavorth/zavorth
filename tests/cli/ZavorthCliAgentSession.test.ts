import { formatExperienceAgentSession } from '../../src/cli/ZavorthCliExperienceRenderer.js';

describe('Zavorth CLI agent session', () => {
  it('renders a minimal interactive agent welcome instead of the home dashboard', () => {
    const output = formatExperienceAgentSession({
      sessionId: 'main',
      workspace: 'C:/workspace',
      agent: {
        providerLabel: 'not configured',
        modelLabel: 'not configured',
      },
      health: {
        status: 'warning',
      },
      daily: {
        pendingApprovals: 2,
      },
      approvals: [],
      learning: {
        pending: 0,
      },
      actionCards: [],
      receipts: [],
    } as any);

    expect(output).toContain("Hi, I'm Zavorth.");
    expect(output).toContain('Choose a model to unlock the full LLM agent loop.');
    expect(output).toContain('quick actions');
    expect(output).toContain('local ready | session main | tokens ?');
    expect(output).not.toContain('Start Here');
    expect(output).not.toContain('Native Power');
  });
});
