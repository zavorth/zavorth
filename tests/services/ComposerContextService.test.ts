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
    expect(result).toContain('[Composer context]');
    expect(result).toContain('Selected file for this request:');
    expect(result).toContain('Path: C:/repo/src/index.ts');
    expect(result).toContain('Selected artifact for this request:');
    expect(result).toContain('Summary: Log principal do build.');
  });

  it('treats a selected command as explicit execution context', () => {
    const service = new ComposerContextService();
    const mentions = [{
      id: '/task',
      type: 'command',
      label: '/task',
      payload: { command: '/task' },
    }] as any;

    expect(service.hasCommandMention(mentions)).toBe(true);
    expect(service.buildExecutionText('review this change', mentions)).toBe('/task review this change');
    expect(service.buildExecutionText('/task review this change', mentions)).toBe('/task review this change');
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
