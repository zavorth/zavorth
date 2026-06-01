import {
  createPromptQueueItem,
  hasDuplicateQueuedPrompt,
  promptSubmitKey,
  readPromptQueueForSession,
  writePromptQueueForSession,
} from '../../../apps/zavorth-control-vite-shell/src/prompt-queue';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => store.get(key) || null),
    setItem: jest.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe('zavorth-control prompt queue', () => {
  it('persists isolated queues per session', () => {
    const storage = createMemoryStorage();
    const first = createPromptQueueItem({
      text: 'first',
      sessionId: 'session-a',
      id: 'queue-a',
      backoffMs: 2500,
      maxAttempts: 5,
      nextRetryAt: 123456,
    });
    const second = createPromptQueueItem({ text: 'second', sessionId: 'session-b', id: 'queue-b' });

    expect(writePromptQueueForSession(storage, 'session-a', [first])).toBe(true);
    expect(writePromptQueueForSession(storage, 'session-b', [second])).toBe(true);

    expect(readPromptQueueForSession(storage, 'session-a')).toEqual([
      expect.objectContaining({
        id: 'queue-a',
        text: 'first',
        sessionId: 'session-a',
        backoffMs: 2500,
        maxAttempts: 5,
        nextRetryAt: 123456,
      }),
    ]);
    expect(readPromptQueueForSession(storage, 'session-b')).toEqual([
      expect.objectContaining({ id: 'queue-b', text: 'second', sessionId: 'session-b' }),
    ]);
  });

  it('deduplicates in-flight prompts by text, attachments, skills, and command', () => {
    const item = createPromptQueueItem({
      text: 'review',
      sessionId: 'session-a',
      attachments: [{ name: 'a.txt', type: 'text/plain', size: 12, text: 'hello' }],
      selectedSkills: [{ id: 'security' }],
      id: 'queue-a',
    });
    const duplicate = createPromptQueueItem({
      text: 'review',
      sessionId: 'session-a',
      attachments: [{ name: 'a.txt', type: 'text/plain', size: 12, text: 'hello' }],
      selectedSkills: [{ id: 'security' }],
      id: 'queue-b',
    });

    expect(promptSubmitKey(item)).toBe(promptSubmitKey(duplicate));
    expect(hasDuplicateQueuedPrompt([item], duplicate)).toBe(true);
  });
});
