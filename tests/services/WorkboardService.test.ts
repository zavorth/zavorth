import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { WorkboardService } from '../../src/services/WorkboardService';

describe('WorkboardService', () => {
  let service: WorkboardService;
  let tempDir: string;
  let fixedTime: Date;
  let nowFn: () => Date;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'workboard-test-'));
    fixedTime = new Date('2025-01-15T10:00:00Z');
    nowFn = () => fixedTime;
    service = new WorkboardService({ storageDir: tempDir, now: nowFn });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Board CRUD', () => {
    it('creates a board with name and description', () => {
      const board = service.createBoard('Sprint 1', 'First sprint');
      expect(board.id).toBeDefined();
      expect(board.name).toBe('Sprint 1');
      expect(board.description).toBe('First sprint');
      expect(board.columns).toEqual([]);
      expect(board.createdAt).toBe(fixedTime.toISOString());
      expect(board.updatedAt).toBe(fixedTime.toISOString());
    });

    it('trims board name', () => {
      const board = service.createBoard('  Sprint 1  ', '');
      expect(board.name).toBe('Sprint 1');
    });

    it('throws when board name is empty', () => {
      expect(() => service.createBoard('', 'desc')).toThrow('Board name is required.');
    });

    it('throws when board name is whitespace only', () => {
      expect(() => service.createBoard('   ', 'desc')).toThrow('Board name is required.');
    });

    it('lists boards', () => {
      service.createBoard('Board A', '');
      service.createBoard('Board B', '');
      const boards = service.listBoards();
      expect(boards).toHaveLength(2);
      expect(boards.map(b => b.name)).toEqual(expect.arrayContaining(['Board A', 'Board B']));
    });

    it('gets a board by id', () => {
      const board = service.createBoard('Sprint 1', '');
      const retrieved = service.getBoard(board.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(board.id);
    });

    it('returns null for non-existent board', () => {
      expect(service.getBoard('non-existent-id')).toBeNull();
    });

    it('deletes a board', () => {
      const board = service.createBoard('Sprint 1', '');
      service.deleteBoard(board.id);
      expect(service.getBoard(board.id)).toBeNull();
      expect(service.listBoards()).toHaveLength(0);
    });

    it('throws when deleting non-existent board', () => {
      expect(() => service.deleteBoard('non-existent-id')).toThrow('Board not found');
    });

    it('deletes board and its cards', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      service.createCard(board.id, col.id, { title: 'Task 1' });
      service.createCard(board.id, col.id, { title: 'Task 2' });
      service.deleteBoard(board.id);
      expect(service.listBoards()).toHaveLength(0);
    });
  });

  describe('Column CRUD', () => {
    it('creates a column in a board', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#60a5fa');
      expect(col.id).toBeDefined();
      expect(col.name).toBe('To Do');
      expect(col.color).toBe('#60a5fa');
      expect(col.order).toBe(0);
      expect(col.cardIds).toEqual([]);
    });

    it('assigns incrementing order to columns', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'In Progress', '#fff');
      const col3 = service.createColumn(board.id, 'Done', '#fff');
      expect(col1.order).toBe(0);
      expect(col2.order).toBe(1);
      expect(col3.order).toBe(2);
    });

    it('throws when creating column in non-existent board', () => {
      expect(() => service.createColumn('fake-id', 'Col', '#fff')).toThrow('Board not found');
    });

    it('throws when column name is empty', () => {
      const board = service.createBoard('Sprint 1', '');
      expect(() => service.createColumn(board.id, '', '#fff')).toThrow('Column name is required.');
    });

    it('deletes a column and its cards', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      service.createCard(board.id, col.id, { title: 'Task 1' });
      service.deleteColumn(board.id, col.id);
      const updated = service.getBoard(board.id);
      expect(updated!.columns).toHaveLength(0);
    });

    it('throws when deleting non-existent column', () => {
      const board = service.createBoard('Sprint 1', '');
      expect(() => service.deleteColumn(board.id, 'fake-col-id')).toThrow('Column not found');
    });
  });

  describe('Reorder columns', () => {
    it('reorders columns by id array', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'In Progress', '#fff');
      const col3 = service.createColumn(board.id, 'Done', '#fff');

      service.reorderColumns(board.id, [col3.id, col1.id, col2.id]);

      const updated = service.getBoard(board.id)!;
      expect(updated.columns.map(c => c.name)).toEqual(['Done', 'To Do', 'In Progress']);
      expect(updated.columns[0].order).toBe(0);
      expect(updated.columns[1].order).toBe(1);
      expect(updated.columns[2].order).toBe(2);
    });

    it('throws when reordering columns of non-existent board', () => {
      expect(() => service.reorderColumns('fake-id', [])).toThrow('Board not found');
    });

    it('throws when column id not found during reorder', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      expect(() => service.reorderColumns(board.id, [col1.id, 'fake-id'])).toThrow('Column not found');
    });
  });

  describe('Card CRUD', () => {
    it('creates a card with default values', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });
      expect(card.id).toBeDefined();
      expect(card.title).toBe('Task 1');
      expect(card.description).toBe('');
      expect(card.columnId).toBe(col.id);
      expect(card.priority).toBe('medium');
      expect(card.assignee).toBeNull();
      expect(card.labels).toEqual([]);
      expect(card.dueDate).toBeNull();
      expect(card.checklist).toEqual([]);
      expect(card.order).toBe(0);
    });

    it('creates a card with all fields', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, {
        title: 'Task 1',
        description: 'Important task',
        priority: 'high',
        assignee: 'Alice',
        labels: ['bug', 'urgent'],
        dueDate: '2025-02-01',
        checklist: [{ id: 'c1', text: 'Step 1', completed: false }],
      });
      expect(card.priority).toBe('high');
      expect(card.assignee).toBe('Alice');
      expect(card.labels).toEqual(['bug', 'urgent']);
      expect(card.dueDate).toBe('2025-02-01');
      expect(card.checklist).toHaveLength(1);
    });

    it('throws when card title is empty', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      expect(() => service.createCard(board.id, col.id, { title: '' })).toThrow('Card title is required.');
    });

    it('throws when creating card in non-existent column', () => {
      const board = service.createBoard('Sprint 1', '');
      expect(() => service.createCard(board.id, 'fake-col', { title: 'Task' })).toThrow('Column not found');
    });

    it('updates a card', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });

      const updated = service.updateCard(board.id, card.id, {
        title: 'Updated Task',
        priority: 'urgent',
        assignee: 'Bob',
      });
      expect(updated.title).toBe('Updated Task');
      expect(updated.priority).toBe('urgent');
      expect(updated.assignee).toBe('Bob');
    });

    it('throws when updating card with empty title', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });
      expect(() => service.updateCard(board.id, card.id, { title: '' })).toThrow('Card title cannot be empty.');
    });

    it('throws when updating non-existent card', () => {
      const board = service.createBoard('Sprint 1', '');
      expect(() => service.updateCard(board.id, 'fake-card', { title: 'X' })).toThrow('Card not found');
    });

    it('deletes a card', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });
      service.deleteCard(board.id, card.id);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns[0].cardIds).toHaveLength(0);
    });

    it('throws when deleting non-existent card', () => {
      const board = service.createBoard('Sprint 1', '');
      expect(() => service.deleteCard(board.id, 'fake-card')).toThrow('Card not found');
    });
  });

  describe('Move cards between columns', () => {
    it('moves a card from one column to another', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'Done', '#fff');
      const card = service.createCard(board.id, col1.id, { title: 'Task 1' });

      const moved = service.moveCard(board.id, card.id, col2.id, 0);
      expect(moved.columnId).toBe(col2.id);

      const updated = service.getBoard(board.id)!;
      expect(updated.columns[0].cardIds).toHaveLength(0);
      expect(updated.columns[1].cardIds).toEqual([card.id]);
    });

    it('clamps index to valid range (negative)', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });

      const moved = service.moveCard(board.id, card.id, col.id, -5);
      expect(moved.columnId).toBe(col.id);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns[0].cardIds[0]).toBe(card.id);
    });

    it('clamps index to valid range (beyond length)', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'Done', '#fff');
      const card = service.createCard(board.id, col1.id, { title: 'Task 1' });

      service.moveCard(board.id, card.id, col2.id, 999);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns[1].cardIds).toEqual([card.id]);
    });

    it('reorders cards within the same column', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card1 = service.createCard(board.id, col.id, { title: 'Task 1' });
      const card2 = service.createCard(board.id, col.id, { title: 'Task 2' });

      service.moveCard(board.id, card1.id, col.id, 1);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns[0].cardIds[0]).toBe(card2.id);
      expect(updated.columns[0].cardIds[1]).toBe(card1.id);
    });

    it('updates card order after move', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card1 = service.createCard(board.id, col.id, { title: 'Task 1' });
      const card2 = service.createCard(board.id, col.id, { title: 'Task 2' });

      expect(card1.order).toBe(0);
      expect(card2.order).toBe(1);

      service.moveCard(board.id, card1.id, col.id, 1);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns[0].cardIds).toEqual([card2.id, card1.id]);
    });

    it('throws when moving to non-existent column', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      const card = service.createCard(board.id, col.id, { title: 'Task 1' });
      expect(() => service.moveCard(board.id, card.id, 'fake-col', 0)).toThrow('Column not found');
    });
  });

  describe('Filter cards', () => {
    let board: ReturnType<WorkboardService['createBoard']>;
    let col: ReturnType<WorkboardService['createColumn']>;

    beforeEach(() => {
      board = service.createBoard('Sprint 1', '');
      col = service.createColumn(board.id, 'To Do', '#fff');
      service.createCard(board.id, col.id, {
        title: 'Bug fix',
        priority: 'high',
        assignee: 'Alice',
        labels: ['bug'],
      });
      service.createCard(board.id, col.id, {
        title: 'Feature',
        priority: 'low',
        assignee: 'Bob',
        labels: ['feature'],
      });
      service.createCard(board.id, col.id, {
        title: 'Urgent fix',
        priority: 'urgent',
        assignee: 'Alice',
        labels: ['bug', 'urgent'],
      });
      service.createCard(board.id, col.id, {
        title: 'Medium task',
        priority: 'medium',
        labels: [],
      });
    });

    it('returns all cards when no filter', () => {
      const cards = service.getCards(board.id);
      expect(cards).toHaveLength(4);
    });

    it('filters by priority', () => {
      const cards = service.getCards(board.id, { priority: 'high' });
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('Bug fix');
    });

    it('filters by priority case-insensitive', () => {
      const cards = service.getCards(board.id, { priority: 'HIGH' });
      expect(cards).toHaveLength(1);
    });

    it('filters by assignee', () => {
      const cards = service.getCards(board.id, { assignee: 'Alice' });
      expect(cards).toHaveLength(2);
    });

    it('filters by assignee case-insensitive', () => {
      const cards = service.getCards(board.id, { assignee: 'alice' });
      expect(cards).toHaveLength(2);
    });

    it('filters by label', () => {
      const cards = service.getCards(board.id, { label: 'bug' });
      expect(cards).toHaveLength(2);
    });

    it('filters by label case-insensitive', () => {
      const cards = service.getCards(board.id, { label: 'BUG' });
      expect(cards).toHaveLength(2);
    });

    it('filters by dueBefore', () => {
      service.updateCard(board.id, service.getCards(board.id)[0].id, {
        dueDate: '2025-01-10',
      });
      const cards = service.getCards(board.id, { dueBefore: '2025-01-12' });
      expect(cards.length).toBeGreaterThanOrEqual(1);
    });

    it('combines multiple filters', () => {
      const cards = service.getCards(board.id, { priority: 'high', assignee: 'Alice' });
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('Bug fix');
    });

    it('returns empty array when no cards match filter', () => {
      const cards = service.getCards(board.id, { assignee: 'Charlie' });
      expect(cards).toEqual([]);
    });
  });

  describe('Board statistics', () => {
    it('returns correct stats for a board with cards', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'Done', '#fff');

      service.createCard(board.id, col1.id, {
        title: 'Task 1',
        priority: 'high',
        assignee: 'Alice',
        checklist: [
          { id: 'c1', text: 'Step 1', completed: true },
          { id: 'c2', text: 'Step 2', completed: false },
        ],
      });
      service.createCard(board.id, col2.id, {
        title: 'Task 2',
        priority: 'low',
        assignee: 'Bob',
      });

      const stats = service.getBoardStats(board.id);
      expect(stats.totalCards).toBe(2);
      expect(stats.boardName).toBe('Sprint 1');
      expect(stats.cardsByPriority).toEqual({ low: 1, medium: 0, high: 1, urgent: 0 });
      expect(stats.cardsByAssignee).toEqual({ Alice: 1, Bob: 1 });
      expect(stats.completedChecklistItems).toBe(1);
      expect(stats.totalChecklistItems).toBe(2);
    });

    it('counts overdue cards', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      service.createCard(board.id, col.id, {
        title: 'Overdue task',
        dueDate: '2025-01-01',
      });
      service.createCard(board.id, col.id, {
        title: 'Future task',
        dueDate: '2025-12-01',
      });

      const stats = service.getBoardStats(board.id);
      expect(stats.overdueCards).toBe(1);
    });

    it('returns zero stats for empty board', () => {
      const board = service.createBoard('Empty', '');
      service.createColumn(board.id, 'Col', '#fff');

      const stats = service.getBoardStats(board.id);
      expect(stats.totalCards).toBe(0);
      expect(stats.overdueCards).toBe(0);
      expect(stats.completedChecklistItems).toBe(0);
      expect(stats.totalChecklistItems).toBe(0);
    });

    it('counts cards per column', () => {
      const board = service.createBoard('Sprint 1', '');
      const col1 = service.createColumn(board.id, 'To Do', '#fff');
      const col2 = service.createColumn(board.id, 'Done', '#fff');
      service.createCard(board.id, col1.id, { title: 'Task 1' });
      service.createCard(board.id, col1.id, { title: 'Task 2' });
      service.createCard(board.id, col2.id, { title: 'Task 3' });

      const stats = service.getBoardStats(board.id);
      expect(stats.cardsByColumn).toEqual({ 'To Do': 2, 'Done': 1 });
    });

    it('throws for non-existent board', () => {
      expect(() => service.getBoardStats('fake-id')).toThrow('Board not found');
    });
  });

  describe('Persistence', () => {
    it('saves and loads boards', () => {
      service.createBoard('Sprint 1', 'First sprint');
      service.createBoard('Sprint 2', 'Second sprint');

      const service2 = new WorkboardService({ storageDir: tempDir, now: nowFn });
      service2.load();
      expect(service2.listBoards()).toHaveLength(2);
    });

    it('saves and loads cards', () => {
      const board = service.createBoard('Sprint 1', '');
      const col = service.createColumn(board.id, 'To Do', '#fff');
      service.createCard(board.id, col.id, { title: 'Task 1' });

      const service2 = new WorkboardService({ storageDir: tempDir, now: nowFn });
      service2.load();
      const cards = service2.getCards(board.id);
      expect(cards).toHaveLength(1);
      expect(cards[0].title).toBe('Task 1');
    });

    it('creates workboard.json file', () => {
      service.createBoard('Sprint 1', '');
      const filePath = path.join(tempDir, 'workboard.json');
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('load is no-op when file does not exist', () => {
      const emptyService = new WorkboardService({ storageDir: path.join(tempDir, 'empty'), now: nowFn });
      emptyService.load();
      expect(emptyService.listBoards()).toHaveLength(0);
    });

    it('load throws on invalid JSON content', () => {
      const filePath = path.join(tempDir, 'workboard.json');
      fs.writeFileSync(filePath, 'not valid json');
      const service2 = new WorkboardService({ storageDir: tempDir, now: nowFn });
      expect(() => service2.load()).toThrow();
    });

    it('load clears previous state before loading from file', () => {
      service.createBoard('Board 1', '');

      const service2 = new WorkboardService({ storageDir: tempDir, now: nowFn });
      expect(service2.listBoards()).toHaveLength(0);

      service2.load();
      expect(service2.listBoards()).toHaveLength(1);
      expect(service2.listBoards()[0].name).toBe('Board 1');
    });
  });

  describe('Handle empty boards', () => {
    it('returns empty array from listBoards', () => {
      expect(service.listBoards()).toEqual([]);
    });

    it('returns empty array for getCards on board with no columns', () => {
      const board = service.createBoard('Empty', '');
      const cards = service.getCards(board.id);
      expect(cards).toEqual([]);
    });

    it('returns zero stats for board with no columns', () => {
      const board = service.createBoard('Empty', '');
      const stats = service.getBoardStats(board.id);
      expect(stats.totalCards).toBe(0);
      expect(stats.cardsByPriority).toEqual({ low: 0, medium: 0, high: 0, urgent: 0 });
      expect(stats.cardsByColumn).toEqual({});
      expect(stats.cardsByAssignee).toEqual({});
    });

    it('deletes board with no columns', () => {
      const board = service.createBoard('Empty', '');
      service.deleteBoard(board.id);
      expect(service.listBoards()).toHaveLength(0);
    });

    it('reorderColumns on board with no columns', () => {
      const board = service.createBoard('Empty', '');
      service.reorderColumns(board.id, []);
      const updated = service.getBoard(board.id)!;
      expect(updated.columns).toEqual([]);
    });
  });

  describe('Multiple boards isolation', () => {
    it('boards have independent columns', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1a = service.createColumn(board1.id, 'Col A', '#fff');
      const col1b = service.createColumn(board1.id, 'Col B', '#fff');
      const col2a = service.createColumn(board2.id, 'Col X', '#fff');

      const updated1 = service.getBoard(board1.id)!;
      const updated2 = service.getBoard(board2.id)!;

      expect(updated1.columns).toHaveLength(2);
      expect(updated2.columns).toHaveLength(1);
      expect(updated1.columns.map(c => c.name)).toEqual(['Col A', 'Col B']);
      expect(updated2.columns[0].name).toBe('Col X');
    });

    it('boards have independent cards', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1 = service.createColumn(board1.id, 'To Do', '#fff');
      const col2 = service.createColumn(board2.id, 'To Do', '#fff');

      service.createCard(board1.id, col1.id, { title: 'Task 1A' });
      service.createCard(board1.id, col1.id, { title: 'Task 1B' });
      service.createCard(board2.id, col2.id, { title: 'Task 2A' });

      const cards1 = service.getCards(board1.id);
      const cards2 = service.getCards(board2.id);

      expect(cards1).toHaveLength(2);
      expect(cards2).toHaveLength(1);
      expect(cards1.map(c => c.title)).toEqual(expect.arrayContaining(['Task 1A', 'Task 1B']));
      expect(cards2[0].title).toBe('Task 2A');
    });

    it('deleting one board does not affect another', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1 = service.createColumn(board1.id, 'To Do', '#fff');
      const col2 = service.createColumn(board2.id, 'To Do', '#fff');

      service.createCard(board1.id, col1.id, { title: 'Task 1' });
      service.createCard(board2.id, col2.id, { title: 'Task 2' });

      service.deleteBoard(board1.id);

      expect(service.getBoard(board1.id)).toBeNull();
      expect(service.getBoard(board2.id)).not.toBeNull();
      expect(service.getCards(board2.id)).toHaveLength(1);
    });

    it('stats are isolated per board', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1 = service.createColumn(board1.id, 'To Do', '#fff');
      const col2 = service.createColumn(board2.id, 'To Do', '#fff');

      service.createCard(board1.id, col1.id, { title: 'Task 1', priority: 'high' });
      service.createCard(board1.id, col1.id, { title: 'Task 2', priority: 'low' });
      service.createCard(board2.id, col2.id, { title: 'Task 3', priority: 'urgent' });

      const stats1 = service.getBoardStats(board1.id);
      const stats2 = service.getBoardStats(board2.id);

      expect(stats1.totalCards).toBe(2);
      expect(stats2.totalCards).toBe(1);
      expect(stats1.cardsByPriority).toEqual({ low: 1, medium: 0, high: 1, urgent: 0 });
      expect(stats2.cardsByPriority).toEqual({ low: 0, medium: 0, high: 0, urgent: 1 });
    });

    it('moves card only within its own board', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1a = service.createColumn(board1.id, 'To Do', '#fff');
      const col1b = service.createColumn(board1.id, 'Done', '#fff');
      const col2 = service.createColumn(board2.id, 'To Do', '#fff');

      const card = service.createCard(board1.id, col1a.id, { title: 'Task 1' });
      service.createCard(board2.id, col2.id, { title: 'Task 2' });

      service.moveCard(board1.id, card.id, col1b.id, 0);

      expect(service.getCards(board1.id)).toHaveLength(1);
      expect(service.getCards(board2.id)).toHaveLength(1);
      expect(service.getCards(board2.id)[0].title).toBe('Task 2');
    });

    it('filter applies only to the queried board', () => {
      const board1 = service.createBoard('Board 1', '');
      const board2 = service.createBoard('Board 2', '');

      const col1 = service.createColumn(board1.id, 'To Do', '#fff');
      const col2 = service.createColumn(board2.id, 'To Do', '#fff');

      service.createCard(board1.id, col1.id, { title: 'Task 1', assignee: 'Alice', priority: 'high' });
      service.createCard(board2.id, col2.id, { title: 'Task 2', assignee: 'Alice', priority: 'low' });

      const aliceHigh = service.getCards(board1.id, { assignee: 'Alice', priority: 'high' });
      expect(aliceHigh).toHaveLength(1);

      const aliceAll = service.getCards(board2.id, { assignee: 'Alice' });
      expect(aliceAll).toHaveLength(1);
      expect(aliceAll[0].priority).toBe('low');
    });
  });
});
