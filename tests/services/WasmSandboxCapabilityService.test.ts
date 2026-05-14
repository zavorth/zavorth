import { config } from '../../src/config/index';
import { WasmSandboxCapabilityService } from '../../src/services/WasmSandboxCapabilityService';

describe('WasmSandboxCapabilityService', () => {
  const originalEnabled = config.wasmSandboxEnabled;

  afterEach(() => {
    (config as any).wasmSandboxEnabled = originalEnabled;
  });

  it('reports the wasm tier as planned when disabled', () => {
    (config as any).wasmSandboxEnabled = false;
    const service = new WasmSandboxCapabilityService();

    expect(service.getStatus('wasm')).toEqual(
      expect.objectContaining({
        enabled: false,
        canRun: false,
        runtime: 'node-webassembly',
      }),
    );
  });

  it('reports the wasm tier as ready for wasm modules when enabled and available', () => {
    (config as any).wasmSandboxEnabled = true;
    const service = new WasmSandboxCapabilityService();

    expect(service.getStatus('wasm')).toEqual(
      expect.objectContaining({
        enabled: true,
        available: true,
        canRun: true,
        supportedLanguages: ['wasm'],
      }),
    );
    expect(service.getStatus('javascript')).toEqual(
      expect.objectContaining({
        enabled: true,
        canRun: false,
      }),
    );
  });
});
