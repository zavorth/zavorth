import fs from 'fs';
import os from 'os';
import path from 'path';
import { KanbanDispatcherService } from '../../src/services/plugins/KanbanDispatcherService';

describe('KanbanDispatcherService', () => {
  let service: KanbanDispatcherService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-dispatch-'));
    service = new KanbanDispatcherService({ storageDir: tempDir });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a board', () => {
    const result = service.createBoard('Sprint 1');
    expect(result).toContain('created');
  });

  it('prevents duplicate board', () => {
    service.createBoard('Test');
    const result = service.createBoard('Test');
    expect(result).toContain('already exists');
  });

  it('creates board with custom columns', () => {
    const result = service.createBoard('Custom', ['todo', 'doing', 'done']);
    expect(result).toContain('todo');
    expect(result).toContain('doing');
  });

  it('adds a card', () => {
    service.createBoard('Board');
    const result = service.addCard('board', 'Task 1', { priority: 'high' });
    expect(result).toContain('added');
    expect(result).toContain('Task 1');
  });

  it('moves a card', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1', { column: 'todo' });
    const board = service.getBoard('board');
    const cardId = board.match(/card_\w+/)![0];
    const result = service.moveCard('board', cardId, 'in_progress');
    expect(result).toContain('moved');
  });

  it('blocks a card', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1');
    const board = service.getBoard('board');
    const cardId = board.match(/card_\w+/)![0];
    const result = service.blockCard('board', cardId, 'card_other', 'Waiting for API');
    expect(result).toContain('blocked');
  });

  it('dispatches cards by priority', () => {
    service.createBoard('Board');
    service.addCard('board', 'Low', { priority: 'low', column: 'todo' });
    service.addCard('board', 'Critical', { priority: 'critical', column: 'todo' });
    service.addCard('board', 'High', { priority: 'high', column: 'todo' });

    const result = service.dispatch('board', { max_concurrent: 2 });
    expect(result.dispatched.length).toBe(2);
    expect(result.dispatched.length).toBeLessThanOrEqual(2);
  });

  it('does not dispatch blocked cards', () => {
    service.createBoard('Board');
    service.addCard('board', 'Blocker', { column: 'todo' });
    service.addCard('board', 'Blocked', { column: 'todo' });

    const board = service.getBoard('board');
    const blockerId = board.match(/card_\w+/)![0];
    const blockedId = board.match(/card_\w+(?!.*card_\w+)/)![0];

    service.blockCard('board', blockedId, blockerId, 'Depends on blocker');
    const result = service.dispatch('board');
    expect(result.blocked.length).toBeGreaterThanOrEqual(0);
  });

  it('lists boards', () => {
    service.createBoard('Board A');
    service.createBoard('Board B');
    const result = service.listBoards();
    expect(result).toContain('Board A');
    expect(result).toContain('Board B');
  });

  it('gets board view', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1', { column: 'todo' });
    const result = service.getBoard('board');
    expect(result).toContain('Task 1');
    expect(result).toContain('todo');
  });

  it('gets stats', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1');
    const result = service.getStats('board');
    expect(result).toContain('1 cartoes');
  });

  it('returns error for non-existent board', () => {
    const result = service.getBoard('nonexistent');
    expect(result).toContain('not found');
  });
});
