import * as crypto from 'node:crypto';
import { SessionPersistenceService, type StoredSession, type StoredMessage } from '../../storage/SessionPersistenceService.js';

export interface SessionTurnSummary {
  readonly turnIndex: number;
  readonly messageId: string;
  readonly role: 'user' | 'assistant' | 'system' | 'tool';
  readonly preview: string;
  readonly timestamp: number;
  readonly toolCallsCount: number;
}

export interface SessionTimeline {
  readonly sessionId: string;
  readonly title: string;
  readonly totalTurns: number;
  readonly turns: readonly SessionTurnSummary[];
}

export interface ForkFromTurnResult {
  readonly success: boolean;
  readonly newSessionId: string;
  readonly newTitle: string;
  readonly parentSessionId: string;
  readonly forkedAtTurnIndex: number;
  readonly retainedTurns: number;
  readonly error?: string;
}

export class SessionTimelineNavigatorService {
  public getTimeline(sessionId: string): SessionTimeline | null {
    const session = SessionPersistenceService.getSession(sessionId);
    if (!session) {
      return null;
    }

    const messages = session.messages || [];
    const turns: SessionTurnSummary[] = messages.map((msg: StoredMessage, idx: number) => {
      const toolCalls = Array.isArray((msg as { toolCalls?: unknown[] }).toolCalls)
        ? (msg as { toolCalls?: unknown[] }).toolCalls!.length
        : 0;

      const text = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      const cleanText = text.replace(/\s+/g, ' ').trim();
      const preview = cleanText.length > 80 ? `${cleanText.slice(0, 77)}...` : cleanText;

      return {
        turnIndex: idx + 1,
        messageId: msg.id || `msg-${idx + 1}`,
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        preview,
        timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
        toolCallsCount: toolCalls,
      };
    });

    return {
      sessionId: session.id,
      title: session.title || 'Untitled Session',
      totalTurns: turns.length,
      turns,
    };
  }

  public forkFromTurn(
    sessionId: string,
    targetTurnIndex: number,
    customTitle?: string
  ): ForkFromTurnResult {
    const session = SessionPersistenceService.getSession(sessionId);
    if (!session) {
      return {
        success: false,
        newSessionId: '',
        newTitle: '',
        parentSessionId: sessionId,
        forkedAtTurnIndex: targetTurnIndex,
        retainedTurns: 0,
        error: `Session '${sessionId}' not found.`,
      };
    }

    const messages = session.messages || [];
    if (targetTurnIndex < 1 || targetTurnIndex > messages.length) {
      return {
        success: false,
        newSessionId: '',
        newTitle: '',
        parentSessionId: sessionId,
        forkedAtTurnIndex: targetTurnIndex,
        retainedTurns: 0,
        error: `Turn index ${targetTurnIndex} is out of bounds (session has ${messages.length} turns).`,
      };
    }

    const truncatedMessages = messages.slice(0, targetTurnIndex);
    const newSessionId = `ses_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newTitle = customTitle || `${session.title || 'Session'} (fork @ turn ${targetTurnIndex})`;

    const forkedSession: StoredSession = {
      ...session,
      id: newSessionId,
      title: newTitle,
      parentId: session.id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: truncatedMessages,
    };

    SessionPersistenceService.saveSession(forkedSession);

    return {
      success: true,
      newSessionId,
      newTitle,
      parentSessionId: session.id,
      forkedAtTurnIndex: targetTurnIndex,
      retainedTurns: truncatedMessages.length,
    };
  }

  public formatTimelineForCli(timeline: SessionTimeline): string {
    const lines: string[] = [];
    lines.push(`\x1b[36m=== Session Timeline: ${timeline.title} (${timeline.sessionId}) ===\x1b[0m`);
    lines.push(`\x1b[2mTotal turns: ${timeline.totalTurns}\x1b[0m\n`);

    for (const turn of timeline.turns) {
      const roleColor = turn.role === 'user'
        ? '\x1b[32m'
        : turn.role === 'assistant'
        ? '\x1b[34m'
        : '\x1b[33m';

      const roleBadge = `${roleColor}[${turn.role.toUpperCase()}]\x1b[0m`;
      const toolsBadge = turn.toolCallsCount > 0 ? ` \x1b[2m(${turn.toolCallsCount} tools)\x1b[0m` : '';

      lines.push(`  \x1b[1m#${turn.turnIndex}\x1b[0m ${roleBadge} ${turn.preview}${toolsBadge}`);
    }

    lines.push(`\n\x1b[2mUse '/fork --turn <N>' to branch from any turn.\x1b[0m`);
    return lines.join('\n');
  }
}
