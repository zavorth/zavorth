import {
  inferUniversalAgentRequestedTools,
} from '../../../src/runtime/agent/UniversalAgentRequestHeuristics.js';

describe('inferUniversalAgentRequestedTools', () => {
  it('returns only structured capability ids and fallback tool', () => {
    expect(inferUniversalAgentRequestedTools({
      text: 'run npm test and use web_search and zavorth_delegate please',
      capabilityIds: ['agent_manager'],
      fallbackTool: 'read_file',
    }).sort()).toEqual(['agent_manager', 'read_file'].sort());
  });

  it('ignores free-text completely when no structured tools are provided', () => {
    expect(inferUniversalAgentRequestedTools({
      text: 'use subagents swarm.run 300 agents https://example.com',
      fallbackTool: null,
    })).toEqual([]);
  });
});
