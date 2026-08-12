import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { SelfModificationCommandService } from '../../src/services/SelfModificationCommandService';

jest.mock('../../src/providers/ProviderFactory', () => ({
  ProviderFactory: {
    create: jest.fn(),
  },
}));


describe('SelfModificationCommandService', () => {
  const projectRoot = path.join(process.cwd(), 'tmp', 'selfmod-command-service');
  const previewDir = path.join(projectRoot, 'tmp', 'selfmod-previews');

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it('rejects absolute paths before touching the engine', async () => {
    const engine = {
      previewModification: jest.fn(),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn(),
      safeApply: jest.fn(),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });

    const result = await service.createPreview(
      path.join(projectRoot, 'src', 'AuthGuard.ts'),
      'endurecer o guard',
      '42',
    );

    expect(result.success).toBe(false);
    expect(result.summary).toContain('Use apenas arquivos relativos');
    expect(engine.previewModification).not.toHaveBeenCalled();
  });

  it('rejects extensions without a safe validator', async () => {
    const engine = {
      previewModification: jest.fn(),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn(),
      safeApply: jest.fn(),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });

    const result = await service.createPreview('docs/self-modification.md', 'reescreva a documentacao', '42');

    expect(result.success).toBe(false);
    expect(result.summary).toContain('Use apenas arquivos relativos em src/, tests/, config/ ou scripts/');
    expect(engine.previewModification).not.toHaveBeenCalled();
  });

  it('allows scripts in scripts/ with .ps1 extension', async () => {
    fs.mkdirSync(path.join(projectRoot, 'scripts'), { recursive: true });
    const absolutePath = path.join(projectRoot, 'scripts', 'sample.ps1');
    fs.writeFileSync(absolutePath, 'Write-Host "ok"\n', 'utf8');

    const engine = {
      previewModification: jest.fn().mockResolvedValue({
        success: true,
        absolutePath,
        currentContent: 'Write-Host "ok"\n',
        proposedContent: 'Write-Host "updated"\n',
        summary: 'Atualiza o script PowerShell.',
      }),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn(),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });
    jest.spyOn(service as any, 'runDeepValidation').mockReturnValue([
      { filePath: 'project:build', passes: true, output: 'build ok' },
    ]);

    const result = await service.createPreview('scripts/sample.ps1', 'atualize a mensagem', '42');

    expect(result.success).toBe(true);
    expect(engine.previewModification).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'scripts/sample.ps1',
      }),
    );
  });

  it('creates a preview artifact and applies the exact same proposal by preview id', async () => {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, 'src', 'sample.ts'), 'export const value = 1;\n', 'utf8');

    const engine = {
      previewModification: jest.fn().mockResolvedValue({
        success: true,
        absolutePath: path.join(projectRoot, 'src', 'sample.ts'),
        currentContent: 'export const value = 1;\n',
        proposedContent: 'export const value = 2;\n',
        summary: 'Atualiza o valor exportado.',
      }),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn().mockImplementation(async (targetPath: string, content: string) => {
        fs.writeFileSync(targetPath, content, 'utf8');
        return {
        success: true,
        reason: 'Arquivo sample.ts modificado com sucesso. Backup criado pelo Host.',
        };
      }),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });
    jest.spyOn(service as any, 'runDeepValidation').mockReturnValue([
      { filePath: 'project:build', passes: true, output: 'build ok' },
    ]);

    const preview = await service.createPreview('src/sample.ts', 'atualize o valor para 2', '42');

    expect(preview.success).toBe(true);
    expect(preview.previewId).toBeTruthy();
    expect(preview.diffSummary).toContain('+export const value = 2;');
    expect(preview.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'plan',
        status: 'planned',
        source: 'selfmod',
      }),
    ]));

    const apply = await service.applyPreview(preview.previewId!, '42');

    expect(apply.success).toBe(true);
    expect(apply.changeId).toBeTruthy();
    expect(apply.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'execution',
        status: 'completed',
        source: 'selfmod',
      }),
    ]));
    expect(safeModificationService.safeApply).toHaveBeenCalledWith(
      path.join(projectRoot, 'src', 'sample.ts'),
      'export const value = 2;\n',
    );

    const rollback = await service.rollbackChangeSet(apply.changeId!, '42');

    expect(rollback.success).toBe(true);
    expect(fs.readFileSync(path.join(projectRoot, 'src', 'sample.ts'), 'utf8')).toBe('export const value = 1;\n');
  });

  it('blocks apply when the file changed after the preview was generated', async () => {
    fs.mkdirSync(path.join(projectRoot, 'src'), { recursive: true });
    const absolutePath = path.join(projectRoot, 'src', 'sample.ts');
    fs.writeFileSync(absolutePath, 'export const value = 1;\n', 'utf8');

    const engine = {
      previewModification: jest.fn().mockResolvedValue({
        success: true,
        absolutePath,
        currentContent: 'export const value = 1;\n',
        proposedContent: 'export const value = 2;\n',
        summary: 'Atualiza o valor exportado.',
      }),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn(),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });
    jest.spyOn(service as any, 'runDeepValidation').mockReturnValue([
      { filePath: 'project:build', passes: true, output: 'build ok' },
    ]);

    const preview = await service.createPreview('src/sample.ts', 'atualize o valor para 2', '42');
    fs.writeFileSync(absolutePath, 'export const value = 99;\n', 'utf8');

    const apply = await service.applyPreview(preview.previewId!, '42');

    expect(apply.success).toBe(false);
    expect(apply.summary).toContain('arquivo mudou desde que o preview foi gerado');
    expect(safeModificationService.safeApply).not.toHaveBeenCalled();
  });

  it('allows safe .ps1 previews under scripts/', async () => {
    fs.mkdirSync(path.join(projectRoot, 'scripts'), { recursive: true });
    const absolutePath = path.join(projectRoot, 'scripts', 'launch-zavorth-supervised.ps1');
    fs.writeFileSync(absolutePath, 'Write-Host "old"\n', 'utf8');

    const engine = {
      previewModification: jest.fn().mockResolvedValue({
        success: true,
        absolutePath,
        currentContent: 'Write-Host "old"\n',
        proposedContent: 'Write-Host "new"\n',
        summary: 'Atualiza o script supervisionado.',
      }),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn(),
    } as any;
    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      engine,
      safeModificationService,
    });
    jest.spyOn(service as any, 'runDeepValidation').mockReturnValue([
      { filePath: 'project:build', passes: true, output: 'build ok' },
    ]);

    const preview = await service.createPreview('scripts/launch-zavorth-supervised.ps1', 'ajuste o launcher', '42');

    expect(preview.success).toBe(true);
    expect(engine.previewModification).toHaveBeenCalledWith({
      filePath: 'scripts/launch-zavorth-supervised.ps1',
      instruction: 'ajuste o launcher',
    });
  });

  it('enriches goal previews with runtime risk, companion impact and rollback confidence', async () => {
    const goalPreviewDir = path.join(projectRoot, 'tmp', 'selfmod-goal-previews');
    const historyDir = path.join(projectRoot, 'tmp', 'selfmod-history');
    const shadowWorkspaceDir = path.join(projectRoot, 'tmp', 'selfmod-shadow');
    const patternMemoryFile = path.join(projectRoot, 'data', 'runtime', 'selfmod-pattern-memory.json');
    const absolutePath = path.join(projectRoot, 'src', 'services', 'WebAppService.ts');
    const currentContent = 'export const gateway = true;\n';
    const nextContent = 'export const gateway = "hardened";\n';

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.mkdirSync(goalPreviewDir, { recursive: true });
    fs.mkdirSync(historyDir, { recursive: true });
    fs.mkdirSync(shadowWorkspaceDir, { recursive: true });
    fs.writeFileSync(absolutePath, currentContent, 'utf8');

    const engine = {
      previewModification: jest.fn().mockResolvedValue({
        success: true,
        absolutePath,
        currentContent,
        proposedContent: nextContent,
        summary: 'Fortalece a surface web do gateway.',
      }),
    } as any;
    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn(),
    } as any;
    const provider = {
      chat: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          summary: 'Plano para fortalecer a surface do gateway.',
          validationPlan: ['npm run build', 'smoke do gateway'],
          resourceImpact: {
            ramIdleMb: 96,
            diskMb: 24,
            processCount: 1,
            notes: 'selfmod focado em runtime web',
          },
          changes: [
            {
              filePath: 'src/services/WebAppService.ts',
              instruction: 'endureca a surface do gateway sem quebrar o fluxo supervisionado',
            },
          ],
        }),
      }),
    } as any;

    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      goalPreviewDir,
      historyDir,
      shadowWorkspaceDir,
      patternMemoryFile,
      engine,
      safeModificationService,
      provider,
    });
    jest.spyOn(service as any, 'runDeepValidation').mockReturnValue([
      { filePath: 'project:build', passes: true, output: 'build ok' },
    ]);

    const preview = await service.createGoalPreview('fortalecer o gateway web com seguranca operacional', '42');

    expect(preview.success).toBe(true);
    expect(preview.mode).toBe('goal');
    expect(preview.optimizationAnalysis?.resourceDelta.summary).toContain('96 MB RAM');
    expect(preview.optimizationAnalysis?.runtimeRisk.level).toMatch(/moderate|high|critical/);
    expect(preview.optimizationAnalysis?.companionImpact.companionIds).toContain('zavorthBridge');
    expect(preview.optimizationAnalysis?.rollbackConfidence).toBeLessThan(0.9);
    expect(fs.existsSync(patternMemoryFile)).toBe(true);
  });

  it('applies and rolls back an exact goal changeset from persisted artifacts', async () => {
    const goalPreviewDir = path.join(projectRoot, 'tmp', 'selfmod-goal-previews');
    const historyDir = path.join(projectRoot, 'tmp', 'selfmod-history');
    const shadowWorkspaceDir = path.join(projectRoot, 'tmp', 'selfmod-shadow');
    const absolutePath = path.join(projectRoot, 'src', 'sample.ts');
    const previousContent = 'export const value = 1;\n';
    const nextContent = 'export const value = 2;\n';

    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.mkdirSync(goalPreviewDir, { recursive: true });
    fs.mkdirSync(historyDir, { recursive: true });
    fs.mkdirSync(shadowWorkspaceDir, { recursive: true });
    fs.writeFileSync(absolutePath, previousContent, 'utf8');

    const safeModificationService = {
      validateCandidate: jest.fn().mockReturnValue({ passes: true, output: '' }),
      safeApply: jest.fn().mockImplementation(async (targetPath: string, content: string) => {
        fs.writeFileSync(targetPath, content, 'utf8');
        return {
          success: true,
          reason: 'safe apply ok',
        };
      }),
    } as any;

    const service = new SelfModificationCommandService({
      projectRoot,
      previewDir,
      goalPreviewDir,
      historyDir,
      shadowWorkspaceDir,
      engine: {} as any,
      safeModificationService,
    });

    const previewId = 'goal-preview-1';
    fs.writeFileSync(
      path.join(goalPreviewDir, `${previewId}.json`),
      JSON.stringify({
        kind: 'goal',
        previewId,
        goal: 'atualizar sample.ts',
        summary: 'Atualiza o valor exportado.',
        createdAt: new Date().toISOString(),
        requestedBy: '42',
        resourceImpact: {
          ramIdleMb: 0,
          diskMb: 0,
          processCount: 0,
        },
        validationPlan: ['build'],
        shadowWorkspaceDir,
        changes: [
          {
            relativePath: 'src/sample.ts',
            absolutePath,
            instruction: 'atualize o valor para 2',
            summary: 'Atualiza o valor exportado.',
            generatedContent: nextContent,
            currentContent: previousContent,
            originalHash: crypto.createHash('sha256').update(previousContent, 'utf8').digest('hex'),
            originalExists: true,
            diffSummary: '@@ -1 +1 @@',
          },
        ],
        validations: [],
      }, null, 2),
      'utf8',
    );

    const apply = await service.applyPreview(previewId, '42');

    expect(apply.success).toBe(true);
    expect(apply.mode).toBe('goal');
    expect(apply.changeId).toBeTruthy();
    expect(fs.readFileSync(absolutePath, 'utf8')).toBe(nextContent);

    const rollback = await service.rollbackChangeSet(apply.changeId!, '42');

    expect(rollback.success).toBe(true);
    expect(rollback.restoredFiles).toBe(1);
    expect(fs.readFileSync(absolutePath, 'utf8')).toBe(previousContent);
  });
});
