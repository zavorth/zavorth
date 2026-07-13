import { MnemosHumanInTheLoopService } from '../../src/services/MnemosHumanInTheLoopService';

const createMockLogRepo = () => ({
  log: jest.fn(),
});

const createMockMcpRuntime = (mnemosConnected = true) => ({
  readSnapshot: jest.fn().mockReturnValue({
    entries: mnemosConnected
      ? [{ id: 'mnemos', status: 'connected', toolCount: 6, toolNames: ['search_memory', 'scan_local_metadata', 'understand_file', 'index_file', 'vault_status', 'delete_memory'] }]
      : [{ id: 'mnemos', status: 'failed', toolCount: 0, toolNames: [] }],
  }),
});

describe('MnemosHumanInTheLoopService', () => {
  let service: MnemosHumanInTheLoopService;
  let mockLogRepo: ReturnType<typeof createMockLogRepo>;
  let mockInvoker: { execute: jest.Mock };

  beforeEach(() => {
    mockLogRepo = createMockLogRepo();
    mockInvoker = {
      execute: jest.fn().mockResolvedValue(JSON.stringify({
        status: 'success',
        chunks_indexed: 3,
      })),
    };
    service = new MnemosHumanInTheLoopService(mockLogRepo as any, mockInvoker);
  });

  describe('buildCandidatePrompt', () => {
    it('returns message without buttons when there are no candidates', () => {
      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'logic gates',
        candidates: [],
      });

      expect(result.text).toContain('found no file related');
      expect(result.text).toContain('Mnemos Vault Search');
      expect(result.buttons).toHaveLength(0);
    });

    it('builds inline buttons for each candidate', () => {
      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'logic gates',
        candidates: [
          { name: 'portas_logicas.pdf', path: '/scan/downloads/portas_logicas.pdf', size_bytes: 1024 * 1024, extension: '.pdf' },
          { name: 'algebra_booleana.md', path: '/scan/docs/algebra_booleana.md', size_bytes: 512, extension: '.md' },
        ],
      });

      expect(result.text).toContain('Mnemos Vault Search');
      expect(result.text).toContain('portas_logicas.pdf');
      expect(result.text).toContain('algebra_booleana.md');
      // 2 index buttons + 1 reject
      expect(result.buttons).toHaveLength(3);
      expect(result.buttons[0][0].callback_data).toMatch(/^mnemos:index_confirm:/);
      expect(result.buttons[2][0].callback_data).toBe('mnemos:index_reject:all');
    });

    it('limits buttons to 3 candidates + 1 reject', () => {
      const candidates = Array.from({ length: 5 }, (_, i) => ({
        name: `file_${i}.pdf`,
        path: `/scan/file_${i}.pdf`,
        size_bytes: 1024,
        extension: '.pdf',
      }));

      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'anything',
        candidates,
      });

      expect(result.buttons).toHaveLength(4);
    });
  });

  describe('processCallback', () => {
    it('ignores callbacks that are not mnemos', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('hub:action', mcpRuntime as any);
      expect(result.handled).toBe(false);
    });

    it('processes index_confirm successfully', async () => {
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/downloads/test.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('index_confirm');
      expect(result.error).toBeNull();
      expect(result.responseText).toContain('was indexed');
      expect(mockInvoker.execute).toHaveBeenCalledWith('index_file', {
        file_path: '/scan/downloads/test.pdf',
      });
    });

    it('detects disconnected Mnemos on index_confirm', async () => {
      const mcpRuntime = createMockMcpRuntime(false);
      const encodedPath = Buffer.from('/scan/test.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos not connected');
      expect(result.responseText).toContain('not connected');
      expect(mockInvoker.execute).not.toHaveBeenCalled();
    });

    it('detects missing tool runtime on index_confirm', async () => {
      const serviceWithoutInvoker = new MnemosHumanInTheLoopService(mockLogRepo as any);
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/test.pdf').toString('base64url');
      const result = await serviceWithoutInvoker.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos tool runtime not available');
      expect(result.responseText).toContain('tool runtime is not available');
    });

    it('propagates error returned by index_file', async () => {
      mockInvoker.execute.mockResolvedValue(JSON.stringify({ error: 'File not found' }));
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/missing.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('File not found');
      expect(result.responseText).toContain('Failed to index');
    });

    it('processes index_reject', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('mnemos:index_reject:all', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('index_reject');
      expect(result.responseText).toContain('will not index');
    });

    it('processes vault_status when mnemos is connected', async () => {
      const mcpRuntime = createMockMcpRuntime(true);
      const result = await service.processCallback('mnemos:vault_status', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('vault_status');
      expect(result.responseText).toContain('Mnemos Vault Status');
    });

    it('processes vault_status when mnemos is disconnected', async () => {
      const mcpRuntime = createMockMcpRuntime(false);
      const result = await service.processCallback('mnemos:vault_status', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos not connected');
    });

    it('handles unknown action', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('mnemos:unknown_action:data', mcpRuntime as any);

      expect(result.handled).toBe(false);
      expect(result.action).toBe('unknown');
    });
  });
});
