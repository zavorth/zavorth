import type { CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import {
  ZavorthKanbanBoardService,
  type KanbanColumnId,
} from '../services/kanban/ZavorthKanbanBoardService.js';
import { KanbanBoardTuiRenderer } from './components/KanbanBoardTuiView.js';

type RegistryCommandParams = {
  commandName: string | null;
  args: string;
  writer: CliWriter;
};

const sharedKanbanService = new ZavorthKanbanBoardService();
const boardRenderer = new KanbanBoardTuiRenderer();

export async function handleZavorthCliRegistryKanbanCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { commandName, args, writer } = params;
  const cmd = String(commandName || '').trim().toLowerCase();

  if (cmd === '/kanban' || cmd === 'kanban' || cmd === '/board' || cmd === 'board') {
    const subArgs = String(args || '').trim();
    if (subArgs.startsWith('plan ')) {
      const goal = subArgs.substring(5).trim();
      if (!goal) {
        writer.error('Usage: /kanban plan <goal description>');
        return { ok: false, handled: true, output: [], error: 'Missing goal description' };
      }
      const tasks = sharedKanbanService.decomposeGoal(goal, [
        'Analyze scope and requirements',
        'Execute implementation steps',
        'Run automated verification and regression tests',
      ]);
      writer.line(`\x1b[32m✔ Decomposed goal into ${tasks.length} dependent tasks in Swarm Matrix.\x1b[0m`);
    } else if (subArgs.startsWith('repair ')) {
      const taskId = subArgs.substring(7).trim();
      const res = sharedKanbanService.triggerAutoRepair(taskId, 'Manual operator triage request');
      if (!res.success) {
        writer.error(res.error || 'Failed to trigger repair');
        return { ok: false, handled: true, output: [], error: res.error || 'Repair failed' };
      }
      writer.line(`\x1b[33m✔ Task "${taskId}" moved to AUTO_REPAIR lane.\x1b[0m`);
    }

    const state = sharedKanbanService.getBoardState();
    const rendered = boardRenderer.render(state, {
      activeColumnIndex: 1,
      selectedTaskIndex: 0,
      terminalWidth: process.stdout.columns || 100,
    });

    writer.line(rendered);
    return { ok: true, handled: true, output: [rendered], error: null };
  }

  if (cmd === '/triage' || cmd === 'triage') {
    const title = String(args || '').trim();
    if (!title) {
      writer.error('Usage: /triage <task_title>');
      return { ok: false, handled: true, output: [], error: 'Missing title' };
    }
    const task = sharedKanbanService.createTask({ title, priority: 'HIGH' });
    writer.line(`\x1b[32m✔ Task created in Swarm Matrix: [${task.id}] ${task.title}\x1b[0m`);
    return { ok: true, handled: true, output: [task.id], error: null };
  }

  if (cmd === '/move' || cmd === 'move') {
    const tokens = String(args || '').trim().split(/\s+/).filter(Boolean);
    const cardId = tokens[0];
    const destCol = (tokens[1] || '').toUpperCase() as KanbanColumnId;
    if (!cardId || !destCol) {
      writer.error('Usage: /move <card_id> <TODO|READY|RUNNING|REVIEW|AUTO_REPAIR|DONE>\nExample: /move task-123 DONE');
      return { ok: false, handled: true, output: [], error: 'Missing cardId or destination column' };
    }

    const result = sharedKanbanService.moveTask(cardId, destCol);
    if (!result.success) {
      writer.error(`Error: ${result.error}`);
      return { ok: false, handled: true, output: [], error: result.error || 'Move failed' };
    }

    writer.line(`\x1b[32m✔ Task "${cardId}" moved to ${destCol}.\x1b[0m`);
    return { ok: true, handled: true, output: [`Moved to ${destCol}`], error: null };
  }

  return null;
}
