import { Mem0MemoryBackend } from '../../../src/services/memory/Mem0MemoryBackend';

describe('Mem0MemoryBackend', () => {
  it('stays unavailable when no API key is configured', async () => {
    const importer = jest.fn();
    const backend = new Mem0MemoryBackend('', importer as any);

    await expect(backend.isAvailable()).resolves.toBe(false);
    expect(importer).not.toHaveBeenCalled();
  });

  it('loads the client dynamically when the SDK is available', async () => {
    const add = jest.fn().mockResolvedValue({ id: 'mem-1' });
    const search = jest.fn().mockResolvedValue([{ memory: 'usuario prefere respostas curtas' }]);
    const importer = jest.fn().mockResolvedValue({
      MemoryClient: class {
        public add = add;
        public search = search;
      },
    });
    const backend = new Mem0MemoryBackend('mem0-test-key', importer as any);

    await expect(backend.isAvailable()).resolves.toBe(true);
    await backend.addMemory('u1', 'fato importante');
    await expect(backend.searchMemory('u1', 'respostas')).resolves.toEqual([
      'usuario prefere respostas curtas',
    ]);
    expect(add).toHaveBeenCalledWith('fato importante', { user_id: 'u1' });
    expect(search).toHaveBeenCalledWith('respostas', { user_id: 'u1' });
  });
});
