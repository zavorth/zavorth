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
    expect(runtime.toolRuntime.listToolsByGroup('workspace').map((tool: { id: string }) => tool.id)).toEqual(expect.arrayContaining([
      'create_file',
      'read_file',
      'list_directory',
      'workspace.read',
      'workspace.list',
      'workspace.write',
      'workspace.edit',
      'workspace.apply_patch',
    ]));

    expect(names).toContain('zavorth_cron_scheduler');
    expect(names).toContain('zavorth_delegate');
    expect(names).toContain('zavorth_security_guidance');
    expect(names).toContain('zavorth_novita');
    expect(names).toContain('zavorth_replicate');
    expect(names).toContain('zavorth_huggingface');
    expect(names).toContain('zavorth_firecrawl');
    expect(names).toContain('zavorth_fal');
    expect(names).toContain('zavorth_comfyui');
    expect(names).toContain('zavorth_searxng');
    expect(names).toContain('zavorth_runway');
    expect(names).toContain('zavorth_spotify');

    expect(runtime.plugins).toBeDefined();
    expect(runtime.plugins.activeMemory).toBeDefined();
    expect(runtime.plugins.kanbanDispatcher).toBeDefined();
    expect(runtime.plugins.prometheusMetrics).toBeDefined();

    runtime.dispose();
  });
});
