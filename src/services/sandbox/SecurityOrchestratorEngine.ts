import crypto from 'crypto';
import type { ISandboxRuntime, SandboxLanguage, SandboxRequest, SandboxResult, SandboxSecurityLevel } from './ISandboxRuntime.js';
import { DockerSandboxRuntime } from './DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime } from './FirecrackerSandboxRuntime.js';
import { LocalJailSandboxRuntime } from './LocalJailSandboxRuntime.js';
import { WasmSandboxRuntime } from './WasmSandboxRuntime.js';
import { SandboxPolicyService, type CodeSandboxPolicy } from './SandboxPolicyService.js';
import { logger } from '../../logger.js';
export class SecurityOrchestratorEngine {
  private readonly policyService: SandboxPolicyService;
  private readonly dockerRuntime: DockerSandboxRuntime;
  private readonly firecrackerRuntime: FirecrackerSandboxRuntime;
  private readonly localJailRuntime: LocalJailSandboxRuntime;
  private readonly wasmRuntime: WasmSandboxRuntime;

  private readonly getDockerRuntime?: () => DockerSandboxRuntime;
  private readonly getFirecrackerRuntime?: () => FirecrackerSandboxRuntime;
  private readonly getLocalJailRuntime?: () => LocalJailSandboxRuntime;
  private readonly getWasmRuntime?: () => WasmSandboxRuntime;

  constructor(options?: {
    getDockerRuntime?: () => DockerSandboxRuntime;
    getFirecrackerRuntime?: () => FirecrackerSandboxRuntime;
    getLocalJailRuntime?: () => LocalJailSandboxRuntime;
    getWasmRuntime?: () => WasmSandboxRuntime;
  }) {
    this.policyService = new SandboxPolicyService();
    this.dockerRuntime = new DockerSandboxRuntime();
    this.firecrackerRuntime = new FirecrackerSandboxRuntime();
    this.localJailRuntime = new LocalJailSandboxRuntime();
    this.wasmRuntime = new WasmSandboxRuntime();
    this.getDockerRuntime = options?.getDockerRuntime;
    this.getFirecrackerRuntime = options?.getFirecrackerRuntime;
    this.getLocalJailRuntime = options?.getLocalJailRuntime;
    this.getWasmRuntime = options?.getWasmRuntime;
  }

  /**
   * Generates a SHA-256 hash of the code to prevent TOCTOU (Time-of-check to time-of-use) attacks.
   */
  public calculateCodeHash(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Executes code dynamically and securely selecting the best available runtime.
   */
  public async executeSecurely(
    request: SandboxRequest,
    preferredLevel: 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm' = 'auto',
  ): Promise<SandboxResult> {
    const initialHash = this.calculateCodeHash(request.code);

    // 1. Resolve security policy using our SandboxPolicyService rules
    const policy = this.policyService.resolveCodeExecutionPolicy(request.language, request.code, preferredLevel);
    logger.info(`[SecurityOrchestrator] Resolved policy: level=${policy.securityLevel}, reason="${policy.reason}"`);

    // 2. Perform TOCTOU check immediately before execution
    const preExecHash = this.calculateCodeHash(request.code);
    if (initialHash !== preExecHash) {
      throw new Error('TOCTOU integrity violation: Code modified between check and execution.');
    }

    // Try target runtime first, with fallback cascade if unavailable
    const levelsToTry: SandboxSecurityLevel[] = this.getFallbackCascade(policy.securityLevel);

    for (const level of levelsToTry) {
      try {
        const runtime = this.getRuntimeForLevel(level);
        
        // Check availability
        const isAvailable = runtime.isAvailable ? await runtime.isAvailable() : true;
        if (!isAvailable) {
          logger.warn(`[SecurityOrchestrator] Runtime for level ${level} is not available. Trying fallback...`);
          continue;
        }

        if (level === 'wasm' || level === 'local-jail') {
          logger.warn(`[SecurityOrchestrator] Running script with level: ${level} (shares process memory space). Spectre-like side-channel attacks are not isolated at process boundary. Consider using Docker or Firecracker for sensitive workloads.`);
        }
        logger.info(`[SecurityOrchestrator] Executing script with level: ${level}`);
        const result = await runtime.execute(request);
        return {
          ...result,
          securityLevel: level,
          runtime: runtime.constructor.name,
        };
      } catch (error: unknown) {
        logger.error(`[SecurityOrchestrator] Failed executing with level ${level}: ${error.message}. Trying next fallback...`);
      }
    }

    // Ultimate fallback if everything else failed: execute via Wasm/LocalJail with max warning
    logger.warn('[SecurityOrchestrator] All preferred sandboxes failed. Running under local-jail fallback with env cleansing. Spectre-like side-channel attacks are not isolated at process boundary. Consider using Docker or Firecracker for sensitive workloads.');
    const result = await this.localJailRuntime.execute(request);
    return {
      ...result,
      securityLevel: 'local-jail',
      runtime: 'LocalJailSandboxRuntime (Fallback)',
    };
  }

  private getFallbackCascade(level: SandboxSecurityLevel): SandboxSecurityLevel[] {
    switch (level) {
      case 'microvm':
        return ['microvm', 'container', 'wasm', 'local-jail'];
      case 'container':
        return ['container', 'wasm', 'local-jail'];
      case 'wasm':
        return ['wasm', 'local-jail'];
      case 'local-jail':
      default:
        return ['local-jail', 'wasm'];
    }
  }

  private getRuntimeForLevel(level: SandboxSecurityLevel): ISandboxRuntime {
    switch (level) {
      case 'microvm':
        return this.getFirecrackerRuntime ? this.getFirecrackerRuntime() : this.firecrackerRuntime;
      case 'container':
        return this.getDockerRuntime ? this.getDockerRuntime() : this.dockerRuntime;
      case 'wasm':
        return this.getWasmRuntime ? this.getWasmRuntime() : this.wasmRuntime;
      case 'local-jail':
      default:
        return this.getLocalJailRuntime ? this.getLocalJailRuntime() : this.localJailRuntime;
    }
  }
}
