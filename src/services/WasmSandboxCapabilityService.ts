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
        detail: 'Tier Wasm desabilitado por configuracao (ZAVORTH_WASM_SANDBOX_ENABLED).',
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
        detail: 'Runtime WebAssembly indisponivel neste host Node.',
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
        detail: 'Tier Wasm inicial suporta apenas modulos Wasm precompilados com exports numericos.',
        runtime: 'node-webassembly',
        supportedLanguages,
        recommendedAction: 'npm run sandbox:wasm:smoke',
      };
    }

    return {
      enabled,
      available,
      canRun: true,
      detail: 'Tier Wasm pronto para execucao controlada de modulos Wasm precompilados.',
      runtime: 'node-webassembly',
      supportedLanguages,
      recommendedAction: 'npm run sandbox:wasm:smoke',
    };
  }
}
