import type { IMemoryBackend } from '../../../src/services/memory/IMemoryBackend';
import { LocalMemoryBackend } from '../../../src/services/memory/LocalMemoryBackend';
import { MemoryRuntimeService } from '../../../src/services/memory/MemoryRuntimeService';

describe('MemoryRuntimeService', () => {
  it('always persists locally in auto mode and syncs remote memory when available', async () => {
    const localBackend = {
      name: 'local',
      isAvailable: jest.fn().mockResolvedValue(true),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue(['[contexto] zavorth']),
      getMemoryService: jest.fn().mockReturnValue({}),
    } as unknown as LocalMemoryBackend;
    const mem0Backend: IMemoryBackend = {
      name: 'mem0',
      isAvailable: jest.fn().mockResolvedValue(true),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue(['usuario prefere zavorth']),
    };
    const runtime = new MemoryRuntimeService(localBackend, mem0Backend);

    const message = await runtime.addMemory('u1', 'usuario trabalha no Zavorth');

    expect(localBackend.addMemory).toHaveBeenCalledWith('u1', 'usuario trabalha no Zavorth');
    expect(mem0Backend.addMemory).toHaveBeenCalledWith('u1', 'usuario trabalha no Zavorth');
    expect(message).toContain('sincronizado');
  });

  it('falls back to local search when Mem0 is unavailable', async () => {
    const localBackend = {
      name: 'local',
      isAvailable: jest.fn().mockResolvedValue(true),
      addMemory: jest.fn().mockResolvedValue(undefined),
      searchMemory: jest.fn().mockResolvedValue(['[preferencia] respostas objetivas']),
      getMemoryService: jest.fn().mockReturnValue({}),
    } as unknown as LocalMemoryBackend;
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
});
