import { createBootstrapToolRuntime } from '../../src/bootstrap/bootstrapToolRuntime.js';

describe('createBootstrapToolRuntime', () => {
  const originalLog = console.log;
  const originalWarn = console.warn;

  beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.log = originalLog;
    console.warn = originalWarn;
    jest.restoreAllMocks();
  });

  it('registers workspace wrappers beside legacy filesystem aliases', () => {
    const runtime = createBootstrapToolRuntime({ log: jest.fn() } as any);
    const names = runtime.toolRuntime.getRegisteredToolNames();

    expect(names).toEqual(expect.arrayContaining([
      'create_file',
      'read_file',
      'list_directory',
      'workspace.read',
      'workspace.list',
      'workspace.write',
      'workspace.edit',
      'workspace.apply_patch',
    ]));
    expect(runtime.toolRuntime.listToolsByGroup('workspace').map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'create_file',
      'read_file',
      'list_directory',
      'workspace.read',
      'workspace.list',
      'workspace.write',
      'workspace.edit',
      'workspace.apply_patch',
    ]));
  });
});
