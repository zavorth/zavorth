import { LlmSkillRankService } from '../../src/services/LlmSkillRankService.js';

describe('LlmSkillRankService', () => {
  const candidates = [
    { id: 'a', name: 'Alpha', description: 'files' },
    { id: 'b', name: 'Beta', description: 'web' },
    { id: 'c', name: 'Gamma', description: 'memory' },
  ];

  it('keeps deterministic order when useLlm is false', async () => {
    const svc = new LlmSkillRankService({
      chat: {
        complete: async () => {
          throw new Error('should not call LLM');
        },
      },
    });
    const result = await svc.rank({
      query: 'web',
      candidates,
      useLlm: false,
    });
    expect(result.usedLlm).toBe(false);
    expect(result.orderedIds).toEqual(['a', 'b', 'c']);
  });

  it('reorders closed list from LLM JSON and never invents ids', async () => {
    const svc = new LlmSkillRankService({
      chat: {
        complete: async () => JSON.stringify({ orderedIds: ['b', 'invented-id', 'c', 'a'] }),
      },
    });
    const result = await svc.rank({
      query: 'web',
      candidates,
      useLlm: true,
    });
    expect(result.usedLlm).toBe(true);
    expect(result.orderedIds).toEqual(['b', 'c', 'a']);
    expect(result.orderedIds).not.toContain('invented-id');
  });

  it('soft-fails to original order on LLM error', async () => {
    const svc = new LlmSkillRankService({
      chat: {
        complete: async () => {
          throw new Error('offline');
        },
      },
    });
    const result = await svc.rank({
      query: 'web',
      candidates,
      useLlm: true,
    });
    expect(result.usedLlm).toBe(false);
    expect(result.orderedIds).toEqual(['a', 'b', 'c']);
    expect(result.reason).toMatch(/soft-failed|offline/i);
  });
});
