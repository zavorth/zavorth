import { ExecutionRequest } from '../contracts/ExecutionContract.js';
import type { ZavorthCapabilityRunEnvelope } from '../contracts/ZavorthMutationPlaneContract.js';
import { DockerSandboxRuntime } from './sandbox/DockerSandboxRuntime.js';
import type { DockerSandboxStatus } from './sandbox/DockerSandboxRuntime.js';
import { FirecrackerSandboxRuntime } from './sandbox/FirecrackerSandboxRuntime.js';
import type { FirecrackerSandboxStatus } from './sandbox/FirecrackerSandboxRuntime.js';
import type { SandboxLanguage, SandboxSecurityLevel } from './sandbox/ISandboxRuntime.js';
import type { SandboxResult } from './sandbox/ISandboxRuntime.js';
import { LocalJailSandboxRuntime } from './sandbox/LocalJailSandboxRuntime.js';
import { SandboxPolicyService } from './sandbox/SandboxPolicyService.js';
import { WasmSandboxRuntime } from './sandbox/WasmSandboxRuntime.js';
import { SecurityOrchestratorEngine } from './sandbox/SecurityOrchestratorEngine.js';

export type SandboxTierDecision = {
  tier: SandboxSecurityLevel;
  reason: string;
};

export type SandboxEnvelopeExecutionReport = SandboxResult & {
  envelopeId: string;
  auditId: string;
  sandboxProfile: ZavorthCapabilityRunEnvelope['sandboxProfile'];
  networkPolicy: ZavorthCapabilityRunEnvelope['networkPolicy'];
  artifacts: string[];
  cleanup: {
    killOnTimeout: boolean;
    removeWorkspace: boolean;
    removeContainerOrVm: boolean;
    completed: boolean;
  };
};

export class SandboxExecutionService {
  private readonly dockerRuntime = new DockerSandboxRuntime();
  private readonly firecrackerRuntime = new FirecrackerSandboxRuntime();
  private readonly localJailRuntime = new LocalJailSandboxRuntime();
  private readonly wasmRuntime = new WasmSandboxRuntime();
  private readonly policy = new SandboxPolicyService();
  private readonly securityEngine = new SecurityOrchestratorEngine({
    getDockerRuntime: () => this.dockerRuntime,
    getFirecrackerRuntime: () => this.firecrackerRuntime,
    getLocalJailRuntime: () => this.localJailRuntime,
    getWasmRuntime: () => this.wasmRuntime,
  });

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  public isDockerAvailable(): boolean {
    return this.dockerRuntime.isAvailable();
  }

  public isFirecrackerAvailable(): boolean {
    return this.firecrackerRuntime.isAvailable();
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  public getDockerStatus(language: SandboxLanguage = 'javascript'): DockerSandboxStatus {
    return this.dockerRuntime.getStatus(language);
  }

  public getDockerImageForLanguage(language: SandboxLanguage = 'javascript'): string {
    return this.dockerRuntime.getImageForLanguage(language);
  }

  public getFirecrackerStatus(): FirecrackerSandboxStatus {
    return this.firecrackerRuntime.getStatus();
  }

  // ---------------------------------------------------------------------------
  // Policy — 3-tier decision
  // ---------------------------------------------------------------------------

  /**
   * Decide se o request precisa de sandbox e em qual camada.
   * Retorna null se nenhum sandbox e necessario.
   */
  public resolveSandboxTier(request: ExecutionRequest): SandboxTierDecision | null {
    // MicroVM requerido?
    if (this.policy.requiresMicrovmForExecution(request)) {
      return {
        tier: 'microvm',
        reason: 'conteudo nao-confiavel, fonte externa ou God-Mode autonomo',
      };
    }

    // Container requerido?
    if (this.policy.requiresContainerForExecution(request)) {
      return {
        tier: 'container',
        reason: 'sandbox requerido por politica, metadata ou padrao de comando',
      };
    }

    return null;
  }

  /**
   * Alias retrocompativel — retorna true se qualquer nivel de sandbox e necessario.
   */
  public shouldSandbox(request: ExecutionRequest): boolean {
    return this.resolveSandboxTier(request) !== null;
  }

  /**
   * Retorna true se o request exige especificamente MicroVM (Firecracker).
   */
  public shouldUseMicrovm(request: ExecutionRequest): boolean {
    const tier = this.resolveSandboxTier(request);
    return tier?.tier === 'microvm';
  }

  // ---------------------------------------------------------------------------
  // Command builders (Docker path)
  // ---------------------------------------------------------------------------

  public buildSandboxCommand(command: string, workspace: string): string {
    const language = this.policy.inferExecutionSandboxLanguage(command);
    return this.dockerRuntime.buildWrappedCommand(command, workspace, language);
  }

  public buildSandboxInvocation(
    command: string,
    workspace: string,
  ): { command: string; args: string[]; displayCommand: string } {
    const language = this.policy.inferExecutionSandboxLanguage(command);
    const invocation = this.dockerRuntime.buildWrappedInvocation(command, workspace, language);
    return {
      ...invocation,
      displayCommand: this.dockerRuntime.buildWrappedCommand(command, workspace, language),
    };
  }

  // ---------------------------------------------------------------------------
  // Execution (Firecracker path)
  // ---------------------------------------------------------------------------

  public async executeCodeInMicrovm(
    code: string,
    language: SandboxLanguage,
    timeoutMs?: number,
  ) {
    return this.firecrackerRuntime.execute({
      language,
      code,
      timeoutMs,
    });
  }

  public async executeCommandInMicrovm(command: string, timeoutMs?: number) {
    const script = [
      "const { spawnSync } = require('child_process');",
      `const command = ${JSON.stringify(command)};`,
      "const result = spawnSync('/bin/bash', ['-lc', command], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });",
      "if (result.stdout) process.stdout.write(result.stdout);",
      "if (result.stderr) process.stderr.write(result.stderr);",
      "process.exitCode = typeof result.status === 'number' ? result.status : 1;",
    ].join('\n');
    return this.executeCodeInMicrovm(script, 'javascript', timeoutMs);
  }

  public async executeModuleInWasm(
    moduleBase64: string,
    exportName?: string | null,
    args?: number[],
    timeoutMs?: number,
  ) {
    return this.wasmRuntime.execute({
      moduleBase64,
      exportName,
      args,
      timeoutMs,
    });
  }

  public async executeEnvelope(
    envelope: ZavorthCapabilityRunEnvelope,
    request: {
      code: string;
      language: SandboxLanguage;
      env?: Record<string, string>;
    },
  ): Promise<SandboxEnvelopeExecutionReport> {
    if (envelope.status !== 'ready') {
      throw new Error(`Envelope ${envelope.id} nao esta pronto para execucao: ${envelope.status}.`);
    }
    if (envelope.mode !== 'apply' && envelope.mode !== 'dry-run' && envelope.mode !== 'verify') {
      throw new Error(`Envelope ${envelope.id} esta em modo ${envelope.mode}; use preview/approval antes do apply.`);
    }
    if (envelope.networkPolicy !== 'none') {
      throw new Error(`Network policy ${envelope.networkPolicy} ainda nao tem executor isolado nesta etapa.`);
    }
    if (
      envelope.filesystemPolicy.tempWorkspaceOnly !== true
      || envelope.filesystemPolicy.deniedHostWrite !== true
      || envelope.filesystemPolicy.hostMountsReadOnly !== true
    ) {
      throw new Error(`Envelope ${envelope.id} nao garante filesystem temp-only/read-only.`);
    }
    if (envelope.riskLevel !== 'low' && envelope.sandboxProfile === 'process') {
      throw new Error('Codigo nao confiavel nao pode usar profile process/local-jail.');
    }

    const result = await this.executeCode({
      code: request.code,
      language: request.language,
      preferredLevel: this.profileToPreferredLevel(envelope.sandboxProfile),
      timeoutMs: envelope.budget.maxDurationMs,
      env: {
        ...(request.env || {}),
        ZAVORTH_SANDBOX_ENVELOPE_ID: envelope.id,
        ZAVORTH_SANDBOX_AUDIT_ID: envelope.auditId,
        ZAVORTH_SANDBOX_TEMP_ONLY: 'true',
      },
      allowTrustedLocalJail: envelope.sandboxProfile === 'process' && envelope.riskLevel === 'low',
    });

    return {
      ...result,
      envelopeId: envelope.id,
      auditId: envelope.auditId,
      sandboxProfile: envelope.sandboxProfile,
      networkPolicy: envelope.networkPolicy,
      artifacts: [],
      cleanup: {
        killOnTimeout: envelope.cleanupPlan.killOnTimeout,
        removeWorkspace: envelope.cleanupPlan.removeWorkspace,
        removeContainerOrVm: envelope.cleanupPlan.removeContainerOrVm,
        completed: true,
      },
    };
  }

  public async executeCode(input: {
    code: string;
    language: SandboxLanguage;
    preferredLevel?: 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm';
    timeoutMs?: number;
    env?: Record<string, string>;
    allowTrustedLocalJail?: boolean;
  }): Promise<SandboxResult> {
    return this.securityEngine.executeSecurely({
      code: input.code,
      language: input.language,
      timeoutMs: input.timeoutMs,
      env: input.env,
    }, input.preferredLevel || 'auto');
  }

  private profileToPreferredLevel(
    profile: ZavorthCapabilityRunEnvelope['sandboxProfile'],
  ): 'auto' | 'local-jail' | 'wasm' | 'container' | 'microvm' {
    if (profile === 'none' || profile === 'process') {
      return 'local-jail';
    }
    if (profile === 'wasm') {
      return 'wasm';
    }
    if (profile === 'firecracker' || profile === 'remote-node') {
      return 'microvm';
    }
    return 'container';
  }
}
