import { BatchTrajectoryTool } from '../../src/tools/BatchTrajectoryTool';
import { ProviderFactory } from '../../src/providers/ProviderFactory';

jest.mock('../../src/providers/ProviderFactory', () => ({
  ProviderFactory: {
    create: jest.fn(),
  },
}));

describe('BatchTrajectoryTool', () => {
  let tool: BatchTrajectoryTool;
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE;
    jest.mocked(ProviderFactory.create).mockReset();
    jest.mocked(ProviderFactory.create).mockReturnValue({
      name: 'mock-provider',
      chat: jest.fn(async (messages: any[]) => ({
        content: `real output for ${messages[0]?.content || 'unknown'}`,
        toolCalls: [],
        finishReason: 'stop',
      })),
    } as any);
    tool = new BatchTrajectoryTool();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('exposes correct name', () => {
    expect(tool.name).toBe('batch_trajectory');
  });

  it('returns error when trajectories is missing', async () => {
    const result = await tool.execute({});
    expect(result).toContain('Error');
  });

  it('returns error for empty trajectories array', async () => {
    const result = await tool.execute({ trajectories: '[]' });
    expect(result).toContain('Error');
    expect(result).toContain('at least one trajectory');
  });

  it('returns error for invalid JSON', async () => {
    const result = await tool.execute({ trajectories: 'not-json' });
    expect(result).toContain('Error');
    expect(result).toContain('JSON');
  });

  it('returns error when trajectory has no prompt', async () => {
    const result = await tool.execute({
      trajectories: JSON.stringify([{ provider: 'openai' }]),
    });
    expect(result).toContain('Error');
    expect(result).toContain('prompt');
  });

  it('returns error when exceeding max trajectories', async () => {
    const trajectories = Array(11).fill({ prompt: 'test' });
    const result = await tool.execute({
      trajectories: JSON.stringify(trajectories),
    });
    expect(result).toContain('Error');
    expect(result).toMatch(/maximum|maximo/i);
  });

  it('returns error for invalid comparison metric', async () => {
    const result = await tool.execute({
      trajectories: JSON.stringify([{ prompt: 'test' }]),
      comparison_metric: 'invalid',
    });
    expect(result).toContain('Error');
    expect(result).toContain('metric');
  });

  it('refuses to fabricate outputs when live execution is disabled', async () => {
    const result = await tool.execute({
      trajectories: JSON.stringify([{ prompt: 'Hello world' }]),
    });

    expect(result).toMatch(/live batch|execucao real|real providers/i);
    expect(result).not.toContain('[Simulated]');
    expect(ProviderFactory.create).not.toHaveBeenCalled();
  });

  it('executes a single trajectory with a real provider adapter when live execution is enabled', async () => {
    process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE = 'true';
    const result = await tool.execute({
      trajectories: JSON.stringify([{ prompt: 'Hello world', provider: 'openai' }]),
    });

    expect(result).toContain('Comparison of 1 trajectories');
    expect(result).toContain('OK');
    expect(result).toContain('Best result:');
    expect(ProviderFactory.create).toHaveBeenCalledWith('openai');
  });

  it('executes multiple trajectories and compares them', async () => {
    process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE = 'true';
    const result = await tool.execute({
      trajectories: JSON.stringify([
        { prompt: 'What is AI?', provider: 'openai', model: 'gpt-4' },
        { prompt: 'What is AI?', provider: 'anthropic', model: 'claude-3' },
      ]),
      comparison_metric: 'length',
    });

    expect(result).toContain('Comparison of 2 trajectories');
    expect(result).toContain('openai');
    expect(result).toContain('anthropic');
  });

  it('accepts trajectories as array directly', async () => {
    process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE = 'true';
    const result = await tool.execute({
      trajectories: [{ prompt: 'Test prompt' }],
    });

    expect(result).toContain('Comparison of 1 trajectories');
  });

  it('respects max_concurrent parameter', async () => {
    process.env.ZAVORTH_BATCH_TRAJECTORY_ALLOW_LIVE = 'true';
    const result = await tool.execute({
      trajectories: JSON.stringify([{ prompt: 'A' }, { prompt: 'B' }, { prompt: 'C' }, { prompt: 'D' }]),
      max_concurrent: 2,
    });

    expect(result).toContain('Comparison of 4 trajectories');
  });
});
