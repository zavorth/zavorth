import { SessionPersistenceService, type StoredSession } from '../../../src/storage/SessionPersistenceService.js';
import { SessionTimelineNavigatorService } from '../../../src/runtime/sessions/SessionTimelineNavigatorService.js';

describe('SessionTimelineNavigatorService', () => {
  let navigator: SessionTimelineNavigatorService;
  const testSessionId = 'ses_test_timeline_123';

  beforeEach(() => {
    navigator = new SessionTimelineNavigatorService();

    const session: StoredSession = {
      id: testSessionId,
      title: 'Feature Implementation Session',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now(),
      messages: [
        { id: 'm1', role: 'user', content: 'Implement user auth API', timestamp: Date.now() - 9000 },
        { id: 'm2', role: 'assistant', content: 'Planning authentication flow with JWT.', timestamp: Date.now() - 8000 },
        { id: 'm3', role: 'user', content: 'Add bcrypt hashing as well', timestamp: Date.now() - 7000 },
        { id: 'm4', role: 'assistant', content: 'Implementing bcrypt hashing service.', timestamp: Date.now() - 6000 },
      ],
      todos: [],
    };

    SessionPersistenceService.saveSession(session);
  });

  afterEach(() => {
    SessionPersistenceService.deleteSession(testSessionId);
  });

  it('retrieves structured timeline of turns with preview and message roles', () => {
    const timeline = navigator.getTimeline(testSessionId);

    expect(timeline).not.toBeNull();
    expect(timeline?.totalTurns).toBe(4);
    expect(timeline?.turns[0].role).toBe('user');
    expect(timeline?.turns[0].preview).toContain('Implement user auth API');
    expect(timeline?.turns[1].role).toBe('assistant');
  });

  it('forks a session strictly up to a specified historical turn index', () => {
    const result = navigator.forkFromTurn(testSessionId, 2, 'Auth Plan Fork');

    expect(result.success).toBe(true);
    expect(result.retainedTurns).toBe(2);
    expect(result.newTitle).toBe('Auth Plan Fork');
    expect(result.parentSessionId).toBe(testSessionId);

    const forkedSession = SessionPersistenceService.getSession(result.newSessionId);
    expect(forkedSession).toBeDefined();
    expect(forkedSession?.messages).toHaveLength(2);
    expect(forkedSession?.messages[1].content).toBe('Planning authentication flow with JWT.');

    // Cleanup
    SessionPersistenceService.deleteSession(result.newSessionId);
  });

  it('formats timeline clearly for CLI rendering', () => {
    const timeline = navigator.getTimeline(testSessionId);
    expect(timeline).not.toBeNull();

    const formatted = navigator.formatTimelineForCli(timeline!);
    expect(formatted).toContain('=== Session Timeline: Feature Implementation Session');
    expect(formatted).toContain('#1');
    expect(formatted).toContain('[USER]');
    expect(formatted).toContain('#2');
    expect(formatted).toContain('[ASSISTANT]');
  });
});
