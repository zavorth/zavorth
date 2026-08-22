/**
 * Minimal LLM chat port for multi-model consensus engines.
 * Implemented by LlmRuntimeService (or test doubles).
 */

import type { ChatMessage, LlmResponse } from '../providers/ILlmProvider.js';
import type { LlmRunOptions } from '../services/llm/LlmRuntimeService.js';

export type ConsensusChatMessage = Pick<ChatMessage, 'role' | 'content'> & {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ConsensusChatOptions = {
  providerName?: string;
  modelName?: string;
  allowFallback?: boolean;
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
};

/**
 * Port used by AgentConsensusEngine / ConsensusWithFallback.
 * Prefer injecting LlmRuntimeService via createLlmRuntimeChatPort().
 */
export type LlmChatPort = {
  chat(
    messages: ConsensusChatMessage[],
    options?: ConsensusChatOptions,
  ): Promise<string>;
};

export type LlmRuntimeChatLike = {
  chat(
    messages: ChatMessage[],
    tools?: unknown,
    options?: LlmRunOptions,
  ): Promise<LlmResponse>;
};

/**
 * Adapt LlmRuntimeService (or compatible) into LlmChatPort.
 */
export function createLlmRuntimeChatPort(runtime: LlmRuntimeChatLike): LlmChatPort {
  return {
    async chat(messages, options) {
      const response = await runtime.chat(
        messages as ChatMessage[],
        undefined,
        {
          providerName: options?.providerName,
          modelName: options?.modelName,
          allowFallback: options?.allowFallback === true,
          signal: options?.signal,
        },
      );
      const content = response?.content;
      if (typeof content === 'string' && content.trim()) {
        return content.trim();
      }
      throw new Error(
        `Empty LLM response from ${options?.providerName || 'default'}/${options?.modelName || 'default'}`,
      );
    },
  };
}

/**
 * Build an AbortSignal that fires after timeoutMs (best-effort).
 */
export function createTimeoutSignal(timeoutMs: number, parent?: AbortSignal): AbortSignal {
  const ms = Math.max(1_000, Math.floor(timeoutMs || 60_000));
  if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as any).timeout === 'function') { // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timed = (AbortSignal as any).timeout(ms) as AbortSignal;
    if (!parent) return timed;
    return anySignal([parent, timed]);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`LLM call timed out after ${ms}ms`)), ms);
  if (parent) {
    if (parent.aborted) {
      clearTimeout(timer);
      controller.abort(parent.reason);
    } else {
      parent.addEventListener('abort', () => {
        clearTimeout(timer);
        controller.abort(parent.reason);
      }, { once: true });
    }
  }
  // Detach timer when aborted for any reason
  controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  return controller.signal;
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
