import { config } from '../config/index.js';

export type WasmSandboxStatus = {
  enabled: boolean;
  available: boolean;
  canRun: boolean;
  detail: string;
  runtime: string;
  supportedLanguages: string[];
  recommendedAction: string | null;
};

export class WasmSandboxCapabilityService {
  public isAvailable(): boolean {
    return typeof WebAssembly !== 'undefined'
      && typeof WebAssembly.instantiate === 'function'
      && typeof WebAssembly.compile === 'function';
  }

  public getStatus(language = 'wasm'): WasmSandboxStatus {
    const enabled = config.wasmSandboxEnabled;
    const available = this.isAvailable();
    const supportedLanguages = ['wasm'];

    if (!enabled) {
      return {
        enabled,
        available,
        canRun: false,
        detail: 'Wasm tier disabled by configuration (ZAVORTH_WASM_SANDBOX_ENABLED).',
        runtime: 'node-webassembly',
        supportedLanguages,
        recommendedAction: 'npm run sandbox:wasm:smoke',
      };
    }

    if (!available) {
      return {
        enabled,
        available,
        canRun: false,
        detail: 'Runtime WebAssembly unavailable on this host Node.',
        runtime: 'node-webassembly',
        supportedLanguages,
        recommendedAction: 'npm run sandbox:wasm:smoke',
      };
    }

    if (language !== 'wasm') {
      return {
        enabled,
        available,
        canRun: false,
        detail: 'Tier Wasm inicial suporta only modulos Wasm precompilados com exports numericos.',
        runtime: 'node-webassembly',
        supportedLanguages,
        recommendedAction: 'npm run sandbox:wasm:smoke',
      };
    }

    return {
      enabled,
      available,
      canRun: true,
      detail: 'Wasm tier ready for controlled execution of precompiled Wasm modules.',
      runtime: 'node-webassembly',
      supportedLanguages,
      recommendedAction: 'npm run sandbox:wasm:smoke',
    };
  }
}
