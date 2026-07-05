/**
 * ContextAwareInjector — dynamic tool injection during conversation.
 *
 * Instead of injecting all relevant tools at the start, this module starts
 * with a minimal set and injects additional tools on demand when the LLM
 * tries to use a tool not in the initial set. After repeated failures,
 * it escalates to the full toolset for the current turn.
 */

import type { ToolDefinition } from '../providers/ILlmProvider.js';
import type { IntentClassification } from './IntentClassifier.js';

export interface InjectorState {
  /** Tool names already injected this turn. */
  injectedTools: Set<string>;
  /** Number of failed tool calls (tool not found) this turn. */
  failureCount: number;
  /** Whether escalation to full toolset has occurred. */
  escalated: boolean;
  /** Timestamp of last activity. */
  lastActivity: number;
}

export interface InjectorResult {
  /** The tool definition to inject, or null if not found. */
  tool: ToolDefinition | null;
  /** Whether the injector escalated to full toolset. */
  escalated: boolean;
  /** Updated state after this request. */
  state: InjectorState;
}

/** Minimal tool sets per intent category. */
const MINIMAL_TOOL_SETS: Record<string, string[]> = {
  conversation: [],
  information: ['web_search'],
  file_operation: ['read_file'],
  execution: ['run_sandbox_code'],
  configuration: ['configure_llm_profile'],
  memory: ['semantic_memory'],
  desktop: ['desktop_automation'],
  research: ['web_search'],
  full_toolset: ['read_file', 'web_search'],
};

/** Number of failures before escalating to full toolset. */
const ESCALATION_THRESHOLD = 2;

/** Session TTL: 2 hours. */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class ContextAwareInjector {
  private readonly sessions: Map<string, InjectorState> = new Map();
  private readonly sessionTtlMs: number;

  constructor(options?: { sessionTtlMs?: number }) {
    this.sessionTtlMs = options?.sessionTtlMs ?? SESSION_TTL_MS;
  }

  /**
   * Returns the initial minimal tool set for a given intent classification.
   */
  getInitialTools(classification: IntentClassification): string[] {
    return MINIMAL_TOOL_SETS[classification.category] ?? MINIMAL_TOOL_SETS.full_toolset;
  }

  /**
   * Handles a tool call request. If the tool is in the registry but not yet
   * injected, returns its full definition for injection. Tracks failures
   * and escalates to full toolset after repeated failures.
   */
  handleRequest(
    sessionId: string,
    toolCallName: string,
    allTools: ToolDefinition[],
  ): InjectorResult {
    this.evictStale();

    let state = this.sessions.get(sessionId);
    if (!state) {
      state = {
        injectedTools: new Set(),
        failureCount: 0,
        escalated: false,
        lastActivity: Date.now(),
      };
      this.sessions.set(sessionId, state);
    }

    state.lastActivity = Date.now();

    // If already escalated, return the tool if it exists
    if (state.escalated) {
      const tool = allTools.find((t) => t.name === toolCallName) ?? null;
      if (tool) {
        state.injectedTools.add(toolCallName);
      }
      return { tool, escalated: true, state };
    }

    // Check if tool exists in the registry
    const tool = allTools.find((t) => t.name === toolCallName) ?? null;

    if (!tool) {
      // Tool not found in registry at all
      state.failureCount++;
      if (state.failureCount >= ESCALATION_THRESHOLD) {
        state.escalated = true;
      }
      return { tool: null, escalated: state.escalated, state };
    }

    // Tool found — inject it
    state.injectedTools.add(toolCallName);
    state.failureCount = 0; // Reset failure count on success

    return { tool, escalated: false, state };
  }

  /**
   * Checks if a session has been escalated to full toolset.
   */
  isEscalated(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.escalated ?? false;
  }

  /**
   * Returns the set of tools injected so far for a session.
   */
  getInjectedTools(sessionId: string): string[] {
    const state = this.sessions.get(sessionId);
    return state ? Array.from(state.injectedTools) : [];
  }

  /**
   * Starts a new turn for a session, resetting turn-specific state.
   */
  startNewTurn(sessionId: string): void {
    const state = this.sessions.get(sessionId);
    if (state) {
      state.injectedTools.clear();
      state.failureCount = 0;
      state.escalated = false;
      state.lastActivity = Date.now();
    }
  }

  /**
   * Returns the current state for a session, or null if no state exists.
   */
  getSessionState(sessionId: string): InjectorState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Clears state for a specific session.
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clears all session state.
   */
  clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Returns the number of active sessions.
   */
  getActiveSessionCount(): number {
    this.evictStale();
    return this.sessions.size;
  }

  /**
   * Evicts stale sessions that haven't been accessed within the TTL.
   */
  private evictStale(): void {
    const now = Date.now();
    for (const [sessionId, state] of this.sessions) {
      if (now - state.lastActivity > this.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
