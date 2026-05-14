import { ComposerContextService } from '../../src/services/ComposerContextService';

describe('ComposerContextService', () => {
  it('appends file and artifact context to the execution message', () => {
    const service = new ComposerContextService();

    const result = service.buildExecutionText(
      '/task revisar isso',
      [
        {
          id: 'action:file',
          type: 'action',
          label: '#usar-arquivo:index.ts',
          payload: {
            action: 'attach_file_context',
            fileName: 'index.ts',
            path: 'C:/repo/src/index.ts',
            workspace: 'C:/repo',
            taskId: 'task-123456789',
          },
        },
        {
          id: 'action:artifact',
          type: 'action',
          label: '#usar-artefato:build-log',
          payload: {
            action: 'attach_artifact_context',
            name: 'build.log',
            path: 'C:/repo/output/build.log',
            summary: 'Log principal do build.',
            taskId: 'task-123456789',
          },
        },
      ] as any,
    );

    expect(result).toContain('/task revisar isso');
    expect(result).toContain('[Contexto do composer]');
    expect(result).toContain('Arquivo selecionado para este pedido:');
    expect(result).toContain('Caminho: C:/repo/src/index.ts');
    expect(result).toContain('Artefato selecionado para este pedido:');
    expect(result).toContain('Resumo: Log principal do build.');
  });

  it('flags context actions without a natural-language follow-up', () => {
    const service = new ComposerContextService();

    expect(
      service.hasPendingFollowupActionWithoutMessage(
        '   ',
        [
          {
            id: 'action:file',
            type: 'action',
            label: '#usar-arquivo:index.ts',
            payload: { action: 'attach_file_context' },
          },
        ] as any,
      ),
    ).toBe(true);

    expect(
      service.hasPendingFollowupActionWithoutMessage(
        'analise esse arquivo',
        [
          {
            id: 'action:file',
            type: 'action',
            label: '#usar-arquivo:index.ts',
            payload: { action: 'attach_file_context' },
          },
        ] as any,
      ),
    ).toBe(false);
  });
});
