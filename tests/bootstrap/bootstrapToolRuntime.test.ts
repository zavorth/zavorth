import { createBootstrapToolRuntime } from '../../src/bootstrap/bootstrapToolRuntime.js';

describe('bootstrapToolRuntime & ToolRegistry integration', () => {
  it('should register all new dynamic tools into ToolRegistry during runtime bootstrap', () => {
    const mockLogRepo = {
      save: jest.fn(),
      getLogs: jest.fn(),
    };

    const runtime = createBootstrapToolRuntime(mockLogRepo as any);
    expect(runtime.toolRegistry).toBeDefined();

    const registeredToolNames = runtime.toolRegistry.getAllTools().map((t: any) => t.name);

    // Verify all 9 tools from recent packages are physically registered in the active registry
    expect(registeredToolNames).toContain('zavorth_macro');
    expect(registeredToolNames).toContain('zavorth_checkpoint');
    expect(registeredToolNames).toContain('zavorth_bm25_search');
    expect(registeredToolNames).toContain('zavorth_lsp_diagnostics');
    expect(registeredToolNames).toContain('zavorth_power_lock');
    expect(registeredToolNames).toContain('zavorth_blueprint');
    expect(registeredToolNames).toContain('zavorth_context_meter');
    expect(registeredToolNames).toContain('zavorth_mcp_doctor');
    expect(registeredToolNames).toContain('zavorth_stealth_browse');
    expect(registeredToolNames).toContain('zavorth_scheduler');
    expect(registeredToolNames).toContain('zavorth_plugin_sdk');
    expect(registeredToolNames).toContain('zavorth_worktree');

    if (typeof runtime.dispose === 'function') {
      runtime.dispose();
    }
  });
});
