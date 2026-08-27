import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AcpClientBridge } from '../../src/acp/AcpClientBridge.js';
import { SessionPersistenceService } from '../../src/storage/SessionPersistenceService.js';

jest.mock('../../src/providers/ProviderFactory.js', () => ({
  ProviderFactory: {
    create: jest.fn().mockReturnValue({
      chat: jest.fn().mockResolvedValue({ content: 'Test response from provider' }),
    }),
  },
}));

describe('AcpClientBridge (Desktop & Dashboard Coexistence)', () => {
  let bridge: AcpClientBridge;

  beforeEach(() => {
    SessionPersistenceService.resetForTesting();
    bridge = new AcpClientBridge();
  });

  it('should create and retrieve active session across surfaces', async () => {
    const session = await bridge.getOrCreateSession('Desktop Work Session', 'Claude 3.7 Sonnet');
    expect(session.id).toBeDefined();
    expect(session.title).toBe('Desktop Work Session');

    const active = bridge.getActiveSession();
    expect(active?.id).toBe(session.id);
  });

  it('should list sessions from shared persistence', async () => {
    await bridge.getOrCreateSession('Session A');
    await bridge.getOrCreateSession('Session B');

    const list = await bridge.listSessions();
    expect(list.length).toBeGreaterThanOrEqual(2);
  });

  it('should stream thoughts and calculate dynamic prompt cost', async () => {
    const session = await bridge.getOrCreateSession('Stream Session');
    const events: string[] = [];

    bridge.onStreamEvent((event) => {
      if (event.type === 'thought' || event.type === 'chunk') {
        events.push(event.type);
      }
    });

    const result = await bridge.sendPrompt(session.id, 'Help me implement an agnostic router');
    expect(result.response).toBe('Test response from provider');
    expect(result.cost).toBeGreaterThanOrEqual(0);
    expect(events).toContain('thought');
    expect(events).toContain('chunk');
  });

  it('should fork session into a child branch for desktop branching', async () => {
    const parent = await bridge.getOrCreateSession('Main Branch');
    const forked = await bridge.forkSession(parent.id, 'Child Branch');

    expect(forked).not.toBeNull();
    expect(forked?.parentId).toBe(parent.id);
    expect(bridge.getActiveSession()?.id).toBe(forked?.id);
  });
});
