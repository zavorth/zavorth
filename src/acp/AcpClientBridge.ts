/**
 * ACP Client Bridge — Universal Client Adapter for Desktop App, Dashboard, and Web Interfaces.
 * Unifies session management, live streaming, tool approval, and model catalogs.
 */

import { SessionPersistenceService, type SessionRecord } from '../storage/SessionPersistenceService.js';
import { DynamicModelCatalogService } from '../services/providers/catalog/DynamicModelCatalogService.js';
import { DynamicCostEstimator } from '../services/pricing/DynamicCostEstimator.js';
import { ProviderFactory } from '../providers/ProviderFactory.js';

export interface AcpClientStreamEvent {
  type: 'thought' | 'chunk' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content?: string;
  toolName?: string;
  durationMs?: number;
  error?: string;
}

export interface AcpClientPromptResult {
  sessionId: string;
  response: string;
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache_read: number;
    cache_write: number;
  };
}

export interface IAcpClientTransport {
  send(method: string, params: Record<string, unknown>): Promise<unknown>;
  onEvent(handler: (event: AcpClientStreamEvent) => void): () => void;
}

export class AcpClientBridge {
  private activeSessionId: string | null = null;
  private eventHandlers: Set<(event: AcpClientStreamEvent) => void> = new Set();

  /**
   * Lists all available sessions from the unified persistent store.
   */
  async listSessions(limit = 50): Promise<SessionRecord[]> {
    return SessionPersistenceService.listSessions(limit);
  }

  /**
   * Retrieves or creates an active session.
   */
  async getOrCreateSession(title = 'New Desktop Session', model = 'Claude 3.7 Sonnet'): Promise<SessionRecord> {
    if (this.activeSessionId) {
      const existing = SessionPersistenceService.getSession(this.activeSessionId);
      if (existing) return existing;
    }

    const created = SessionPersistenceService.createSession({ title, model });
    this.activeSessionId = created.id;
    return created;
  }

  /**
   * Switches active session ID.
   */
  setActiveSession(sessionId: string): SessionRecord | null {
    const session = SessionPersistenceService.getSession(sessionId);
    if (session) {
      this.activeSessionId = session.id;
      return session;
    }
    return null;
  }

  /**
   * Returns current active session.
   */
  getActiveSession(): SessionRecord | null {
    if (!this.activeSessionId) return null;
    return SessionPersistenceService.getSession(this.activeSessionId);
  }

  /**
   * Forks the active session into a new branch.
   */
  async forkSession(sessionId: string, newTitle?: string): Promise<SessionRecord | null> {
    const forked = SessionPersistenceService.forkSession(sessionId, newTitle);
    if (forked) {
      this.activeSessionId = forked.id;
    }
    return forked;
  }

  /**
   * Returns dynamic model catalog grouped by provider.
   */
  getModelCatalog(filter?: string) {
    return DynamicModelCatalogService.listProviders(filter);
  }

  /**
   * Registers a stream listener for real-time thoughts and tool events.
   */
  onStreamEvent(handler: (event: AcpClientStreamEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  protected emitEvent(event: AcpClientStreamEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Safe dispatch
      }
    }
  }

  /**
   * Dispatches a prompt turn to the agent session and records cost.
   */
  async sendPrompt(
    sessionId: string,
    prompt: string,
    onChunk?: (text: string) => void
  ): Promise<AcpClientPromptResult> {
    const session = SessionPersistenceService.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.emitEvent({ type: 'thought', content: 'Analyzing request and inspecting project context...' });

    let responseText: string;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const provider = ProviderFactory.create(session.model);
      const result = await provider.chat([
        { role: 'user', content: prompt },
      ]);

      responseText = result.content || '';
      inputTokens = result.tokens?.input ?? Math.max(10, prompt.length);
      outputTokens = result.tokens?.output ?? Math.max(20, responseText.length);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitEvent({ type: 'error', error: message });
      throw new Error(`Provider invocation failed: ${message}`);
    }

    if (onChunk) {
      onChunk(responseText);
    }
    this.emitEvent({ type: 'chunk', content: responseText });

    const cost = DynamicCostEstimator.estimateCost(session.model, {
      inputTokens,
      outputTokens,
      reasoningTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    const updatedTokens = {
      input: session.tokens.input + inputTokens,
      output: session.tokens.output + outputTokens,
      reasoning: session.tokens.reasoning,
      cache_read: session.tokens.cache_read,
      cache_write: session.tokens.cache_write,
    };

    SessionPersistenceService.updateSession(sessionId, {
      cost: session.cost + cost,
      tokens: updatedTokens,
      messagesCount: session.messagesCount + 2,
    });

    this.emitEvent({ type: 'done' });

    return {
      sessionId,
      response: responseText,
      cost,
      tokens: updatedTokens,
    };
  }
}
