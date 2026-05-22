import {
  inferUniversalAgentRequestedTools,
} from '../../../src/runtime/agent/index.js';

describe('inferUniversalAgentRequestedTools', () => {
  it('infers get_datetime for Portuguese current time questions', () => {
    expect(inferUniversalAgentRequestedTools({
      text: 'Me diga que horas sao agora em Brasilia',
      fallbackTool: null,
    })).toEqual(expect.arrayContaining(['get_datetime']));
  });

  it('infers get_datetime for current date questions', () => {
    expect(inferUniversalAgentRequestedTools({
      text: 'Qual e a data atual?',
      fallbackTool: null,
    })).toEqual(expect.arrayContaining(['get_datetime']));
  });

  it('does not infer datetime from non-current conceptual questions', () => {
    expect(inferUniversalAgentRequestedTools({
      text: 'Explique como fusos horarios funcionam',
      fallbackTool: null,
    })).not.toContain('get_datetime');
  });
});
