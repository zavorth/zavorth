/**
 * ToolUsageTracker — tracks tool usage patterns per session for predictive loading.
 *
 * Maintains a sliding window of tool call sequences. Uses co-occurrence analysis
 * to predict which tools are likely to be needed alongside the current intent-based
 * selection. No persistence — rebuilds naturally from conversation flow.
 */

export interface ToolUsageTurn {
  /** Tool names used in this turn. */
  toolNames: string[];
  /** Timestamp of the turn. */
  timestamp: number;
}

export interface PredictionResult {
  /** Predicted tool names not already in the current set. */
  predictedTools: string[];
  /** Confidence scores for each prediction (0-1). */
  confidenceScores: Map<string, number>;
}

interface SessionHistory {
  turns: ToolUsageTurn[];
  lastAccess: number;
}

/** Maximum turns kept per session in the sliding window. */
const MAX_TURNS_PER_SESSION = 100;
/** Minimum turns required before making predictions. */
const MIN_TURNS_FOR_PREDICTION = 3;
/** Maximum number of predicted tools per turn. */
const MAX_PREDICTIONS = 5;
/** Co-occurrence threshold: tool must co-occur in at least this fraction of turns. */
const CO_OCCURRENCE_THRESHOLD = 0.3;
/** Session TTL: 2 hours. */
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class ToolUsageTracker {
  private readonly sessions: Map<string, SessionHistory> = new Map();
  private readonly sessionTtlMs: number;

  constructor(options?: { sessionTtlMs?: number }) {
    this.sessionTtlMs = options?.sessionTtlMs ?? SESSION_TTL_MS;
  }

  /**
   * Records a turn's tool usage for a session.
   */
  recordTurn(sessionId: string, toolNames: string[]): void {
    this.evictStale();

    let session = this.sessions.get(sessionId);
    if (!session) {
      session = { turns: [], lastAccess: Date.now() };
      this.sessions.set(sessionId, session);
    }

    session.turns.push({
      toolNames: [...toolNames],
      timestamp: Date.now(),
    });

    // Enforce sliding window
    if (session.turns.length > MAX_TURNS_PER_SESSION) {
      session.turns = session.turns.slice(-MAX_TURNS_PER_SESSION);
    }

    session.lastAccess = Date.now();
  }

  /**
   * Predicts which tools are likely needed alongside the current intent-based tools.
   * Returns tools not already in the current set, capped at MAX_PREDICTIONS.
   */
  predictNextTools(sessionId: string, currentIntentTools: string[]): PredictionResult {
    this.evictStale();

    const session = this.sessions.get(sessionId);
    const result: PredictionResult = {
      predictedTools: [],
      confidenceScores: new Map(),
    };

    if (!session || session.turns.length < MIN_TURNS_FOR_PREDICTION) {
      return result;
    }

    const currentSet = new Set(currentIntentTools);
    const coOccurrence = this.buildCoOccurrenceMatrix(session.turns);

    // For each current intent tool, find co-occurring tools
    const candidateScores = new Map<string, number>();

    for (const toolName of currentIntentTools) {
      const coTools = coOccurrence.get(toolName);
      if (!coTools) continue;

      for (const [coTool, count] of coTools) {
        if (currentSet.has(coTool)) continue; // Already in intent set

        const confidence = count / session.turns.length;
        if (confidence < CO_OCCURRENCE_THRESHOLD) continue;

        const existing = candidateScores.get(coTool) ?? 0;
        candidateScores.set(coTool, Math.max(existing, confidence));
      }
    }

    // Sort by confidence and cap at MAX_PREDICTIONS
    const sorted = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_PREDICTIONS);

    for (const [toolName, confidence] of sorted) {
      result.predictedTools.push(toolName);
      result.confidenceScores.set(toolName, Math.round(confidence * 100) / 100);
    }

    return result;
  }

  /**
   * Returns the number of turns recorded for a session.
   */
  getSessionTurnCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.turns.length ?? 0;
  }

  /**
   * Returns the number of active sessions.
   */
  getActiveSessionCount(): number {
    this.evictStale();
    return this.sessions.size;
  }

  /**
   * Clears history for a specific session.
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /**
   * Clears all session history.
   */
  clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Builds a co-occurrence matrix from turn history.
   * For each tool, tracks how many turns it co-occurred with each other tool.
   */
  private buildCoOccurrenceMatrix(
    turns: ToolUsageTurn[],
  ): Map<string, Map<string, number>> {
    const matrix = new Map<string, Map<string, number>>();

    for (const turn of turns) {
      const uniqueTools = new Set(turn.toolNames);

      for (const toolA of uniqueTools) {
        let row = matrix.get(toolA);
        if (!row) {
          row = new Map();
          matrix.set(toolA, row);
        }

        for (const toolB of uniqueTools) {
          if (toolA === toolB) continue;
          row.set(toolB, (row.get(toolB) ?? 0) + 1);
        }
      }
    }

    return matrix;
  }

  /**
   * Evicts stale sessions that haven't been accessed within the TTL.
   */
  private evictStale(): void {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastAccess > this.sessionTtlMs) {
        this.sessions.delete(sessionId);
      }
    }
  }
}
