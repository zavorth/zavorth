import { config } from '../../../src/config/index';
import { WasmSandboxRuntime } from '../../../src/services/sandbox/WasmSandboxRuntime';

const ADD_WASM_BASE64 = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';

describe('WasmSandboxRuntime', () => {
  const originalEnabled = config.wasmSandboxEnabled;
  const originalMaxBytes = config.wasmSandboxMaxBytes;

  afterEach(() => {
    (config as any).wasmSandboxEnabled = originalEnabled;
    (config as any).wasmSandboxMaxBytes = originalMaxBytes;
  });

  it('executes a precompiled wasm module export in a worker', async () => {
    (config as any).wasmSandboxEnabled = true;
    const runtime = new WasmSandboxRuntime();

    const result = await runtime.execute({
      moduleBase64: ADD_WASM_BASE64,
      exportName: 'add',
      args: [2, 3],
      timeoutMs: 5000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        securityLevel: 'wasm',
        runtime: 'WasmSandboxRuntime',
        exitCode: 0,
        selectedExport: 'add',
        returnValue: '5',
      }),
    );
    expect(result.stdout).toContain('5');
  });

  it('fails safely when the requested export does not exist', async () => {
    (config as any).wasmSandboxEnabled = true;
    const runtime = new WasmSandboxRuntime();

    const result = await runtime.execute({
      moduleBase64: ADD_WASM_BASE64,
      exportName: 'missing',
      args: [2, 3],
      timeoutMs: 5000,
    });

    expect(result.exitCode).toBe(-1);
    expect(result.stderr).toContain('Export Wasm');
  });
});
