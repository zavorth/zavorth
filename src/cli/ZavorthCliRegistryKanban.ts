import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import { KanbanSQLiteDispatcherService } from '../services/plugins/KanbanSQLiteDispatcherService.js';

type RegistryCommandParams = {
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryKanbanCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;
  const cmd = String(commandName || '').trim().toLowerCase();

  if (cmd === '/board' || cmd === 'board') {
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      kanban.createBoard('Default Board');
      const boardStr = kanban.getBoard('default_board');
      writer.line(boardStr);
      return { ok: true, handled: true, output: [boardStr], error: null };
    } finally {
      kanban.close();
    }
  }

  if (cmd === '/triage' || cmd === 'triage') {
    const title = String(args || '').trim();
    if (!title) {
      writer.error('Uso: /triage <titulo da task>');
      return { ok: false, handled: true, output: [], error: 'Missing title' };
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      kanban.createBoard('Default Board');
      const result = kanban.addCard('default_board', title, { column: 'todo' });
      writer.line(result);
      return { ok: true, handled: true, output: [result], error: null };
    } finally {
      kanban.close();
    }
  }

  if (cmd === '/move' || cmd === 'move') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const cardId = tokens[0];
    const destCol = tokens[1];
    if (!cardId || !destCol) {
      writer.error('Uso: /move <card_id> <coluna_destino>\nExemplo: /move card_123 in_progress');
      return { ok: false, handled: true, output: [], error: 'Missing cardId or destination column' };
    }
    const kanban = new KanbanSQLiteDispatcherService();
    try {
      const result = kanban.moveCard('default_board', cardId, destCol, 'Moved via CLI Command');
      writer.line(result);
      return { ok: !result.startsWith('Error:'), handled: true, output: [result], error: result.startsWith('Error:') ? result : null };
    } finally {
      kanban.close();
    }
  }

  return null;
}
