import type { IMemoryBackend, MemoryRecord } from '../../../src/services/memory/IMemoryBackend';
import { LocalMemoryBackend } from '../../../src/services/memory/LocalMemoryBackend';
import { MemoryRuntimeService } from '../../../src/services/memory/MemoryRuntimeService';

function makeLocalMock(overrides: Record<string, unknown> = {}): LocalMemoryBackend {
  return {
    name: 'local',
    contractVersion: 2,
    isAvailable: jest.fn().mockResolvedValue(true),
    addMemory: jest.fn().mockResolvedValue(undefined),
    searchMemory: jest.fn().mockResolvedValue(['[contexto] zavorth']),
    addMemoryRecord: jest.fn().mockImplementation(async (userId: string, content: string) => {
      const now = new Date().toISOString();
      return {
        id: 'local-1',
        userId,
        content,
        metadata: { category: 'general', source: 'local', key: 'local-1' },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      } satisfies MemoryRecord;
    }),
    searchMemoryRecords: jest.fn().mockResolvedValue([]),
    listMemoryRecords: jest.fn().mockResolvedValue([]),
    getMemoryRecord: jest.fn().mockResolvedValue(null),
    deleteMemory: jest.fn().mockResolvedValue(true),
    restoreMemory: jest.fn().mockResolvedValue(true),
    getMemoryService: jest.fn().mockReturnValue({}),
    ...overrides,
  } as unknown as LocalMemoryBackend;
}

describe('MemoryRuntimeService', () => {
  it('always persists locally in auto mode and syncs remote memory when available', async () => {
    const localBackend = makeLocalMock();
    const mem0Backend: IMemoryBackend = {
      name: 'mem0',
      contractVersion: 2,
      isAvailable: jest.fn().mockResolvedValue(true),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue(['usuario prefere zavorth']),
    };
    const runtime = new MemoryRuntimeService(localBackend, mem0Backend);

    const message = await runtime.addMemory('u1', 'usuario trabalha no Zavorth');

    expect(localBackend.addMemory).toHaveBeenCalledWith('u1', 'usuario trabalha no Zavorth', undefined);
    expect(mem0Backend.addMemory).toHaveBeenCalledWith('u1', 'usuario trabalha no Zavorth', undefined);
    expect(message).toContain('sincronizado');
  });

  it('falls back to local search when Mem0 is unavailable', async () => {
    const localBackend = makeLocalMock({
      searchMemory: jest.fn().mockResolvedValue(['[preferencia] respostas objetivas']),
    });
    const mem0Backend: IMemoryBackend = {
      name: 'mem0',
      isAvailable: jest.fn().mockResolvedValue(false),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue([]),
    };
    const runtime = new MemoryRuntimeService(localBackend, mem0Backend);

    const results = await runtime.searchMemory('u1', 'como voce responde?', {
      backend: 'auto',
      limit: 5,
    });

    expect(results).toEqual(['[preferencia] respostas objetivas']);
    expect(mem0Backend.searchMemory).not.toHaveBeenCalled();
  });

  it('supports Phase 6 structured add with metadata write options', async () => {
    const localBackend = makeLocalMock();
    const mem0Backend: IMemoryBackend = {
      name: 'mem0',
      isAvailable: jest.fn().mockResolvedValue(false),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue([]),
    };
    const runtime = new MemoryRuntimeService(localBackend, mem0Backend);

    const record = await runtime.addMemoryRecord('u1', 'prefers dark mode', {
      backend: 'local',
      write: {
        key: 'pref_theme',
        metadata: { category: 'preference', tags: ['ui'] },
      },
    });

    expect(record.content).toBe('prefers dark mode');
    expect(localBackend.addMemoryRecord).toHaveBeenCalledWith(
      'u1',
      'prefers dark mode',
      expect.objectContaining({ key: 'pref_theme' }),
    );
  });
});
