import {
  createStructuredAgentRunAction,
  isStructuredAgentRunAction,
  STRUCTURED_AGENT_RUN_ACTION_TYPE,
} from '../../src/contracts/StructuredAgentRunContract';

describe('StructuredAgentRunContract', () => {
  it('creates the canonical structured agent run action shape', () => {
    const action = createStructuredAgentRunAction({
      payload: 'rode a validacao focada',
      metadata: {
        source: 'test',
      },
    });

    expect(action).toEqual({
      type: STRUCTURED_AGENT_RUN_ACTION_TYPE,
      payload: 'rode a validacao focada',
      metadata: {
        source: 'test',
      },
    });
  });

  it('accepts only non-empty structured agent run actions', () => {
    expect(isStructuredAgentRunAction({
      type: STRUCTURED_AGENT_RUN_ACTION_TYPE,
      payload: 'execute a tarefa',
    })).toBe(true);

    expect(isStructuredAgentRunAction({
      type: STRUCTURED_AGENT_RUN_ACTION_TYPE,
      payload: '   ',
    })).toBe(false);

    expect(isStructuredAgentRunAction({
      type: 'autonomous_task',
      payload: 'execute a tarefa',
    })).toBe(false);
  });
});
