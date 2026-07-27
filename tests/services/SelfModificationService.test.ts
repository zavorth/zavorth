import fs from 'fs';
import path from 'path';
import { SelfModificationService } from '../../src/services/SelfModificationService';

describe('SelfModificationService', () => {
  const projectRoot = path.join(process.cwd(), 'tmp', 'self-modification-service');
  const filePath = 'src/sample.ts';
  const absoluteFilePath = path.join(projectRoot, filePath);

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  function createService(responseContent: string) {
    const provider = {
      name: 'mock',
      chat: jest.fn().mockResolvedValue({
        content: responseContent,
        toolCalls: [],
        finishReason: 'stop',
      }),
    } as any;

    const safeModificationService = {
      safeApply: jest.fn().mockResolvedValue({
        success: true,
        reason: 'File sample.ts modificado com sucesso. Backup criado pelo Host.',
      }),
    } as any;

    const service = new SelfModificationService({
      projectRoot,
      provider,
      safeModificationService,
    });

    return { service, provider, safeModificationService };
  }

  it('previews a change by producing a diff and summary without writing to disk', async () => {
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, 'export const value = 1;\n', 'utf-8');

    const { service, provider, safeModificationService } = createService(
      JSON.stringify({
        fullContent: 'export const value = 2;\n',
        summary: 'Atualiza o value exportado.',
        warnings: ['Revisar usos dependentes.'],
        rationale: 'O requisito pede um novo value pattern.',
      }),
    );

    const result = await service.previewModification({
      filePath,
      instruction: 'Atualize o value exportado para 2.',
    });

    expect(result.success).toBe(true);
    expect(result.proposedContent).toBe('export const value = 2;');
    expect(result.summary).toContain('Atualiza o value exportado.');
    expect(result.diffPatch).toContain('-export const value = 1;');
    expect(result.diffPatch).toContain('+export const value = 2;');
    expect(result.stats.insertions).toBeGreaterThan(0);
    expect(result.stats.deletions).toBeGreaterThan(0);
    expect(provider.chat).toHaveBeenCalledTimes(1);
    expect(safeModificationService.safeApply).not.toHaveBeenCalled();
    expect(fs.readFileSync(absoluteFilePath, 'utf-8')).toBe('export const value = 1;\n');
  });

  it('applies the proposed change through SafeModificationService when requested', async () => {
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, 'export const value = 1;\n', 'utf-8');

    const { service, safeModificationService } = createService(
      JSON.stringify({
        fullContent: 'export const value = 2;\n',
        summary: 'Atualiza o value exportado.',
      }),
    );

    const result = await service.applyModification({
      filePath,
      instruction: 'Atualize o value exportado para 2.',
    });

    expect(result.applied).toBe(true);
    expect(safeModificationService.safeApply).toHaveBeenCalledWith(
      absoluteFilePath,
      'export const value = 2;',
    );
    expect(result.modificationResult?.success).toBe(true);
  });

  it('rejects paths outside the project root before calling the model', async () => {
    const { service, provider, safeModificationService } = createService(
      JSON.stringify({
        fullContent: 'export const value = 2;\n',
      }),
    );

    const result = await service.previewModification({
      filePath: '../outside.ts',
      instruction: 'Troque o value.',
    });

    expect(result.success).toBe(false);
    expect(result.reason).toContain('fora da raiz do projeto');
    expect(provider.chat).not.toHaveBeenCalled();
    expect(safeModificationService.safeApply).not.toHaveBeenCalled();
  });

  it('falls back to raw text when the model does not return JSON', async () => {
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, 'export const value = 1;\n', 'utf-8');

    const { service } = createService('export const value = 3;\n');

    const result = await service.previewModification({
      filePath,
      instruction: 'Atualize o value exportado para 3.',
    });

    expect(result.success).toBe(true);
    expect(result.proposedContent).toBe('export const value = 3;');
    expect(result.summary).toContain('texto bruto');
  });
});
