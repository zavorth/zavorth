export type SandboxSecurityLevel = 'local-jail' | 'container' | 'microvm' | 'wasm';
export type SandboxLanguage = 'javascript' | 'python' | 'shell' | 'wasm';

export interface SandboxRequest {
  code: string;
  language: SandboxLanguage;
  timeoutMs?: number;
  env?: Record<string, string>;
}

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number;
  securityLevel: SandboxSecurityLevel;
  runtime: string;
}

export interface ISandboxRuntime {
  readonly securityLevel: SandboxSecurityLevel;
  isAvailable?(): boolean | Promise<boolean>;
  execute(request: SandboxRequest): Promise<SandboxResult>;
}
