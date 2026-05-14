import { SupervisedComputerUseAdapter } from '../../../src/adapters/overlord/SupervisedComputerUseAdapter.js';

describe('SupervisedComputerUseAdapter', () => {
  it('requires an injected Computer Use agent', async () => {
    const adapter = new SupervisedComputerUseAdapter(null);

    const result = await adapter.execute(
      {
        capability: 'computer_use.visual_action',
        command: JSON.stringify({ action: 'snapshot' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'computer_use.visual_action',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('computer_use_agent_unavailable');
  });

  it('runs visual computer-use with target window, objective and bounded iterations', async () => {
    const agent = {
      run: jest.fn(async () => ({ status: 'completed' })),
      stop: jest.fn(),
      getSnapshot: jest.fn(() => ({ status: 'idle' })),
    };
    const adapter = new SupervisedComputerUseAdapter(agent);

    const result = await adapter.execute(
      {
        capability: 'computer_use.visual_action',
        command: JSON.stringify({
          action: 'run',
          targetWindow: 'Chrome',
          objective: 'Abrir docs',
          maxIterations: 99,
        }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'computer_use.visual_action',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(true);
    expect(agent.run).toHaveBeenCalledWith(expect.objectContaining({
      targetWindow: 'Chrome',
      objective: 'Abrir docs',
      maxIterations: 10,
    }));
  });

  it('supports supervised stop without running a visual loop', async () => {
    const agent = {
      run: jest.fn(),
      stop: jest.fn(),
      getSnapshot: jest.fn(() => ({ status: 'running' })),
    };
    const adapter = new SupervisedComputerUseAdapter(agent);

    const result = await adapter.execute(
      {
        capability: 'computer_use.visual_action',
        command: JSON.stringify({ action: 'stop' }),
        approved: true,
      },
      {
        allowed: true,
        requiresApproval: false,
        reason: 'ok',
        capability: 'computer_use.visual_action',
        profile: 'dangerous',
        requiredProfile: 'dangerous',
        autonomyLevel: 5,
        requiredAutonomyLevel: 5,
        runtimeTarget: 'desktop',
        mutating: true,
      },
    );

    expect(result.ok).toBe(true);
    expect(agent.stop).toHaveBeenCalledTimes(1);
    expect(agent.run).not.toHaveBeenCalled();
  });
});
