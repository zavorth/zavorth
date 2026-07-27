import assert from 'node:assert/strict';
import { config } from '../src/config/index.js';
import { SandboxExecutionService } from '../src/services/SandboxExecutionService.js';
import { WasmSandboxCapabilityService } from '../src/services/WasmSandboxCapabilityService.js';
import { DockerSandboxRuntime } from '../src/services/sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime } from '../src/services/sandbox/FirecrackerSandboxRuntime.js';

const ADD_WASM_BASE64 = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';

type SandboxTier = 'auto' | 'wasm' | 'container' | 'microvm';

async function main(): Promise<void> {
  const optIn = (process.env.ZAVORTH_SANDBOX_SMOKE_OPT_IN || 'false').toLowerCase() === 'true';
  const requestedTier = readTier();

  if (!optIn) {
    printResult({
      ok: true,
      skipped: true,
      requestedTier,
      resolvedTier: null,
      reason: 'ZAVORTH_SANDBOX_SMOKE_OPT_IN=false; smoke opt-in was not requested.',
    });
    return;
  }

  const resolvedTier = requestedTier === 'auto' ? resolveAutoTier() : requestedTier;
  if (!resolvedTier) {
    printResult({
      ok: true,
      skipped: true,
      requestedTier,
      resolvedTier: null,
      reason: 'No tier de sandbox habilitado/operable no host current.',
    });
    return;
  }

  if (resolvedTier === 'wasm') {
    const result = await runWasmSmoke(requestedTier !== 'auto');
    printResult({ ok: true, skipped: false, requestedTier, resolvedTier, ...result });
    return;
  }

  if (resolvedTier === 'container') {
    const result = await runContainerSmoke(requestedTier !== 'auto');
    printResult({ ok: true, skipped: false, requestedTier, resolvedTier, ...result });
    return;
  }

  const result = await runMicrovmSmoke(requestedTier !== 'auto');
  printResult({ ok: true, skipped: false, requestedTier, resolvedTier, ...result });
}

function readTier(): SandboxTier {
  const normalized = String(process.env.ZAVORTH_SANDBOX_SMOKE_TIER || 'auto').trim().toLowerCase();
  if (normalized === 'wasm' || normalized === 'container' || normalized === 'microvm') {
    return normalized;
  }
  return 'auto';
}

function resolveAutoTier(): Exclude<SandboxTier, 'auto'> | null {
  if (new WasmSandboxCapabilityService().getStatus('wasm').canRun) {
    return 'wasm';
  }
  if (new DockerSandboxRuntime().getStatus('javascript').canRun) {
    return 'container';
  }
  if (new FirecrackerSandboxRuntime().getStatus().canRun) {
    return 'microvm';
  }
  return null;
}

async function runWasmSmoke(strict: boolean): Promise<Record<string, unknown>> {
  const capability = new WasmSandboxCapabilityService().getStatus('wasm');
  if (!capability.canRun) {
    return handleUnavailable(strict, 'wasm', capability.detail);
  }

  const service = new SandboxExecutionService();
  const result = await service.executeModuleInWasm(ADD_WASM_BASE64, 'add', [20, 22], 5000);
  assert.equal(result.exitCode, 0);
  assert.equal(result.returnValue, '42');

  return {
    runtime: result.runtime,
    detail: capability.detail,
    returnValue: result.returnValue,
    executionTimeMs: result.executionTimeMs,
  };
}

async function runContainerSmoke(strict: boolean): Promise<Record<string, unknown>> {
  const runtime = new DockerSandboxRuntime();
  const status = runtime.getStatus('javascript');
  if (!status.canRun) {
    return handleUnavailable(strict, 'container', status.detail);
  }

  const result = await runtime.execute({
    language: 'javascript',
    code: "console.log('sandbox-optin-container-ok:42');",
    timeoutMs: 20_000,
  });
  assert.equal(result.exitCode, 0);
  assert.match(String(result.stdout || ''), /sandbox-optin-container-ok:42/);

  return {
    runtime: result.runtime,
    detail: status.detail,
    stdout: String(result.stdout || '').trim(),
    executionTimeMs: result.executionTimeMs,
  };
}

async function runMicrovmSmoke(strict: boolean): Promise<Record<string, unknown>> {
  const runtime = new FirecrackerSandboxRuntime();
  const status = runtime.getStatus();
  if (!status.canRun) {
    return handleUnavailable(strict, 'microvm', status.detail);
  }

  const result = await runtime.execute({
    language: 'javascript',
    code: "console.log('sandbox-optin-microvm-ok:42');",
    timeoutMs: config.firecrackerExecutionTimeoutMs,
  });
  assert.equal(result.exitCode, 0);
  assert.match(String(result.stdout || ''), /sandbox-optin-microvm-ok:42/);

  return {
    runtime: result.runtime,
    detail: status.detail,
    stdout: String(result.stdout || '').trim(),
    executionTimeMs: result.executionTimeMs,
  };
}

function handleUnavailable(strict: boolean, tier: string, detail: string): Record<string, unknown> {
  if (strict) {
    throw new Error(`Tier ${tier} unavailable para smoke opt-in: ${detail}`);
  }

  return {
    skipped: true,
    runtime: null,
    detail,
  };
}

function printResult(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error('[sandbox:optin:smoke] failed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
