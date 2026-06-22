import fs from 'node:fs';
import path from 'node:path';
import DatabaseLib, { type Database as SQLiteDatabase } from 'better-sqlite3';

export interface KanbanBoard {
  id: string;
  name: string;
  columns: string[];
  created_at: string;
  updated_at: string;
}

interface DBKanbanBoard {
  id: string;
  name: string;
  columns: string;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  board_id: string;
  title: string;
  description: string;
  column_name: string;
  assignee: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
  blocked_by: string | null;
  blocked_reason: string | null;
  auto_blocked: boolean;
  subtasks: Array<{ title: string; done: boolean }>;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface DispatchResult {
  dispatched: string[];
  blocked: string[];
  skipped: string[];
  errors: string[];
  dispatched_at: string;
}

export interface DispatchLog {
  id: string;
  board_id: string;
  card_id: string;
  action: 'dispatch' | 'block' | 'unblock' | 'move' | 'complete';
  from_column: string | null;
  to_column: string | null;
  reason: string;
  timestamp: string;
}

export class KanbanSQLiteDispatcherService {
  private db: SQLiteDatabase;
  private readonly dbPath: string;

  constructor(options?: { storageDir?: string; dbPath?: string }) {
    const storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'kanban');
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    this.dbPath = options?.dbPath || path.join(storageDir, 'kanban.sqlite');
    this.db = new DatabaseLib(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS boards (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        columns TEXT NOT NULL DEFAULT '["backlog","todo","in_progress","review","done"]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        column_name TEXT NOT NULL,
        assignee TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
        labels TEXT DEFAULT '[]',
        blocked_by TEXT REFERENCES cards(id) ON DELETE SET NULL,
        blocked_reason TEXT,
        auto_blocked INTEGER NOT NULL DEFAULT 0,
        subtasks TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT,
        metadata TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS dispatch_log (
        id TEXT PRIMARY KEY,
        board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        from_column TEXT,
        to_column TEXT,
        reason TEXT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_cards_board ON cards(board_id);
      CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(board_id, column_name);
      CREATE INDEX IF NOT EXISTS idx_cards_priority ON cards(board_id, priority);
      CREATE INDEX IF NOT EXISTS idx_cards_assignee ON cards(assignee);
      CREATE INDEX IF NOT EXISTS idx_cards_blocked ON cards(blocked_by);
      CREATE INDEX IF NOT EXISTS idx_dispatch_board ON dispatch_log(board_id);
      CREATE INDEX IF NOT EXISTS idx_dispatch_card ON dispatch_log(card_id);
    `);
  }

  public createBoard(name: string, columns?: string[]): string {
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const existing = this.db.prepare('SELECT id FROM boards WHERE id = ?').get(id);
    if (existing) return `Erro: quadro "${id}" ja existe.`;

    const cols = columns || ['backlog', 'todo', 'in_progress', 'review', 'done'];
    this.db.prepare('INSERT INTO boards (id, name, columns) VALUES (?, ?, ?)').run(id, name, JSON.stringify(cols));
    return `Quadro "${name}" criado (SQLite). Colunas: ${cols.join(', ')}`;
  }

  public deleteBoard(boardId: string): string {
    const existing = this.db.prepare('SELECT id FROM boards WHERE id = ?').get(boardId);
    if (!existing) return `Erro: quadro "${boardId}" nao encontrado.`;
    this.db.prepare('DELETE FROM boards WHERE id = ?').run(boardId);
    return `Quadro "${boardId}" deletado.`;
  }

  public addCard(boardId: string, title: string, options?: {
    description?: string;
    column?: string;
    priority?: KanbanCard['priority'];
    assignee?: string;
    labels?: string[];
    blocked_by?: string;
    metadata?: Record<string, unknown>;
  }): string {
    const board = this.getBoardData(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const columns = board.columns;
    const column = options?.column || columns[0];
    if (!columns.includes(column)) {
      return `Erro: coluna "${column}" invalida. Use: ${columns.join(', ')}`;
    }

    const cardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare(`
      INSERT INTO cards (id, board_id, title, description, column_name, assignee, priority, labels, blocked_by, subtasks, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cardId,
      boardId,
      title,
      options?.description || '',
      column,
      options?.assignee || null,
      options?.priority || 'medium',
      JSON.stringify(options?.labels || []),
      options?.blocked_by || null,
      '[]',
      JSON.stringify(options?.metadata || {}),
    );

    this.logDispatch(boardId, cardId, 'move', null, column, 'Card criado');
    return `Cartao "${title}" adicionado a "${column}" no quadro "${boardId}". ID: ${cardId}`;
  }

  public moveCard(boardId: string, cardId: string, targetColumn: string, reason?: string): string {
    const board = this.getBoardData(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const card = this.db.prepare('SELECT * FROM cards WHERE id = ? AND board_id = ?').get(cardId, boardId) as KanbanCard | undefined;
    if (!card) return `Erro: cartao "${cardId}" nao encontrado no quadro "${boardId}".`;

    if (card.blocked_by) {
      const blocker = this.db.prepare('SELECT id, column_name, title FROM cards WHERE id = ?').get(card.blocked_by) as { id: string; column_name: string; title: string } | undefined;
      if (blocker && blocker.column_name !== 'done') {
        return `Erro: cartao "${cardId}" bloqueado por "${card.blocked_by}" (${blocker.title}).`;
      }
      this.db.prepare('UPDATE cards SET blocked_by = NULL, blocked_reason = NULL, auto_blocked = 0 WHERE id = ?').run(cardId);
    }

    const columns = board.columns;
    if (!columns.includes(targetColumn)) {
      return `Erro: coluna "${targetColumn}" invalida. Use: ${columns.join(', ')}`;
    }

    const oldColumn = card.column_name;
    const now = new Date().toISOString();

    if (targetColumn === 'done') {
      this.db.prepare('UPDATE cards SET column_name = ?, updated_at = ?, completed_at = ? WHERE id = ?')
        .run(targetColumn, now, now, cardId);
      this.autoUnblock(boardId, cardId);
    } else {
      this.db.prepare('UPDATE cards SET column_name = ?, updated_at = ? WHERE id = ?')
        .run(targetColumn, now, cardId);
    }

    this.logDispatch(boardId, cardId, 'move', oldColumn, targetColumn, reason || 'Movido manualmente');
    return `Cartao "${card.title}" movido de "${oldColumn}" para "${targetColumn}".`;
  }

  public blockCard(boardId: string, cardId: string, blockedBy: string, reason?: string): string {
    const card = this.db.prepare('SELECT id, title FROM cards WHERE id = ? AND board_id = ?').get(cardId, boardId) as { id: string; title: string } | undefined;
    if (!card) return `Erro: cartao "${cardId}" nao encontrado.`;

    const now = new Date().toISOString();
    this.db.prepare('UPDATE cards SET blocked_by = ?, blocked_reason = ?, auto_blocked = 1, updated_at = ? WHERE id = ?')
      .run(blockedBy, reason || `Bloqueado por ${blockedBy}`, now, cardId);

    this.logDispatch(boardId, cardId, 'block', null, null, reason || `Bloqueado por ${blockedBy}`);
    return `Cartao "${card.title}" bloqueado por "${blockedBy}".`;
  }

  public unblockCard(boardId: string, cardId: string): string {
    const card = this.db.prepare('SELECT id, title FROM cards WHERE id = ? AND board_id = ?').get(cardId, boardId) as { id: string; title: string } | undefined;
    if (!card) return `Erro: cartao "${cardId}" nao encontrado.`;

    const now = new Date().toISOString();
    this.db.prepare('UPDATE cards SET blocked_by = NULL, blocked_reason = NULL, auto_blocked = 0, updated_at = ? WHERE id = ?')
      .run(now, cardId);

    this.logDispatch(boardId, cardId, 'unblock', null, null, 'Desbloqueado manualmente');
    return `Cartao "${card.title}" desbloqueado.`;
  }

  public dispatch(boardId: string, options?: {
    max_concurrent?: number;
    assignee_filter?: string;
    priority_filter?: KanbanCard['priority'];
    column_from?: string;
  }): DispatchResult {
    const board = this.getBoardData(boardId);
    if (!board) return { dispatched: [], blocked: [], skipped: [], errors: [`Quadro "${boardId}" nao encontrado`], dispatched_at: new Date().toISOString() };

    const columns = board.columns;
    const fromColumn = options?.column_from || 'todo';
    const toColumn = columns[columns.indexOf(fromColumn) + 1] || 'in_progress';
    const maxConcurrent = options?.max_concurrent || 5;

    const inProgressCount = (this.db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ? AND column_name = ?').get(boardId, toColumn) as { c: number }).c;
    const availableSlots = Math.max(0, maxConcurrent - inProgressCount);

    let query = 'SELECT * FROM cards WHERE board_id = ? AND column_name = ?';
    const params: unknown[] = [boardId, fromColumn];

    if (options?.assignee_filter) {
      query += ' AND assignee = ?';
      params.push(options.assignee_filter);
    }
    if (options?.priority_filter) {
      query += ' AND priority = ?';
      params.push(options.priority_filter);
    }

    query += ` ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END`;

    const todoCards = this.db.prepare(query).all(...params) as KanbanCard[];
    const result: DispatchResult = { dispatched: [], blocked: [], skipped: [], errors: [], dispatched_at: new Date().toISOString() };

    let dispatched = 0;
    const now = new Date().toISOString();

    for (const card of todoCards) {
      if (dispatched >= availableSlots) {
        result.skipped.push(card.id);
        continue;
      }

      if (card.blocked_by) {
        const blocker = this.db.prepare('SELECT column_name FROM cards WHERE id = ?').get(card.blocked_by) as { column_name: string } | undefined;
        if (blocker && blocker.column_name !== 'done') {
          result.blocked.push(card.id);
          continue;
        }
        this.db.prepare('UPDATE cards SET blocked_by = NULL, blocked_reason = NULL, auto_blocked = 0 WHERE id = ?').run(card.id);
      }

      this.db.prepare('UPDATE cards SET column_name = ?, updated_at = ? WHERE id = ?').run(toColumn, now, card.id);
      this.logDispatch(boardId, card.id, 'dispatch', fromColumn, toColumn, `Dispatched por prioridade (${card.priority})`);
      result.dispatched.push(card.id);
      dispatched++;
    }

    return result;
  }

  public getBoard(boardId: string): string {
    const board = this.getBoardData(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const columns = board.columns;
    const rawCards = this.db.prepare("SELECT * FROM cards WHERE board_id = ? ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END").all(boardId) as Array<Record<string, unknown>>;
    const cards: KanbanCard[] = rawCards.map((c) => ({
      ...c,
      labels: typeof c.labels === 'string' ? JSON.parse(c.labels) : (c.labels || []),
      subtasks: typeof c.subtasks === 'string' ? JSON.parse(c.subtasks) : (c.subtasks || []),
      metadata: typeof c.metadata === 'string' ? JSON.parse(c.metadata) : (c.metadata || {}),
      auto_blocked: Boolean(c.auto_blocked),
    })) as KanbanCard[];

    const lines: string[] = [
      `Quadro: ${board.name} (${board.id}) [SQLite]`,
      `Colunas: ${columns.join(' → ')}`,
      `Cartoes: ${cards.length}`,
      '',
    ];

    for (const col of columns) {
      const colCards = cards.filter((c) => c.column_name === col);
      if (colCards.length === 0) continue;

      const colIcon: Record<string, string> = { backlog: '📋', todo: '📝', in_progress: '🔄', review: '🔍', done: '✅' };
      lines.push(`${colIcon[col] || '📄'} [${col}] (${colCards.length})`);

      for (const card of colCards) {
        const priorityIcon: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
        const blocked = card.blocked_by ? ' 🚫' : '';
        const assignee = card.assignee ? ` @${card.assignee}` : '';
        const subs = Array.isArray(card.subtasks) ? card.subtasks : [];
        const subtasks = subs.length > 0
          ? ` [${subs.filter((s: { done: boolean }) => s.done).length}/${subs.length}]`
          : '';
        lines.push(`  ${priorityIcon[card.priority] || '⚪'} ${card.id}: ${card.title}${blocked}${assignee}${subtasks}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  public listBoards(): string {
    const rawBoards = this.db.prepare('SELECT * FROM boards').all() as DBKanbanBoard[];
    if (rawBoards.length === 0) return 'Nenhum quadro.';
    const boards = rawBoards.map((b) => this.mapBoard(b));

    const lines: string[] = ['Quadros [SQLite]:'];
    for (const board of boards) {
      const cardCount = (this.db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(board.id) as { c: number }).c;
      const columns = board.columns;
      const byCol: Record<string, number> = {};
      for (const col of columns) byCol[col] = 0;
      const colCounts = this.db.prepare('SELECT column_name, COUNT(*) as c FROM cards WHERE board_id = ? GROUP BY column_name').all(board.id) as Array<{ column_name: string; c: number }>;
      for (const row of colCounts) byCol[row.column_name] = row.c;

      const summary = columns.map((c) => `${c}:${byCol[c] || 0}`).join(' ');
      lines.push(`  ${board.id}: ${board.name} (${cardCount} cartoes) — ${summary}`);
    }
    return lines.join('\n');
  }

  public getStats(boardId?: string): string {
    if (boardId) {
      const board = this.getBoardData(boardId);
      if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

      const total = (this.db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ?').get(boardId) as { c: number }).c;
      const blocked = (this.db.prepare('SELECT COUNT(*) as c FROM cards WHERE board_id = ? AND blocked_by IS NOT NULL').get(boardId) as { c: number }).c;
      const byPriority = this.db.prepare('SELECT priority, COUNT(*) as c FROM cards WHERE board_id = ? GROUP BY priority').all(boardId) as Array<{ priority: string; c: number }>;
      const byColumn = this.db.prepare('SELECT column_name, COUNT(*) as c FROM cards WHERE board_id = ? GROUP BY column_name').all(boardId) as Array<{ column_name: string; c: number }>;
      const dispatchCount = (this.db.prepare('SELECT COUNT(*) as c FROM dispatch_log WHERE board_id = ?').get(boardId) as { c: number }).c;

      return [
        `Estatisticas do quadro "${board.name}" [SQLite]:`,
        `  Total: ${total} cartoes`,
        `  Bloqueados: ${blocked}`,
        `  Dispatches: ${dispatchCount}`,
        '  Por prioridade: ' + byPriority.map((r) => `${r.priority}:${r.c}`).join(' '),
        '  Por coluna: ' + byColumn.map((r) => `${r.column_name}:${r.c}`).join(' '),
      ].join('\n');
    }

    const totalBoards = (this.db.prepare('SELECT COUNT(*) as c FROM boards').get() as { c: number }).c;
    const totalCards = (this.db.prepare('SELECT COUNT(*) as c FROM cards').get() as { c: number }).c;
    const totalDispatches = (this.db.prepare('SELECT COUNT(*) as c FROM dispatch_log').get() as { c: number }).c;
    return `Total [SQLite]: ${totalBoards} quadros, ${totalCards} cartoes, ${totalDispatches} dispatches.`;
  }

  public getDispatchLog(boardId: string, limit: number = 20): string {
    const logs = this.db.prepare('SELECT * FROM dispatch_log WHERE board_id = ? ORDER BY timestamp DESC LIMIT ?').all(boardId, limit) as DispatchLog[];
    if (logs.length === 0) return 'Nenhum dispatch log.';

    const lines: string[] = [`Dispatch Log (${logs.length} entradas):`];
    for (const log of logs) {
      const icon: Record<string, string> = { dispatch: '🚀', block: '🚫', unblock: '🔓', move: '➡️', complete: '✅' };
      const colInfo = log.from_column && log.to_column ? ` ${log.from_column}→${log.to_column}` : '';
      lines.push(`  ${icon[log.action] || '📝'} [${log.timestamp}] ${log.card_id}${colInfo} — ${log.reason}`);
    }
    return lines.join('\n');
  }

  public moveCardsBulk(boardId: string, cardIds: string[], targetColumn: string): string {
    const board = this.getBoardData(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const columns = board.columns;
    if (!columns.includes(targetColumn)) return `Erro: coluna "${targetColumn}" invalida.`;

    const now = new Date().toISOString();
    let moved = 0;

    const moveStmt = this.db.prepare('UPDATE cards SET column_name = ?, updated_at = ? WHERE id = ? AND board_id = ?');
    const moveMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        const result = moveStmt.run(targetColumn, now, id, boardId);
        if (result.changes > 0) {
          this.logDispatch(boardId, id, 'move', null, targetColumn, 'Move em massa');
          moved++;
        }
      }
    });
    moveMany(cardIds);

    return `${moved} cartao(oes) movido(s) para "${targetColumn}".`;
  }

  public searchCards(boardId: string, query: string): string {
    const cards = this.db.prepare(
      "SELECT * FROM cards WHERE board_id = ? AND (title LIKE ? OR description LIKE ? OR assignee LIKE ?) ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END"
    ).all(boardId, `%${query}%`, `%${query}%`, `%${query}%`) as KanbanCard[];

    if (cards.length === 0) return `Nenhum cartao encontrado para "${query}".`;

    const lines: string[] = [`Resultados para "${query}" (${cards.length}):`];
    for (const card of cards) {
      const priorityIcon: Record<string, string> = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' };
      lines.push(`  ${priorityIcon[card.priority]} [${card.column_name}] ${card.id}: ${card.title}`);
    }
    return lines.join('\n');
  }

  public close(): void {
    this.db.close();
  }

  private getBoardData(boardId: string): KanbanBoard | null {
    const raw = this.db.prepare('SELECT * FROM boards WHERE id = ?').get(boardId) as DBKanbanBoard | null;
    if (!raw) return null;
    return this.mapBoard(raw);
  }

  private mapBoard(raw: DBKanbanBoard): KanbanBoard {
    return {
      ...raw,
      columns: typeof raw.columns === 'string' ? JSON.parse(raw.columns) : raw.columns,
    };
  }

  private autoUnblock(boardId: string, completedCardId: string): void {
    const now = new Date().toISOString();
    const blocked = this.db.prepare('SELECT id FROM cards WHERE board_id = ? AND blocked_by = ?').all(boardId, completedCardId) as Array<{ id: string }>;
    for (const card of blocked) {
      this.db.prepare('UPDATE cards SET blocked_by = NULL, blocked_reason = NULL, auto_blocked = 0, updated_at = ? WHERE id = ?').run(now, card.id);
      this.logDispatch(boardId, card.id, 'unblock', null, null, `Desbloqueado automaticamente (cartao ${completedCardId} completado)`);
    }
  }

  private logDispatch(boardId: string, cardId: string, action: string, fromColumn: string | null, toColumn: string | null, reason: string): void {
    const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db.prepare('INSERT INTO dispatch_log (id, board_id, card_id, action, from_column, to_column, reason) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, boardId, cardId, action, fromColumn, toColumn, reason);
  }
}
