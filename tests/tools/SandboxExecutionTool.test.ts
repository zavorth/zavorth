
import { config } from '../../src/config/index';
import { SandboxExecutionTool } from '../../src/tools/SandboxExecutionTool';

const ADD_WASM_BASE64 = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';

describe('SandboxExecutionTool', () => {
  const originalEnabled = config.wasmSandboxEnabled;

  afterEach(() => {
    (config as any).wasmSandboxEnabled = originalEnabled;
  });

  it('executes a wasm module through the wasm path', async () => {
    (config as any).wasmSandboxEnabled = true;
    const tool = new SandboxExecutionTool();

    const output = await tool.execute({
      language: 'wasm',
      code: ADD_WASM_BASE64,
      export_name: 'add',
      args_json: '[7,8]',
      security_level: 'wasm',
      timeout_ms: '5000',
    });

    expect(output).toContain('Sandbox wasm');
    expect(output).toContain('Selected export:');
    expect(output).toContain('Return value: 15');
  });

  it('rejects invalid wasm args_json before execution', async () => {
    (config as any).wasmSandboxEnabled = true;
    const tool = new SandboxExecutionTool();

    const output = await tool.execute({
      language: 'wasm',
      code: ADD_WASM_BASE64,
      export_name: 'add',
      args_json: '{"a":1}',
    });

    expect(output).toContain('Sandbox failure (wasm)');
    expect(output).toContain('args_json');
  });
});
