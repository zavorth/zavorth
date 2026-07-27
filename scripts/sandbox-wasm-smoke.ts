import { WasmSandboxCapabilityService } from '../src/services/WasmSandboxCapabilityService.js';
import { SandboxExecutionService } from '../src/services/SandboxExecutionService.js';

const ADD_WASM_BASE64 = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';

async function main(): Promise<void> {
  const capability = new WasmSandboxCapabilityService().getStatus('wasm');
  const service = new SandboxExecutionService();

  if (!capability.canRun) {
    console.error('[sandbox:wasm:smoke] Tier Wasm unavailable.');
    console.error(`[sandbox:wasm:smoke] Detalhe: ${capability.detail}`);
    process.exitCode = 1;
    return;
  }

  const result = await service.executeModuleInWasm(ADD_WASM_BASE64, 'add', [20, 22], 5000);
  if (result.exitCode !== 0 || result.returnValue !== '42') {
    console.error('[sandbox:wasm:smoke] Failure ao run modulo Wasm de smoke.');
    console.error(`[sandbox:wasm:smoke] Exit: ${result.exitCode}`);
    console.error(`[sandbox:wasm:smoke] STDERR: ${result.stderr || '(vazio)'}`);
    console.error(`[sandbox:wasm:smoke] Return: ${result.returnValue || '(vazio)'}`);
    process.exitCode = 1;
    return;
  }

  console.log('[sandbox:wasm:smoke] OK');
  console.log(`[sandbox:wasm:smoke] Runtime: ${result.runtime}`);
  console.log(`[sandbox:wasm:smoke] Export: ${result.selectedExport}`);
  console.log(`[sandbox:wasm:smoke] Return: ${result.returnValue}`);
  console.log(`[sandbox:wasm:smoke] Execution time: ${result.executionTimeMs}ms`);
}

void main();
