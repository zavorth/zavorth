
import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

const VALID_COLUMNS = ['backlog', 'todo', 'in_progress', 'review', 'done'] as const;
type Column = typeof VALID_COLUMNS[number];

interface KanbanCard {
  id: string;
  title: string;
  description: string;
  column: Column;
  assignee: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

interface KanbanBoard {
  id: string;
  name: string;
  cards: KanbanCard[];
  created_at: string;
}

export class KanbanTool extends BaseTool {
  public readonly name = 'kanban_board';

  public readonly description =
    'Manages a Kanban board for organizing agent and user tasks.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao a executar: 'create_board', 'add_card', 'move_card', 'list_cards', 'assign_card', 'delete_card'.",
      },
      board_id: {
        type: 'string',
        description: 'ID do quadro Kanban.',
      },
      card_id: {
        type: 'string',
        description: 'ID do cartao.',
      },
      title: {
        type: 'string',
        description: 'Titulo do cartao (para add_card).',
      },
      description: {
        type: 'string',
        description: 'Descricao do cartao.',
      },
      column: {
        type: 'string',
        description: "Coluna de destino: 'backlog', 'todo', 'in_progress', 'review', 'done'.",
      },
      assignee: {
        type: 'string',
        description: 'Responsavel pelo cartao.',
      },
      priority: {
        type: 'string',
        description: "Prioridade: 'low', 'medium', 'high', 'critical'. Default: 'medium'.",
      },
    },
    required: ['action'],
  };

  private readonly storageDir: string;

  constructor(options?: { storageDir?: string }) {
    super();
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'kanban');
  }

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) {
      return 'Error: the "action" parameter is required.';
    }

    const validActions = ['create_board', 'add_card', 'move_card', 'list_cards', 'assign_card', 'delete_card'];
    if (!validActions.includes(action)) {
      return `Error: invalid action "${action}" is invalid. Use: ${validActions.join(', ')}.`;
    }

    this.ensureStorageDir();

    try {
      switch (action) {
        case 'create_board':
          return this.createBoard(args);
        case 'add_card':
          return this.addCard(args);
        case 'move_card':
          return this.moveCard(args);
        case 'list_cards':
          return this.listCards(args);
        case 'assign_card':
          return this.assignCard(args);
        case 'delete_card':
          return this.deleteCard(args);
        default:
          return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Kanban] delete operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return `Kanban error: ${message}`;
  }
  }

  private ensureStorageDir(): void {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private boardPath(boardId: string): string {
    return path.join(this.storageDir, `${boardId}.json`);
  }

  private loadBoard(boardId: string): KanbanBoard | null {
    const filePath = this.boardPath(boardId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as KanbanBoard;
  }

  private saveBoard(board: KanbanBoard): void {
    fs.writeFileSync(this.boardPath(board.id), JSON.stringify(board, null, 2), 'utf-8');
  }

  private createBoard(args: Record<string, unknown>): string {
    const name = String(args.title || args.board_id || `board_${Date.now()}`);
    const boardId = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const existing = this.loadBoard(boardId);
    if (existing) {
      return `Error: board "${boardId}" already exists.`;
    }

    const board: KanbanBoard = {
      id: boardId,
      name,
      cards: [],
      created_at: new Date().toISOString(),
    };
    this.saveBoard(board);
    return `Quadro "${name}" created successfully. ID: ${boardId}`;
  }

  private addCard(args: Record<string, unknown>): string {
    const boardId = String(args.board_id || '');
    if (!boardId) return 'Error: "board_id" is required for add_card.';

    const board = this.loadBoard(boardId);
    if (!board) return `Error: board "${boardId}" not found.`;

    const title = String(args.title || '');
    if (!title) return 'Error: "title" is required for add_card.';

    const column = String(args.column || 'backlog') as Column;
    if (!VALID_COLUMNS.includes(column)) {
      return `Error: invalid column "${column}" is invalid. Use: ${VALID_COLUMNS.join(', ')}.`;
    }

    const priority = String(args.priority || 'medium') as KanbanCard['priority'];
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return `Error: invalid priority "${priority}" is invalid. Use: ${validPriorities.join(', ')}.`;
    }

    const cardId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const card: KanbanCard = {
      id: cardId,
      title,
      description: String(args.description || ''),
      column,
      assignee: typeof args.assignee === 'string' ? args.assignee : null,
      priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    board.cards.push(card);
    this.saveBoard(board);
    return `Cartao "${title}" adicionado ao quadro "${boardId}" na coluna "${column}". ID: ${cardId}`;
  }

  private moveCard(args: Record<string, unknown>): string {
    const boardId = String(args.board_id || '');
    const cardId = String(args.card_id || '');
    const column = String(args.column || '') as Column;

    if (!boardId) return 'Error: "board_id" is required.';
    if (!cardId) return 'Error: "card_id" is required.';
    if (!VALID_COLUMNS.includes(column)) {
      return `Error: invalid column "${column}" is invalid. Use: ${VALID_COLUMNS.join(', ')}.`;
    }

    const board = this.loadBoard(boardId);
    if (!board) return `Error: board "${boardId}" not found.`;

    const card = board.cards.find((c) => c.id === cardId);
    if (!card) return `Error: card "${cardId}" not found on board "${boardId}".`;

    const oldColumn = card.column;
    card.column = column;
    card.updated_at = new Date().toISOString();
    this.saveBoard(board);
    return `Cartao "${card.title}" movido de "${oldColumn}" para "${column}".`;
  }

  private listCards(args: Record<string, unknown>): string {
    const boardId = String(args.board_id || '');
    if (!boardId) return 'Error: "board_id" is required.';

    const board = this.loadBoard(boardId);
    if (!board) return `Error: board "${boardId}" not found.`;

    if (board.cards.length === 0) {
      return `Quadro "${board.name}" esta vazio.`;
    }

    const lines: string[] = [`Quadro: ${board.name} (${board.cards.length} cartoes)`];
    for (const col of VALID_COLUMNS) {
      const colCards = board.cards.filter((c) => c.column === col);
      if (colCards.length > 0) {
        lines.push(`\n[${col}]`);
        for (const card of colCards) {
          const assignee = card.assignee ? ` @${card.assignee}` : '';
          lines.push(`  - ${card.id}: ${card.title} [${card.priority}]${assignee}`);
        }
      }
    }
    return lines.join('\n');
  }

  private assignCard(args: Record<string, unknown>): string {
    const boardId = String(args.board_id || '');
    const cardId = String(args.card_id || '');
    const assignee = typeof args.assignee === 'string' ? args.assignee : '';

    if (!boardId) return 'Error: "board_id" is required.';
    if (!cardId) return 'Error: "card_id" is required.';
    if (!assignee) return 'Error: "assignee" is required.';

    const board = this.loadBoard(boardId);
    if (!board) return `Error: board "${boardId}" not found.`;

    const card = board.cards.find((c) => c.id === cardId);
    if (!card) return `Error: card "${cardId}" not found.`;

    card.assignee = assignee;
    card.updated_at = new Date().toISOString();
    this.saveBoard(board);
    return `Cartao "${card.title}" atribuido a "${assignee}".`;
  }

  private deleteCard(args: Record<string, unknown>): string {
    const boardId = String(args.board_id || '');
    const cardId = String(args.card_id || '');

    if (!boardId) return 'Error: "board_id" is required.';
    if (!cardId) return 'Error: "card_id" is required.';

    const board = this.loadBoard(boardId);
    if (!board) return `Error: board "${boardId}" not found.`;

    const index = board.cards.findIndex((c) => c.id === cardId);
    if (index === -1) return `Error: card "${cardId}" not found.`;

    const removed = board.cards.splice(index, 1)[0];
    this.saveBoard(board);
    return `Cartao "${removed.title}" removido do quadro "${boardId}".`;
  }
}
