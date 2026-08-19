import { KanbanTool } from '../../src/tools/KanbanTool';
import { ZavorthKanbanBoardService } from '../../src/services/kanban/ZavorthKanbanBoardService';

describe('KanbanTool', () => {
  let tool: KanbanTool;
  let service: ZavorthKanbanBoardService;

  beforeEach(() => {
    service = new ZavorthKanbanBoardService();
    tool = new KanbanTool(service);
  });

  it('should create tasks and list the board state via tool execution', async () => {
    const createRes = await tool.execute({
      action: 'create_task',
      title: 'Implement Auth Gate',
      priority: 'HIGH',
    });

    const parsedCreate = JSON.parse(createRes);
    expect(parsedCreate.success).toBe(true);
    expect(parsedCreate.task.title).toBe('Implement Auth Gate');
    expect(parsedCreate.task.priority).toBe('HIGH');

    const boardRes = await tool.execute({ action: 'get_board' });
    const parsedBoard = JSON.parse(boardRes);
    expect(parsedBoard.success).toBe(true);
    expect(parsedBoard.board.totalTasks).toBe(1);
  });

  it('should decompose high-level goals into dependent tasks and route to auto-repair on faults', async () => {
    const decompRes = await tool.execute({
      action: 'decompose_goal',
      goal: 'Refactor Core Storage',
      subtasks: ['Audit schema', 'Write migrations', 'Run integration tests'],
    });

    const parsedDecomp = JSON.parse(decompRes);
    expect(parsedDecomp.success).toBe(true);
    expect(parsedDecomp.createdTasksCount).toBe(3);

    const firstTaskId = parsedDecomp.tasks[0].id;
    const repairRes = await tool.execute({
      action: 'trigger_repair',
      taskId: firstTaskId,
      reason: 'Schema compilation mismatch',
    });

    const parsedRepair = JSON.parse(repairRes);
    expect(parsedRepair.success).toBe(true);
    expect(parsedRepair.task.column).toBe('AUTO_REPAIR');
  });
});
