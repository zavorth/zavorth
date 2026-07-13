import {
  buildOpenAiReasoningEffortBody,
  buildAnthropicThinkingHint,
  normalizeEffort,
} from '../../src/providers/reasoningEffortPayload.js';

describe('reasoningEffortPayload', () => {
  it('normalizes aliases', () => {
    expect(normalizeEffort('ultra')).toBe('xhigh');
    expect(normalizeEffort('max')).toBe('xhigh');
    expect(normalizeEffort('standard')).toBe('medium');
  });

  it('builds openai body for non-none effort', () => {
    expect(buildOpenAiReasoningEffortBody({ reasoningEffort: 'high' })).toEqual({
      reasoning_effort: 'high',
    });
    expect(buildOpenAiReasoningEffortBody({ reasoningEffort: 'none' })).toEqual({});
    expect(buildOpenAiReasoningEffortBody({})).toEqual({});
  });

  it('builds anthropic thinking budget for deep efforts', () => {
    expect(buildAnthropicThinkingHint({ reasoningEffort: 'low' })).toBeNull();
    expect(buildAnthropicThinkingHint({ reasoningEffort: 'xhigh' })?.budget_tokens).toBe(16_000);
  });
});
