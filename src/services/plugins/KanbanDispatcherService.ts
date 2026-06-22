import fs from 'fs';
import path from 'path';

export interface KanbanBoard {
  id: string;
  name: string;
  columns: string[];
  cards: KanbanCard[];
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  description: string;
  column: string;
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
}

export interface DispatchResult {
  dispatched: string[];
  blocked: string[];
  skipped: string[];
  errors: string[];
}

export class KanbanDispatcherService {
  private readonly storageDir: string;
  private readonly dbPath: string;
  private boards: Map<string, KanbanBoard> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'kanban');
    this.dbPath = path.join(this.storageDir, 'boards.json');
    this.ensureStorageDir();
    this.loadBoards();
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private loadBoards(): void {
    if (!fs.existsSync(this.dbPath)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.dbPath, 'utf-8'));
      const sanitized = this.sanitizeParsedData(data) as Record<string, KanbanBoard>;
      this.boards = new Map(Object.entries(sanitized));
    } catch { /* ignore */ }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(this.dbPath, JSON.stringify(Object.fromEntries(this.boards), null, 2), 'utf-8');
      }
    }, 1000);
  }

  public createBoard(name: string, columns?: string[]): string {
    const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (this.boards.has(id)) return `Erro: quadro "${id}" ja existe.`;

    const board: KanbanBoard = {
      id,
      name,
      columns: columns || ['backlog', 'todo', 'in_progress', 'review', 'done'],
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.boards.set(id, board);
    this.scheduleFlush();
    return `Quadro "${name}" criado. Colunas: ${board.columns.join(', ')}`;
  }

  public addCard(boardId: string, title: string, options?: {
    description?: string;
    column?: string;
    priority?: KanbanCard['priority'];
    assignee?: string;
    labels?: string[];
    blocked_by?: string;
  }): string {
    const board = this.boards.get(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const column = options?.column || board.columns[0];
    if (!board.columns.includes(column)) {
      return `Erro: coluna "${column}" invalida. Use: ${board.columns.join(', ')}`;
    }

    const cardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const card: KanbanCard = {
      id: cardId,
      title,
      description: options?.description || '',
      column,
      assignee: options?.assignee || null,
      priority: options?.priority || 'medium',
      labels: options?.labels || [],
      blocked_by: options?.blocked_by || null,
      blocked_reason: null,
      auto_blocked: false,
      subtasks: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
    };

    board.cards.push(card);
    board.updated_at = new Date().toISOString();
    this.scheduleFlush();

    return `Cartao "${title}" adicionado a "${column}" no quadro "${boardId}". ID: ${cardId}`;
  }

  public moveCard(boardId: string, cardId: string, targetColumn: string): string {
    const board = this.boards.get(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const card = board.cards.find((c) => c.id === cardId);
    if (!card) return `Erro: cartao "${cardId}" nao encontrado.`;

    if (card.blocked_by) {
      const blocker = board.cards.find((c) => c.id === card.blocked_by);
      if (blocker && blocker.column !== 'done') {
        return `Erro: cartao "${cardId}" esta bloqueado por "${card.blocked_by}" (${blocker.title}).`;
      }
      card.blocked_by = null;
      card.blocked_reason = null;
      card.auto_blocked = false;
    }

    if (!board.columns.includes(targetColumn)) {
      return `Erro: coluna "${targetColumn}" invalida. Use: ${board.columns.join(', ')}`;
    }

    const oldColumn = card.column;
    card.column = targetColumn;
    card.updated_at = new Date().toISOString();

    if (targetColumn === 'done') {
      card.completed_at = new Date().toISOString();
      this.autoUnblock(board, cardId);
    }

    board.updated_at = new Date().toISOString();
    this.scheduleFlush();

    return `Cartao "${card.title}" movido de "${oldColumn}" para "${targetColumn}".`;
  }

  public blockCard(boardId: string, cardId: string, blockedBy: string, reason?: string): string {
    const board = this.boards.get(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const card = board.cards.find((c) => c.id === cardId);
    if (!card) return `Erro: cartao "${cardId}" nao encontrado.`;

    card.blocked_by = blockedBy;
    card.blocked_reason = reason || `Bloqueado por ${blockedBy}`;
    card.auto_blocked = true;
    card.updated_at = new Date().toISOString();

    this.scheduleFlush();
    return `Cartao "${card.title}" bloqueado por "${blockedBy}". Motivo: ${card.blocked_reason}`;
  }

  public dispatch(boardId: string, options?: {
    max_concurrent?: number;
    assignee_filter?: string;
    priority_filter?: KanbanCard['priority'];
  }): DispatchResult {
    const board = this.boards.get(boardId);
    if (!board) return { dispatched: [], blocked: [], skipped: [], errors: [`Quadro "${boardId}" nao encontrado`] };

    const maxConcurrent = options?.max_concurrent || 5;
    const result: DispatchResult = { dispatched: [], blocked: [], skipped: [], errors: [] };

    const inProgress = board.cards.filter((c) => c.column === 'in_progress').length;
    const availableSlots = Math.max(0, maxConcurrent - inProgress);

    const todoCards = board.cards
      .filter((c) => c.column === 'todo')
      .filter((c) => !options?.assignee_filter || c.assignee === options.assignee_filter)
      .filter((c) => !options?.priority_filter || c.priority === options.priority_filter)
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      });

    let dispatched = 0;
    for (const card of todoCards) {
      if (dispatched >= availableSlots) {
        result.skipped.push(card.id);
        continue;
      }

      if (card.blocked_by) {
        const blocker = board.cards.find((c) => c.id === card.blocked_by);
        if (blocker && blocker.column !== 'done') {
          result.blocked.push(card.id);
          continue;
        }
        card.blocked_by = null;
        card.blocked_reason = null;
        card.auto_blocked = false;
      }

      card.column = 'in_progress';
      card.updated_at = new Date().toISOString();
      result.dispatched.push(card.id);
      dispatched++;
    }

    board.updated_at = new Date().toISOString();
    this.scheduleFlush();

    return result;
  }

  public getBoard(boardId: string): string {
    const board = this.boards.get(boardId);
    if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

    const lines: string[] = [
      `Quadro: ${board.name} (${board.id})`,
      `Colunas: ${board.columns.join(' → ')}`,
      `Cartoes: ${board.cards.length}`,
      '',
    ];

    for (const col of board.columns) {
      const colCards = board.cards.filter((c) => c.column === col);
      if (colCards.length === 0) continue;

      const colIcon = { backlog: '📋', todo: '📝', in_progress: '🔄', review: '🔍', done: '✅' }[col] || '📄';
      lines.push(`${colIcon} [${col}] (${colCards.length})`);

      for (const card of colCards) {
        const priority = { low: '🟢', medium: '🟡', high: '🟠', critical: '🔴' }[card.priority];
        const blocked = card.blocked_by ? ' 🚫' : '';
        const assignee = card.assignee ? ` @${card.assignee}` : '';
        const subtasks = card.subtasks.length > 0
          ? ` [${card.subtasks.filter((s) => s.done).length}/${card.subtasks.length}]`
          : '';
        lines.push(`  ${priority} ${card.id}: ${card.title}${blocked}${assignee}${subtasks}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  public listBoards(): string {
    if (this.boards.size === 0) return 'Nenhum quadro criado.';

    const lines: string[] = ['Quadros:'];
    for (const [id, board] of this.boards) {
      const byColumn: Record<string, number> = {};
      for (const col of board.columns) byColumn[col] = 0;
      for (const card of board.cards) byColumn[card.column] = (byColumn[card.column] || 0) + 1;

      const summary = board.columns.map((c) => `${c}:${byColumn[c]}`).join(' ');
      lines.push(`  ${id}: ${board.name} (${board.cards.length} cartoes) — ${summary}`);
    }
    return lines.join('\n');
  }

  public getStats(boardId?: string): string {
    if (boardId) {
      const board = this.boards.get(boardId);
      if (!board) return `Erro: quadro "${boardId}" nao encontrado.`;

      const byPriority: Record<string, number> = {};
      const byColumn: Record<string, number> = {};
      let blocked = 0;

      for (const card of board.cards) {
        byPriority[card.priority] = (byPriority[card.priority] || 0) + 1;
        byColumn[card.column] = (byColumn[card.column] || 0) + 1;
        if (card.blocked_by) blocked++;
      }

      return [
        `Estatisticas do quadro "${board.name}":`,
        `  Total: ${board.cards.length} cartoes`,
        `  Bloqueados: ${blocked}`,
        '  Por prioridade: ' + Object.entries(byPriority).map(([k, v]) => `${k}:${v}`).join(' '),
        '  Por coluna: ' + Object.entries(byColumn).map(([k, v]) => `${k}:${v}`).join(' '),
      ].join('\n');
    }

    let totalCards = 0;
    for (const board of this.boards.values()) totalCards += board.cards.length;
    return `Total: ${this.boards.size} quadros, ${totalCards} cartoes.`;
  }

  private autoUnblock(board: KanbanBoard, completedCardId: string): void {
    for (const card of board.cards) {
      if (card.blocked_by === completedCardId) {
        card.blocked_by = null;
        card.blocked_reason = null;
        card.auto_blocked = false;
        card.updated_at = new Date().toISOString();
      }
    }
  }

  private sanitizeParsedData(data: unknown): unknown {
    if (Array.isArray(data)) return data.map((item) => this.sanitizeParsedData(item));
    if (data && typeof data === 'object') {
      const clean: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        clean[key] = this.sanitizeParsedData(value);
      }
      return clean;
    }
    return data;
  }
}
