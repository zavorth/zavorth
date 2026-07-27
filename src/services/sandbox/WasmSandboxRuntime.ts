
import { Worker } from 'worker_threads';
import { config } from '../../config/index.js';
import type { ISandboxRuntime, SandboxRequest, SandboxResult } from './ISandboxRuntime.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type WasmSandboxRequest = {
  moduleBase64: string;
  exportName?: string | null;
  args?: number[];
  timeoutMs?: number;
};

export type WasmSandboxResult = SandboxResult & {
  selectedExport: string | null;
  returnValue: string | null;
};

const WORKER_SOURCE = `
const { parentPort, workerData } = require('worker_threads');

function normalizeReturnValue(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return String(value);
  }
  return JSON.stringify(value);
}

(async () => {
  try {
    const encoded = String(workerData.moduleBase64 || '').trim();
    const base64 = encoded.replace(/^data:application\\/wasm;base64,/i, '').replace(/\\s+/g, '');
    if (!base64) {
      throw new Error('Modulo Wasm vazio.');
    }

    const bytes = Buffer.from(base64, 'base64');
    const compiled = await WebAssembly.compile(bytes);
    const instance = await WebAssembly.instantiate(compiled, {});
    const exportsRecord = instance.exports || {};
    const availableFunctions = Object.entries(exportsRecord).filter(([, value]) => typeof value === 'function');

    if (availableFunctions.length === 0) {
      throw new Error('Modulo Wasm without export function accessible.');
    }

    const requestedExport = String(workerData.exportName || '').trim();
    const selectedExport = requestedExport || String(availableFunctions[0][0]);
    const exportValue = exportsRecord[selectedExport];
    if (typeof exportValue !== 'function') {
      throw new Error(\`Wasm export "\${selectedExport}" not found or not executable.\`);
    }

    const args = Array.isArray(workerData.args) ? workerData.args.map((value) => {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        throw new Error('Wasm module args must be finite numbers.');
      }
      return numericValue;
    }) : [];

    const result = exportValue(...args);
    const normalized = normalizeReturnValue(result);
    parentPort.postMessage({
      ok: true,
      selectedExport,
      returnValue: normalized,
      stdout: normalized ? \`\${normalized}\\n\` : '',
    });
  } catch (error: unknown) {
    const err = asErrorLike(error);
    parentPort.postMessage({
      ok: false,
      error: error instanceof Error ? err.message : String(error),
    });
  }
})();
`;

export class WasmSandboxRuntime implements ISandboxRuntime {
  public readonly securityLevel = 'wasm' as const;

  public isAvailable(): boolean {
    return config.wasmSandboxEnabled
      && typeof Worker === 'function'
      && typeof WebAssembly !== 'undefined'
      && typeof WebAssembly.instantiate === 'function'
      && typeof WebAssembly.compile === 'function';
  }

  public async execute(request: SandboxRequest | WasmSandboxRequest): Promise<WasmSandboxResult> {
    const timeoutMs = Number.isFinite(Number(request.timeoutMs)) && Number(request.timeoutMs) > 0
      ? Number(request.timeoutMs)
      : config.wasmSandboxMaxExecutionMs;
    const startedAt = Date.now();
    const finish = (
      partial: Omit<WasmSandboxResult, 'executionTimeMs' | 'securityLevel' | 'runtime'>,
    ): WasmSandboxResult => ({
      ...partial,
      executionTimeMs: Date.now() - startedAt,
      securityLevel: this.securityLevel,
      runtime: 'WasmSandboxRuntime',
    });

    if (!config.wasmSandboxEnabled) {
      return finish({
        stdout: '',
        stderr: '[WasmSandbox] Wasm tier disabled by configuration.',
        exitCode: -1,
        selectedExport: null,
        returnValue: null,
      });
    }

    if (!this.isAvailable()) {
      return finish({
        stdout: '',
        stderr: '[WasmSandbox] Runtime WebAssembly unavailable on this host.',
        exitCode: -1,
        selectedExport: null,
        returnValue: null,
      });
    }

    const moduleBase64 = 'moduleBase64' in request ? request.moduleBase64 : request.code;
    const encoded = String(moduleBase64 || '').trim();
    const normalizedBase64 = encoded.replace(/^data:application\/wasm;base64,/i, '').replace(/\s+/g, '');
    if (!normalizedBase64) {
      return finish({
        stdout: '',
        stderr: '[WasmSandbox] Modulo Wasm vazio.',
        exitCode: -1,
        selectedExport: null,
        returnValue: null,
      });
    }

    const byteLength = Buffer.from(normalizedBase64, 'base64').byteLength;
    if (byteLength > config.wasmSandboxMaxBytes) {
      return finish({
        stdout: '',
        stderr: `[WasmSandbox] Modulo excede o limite de ${config.wasmSandboxMaxBytes} bytes.`,
        exitCode: -1,
        selectedExport: null,
        returnValue: null,
      });
    }

    const requestExportName = 'exportName' in request ? request.exportName : undefined;
    const requestArgs = 'args' in request ? request.args : undefined;

    return new Promise((resolve) => {
      const worker = new Worker(WORKER_SOURCE, {
        eval: true,
        workerData: {
          moduleBase64: normalizedBase64,
          exportName: requestExportName || null,
          args: Array.isArray(requestArgs) ? requestArgs : [],
        },
      });
      let settled = false;

      const settle = (partial: Omit<WasmSandboxResult, 'executionTimeMs' | 'securityLevel' | 'runtime'>) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timeout);
        void worker.terminate().catch(() => undefined);
        resolve(finish(partial));
      };

      const timeout = setTimeout(() => {
        settle({
          stdout: '',
          stderr: `[WasmSandbox] Timeout after ${timeoutMs}ms.`,
          exitCode: null,
          selectedExport: String(requestExportName || '').trim() || null,
          returnValue: null,
        });
      }, timeoutMs);

      worker.once('message', (message: unknown) => {
        const payload = message && typeof message === 'object'
          ? message as Record<string, unknown>
          : {};
        if (payload.ok) {
          settle({
            stdout: String(payload.stdout || ''),
            stderr: '',
            exitCode: 0,
            selectedExport: String(payload.selectedExport || '').trim() || null,
            returnValue: String(payload.returnValue || ''),
          });
          return;
        }

        settle({
          stdout: '',
          stderr: `[WasmSandbox] ${String(payload.error || 'Unknown failure in Wasm worker.')}`,
          exitCode: -1,
          selectedExport: String(requestExportName || '').trim() || null,
          returnValue: null,
        });
      });

      worker.once('error', (error) => {
        settle({
          stdout: '',
          stderr: `[WasmSandbox] Failure ao iniciar worker: ${error.message}`,
          exitCode: -1,
          selectedExport: String(requestExportName || '').trim() || null,
          returnValue: null,
        });
      });

      worker.once('exit', (code) => {
        if (!settled && code !== 0) {
          settle({
            stdout: '',
            stderr: `[WasmSandbox] Worker encerrado with code ${code}.`,
            exitCode: typeof code === 'number' ? code : -1,
            selectedExport: String(requestExportName || '').trim() || null,
            returnValue: null,
          });
        }
      });
    });
  }
}
