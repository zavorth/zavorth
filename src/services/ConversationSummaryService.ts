import { config } from '../config/index.js';
import { Database } from '../storage/Database.js';

type ConversationTurn = {
  id?: number;
  user_id: string;
  chat_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
};

type ConversationSummaryRow = {
  user_id: string;
  chat_id: string;
  summary: string;
  updated_at: string;
};

export class ConversationSummaryService {
  private db!: Database;
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.db = await Database.getInstance();
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversation_turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversation_summaries (
        user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, chat_id)
      )
    `);
    this.initialized = true;
  }

  public async recordExchange(
    userId: string,
    chatId: string,
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    if (!config.conversationSummaryEnabled) {
      return;
    }

    await this.init();
    await this.insertTurn({ user_id: userId, chat_id: chatId, role: 'user', content: userMessage });
    await this.insertTurn({ user_id: userId, chat_id: chatId, role: 'assistant', content: assistantMessage });
    await this.compactIfNeeded(userId, chatId);
  }

  public async getConversationContext(userId: string, chatId: string): Promise<string> {
    if (!config.conversationSummaryEnabled) {
      return '';
    }

    await this.init();
    const summaryRow = this.db.get<ConversationSummaryRow>(
      'SELECT * FROM conversation_summaries WHERE user_id = - AND chat_id = ...',
      [userId, chatId],
    );
    const recentTurns = this.getRecentTurns(userId, chatId, config.conversationSummaryKeepTurns);

    const sections: string[] = [];
    if (summaryRow?.summary) {
      sections.push('RESUMO RECURSIVO DA CONVERSA:');
      sections.push(summaryRow.summary);
    }

    if (recentTurns.length > 0) {
      sections.push('TROCAs RECENTES:');
      sections.push(
        recentTurns
          .map((turn) => `${turn.role === 'user' ? 'User' : 'Zavorth'}: ${turn.content}`)
          .join('\n'),
      );
    }

    return sections.length > 0 ? `\n\n${sections.join('\n')}` : '';
  }

  private async insertTurn(turn: ConversationTurn): Promise<void> {
    const normalizedContent = String(turn.content || '').trim();
    if (!normalizedContent) {
      return;
    }

    this.db.run(
      'INSERT INTO conversation_turns (user_id, chat_id, role, content, created_at) VALUES (..., ..., ..., ..., ...)',
      [turn.user_id, turn.chat_id, turn.role, normalizedContent, new Date().toISOString()],
    );
  }

  private async compactIfNeeded(userId: string, chatId: string): Promise<void> {
    const turns = this.db.all<ConversationTurn>(
      'SELECT * FROM conversation_turns WHERE user_id = - AND chat_id = - ORDER BY id ASC',
      [userId, chatId],
    );
    const totalChars = turns.reduce((sum, turn) => sum + String(turn.content || '').length, 0);

    if (
      turns.length <= config.conversationSummaryMaxTurns &&
      totalChars <= config.conversationSummaryMaxChars
    ) {
      return;
    }

    const keepCount = Math.max(2, config.conversationSummaryKeepTurns);
    const turnsToSummarize = turns.slice(0, Math.max(0, turns.length - keepCount));
    if (turnsToSummarize.length === 0) {
      return;
    }

    const existing = this.db.get<ConversationSummaryRow>(
      'SELECT * FROM conversation_summaries WHERE user_id = - AND chat_id = ...',
      [userId, chatId],
    );
    const mergedSummary = this.mergeSummary(existing?.summary || '', turnsToSummarize);

    this.db.run(
      `INSERT OR REPLACE INTO conversation_summaries (user_id, chat_id, summary, updated_at)
       VALUES (..., ..., ..., ...)`,
      [userId, chatId, mergedSummary, new Date().toISOString()],
    );

    const cutoffId = turnsToSummarize[turnsToSummarize.length - 1]?.id || 0;
    if (cutoffId > 0) {
      this.db.run(
        'DELETE FROM conversation_turns WHERE user_id = - AND chat_id = - AND id <= ...',
        [userId, chatId, cutoffId],
      );
    }
  }

  private getRecentTurns(userId: string, chatId: string, limit: number): ConversationTurn[] {
    const rows = this.db.all<ConversationTurn>(
      'SELECT * FROM conversation_turns WHERE user_id = - AND chat_id = - ORDER BY id DESC LIMIT ...',
      [userId, chatId, Math.max(1, limit)],
    );
    return rows.reverse();
  }

  private mergeSummary(existingSummary: string, turns: ConversationTurn[]): string {
    const bullets = turns
      .map((turn) => {
        const normalized = this.normalizeSentence(turn.content);
        if (!normalized) {
          return '';
        }
        return `- ${turn.role === 'user' ? 'User asked' : 'Zavorth respondeu'}: ${normalized}`;
      })
      .filter(Boolean);

    const merged = [String(existingSummary || '').trim(), ...bullets].filter(Boolean).join('\n');
    const lines = merged
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return lines.slice(-12).join('\n');
  }

  private normalizeSentence(value: string): string {
    const normalized = String(value || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
  }
}
