/**
 * Unit tests for AgentConsensusEngine + ConsensusWithFallback with mock LlmChatPort.
 */

import { AgentConsensusEngine } from '../../src/agents/AgentConsensusEngine.js';
import { ConsensusWithFallback } from '../../src/agents/ConsensusWithFallback.js';
import type { LlmChatPort } from '../../src/agents/LlmChatPort.js';

describe('AgentConsensusEngine', () => {
  it('deliberates with injected LlmChatPort and synthesizes', async () => {
    let calls = 0;
    const llm: LlmChatPort = {
      async chat(messages) {
        calls += 1;
        const user = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
        if (user.includes('Assessment')) return 'Final: Option 1 with gates.';
        return `Reviewer view ${calls}`;
      },
    };

    const engine = new AgentConsensusEngine({
      reviewers: [
        { provider: 'ollama', model: 'llama3.2' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
      synthesizer: { provider: 'ollama', model: 'llama3.2' },
      enableCache: false,
      llm,
    });

    const result = await engine.deliberate('Which option-');
    expect(result.reviewersUsed).toBe(2);
    expect(result.synthesis).toMatch(/Option 1/);
    expect(calls).toBe(3);
  });

  it('throws when all reviewers fail', async () => {
    const llm: LlmChatPort = {
      async chat() {
        throw new Error('provider down');
      },
    };
    const engine = new AgentConsensusEngine({
      reviewers: [{ provider: 'local', model: 'x' }],
      synthesizer: { provider: 'local', model: 'x' },
      enableCache: false,
      llm,
    });
    await expect(engine.deliberate('q')).rejects.toThrow(/No reviewer/);
  });
});

describe('ConsensusWithFallback', () => {
  it('uses only caller-provided user fallbacks', async () => {
    const tried: string[] = [];
    const llm: LlmChatPort = {
      async chat(_messages, options) {
        const key = `${options?.providerName}/${options?.modelName}`;
        tried.push(key);
        if (options?.modelName === 'primary-fail') {
          throw new Error('429 rate_limit');
        }
        return `OK ${key}`;
      },
    };

    const engine = new ConsensusWithFallback(llm, {
      resolveFallbacks: () => [{ provider: 'ollama', model: 'llama3.2' }],
    });

    const result = await engine.deliberate({
      query: 'check',
      reviewers: [{ provider: 'custom', model: 'primary-fail' }],
      synthesizer: { provider: 'ollama', model: 'llama3.2' },
      maxConcurrent: 1,
    });

    expect(result.reviewersUsed).toBe(1);
    expect(result.assessments[0].effectiveModel).toBe('llama3.2');
    expect(tried.some((t) => t.includes('primary-fail'))).toBe(true);
    expect(tried.some((t) => t.includes('llama3.2'))).toBe(true);
  });
});
