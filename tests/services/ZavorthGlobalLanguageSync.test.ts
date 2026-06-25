import { describe, expect, it } from '@jest/globals';
import { EchoExecutionLoop } from '../../src/services/EchoExecutionLoop';

describe('ZavorthGlobalLanguageSync - EchoExecutionLoop', () => {
  it('appends language directive in system prompt when lang option is specified', () => {
    const loop = new EchoExecutionLoop({
      orchestrator: {} as any,
      llmRuntime: {} as any,
      permissions: {} as any,
      pendingExecutions: {} as any,
      executionBoundary: {} as any,
      decorateToolCall: (tc) => tc,
      buildLlmRunOptions: () => ({} as any),
    });

    const messages = (loop as any).buildInitialMessages('hello', 'ja-JP');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain("Obligatorily, you must respond in the language code 'ja-jp'.");
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toBe('hello');
  });

  it('does not append language directive when lang option is undefined or auto', () => {
    const loop = new EchoExecutionLoop({
      orchestrator: {} as any,
      llmRuntime: {} as any,
      permissions: {} as any,
      pendingExecutions: {} as any,
      executionBoundary: {} as any,
      decorateToolCall: (tc) => tc,
      buildLlmRunOptions: () => ({} as any),
    });

    const messagesAuto = (loop as any).buildInitialMessages('hello', 'auto');
    expect(messagesAuto[0].content).not.toContain('Obligatorily, you must respond in the language code');

    const messagesUndefined = (loop as any).buildInitialMessages('hello', undefined);
    expect(messagesUndefined[0].content).not.toContain('Obligatorily, you must respond in the language code');
  });
});
