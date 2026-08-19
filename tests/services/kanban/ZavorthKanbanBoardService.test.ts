import { ZavorthKanbanBoardService } from '../../../src/services/kanban/ZavorthKanbanBoardService';

describe('ZavorthKanbanBoardService', () => {
  let service: ZavorthKanbanBoardService;

  beforeEach(() => {
    service = new ZavorthKanbanBoardService();
  });

  it('should create tasks with proper default columns and priority sorting', () => {
    const t1 = service.createTask({ title: 'Root task', priority: 'LOW' });
    const t2 = service.createTask({ title: 'Urgent task', priority: 'URGENT' });

    expect(t1.column).toBe('READY');
    expect(t2.column).toBe('READY');

    const board = service.getBoardState();
    expect(board.columns.READY[0].id).toBe(t2.id);
  });

  it('should enforce DAG dependency ordering and transition to READY when blockers complete', () => {
    const parent = service.createTask({ title: 'Parent task' });
    const child = service.createTask({ title: 'Child task', blockedBy: [parent.id] });

    expect(child.column).toBe('TODO');

    const invalidMove = service.moveTask(child.id, 'RUNNING');
    expect(invalidMove.success).toBe(false);
    expect(invalidMove.error).toContain('blocked by unfinished tasks');

    service.moveTask(parent.id, 'RUNNING');
    service.moveTask(parent.id, 'DONE');

    const updatedChild = service.getTask(child.id);
    expect(updatedChild?.column).toBe('READY');

    const validMove = service.moveTask(child.id, 'RUNNING');
    expect(validMove.success).toBe(true);
  });

  it('should route faulted tasks to AUTO_REPAIR lane with incident log', () => {
    const task = service.createTask({ title: 'Flaky task' });
    service.assignSubagent(task.id, 'subagent-alpha');

    const repairRes = service.triggerAutoRepair(task.id, 'Timeout on external API endpoint');
    expect(repairRes.success).toBe(true);
    expect(repairRes.task?.column).toBe('AUTO_REPAIR');
    expect(repairRes.task?.incidentLog).toContain('Timeout on external API endpoint');
  });

  it('should decompose complex goals into dependent task DAGs', () => {
    const tasks = service.decomposeGoal('Refactor DB', [
      'Create schema migration',
      'Update model entities',
      'Run integration tests',
    ]);

    expect(tasks.length).toBe(3);
    expect(tasks[0].column).toBe('READY');
    expect(tasks[1].column).toBe('TODO');
    expect(tasks[1].blockedBy).toContain(tasks[0].id);
    expect(tasks[2].blockedBy).toContain(tasks[1].id);
  });

  it('should track live telemetry across subagents', () => {
    const task = service.createTask({ title: 'Long running task' });
    service.assignSubagent(task.id, 'subagent-beta');

    service.updateTelemetry(task.id, 1500, 12);
    service.updateTelemetry(task.id, 500, 3);

    const board = service.getBoardState();
    expect(board.totalTokensConsumed).toBe(2000);
    expect(board.activeSubagentsCount).toBe(1);
    expect(service.getTask(task.id)?.elapsedSeconds).toBe(15);
  });
});
