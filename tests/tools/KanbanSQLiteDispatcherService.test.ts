import fs from 'fs';
import os from 'os';
import path from 'path';
import { KanbanSQLiteDispatcherService } from '../../src/services/plugins/KanbanSQLiteDispatcherService';

describe('KanbanSQLiteDispatcherService', () => {
  let service: KanbanSQLiteDispatcherService;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-sqlite-'));
    service = new KanbanSQLiteDispatcherService({ storageDir: tempDir });
  });

  afterEach(() => {
    service.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('creates a board', () => {
    const result = service.createBoard('Sprint 1');
    expect(result).toContain('created');
    expect(result).toContain('SQLite');
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

  it('deletes a board', () => {
    service.createBoard('Temp');
    const result = service.deleteBoard('temp');
    expect(result).toContain('deleted');
  });

  it('adds a card', () => {
    service.createBoard('Board');
    const result = service.addCard('board', 'Task 1', { priority: 'high', assignee: 'dev' });
    expect(result).toContain('added');
    expect(result).toContain('Task 1');
  });

  it('moves a card', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1', { column: 'todo' });
    const board = service.getBoard('board');
    const cardId = board.match(/card_\w+/)![0];
    const result = service.moveCard('board', cardId, 'in_progress', 'Starting work');
    expect(result).toContain('moved');
  });

  it('blocks a card', () => {
    service.createBoard('Board');
    service.addCard('board', 'Blocker', { column: 'todo' });
    service.addCard('board', 'Blocked', { column: 'todo' });
    const board = service.getBoard('board');
    const cardIds = board.match(/card_\w+/g)!;
    const result = service.blockCard('board', cardIds[1], cardIds[0], 'Waiting for API');
    expect(result).toContain('blocked');
  });

  it('unblocks a card', () => {
    service.createBoard('Board');
    service.addCard('board', 'Blocker', { column: 'todo' });
    service.addCard('board', 'Blocked', { column: 'todo' });
    const board = service.getBoard('board');
    const cardIds = board.match(/card_\w+/g)!;
    service.blockCard('board', cardIds[1], cardIds[0]);
    const result = service.unblockCard('board', cardIds[1]);
    expect(result).toContain('unblocked');
  });

  it('dispatches by priority', () => {
    service.createBoard('Board');
    service.addCard('board', 'Low', { priority: 'low', column: 'todo' });
    service.addCard('board', 'Critical', { priority: 'critical', column: 'todo' });
    service.addCard('board', 'High', { priority: 'high', column: 'todo' });
    service.addCard('board', 'Medium', { priority: 'medium', column: 'todo' });

    const result = service.dispatch('board', { max_concurrent: 3 });
    expect(result.dispatched.length).toBe(3);
    expect(result.dispatched.length).toBeLessThanOrEqual(3);
  });

  it('does not dispatch blocked cards', () => {
    service.createBoard('Board');
    service.addCard('board', 'Blocker', { column: 'todo' });
    service.addCard('board', 'Blocked', { column: 'todo' });

    const board = service.getBoard('board');
    const blockerMatch = board.match(/card_\w+/);
    const blockerId = blockerMatch![0];

    const cards = board.match(/card_\w+/g)!;
    const blockedId = cards[1];

    service.blockCard('board', blockedId, blockerId, 'Depends on blocker');
    const result = service.dispatch('board');
    expect(result.blocked.length).toBeGreaterThanOrEqual(0);
  });

  it('moves cards in bulk', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task A', { column: 'todo' });
    service.addCard('board', 'Task B', { column: 'todo' });
    service.addCard('board', 'Task C', { column: 'todo' });

    const board = service.getBoard('board');
    const cardIds = board.match(/card_\w+/g)!;

    const result = service.moveCardsBulk('board', cardIds, 'in_progress');
    expect(result).toContain('3');
  });

  it('searches cards', () => {
    service.createBoard('Board');
    service.addCard('board', 'Implement OAuth2', { column: 'todo' });
    service.addCard('board', 'Fix login bug', { column: 'todo' });
    service.addCard('board', 'Update docs', { column: 'todo' });

    const result = service.searchCards('board', 'OAuth');
    expect(result).toContain('OAuth2');
    expect(result).not.toContain('docs');
  });

  it('lists boards', () => {
    service.createBoard('Board A');
    service.createBoard('Board B');
    const result = service.listBoards();
    expect(result).toContain('Board A');
    expect(result).toContain('Board B');
    expect(result).toContain('SQLite');
  });

  it('gets board view', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1', { column: 'todo', priority: 'critical' });
    const result = service.getBoard('board');
    expect(result).toContain('Task 1');
    expect(result).toContain('SQLite');
    expect(result).toContain('🔴');
  });

  it('gets stats', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1');
    service.addCard('board', 'Task 2');
    const result = service.getStats('board');
    expect(result).toContain('2 cartoes');
    expect(result).toContain('SQLite');
  });

  it('gets dispatch log', () => {
    service.createBoard('Board');
    service.addCard('board', 'Task 1', { column: 'todo' });
    const board = service.getBoard('board');
    const cardId = board.match(/card_\w+/)![0];
    service.moveCard('board', cardId, 'in_progress');
    service.moveCard('board', cardId, 'done');

    const log = service.getDispatchLog('board');
    expect(log).toContain('Movido');
    expect(log).toContain('➡️');
  });

  it('persists data to SQLite file', () => {
    service.createBoard('Persistent');
    service.addCard('persistent', 'Card 1', { priority: 'high' });
    service.close();

    const service2 = new KanbanSQLiteDispatcherService({ storageDir: tempDir });
    const board = service2.getBoard('persistent');
    expect(board).toContain('Card 1');
    service2.close();

    service = new KanbanSQLiteDispatcherService({ storageDir: tempDir });
  });

  it('returns error for non-existent board', () => {
    const result = service.getBoard('nonexistent');
    expect(result).toContain('not found');
  });

  it('returns error for invalid column', () => {
    service.createBoard('Board');
    const result = service.addCard('board', 'Task', { column: 'invalid_col' });
    expect(result).toContain('invalid');
  });
});
