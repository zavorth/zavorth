import { ToolRuntimeService } from '../../../src/services/tools/ToolRuntimeService';

describe('ToolRuntimeService', () => {
  it('lists tool definitions and names from the registry', () => {
    const runtime = new ToolRuntimeService(
      {
        getToolDefinitions: jest.fn().mockReturnValue([
          {
            name: 'read_file',
            description: 'Reads a file',
            parameters: {
              type: 'object',
              properties: {},
              required: [],
            },
          },
        ]),
        getAllTools: jest.fn().mockReturnValue([
          {
            name: 'read_file',
          },
          {
            name: 'list_directory',
          },
        ]),
        getTool: jest.fn().mockReturnValue({ name: 'read_file' }),
      } as any,
      {
        executeTool: jest.fn(),
      } as any,
    );

    expect(runtime.getToolDefinitions()).toHaveLength(1);
    expect(runtime.getRegisteredToolNames()).toEqual(['read_file', 'list_directory']);
    expect(runtime.listTools()).toEqual([
      expect.objectContaining({
        id: 'read_file',
        group: 'workspace',
      }),
      expect.objectContaining({
        id: 'list_directory',
        group: 'workspace',
      }),
    ]);
    expect(runtime.listToolsByGroup('workspace').map((tool) => tool.id)).toEqual(['read_file', 'list_directory']);
    expect(runtime.getToolEntry('read_file')).toEqual(expect.objectContaining({
      id: 'read_file',
      group: 'workspace',
    }));
    expect(runtime.hasTool('read_file')).toBe(true);
    expect(runtime.isAvailable()).toBe(true);
  });

  it('throws a clear error when execution is requested without a configured executor', async () => {
    const runtime = new ToolRuntimeService(
      {
        getToolDefinitions: jest.fn().mockReturnValue([]),
        getAllTools: jest.fn().mockReturnValue([]),
        getTool: jest.fn().mockReturnValue(undefined),
      } as any,
    );

    await expect(runtime.executeTool('read_file', { path: 'README.md' })).rejects.toThrow(
      'Tool runtime without executor configured in this session.',
    );
  });
});
