import {
  authorizeHotPathToolCall,
  __resetHotPathBudgetForTests,
} from '../../src/services/AgentHotPathBudgetGate';

describe('AgentHotPathBudgetGate', () => {
  beforeEach(() => {
    __resetHotPathBudgetForTests();
    process.env.ZAVORTH_HOTPATH_MAX_ACTIONS = '3';
    process.env.ZAVORTH_HOTPATH_MAX_MUTABLE_ACTIONS = '2';
  });

  afterEach(() => {
    delete process.env.ZAVORTH_HOTPATH_MAX_ACTIONS;
    delete process.env.ZAVORTH_HOTPATH_MAX_MUTABLE_ACTIONS;
    __resetHotPathBudgetForTests();
  });

  it('allows tool calls within budget and blocks after limit', async () => {
    const a = await authorizeHotPathToolCall({
      userId: 'u-budget',
      sessionId: 's1',
      surface: 'cli',
      toolName: 'web_search',
    });
    expect(a.allowed).toBe(true);

    await authorizeHotPathToolCall({
      userId: 'u-budget',
      sessionId: 's1',
      surface: 'cli',
      toolName: 'read_file',
    });
    await authorizeHotPathToolCall({
      userId: 'u-budget',
      sessionId: 's1',
      surface: 'cli',
      toolName: 'list_dir',
    });

    const blocked = await authorizeHotPathToolCall({
      userId: 'u-budget',
      sessionId: 's1',
      surface: 'cli',
      toolName: 'web_search',
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockers.length).toBeGreaterThan(0);
  });
});
