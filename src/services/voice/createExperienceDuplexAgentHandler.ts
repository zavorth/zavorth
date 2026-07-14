/**
 * Wire duplex listen turns to the real Experience Core agent path (same as /api/experience/ask).
 */

import type { VoiceDuplexAgentHandler } from './VoiceRealtimeDuplexSession.js';
import {
  registerVoiceAgentAbort,
  unregisterVoiceAgentAbort,
} from './VoiceAgentAbortRegistry.js';

export type ExperienceDuplexAgentDeps = {
  ensureReady: () => Promise<void>;
  execute: (command: {
    text: string;
    surface?: string;
    userId?: string;
    sessionId?: string | null;
    metadata?: Record<string, unknown>;
    intent?: string;
  }) => Promise<{
    ok?: boolean;
    error?: string | null;
    replies?: Array<{ role?: string; text?: string }>;
  }>;
  userId?: string;
  sessionId?: string | null;
  agentReplyOverride?: string | null;
};

/**
 * Build agent handler for duplex sessions.
 * Falls back to honest error text — never invents a silent success.
 */
export function createExperienceDuplexAgentHandler(
  deps: ExperienceDuplexAgentDeps,
): VoiceDuplexAgentHandler {
  return async ({ agentText, sessionId, surface, signal }) => {
    const override = String(deps.agentReplyOverride || '').trim();
    if (override) {
      return { replyText: override };
    }

    const text = String(agentText || '').trim();
    if (!text) {
      return { replyText: 'Empty voice transcript. Type your message instead.' };
    }

    if (signal?.aborted) {
      throw new Error('Voice turn aborted (barge-in).');
    }

    try {
      await deps.ensureReady();
      if (signal?.aborted) {
        throw new Error('Voice turn aborted (barge-in).');
      }

      // Register so LLM runtime can abort provider fetch (not only race the Promise)
      if (signal) {
        registerVoiceAgentAbort(sessionId, signal);
      }

      // Race agent execute against abort signal + provider-level abort via registry
      const executePromise = deps.execute({
        text,
        surface: 'web',
        userId: deps.userId || 'desktop-user',
        sessionId: deps.sessionId || sessionId,
        intent: 'ask',
        metadata: {
          source: 'voice-duplex',
          duplexSessionId: sessionId,
          voiceSurface: surface,
          // in-process only — never JSON-serialized to disk
          voiceAbortSignal: signal || undefined,
        },
      });

      const result = signal
        ? await Promise.race([
            executePromise,
            new Promise<never>((_, reject) => {
              const onAbort = () => {
                reject(new Error('Voice turn aborted (barge-in).'));
              };
              if (signal.aborted) onAbort();
              else signal.addEventListener('abort', onAbort, { once: true });
            }),
          ])
        : await executePromise;

      if (signal?.aborted) {
        throw new Error('Voice turn aborted (barge-in).');
      }

      if (result.error && !result.replies?.length) {
        return {
          replyText: `${result.error}. Type your message instead.`,
        };
      }

      const assistant =
        result.replies?.find((r) => r.role === 'assistant')?.text ||
        result.replies?.[0]?.text ||
        null;
      const reply = String(assistant || '').trim();
      if (!reply) {
        return {
          replyText:
            'Agent returned an empty reply. Type your message instead.',
        };
      }
      return { replyText: reply };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/aborted|barge-in/i.test(message)) {
        throw error instanceof Error ? error : new Error(message);
      }
      return {
        replyText: `Agent unavailable (${message}). Type your message instead.`,
      };
    } finally {
      unregisterVoiceAgentAbort(sessionId);
    }
  };
}
