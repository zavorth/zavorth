import { LocalJailSandboxRuntime } from './sandbox/LocalJailSandboxRuntime.js';
import type { SandboxLanguage, SandboxResult } from './sandbox/ISandboxRuntime.js';

/**
 * @deprecated Use LocalJailSandboxRuntime.
 * Mantido apenas por compatibilidade enquanto o restante do runtime migra
 * do nome "MicroVM" para o nome operacional correto.
 */
export class MicroVMSandboxService {
  private readonly runtime = new LocalJailSandboxRuntime();

  public async executeIsolated(
    code: string,
    language: SandboxLanguage,
    timeoutMs = 15_000,
  ): Promise<SandboxResult> {
    return this.runtime.execute({
      code,
      language,
      timeoutMs,
    });
  }
}
