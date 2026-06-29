import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type ChecklistItem = {
  id: string;
  text: string;
  completed: boolean;
};

export type Card = {
  id: string;
  title: string;
  description: string;
  columnId: string;
  priority: Priority;
  assignee: string | null;
  labels: string[];
  dueDate: string | null;
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  order: number;
};

export type Column = {
  id: string;
  name: string;
  order: number;
  color: string;
  cardIds: string[];
};

export type Board = {
  id: string;
  name: string;
  description: string;
  columns: Column[];
  createdAt: string;
  updatedAt: string;
};

export type BoardFilter = {
  assignee?: string;
  priority?: string;
  label?: string;
  dueBefore?: string;
};

export type BoardStats = {
  boardId: string;
  boardName: string;
  totalCards: number;
  cardsByPriority: Record<Priority, number>;
  cardsByColumn: Record<string, number>;
  cardsByAssignee: Record<string, number>;
  overdueCards: number;
  completedChecklistItems: number;
  totalChecklistItems: number;
};

export type CardInput = {
  title: string;
  description?: string;
  priority?: Priority;
  assignee?: string | null;
  labels?: string[];
  dueDate?: string | null;
  checklist?: ChecklistItem[];
  order?: number;
};

export type CardUpdate = {
  title?: string;
  description?: string;
  priority?: Priority;
  assignee?: string | null;
  labels?: string[];
  dueDate?: string | null;
  checklist?: ChecklistItem[];
};

type WorkboardServiceOptions = {
  storageDir: string;
  now?: () => Date;
};

const CONTRACT_VERSION = 'workboard/1';

export class WorkboardService {
  private readonly storageDir: string;
  private readonly now: () => Date;
  private boards: Map<string, Board> = new Map();
  private cards: Map<string, Card> = new Map();

  constructor(options: WorkboardServiceOptions) {
    this.storageDir = options.storageDir;
    this.now = options.now || (() => new Date());
  }

  createBoard(name: string, description: string): Board {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new Error('Board name is required.');
    }
    const timestamp = this.now().toISOString();
    const board: Board = {
      id: randomUUID(),
      name: trimmedName,
      description: String(description || '').trim(),
      columns: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.boards.set(board.id, board);
    this.save();
    return board;
  }

  deleteBoard(boardId: string): void {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    for (const column of board.columns) {
      for (const cardId of column.cardIds) {
        this.cards.delete(cardId);
      }
    }
    this.boards.delete(boardId);
    this.save();
  }

  getBoard(boardId: string): Board | null {
    return this.boards.get(boardId) || null;
  }

  listBoards(): Board[] {
    return Array.from(this.boards.values());
  }

  createColumn(boardId: string, name: string, color: string): Column {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new Error('Column name is required.');
    }
    const maxOrder = board.columns.reduce((max, col) => Math.max(max, col.order), -1);
    const column: Column = {
      id: randomUUID(),
      name: trimmedName,
      order: maxOrder + 1,
      color: String(color || '#808080').trim(),
      cardIds: [],
    };
    board.columns.push(column);
    board.updatedAt = this.now().toISOString();
    this.save();
    return column;
  }

  deleteColumn(boardId: string, columnId: string): void {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const colIndex = board.columns.findIndex((c) => c.id === columnId);
    if (colIndex === -1) {
      throw new Error(`Column not found: ${columnId}`);
    }
    const column = board.columns[colIndex];
    for (const cardId of column.cardIds) {
      this.cards.delete(cardId);
    }
    board.columns.splice(colIndex, 1);
    board.updatedAt = this.now().toISOString();
    this.save();
  }

  reorderColumns(boardId: string, columnIds: string[]): void {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const reordered: Column[] = [];
    for (let i = 0; i < columnIds.length; i++) {
      const col = board.columns.find((c) => c.id === columnIds[i]);
      if (!col) {
        throw new Error(`Column not found: ${columnIds[i]}`);
      }
      col.order = i;
      reordered.push(col);
    }
    board.columns = reordered;
    board.updatedAt = this.now().toISOString();
    this.save();
  }

  createCard(boardId: string, columnId: string, input: CardInput): Card {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const column = board.columns.find((c) => c.id === columnId);
    if (!column) {
      throw new Error(`Column not found: ${columnId}`);
    }
    const trimmedTitle = String(input.title || '').trim();
    if (!trimmedTitle) {
      throw new Error('Card title is required.');
    }
    const timestamp = this.now().toISOString();
    const maxOrder = column.cardIds.reduce((max, cid) => {
      const card = this.cards.get(cid);
      return card ? Math.max(max, card.order) : max;
    }, -1);
    const card: Card = {
      id: randomUUID(),
      title: trimmedTitle,
      description: String(input.description || '').trim(),
      columnId,
      priority: input.priority || 'medium',
      assignee: input.assignee || null,
      labels: Array.isArray(input.labels) ? [...input.labels] : [],
      dueDate: input.dueDate || null,
      checklist: Array.isArray(input.checklist)
        ? input.checklist.map((item) => ({
            id: item.id || randomUUID(),
            text: item.text,
            completed: item.completed,
          }))
        : [],
      createdAt: timestamp,
      updatedAt: timestamp,
      order: input.order !== undefined ? input.order : maxOrder + 1,
    };
    this.cards.set(card.id, card);
    column.cardIds.push(card.id);
    board.updatedAt = timestamp;
    this.save();
    return card;
  }

  updateCard(boardId: string, cardId: string, updates: CardUpdate): Card {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }
    const timestamp = this.now().toISOString();
    if (updates.title !== undefined) {
      const trimmed = String(updates.title).trim();
      if (!trimmed) {
        throw new Error('Card title cannot be empty.');
      }
      card.title = trimmed;
    }
    if (updates.description !== undefined) {
      card.description = String(updates.description).trim();
    }
    if (updates.priority !== undefined) {
      card.priority = updates.priority;
    }
    if (updates.assignee !== undefined) {
      card.assignee = updates.assignee;
    }
    if (updates.labels !== undefined) {
      card.labels = [...updates.labels];
    }
    if (updates.dueDate !== undefined) {
      card.dueDate = updates.dueDate;
    }
    if (updates.checklist !== undefined) {
      card.checklist = updates.checklist.map((item) => ({
        id: item.id || randomUUID(),
        text: item.text,
        completed: item.completed,
      }));
    }
    card.updatedAt = timestamp;
    board.updatedAt = timestamp;
    this.save();
    return card;
  }

  deleteCard(boardId: string, cardId: string): void {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }
    const column = board.columns.find((c) => c.id === card.columnId);
    if (column) {
      column.cardIds = column.cardIds.filter((id) => id !== cardId);
    }
    this.cards.delete(cardId);
    board.updatedAt = this.now().toISOString();
    this.save();
  }

  moveCard(boardId: string, cardId: string, toColumnId: string, toIndex: number): Card {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const card = this.cards.get(cardId);
    if (!card) {
      throw new Error(`Card not found: ${cardId}`);
    }
    const targetColumn = board.columns.find((c) => c.id === toColumnId);
    if (!targetColumn) {
      throw new Error(`Column not found: ${toColumnId}`);
    }
    const sourceColumn = board.columns.find((c) => c.id === card.columnId);
    if (sourceColumn) {
      sourceColumn.cardIds = sourceColumn.cardIds.filter((id) => id !== cardId);
    }
    const safeIndex = Math.max(0, Math.min(toIndex, targetColumn.cardIds.length));
    targetColumn.cardIds.splice(safeIndex, 0, cardId);
    card.columnId = toColumnId;
    card.updatedAt = this.now().toISOString();
    for (const col of board.columns) {
      for (let i = 0; i < col.cardIds.length; i++) {
        const c = this.cards.get(col.cardIds[i]);
        if (c) {
          c.order = i;
        }
      }
    }
    board.updatedAt = this.now().toISOString();
    this.save();
    return card;
  }

  getCards(boardId: string, filter?: BoardFilter): Card[] {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    let result: Card[] = [];
    for (const column of board.columns) {
      for (const cardId of column.cardIds) {
        const card = this.cards.get(cardId);
        if (card) {
          result.push(card);
        }
      }
    }
    if (!filter) {
      return result.sort((a, b) => a.order - b.order);
    }
    if (filter.assignee) {
      const assigneeLower = filter.assignee.toLowerCase();
      result = result.filter(
        (c) => c.assignee && c.assignee.toLowerCase() === assigneeLower,
      );
    }
    if (filter.priority) {
      const priorityLower = filter.priority.toLowerCase();
      result = result.filter((c) => c.priority === priorityLower);
    }
    if (filter.label) {
      const labelLower = filter.label.toLowerCase();
      result = result.filter((c) =>
        c.labels.some((l) => l.toLowerCase() === labelLower),
      );
    }
    if (filter.dueBefore) {
      const deadline = new Date(filter.dueBefore).getTime();
      result = result.filter((c) => c.dueDate && new Date(c.dueDate).getTime() <= deadline);
    }
    return result.sort((a, b) => a.order - b.order);
  }

  getBoardStats(boardId: string): BoardStats {
    const board = this.boards.get(boardId);
    if (!board) {
      throw new Error(`Board not found: ${boardId}`);
    }
    const now = this.now().getTime();
    const allCards: Card[] = [];
    for (const column of board.columns) {
      for (const cardId of column.cardIds) {
        const card = this.cards.get(cardId);
        if (card) {
          allCards.push(card);
        }
      }
    }
    const cardsByPriority: Record<Priority, number> = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };
    const cardsByColumn: Record<string, number> = {};
    const cardsByAssignee: Record<string, number> = {};
    let overdueCards = 0;
    let completedChecklistItems = 0;
    let totalChecklistItems = 0;

    for (const card of allCards) {
      cardsByPriority[card.priority] = (cardsByPriority[card.priority] || 0) + 1;
      const colName = board.columns.find((c) => c.id === card.columnId)?.name || 'Unknown';
      cardsByColumn[colName] = (cardsByColumn[colName] || 0) + 1;
      if (card.assignee) {
        cardsByAssignee[card.assignee] = (cardsByAssignee[card.assignee] || 0) + 1;
      }
      if (card.dueDate && new Date(card.dueDate).getTime() < now) {
        overdueCards++;
      }
      for (const item of card.checklist) {
        totalChecklistItems++;
        if (item.completed) {
          completedChecklistItems++;
        }
      }
    }

    return {
      boardId,
      boardName: board.name,
      totalCards: allCards.length,
      cardsByPriority,
      cardsByColumn,
      cardsByAssignee,
      overdueCards,
      completedChecklistItems,
      totalChecklistItems,
    };
  }

  save(): void {
    const data = {
      contractVersion: CONTRACT_VERSION,
      savedAt: this.now().toISOString(),
      boards: Array.from(this.boards.values()),
      cards: Array.from(this.cards.values()),
    };
    const filePath = path.join(this.storageDir, 'workboard.json');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  load(): void {
    const filePath = path.join(this.storageDir, 'workboard.json');
    if (!fs.existsSync(filePath)) {
      return;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.boards) || !Array.isArray(data.cards)) {
      return;
    }
    this.boards.clear();
    this.cards.clear();
    for (const board of data.boards) {
      this.boards.set(board.id, board);
    }
    for (const card of data.cards) {
      this.cards.set(card.id, card);
    }
  }
}
