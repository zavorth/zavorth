import { BotGateway } from '../../src/telegram/BotGateway';

describe('BotGateway workspace reusable commands', () => {
  it('resolves unknown slash commands through workspace command aliases', async () => {
    const gateway = Object.create(BotGateway.prototype) as any;
    gateway.parser = {
      parse: jest.fn().mockReturnValue({
        command_type: '/workflow',
        command_args: 'review revise o modulo atual',
        normalized_message: '/workflow review revise o modulo atual',
        explicit_executor: null,
        references_last_task: false,
        workspace_command_name: null,
      }),
    };
    gateway.workspaceProfileService = {
      getProfile: jest.fn().mockResolvedValue({
        workspace_commands: [
          { name: 'review', template: '/workflow review ${args}' },
        ],
      }),
    };
    gateway.workspaceCommandService = {
      resolveInvocation: jest.fn().mockReturnValue({
        name: 'review',
        template: '/workflow review ${args}',
        resolvedText: '/workflow review revise o modulo atual',
        argsText: 'revise o modulo atual',
      }),
    };

    const result = await gateway.resolveWorkspaceCommandInput(
      '/review revise o modulo atual',
      {
        command_type: 'unknown',
        command_args: 'revise o modulo atual',
        normalized_message: '/review revise o modulo atual',
        explicit_executor: null,
        references_last_task: false,
        workspace_command_name: null,
      },
    );

    expect(gateway.workspaceProfileService.getProfile).toHaveBeenCalled();
    expect(gateway.workspaceCommandService.resolveInvocation).toHaveBeenCalledWith(
      expect.any(Object),
      'review',
      'revise o modulo atual',
    );
    expect(result).toEqual({
      rawText: '/workflow review revise o modulo atual',
      parsed: expect.objectContaining({
        command_type: '/workflow',
        command_args: 'review revise o modulo atual',
        workspace_command_name: 'review',
      }),
    });
  });
});
