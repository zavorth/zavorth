import { describe, it, expect, beforeEach } from '@jest/globals';
import { SessionPersistenceService } from '../../src/storage/SessionPersistenceService.js';
import { SessionPickerModal } from '../../src/cli/presentation/SessionPickerModal.js';
import { stripCliAnsi } from '../../src/cli/ZavorthCliVisualTheme.js';

describe('SessionPersistenceService & SessionPickerModal', () => {
  beforeEach(() => {
    SessionPersistenceService.resetForTesting();
  });

  it('should create and retrieve a session record', () => {
    const session = SessionPersistenceService.createSession({
      title: 'Auditoria de Testes',
      model: 'Claude 3.7 Sonnet',
      cost: 0.15,
    });

    expect(session.id).toBeDefined();
    expect(session.title).toBe('Auditoria de Testes');

    const fetched = SessionPersistenceService.getSession(session.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Auditoria de Testes');
    expect(fetched?.cost).toBe(0.15);
  });

  it('should list sessions sorted by update time', async () => {
    const s1 = SessionPersistenceService.createSession({ title: 'Session 1' });
    await new Promise(r => setTimeout(r, 10));
    const s2 = SessionPersistenceService.createSession({ title: 'Session 2' });

    const list = SessionPersistenceService.listSessions();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].id).toBe(s2.id);
  });

  it('should update an existing session', () => {
    const session = SessionPersistenceService.createSession({ title: 'Original Title', cost: 0.05 });
    const updated = SessionPersistenceService.updateSession(session.id, {
      title: 'Updated Title',
      cost: 0.25,
    });

    expect(updated?.title).toBe('Updated Title');
    expect(updated?.cost).toBe(0.25);
  });

  it('should fork a session into a child branch', () => {
    const parent = SessionPersistenceService.createSession({
      title: 'Main Pipeline Architecture',
      cost: 1.5,
    });

    const forked = SessionPersistenceService.forkSession(parent.id, 'Alternative Refactor Branch');
    expect(forked).not.toBeNull();
    expect(forked?.parentId).toBe(parent.id);
    expect(forked?.title).toBe('Alternative Refactor Branch');
  });

  it('should manage session todos', () => {
    const session = SessionPersistenceService.createSession({ title: 'Task Session' });
    const todo = SessionPersistenceService.addTodo(session.id, 'Fix 149 failing tests');
    expect(todo).not.toBeNull();
    expect(todo?.content).toBe('Fix 149 failing tests');
    expect(todo?.status).toBe('pending');

    const updated = SessionPersistenceService.updateTodoStatus(session.id, todo!.id, 'completed');
    expect(updated).toBe(true);

    const reloaded = SessionPersistenceService.getSession(session.id);
    expect(reloaded?.todos[0].status).toBe('completed');
  });

  it('should filter sessions and render SessionPickerModal view', () => {
    const s1 = SessionPersistenceService.createSession({ title: 'Full Code Review', model: 'GPT-4o' });
    const s2 = SessionPersistenceService.createSession({ title: 'Database Optimization', model: 'Claude 3.7' });

    const sessions = SessionPersistenceService.listSessions();
    const filtered = SessionPickerModal.filterSessions(sessions, 'Database');
    expect(filtered.length).toBe(1);
    expect(filtered[0].title).toBe('Database Optimization');

    const modalView = SessionPickerModal.renderModal({
      searchQuery: 'Database',
      selectedIndex: 0,
      currentSessionId: s2.id,
      sessions,
    });

    const clean = stripCliAnsi(modalView);
    expect(clean).toContain('Select session');
    expect(clean).toContain('Search Database');
    expect(clean).toContain('Database Optimization');
    expect(clean).toContain('Resume');
    expect(clean).toContain('Fork');
  });
});
