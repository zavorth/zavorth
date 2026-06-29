import { describe, it, expect, beforeEach } from '@jest/globals';
import { SessionSearchFts5Tool } from '../../src/tools/SessionSearchFts5Tool.js';

describe('SessionSearchFts5Tool', () => {
  let tool: SessionSearchFts5Tool;

  beforeEach(() => {
    tool = new SessionSearchFts5Tool();
    // Index some test data
    tool.indexEntry({
      id: '1',
      sessionId: 'ses_1',
      role: 'user',
      content: 'How to fix login bug',
      timestamp: '2026-01-01T10:00:00Z',
    });
    tool.indexEntry({
      id: '2',
      sessionId: 'ses_1',
      role: 'assistant',
      content: 'You need to check the authentication module',
      timestamp: '2026-01-01T10:01:00Z',
    });
    tool.indexEntry({
      id: '3',
      sessionId: 'ses_2',
      role: 'user',
      content: 'Deploy the application to production',
      timestamp: '2026-01-02T10:00:00Z',
    });
  });

  it('discovers entries by query', async () => {
    const result = await tool.execute({ mode: 'discover', query: 'login' });
    expect(result).toContain('Resultados');
    expect(result).toContain('login');
  });

  it('scrolls entries chronologically', async () => {
    const result = await tool.execute({ mode: 'scroll' });
    expect(result).toContain('Resultados');
  });

  it('reads session by ID', async () => {
    const result = await tool.execute({ mode: 'read', sessionId: 'ses_1' });
    expect(result).toContain('Resultados');
    expect(result).toContain('login');
  });

  it('browses sessions', async () => {
    const result = await tool.execute({ mode: 'browse' });
    expect(result).toContain('Resultados');
  });

  it('requires query for discover mode', async () => {
    const result = await tool.execute({ mode: 'discover', query: '' });
    expect(result).toContain('Erro');
  });

  it('requires sessionId for read mode', async () => {
    const result = await tool.execute({ mode: 'read', sessionId: '' });
    expect(result).toContain('Erro');
  });

  it('handles unknown mode', async () => {
    const result = await tool.execute({ mode: 'unknown' });
    expect(result).toContain('desconhecido');
  });
});
