
import { BaseTool } from './BaseTool.js';
import { ToolDefinition } from '../providers/ILlmProvider.js';
import { DockerSandboxRuntime } from '../services/sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime } from '../services/sandbox/FirecrackerSandboxRuntime.js';
import type { SandboxLanguage } from '../services/sandbox/ISandboxRuntime.js';
import { LocalJailSandboxRuntime } from '../services/sandbox/LocalJailSandboxRuntime.js';
import { SandboxPolicyService } from '../services/sandbox/SandboxPolicyService.js';
import { WasmSandboxRuntime } from '../services/sandbox/WasmSandboxRuntime.js';
import { WasmSandboxCapabilityService } from '../services/WasmSandboxCapabilityService.js';
import { logger } from '../logger.js';
import { asErrorLike } from '../utils/errorLike.js';

type SandboxToolLanguage = SandboxLanguage | 'wasm';

/**
 * SandboxExecutionTool ? runs experiments through 4 isolation paths:
 *
 *   1. wasm         -> precompiled Wasm module in a restricted host runtime
 *   2. local-jail   -> ephemeral local process (fast, trusted code)
 *   3. container    -> Docker + gVisor (sensitive code, shell, network)
 *   4. microvm      -> Firecracker MicroVM for high-risk code and untrusted users
 */
export class SandboxExecutionTool extends BaseTool {
  public readonly name = 'run_sandbox_code';
  public readonly description =
    'Runs a Javascript, Python, Shell script, or a precompiled Wasm module in an isolated runtime. ' +
    'Uses Wasm for small controlled binary modules, local-jail for lightweight experiments, ' +
    'Docker+gVisor containers for sensitive scripts, and Firecracker MicroVM for high-risk code.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      language: {
        type: 'string',
        description: 'Script language to test, or wasm for a base64 precompiled WebAssembly module.',
        enum: ['javascript', 'python', 'shell', 'wasm'],
      },
      code: {
        type: 'string',
        description: 'Literal code to run in the sandbox, or the base64 Wasm module when language=wasm.',
      },
      security_level: {
        type: 'string',
        description:
          'Desired level: auto chooses by policy, wasm runs a restricted precompiled module, ' +
          'local-jail prioritizes a lightweight runtime, container requires Docker+gVisor, microvm requires Firecracker MicroVM.',
        enum: ['auto', 'wasm', 'local-jail', 'container', 'microvm'],
      },
      export_name: {
        type: 'string',
        description: 'Wasm module export name to call when language=wasm.',
      },
      args_json: {
        type: 'string',
        description: 'JSON array with numeric arguments for the Wasm export, for example [2,3].',
      },
      timeout_ms: {
        type: 'string',
        description: 'Optional execution timeout in milliseconds.',
      },
    },
    required: ['language', 'code'],
  };

  private readonly localJail = new LocalJailSandboxRuntime();
  private readonly wasmSandbox = new WasmSandboxRuntime();
  private readonly dockerSandbox = new DockerSandboxRuntime();
  private readonly firecrackerSandbox = new FirecrackerSandboxRuntime();
  private readonly sandboxPolicy = new SandboxPolicyService();
  private readonly wasmCapability = new WasmSandboxCapabilityService();

  public async execute(args: Record<string, unknown>): Promise<string> {
    const language = String(args.language || '').trim().toLowerCase() as SandboxToolLanguage;
    const code = String(args.code || '');
    const preferredLevel = String(args.security_level || 'auto') as
      | 'auto'
      | 'wasm'
      | 'local-jail'
      | 'container'
      | 'microvm';
    const timeoutMs = Number(args.timeout_ms || 15_000);

    if (language === 'wasm') {
      return this.executeWasmModule(code, args, preferredLevel, timeoutMs);
    }

    const policy = this.sandboxPolicy.resolveCodeExecutionPolicy(language as SandboxLanguage, code, preferredLevel);

    try {
      const securityLevel = policy.securityLevel;
      if (securityLevel === 'wasm') {
        throw new Error(
          'Invalid policy: securityLevel=wasm can only be used when language=wasm.',
        );
      }

      const runtime = this.resolveRuntime(
        securityLevel as 'local-jail' | 'container' | 'microvm',
        language as SandboxLanguage,
      );
      const result = await runtime.execute({
        code,
        language: language as SandboxLanguage,
        timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
      });

      let out = `Sandbox ${result.securityLevel} (${result.runtime}) - exit code ${result.exitCode} - ${result.executionTimeMs}ms\n`;
      out += `Policy reason: ${policy.reason}\n`;
      if (result.stdout) {
        out += `--- STDOUT ---\n${result.stdout}\n`;
      }
      if (result.stderr) {
        out += `--- STDERR ---\n${result.stderr}\n`;
      }

      return out;
    } catch (error: unknown) {logger.warn('[Sandbox Execution] process execution failed', error); return ''; }
  }

  private async executeWasmModule(
    moduleBase64: string,
    rawArgs: Record<string, unknown>,
    preferredLevel: 'auto' | 'wasm' | 'local-jail' | 'container' | 'microvm',
    timeoutMs: number,
  ): Promise<string> {
    if (preferredLevel === 'container' || preferredLevel === 'microvm' || preferredLevel === 'local-jail') {
      return 'Sandbox failure (wasm): precompiled Wasm modules only support auto/wasm levels on this path.';
    }

    const wasmStatus = this.wasmCapability.getStatus('wasm');
    if (!wasmStatus.canRun) {
      return `Sandbox failure (wasm): ${wasmStatus.detail}`;
    }

    const parsedArgs = this.parseWasmArgs(rawArgs.args_json);
    if (!parsedArgs.ok) {
      return `Sandbox failure (wasm): ${parsedArgs.error}`;
    }

    const result = await this.wasmSandbox.execute({
      moduleBase64,
      exportName: String(rawArgs.export_name || '').trim() || null,
      args: parsedArgs.value,
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000,
    });

    let out = `Sandbox ${result.securityLevel} (${result.runtime}) - exit code ${result.exitCode} - ${result.executionTimeMs}ms\n`;
    out += 'Policy reason: precompiled Wasm module in a restricted runtime.\n';
    out += `Selected export: ${result.selectedExport || 'auto'}\n`;
    if (result.returnValue) {
      out += `Return value: ${result.returnValue}\n`;
    }
    if (result.stdout) {
      out += `--- STDOUT ---\n${result.stdout}\n`;
    }
    if (result.stderr) {
      out += `--- STDERR ---\n${result.stderr}\n`;
    }
    return out;
  }

  /**
   * Resolves which runtime to use based on the required security level.
   * Automatic fallback:
   *   microvm unavailable -> try container
   *   container unavailable -> blocks execution and does not downgrade to local-jail
   */
  private resolveRuntime(
    securityLevel: 'local-jail' | 'container' | 'microvm' | 'wasm',
    language: SandboxLanguage,
  ) {
    if (securityLevel === 'wasm') {
      throw new Error(
        'Execution blocked: wasm level is only valid for precompiled WebAssembly modules with language=wasm.',
      );
    }

    if (securityLevel === 'microvm') {
      if (this.firecrackerSandbox.isAvailable()) {
        return this.firecrackerSandbox;
      }

      const dockerStatus = this.dockerSandbox.getStatus(language);
      if (dockerStatus.canRun) {
        return this.dockerSandbox;
      }

      throw new Error(
        'Execution blocked: high-risk code requires MicroVM (Firecracker) or container (Docker+gVisor), ' +
        'but neither is available on this host. ' +
        'Install Firecracker or configure Docker with gVisor.',
      );
    }

    if (securityLevel === 'container') {
      const dockerStatus = this.dockerSandbox.getStatus(language);
      if (!dockerStatus.daemonReachable && !dockerStatus.canRun) {
        throw new Error(
          `Sandbox blocked: policy required a Docker container (gVisor), ` +
          `but the strong runtime is not ready on this host. Detail: ${dockerStatus.detail}`,
        );
      }
      return this.dockerSandbox;
    }

    return this.localJail;
  }

  private parseWasmArgs(rawValue: unknown): { ok: true; value: number[] } | { ok: false; error: string } {
    const normalized = String(rawValue || '').trim();
    if (!normalized) {
      return { ok: true, value: [] };
    }

    try {
      const parsed = JSON.parse(normalized);
      if (!Array.isArray(parsed)) {
        return { ok: false, error: 'args_json must be a JSON array.' };
      }
      const numericArgs = parsed.map((entry) => Number(entry));
      if (numericArgs.some((entry) => !Number.isFinite(entry))) {
        return { ok: false, error: 'args_json accepts only finite numbers.' };
      }
      return { ok: true, value: numericArgs };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Sandbox Execution] parsing failed', error);
    return { ok: false, error: `invalid args_json: ${err.message}` };
  }
  }
}
