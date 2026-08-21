import { UniversalCommandRegistry } from '../../../src/domain/commands/UniversalCommandRegistry.js';
import type { UniversalCommandDescriptor } from '../../../src/contracts/commands/UniversalCommandContract.js';

describe('UniversalCommandRegistry', () => {
  let registry: UniversalCommandRegistry;

  beforeEach(() => {
    registry = new UniversalCommandRegistry();
  });

  const sampleDescriptor: UniversalCommandDescriptor = {
    id: 'test.sample',
    name: 'Sample Test Command',
    description: 'Executes a sample test operation.',
    toolName: 'sample_test_operation',
    slashAliases: ['/sample', '/s', 'sample-alias'],
    group: 'workspace',
    riskLevel: 'read_only',
    requiresApproval: false,
    execute: async (args) => ({
      success: true,
      message: 'Sample executed successfully',
      data: args,
      formattedOutput: `[Sample] Result: ${JSON.stringify(args)}`,
    }),
  };

  it('registers and retrieves commands by id, toolName, and alias', () => {
    registry.register(sampleDescriptor);

    expect(registry.getById('test.sample')).toBe(sampleDescriptor);
    expect(registry.getByToolName('sample_test_operation')).toBe(sampleDescriptor);
    expect(registry.getByAlias('/sample')).toBe(sampleDescriptor);
    expect(registry.getByAlias('sample')).toBe(sampleDescriptor);
    expect(registry.getByAlias('/s')).toBe(sampleDescriptor);
    expect(registry.getByAlias('sample-alias')).toBe(sampleDescriptor);
    expect(registry.hasAlias('/sample')).toBe(true);
    expect(registry.hasAlias('unknown')).toBe(false);
  });

  it('lists commands by group', () => {
    registry.register(sampleDescriptor);
    registry.register({
      ...sampleDescriptor,
      id: 'test.network',
      toolName: 'network_test',
      slashAliases: ['/net'],
      group: 'network',
    });

    const workspaceCommands = registry.listByGroup('workspace');
    expect(workspaceCommands).toHaveLength(1);
    expect(workspaceCommands[0].id).toBe('test.sample');

    const networkCommands = registry.listByGroup('network');
    expect(networkCommands).toHaveLength(1);
    expect(networkCommands[0].id).toBe('test.network');
  });

  it('executes command by alias and returns structured execution result', async () => {
    registry.register(sampleDescriptor);

    const result = await registry.executeByAlias('/s', { foo: 'bar' });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Sample executed successfully');
    expect(result.data).toEqual({ foo: 'bar' });
    expect(result.formattedOutput).toContain('bar');
  });

  it('executes command by toolName and returns structured execution result', async () => {
    registry.register(sampleDescriptor);

    const result = await registry.executeByToolName('sample_test_operation', { count: 42 });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Sample executed successfully');
    expect(result.data).toEqual({ count: 42 });
  });

  it('returns clean error result for non-existent commands', async () => {
    const aliasResult = await registry.executeByAlias('missing');
    expect(aliasResult.success).toBe(false);
    expect(aliasResult.error).toBe('COMMAND_NOT_FOUND');

    const toolResult = await registry.executeByToolName('missing_tool');
    expect(toolResult.success).toBe(false);
    expect(toolResult.error).toBe('TOOL_NOT_FOUND');
  });
});
