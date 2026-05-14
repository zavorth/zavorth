import { WorkspaceCommandService } from '../../src/services/WorkspaceCommandService';

describe('WorkspaceCommandService', () => {
  it('lists reusable commands from workspace metadata', () => {
    const service = new WorkspaceCommandService();
    const profile = {
      workspace_commands: [
        { name: 'review', template: '/workflow review ${args}' },
        { name: 'smoke', template: '/run npm run test:smoke' },
      ],
    };

    expect(service.listCommands(profile)).toEqual(expect.arrayContaining([
      { name: 'review', template: '/workflow review ${args}' },
      { name: 'smoke', template: '/run npm run test:smoke' },
    ]));
    expect(service.buildNotes(profile)).toEqual(expect.arrayContaining([
      '/review: /workflow review ${args}',
      '/smoke: /run npm run test:smoke',
    ]));
  });

  it('resolves reusable commands with args placeholder replacement', () => {
    const service = new WorkspaceCommandService();
    const resolved = service.resolveInvocation(
      {
        workspace_commands: [
          { name: 'review', template: '/workflow review ${args}' },
        ],
      },
      'review',
      'revise o modulo atual',
    );

    expect(resolved).toEqual(expect.objectContaining({
      name: 'review',
      template: '/workflow review ${args}',
      resolvedText: '/workflow review revise o modulo atual',
    }));
  });

  it('appends args when the template has no explicit placeholder', () => {
    const service = new WorkspaceCommandService();
    const resolved = service.resolveInvocation(
      {
        workspace_commands: [
          { name: 'smoke', template: '/run npm run test:smoke' },
        ],
      },
      'smoke',
      '-- --json',
    );

    expect(resolved?.resolvedText).toBe('/run npm run test:smoke -- --json');
  });
});
