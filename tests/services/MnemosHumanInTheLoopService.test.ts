import { MnemosHumanInTheLoopService } from '../../src/services/MnemosHumanInTheLoopService';

const createMockLogRepo = () => ({
  log: jest.fn(),
});

const createMockMcpRuntime = (mnemosConnected = true) => ({
  readSnapshot: jest.fn().mockReturnValue({
    entries: mnemosConnected
      ? [{ id: 'mnemos', status: 'connected', toolCount: 5, toolNames: ['search_memory', 'scan_local_metadata', 'index_file', 'vault_status', 'delete_memory'] }]
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
    it('retorna mensagem sem botoes quando nao ha candidatos', () => {
      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'portas logicas',
        candidates: [],
      });

      expect(result.text).toContain('não encontrei nenhum arquivo');
      expect(result.buttons).toHaveLength(0);
    });

    it('gera botoes inline para cada candidato', () => {
      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'portas logicas',
        candidates: [
          { name: 'portas_logicas.pdf', path: '/scan/downloads/portas_logicas.pdf', size_bytes: 1024 * 1024, extension: '.pdf' },
          { name: 'algebra_booleana.md', path: '/scan/docs/algebra_booleana.md', size_bytes: 512, extension: '.md' },
        ],
      });

      expect(result.text).toContain('Busca no Cofre Mnemos');
      expect(result.text).toContain('portas_logicas.pdf');
      expect(result.text).toContain('algebra_booleana.md');
      // 2 botões de indexação + 1 botão de rejeição
      expect(result.buttons).toHaveLength(3);
      expect(result.buttons[0][0].callback_data).toMatch(/^mnemos:index_confirm:/);
      expect(result.buttons[2][0].callback_data).toBe('mnemos:index_reject:all');
    });

    it('limita botoes a 3 candidatos + 1 rejeicao', () => {
      const candidates = Array.from({ length: 5 }, (_, i) => ({
        name: `file_${i}.pdf`,
        path: `/scan/file_${i}.pdf`,
        size_bytes: 1024,
        extension: '.pdf',
      }));

      const result = service.buildCandidatePrompt({
        chatId: '123',
        userId: '456',
        originalQuery: 'qualquer coisa',
        candidates,
      });

      // Maximo 3 candidatos + 1 rejeicao = 4 linhas de botoes
      expect(result.buttons).toHaveLength(4);
    });
  });

  describe('processCallback', () => {
    it('ignora callbacks que nao pertencem ao mnemos', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('hub:action', mcpRuntime as any);
      expect(result.handled).toBe(false);
    });

    it('processa index_confirm com sucesso', async () => {
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/downloads/test.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('index_confirm');
      expect(result.error).toBeNull();
      expect(result.responseText).toContain('foi indexado');
      expect(mockInvoker.execute).toHaveBeenCalledWith('index_file', {
        file_path: '/scan/downloads/test.pdf',
      });
    });

    it('detecta Mnemos desconectado no index_confirm', async () => {
      const mcpRuntime = createMockMcpRuntime(false);
      const encodedPath = Buffer.from('/scan/test.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos not connected');
      expect(result.responseText).toContain('não está conectado');
      expect(mockInvoker.execute).not.toHaveBeenCalled();
    });

    it('detecta runtime de tools ausente no index_confirm', async () => {
      const serviceWithoutInvoker = new MnemosHumanInTheLoopService(mockLogRepo as any);
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/test.pdf').toString('base64url');
      const result = await serviceWithoutInvoker.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos tool runtime not available');
      expect(result.responseText).toContain('runtime de tools');
    });

    it('propaga erro retornado pelo index_file', async () => {
      mockInvoker.execute.mockResolvedValue(JSON.stringify({ error: 'Arquivo não encontrado' }));
      const mcpRuntime = createMockMcpRuntime(true);
      const encodedPath = Buffer.from('/scan/missing.pdf').toString('base64url');
      const result = await service.processCallback(`mnemos:index_confirm:${encodedPath}`, mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Arquivo não encontrado');
      expect(result.responseText).toContain('Falha ao indexar');
    });

    it('processa index_reject', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('mnemos:index_reject:all', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('index_reject');
      expect(result.responseText).toContain('Não vou indexar');
    });

    it('processa vault_status com mnemos conectado', async () => {
      const mcpRuntime = createMockMcpRuntime(true);
      const result = await service.processCallback('mnemos:vault_status', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.action).toBe('vault_status');
      expect(result.responseText).toContain('Status do Cofre');
    });

    it('processa vault_status com mnemos desconectado', async () => {
      const mcpRuntime = createMockMcpRuntime(false);
      const result = await service.processCallback('mnemos:vault_status', mcpRuntime as any);

      expect(result.handled).toBe(true);
      expect(result.error).toBe('Mnemos not connected');
    });

    it('trata acao desconhecida', async () => {
      const mcpRuntime = createMockMcpRuntime();
      const result = await service.processCallback('mnemos:unknown_action:data', mcpRuntime as any);

      expect(result.handled).toBe(false);
      expect(result.action).toBe('unknown');
    });
  });
});
