import crypto from 'crypto';
import { SandboxExecutionService } from './SandboxExecutionService.js';
import { SidecarExecutionReceiptService } from './SidecarExecutionReceiptService.js';
import { SandboxPolicyService } from './sandbox/SandboxPolicyService.js';
import type { SandboxResult, SandboxSecurityLevel } from './sandbox/ISandboxRuntime.js';
import { logger } from '../logger.js';

export type RuntimeShellSidecarLevel = 'auto' | 'container' | 'microvm';

export type RuntimeShellSidecarRequest = {
  command: string;
  timeoutMs: number;
  requiredLevel?: RuntimeShellSidecarLevel;
};

export type RuntimeShellSidecarResult = SandboxResult & {
  auditId: string;
  requiredLevel: RuntimeShellSidecarLevel;
  policyLevel: Exclude<SandboxSecurityLevel, 'local-jail' | 'wasm'>;
  policyReason: string;
};

type RuntimeShellSandbox = Pick<
  SandboxExecutionService,
  'isDockerAvailable' | 'isFirecrackerAvailable' | 'executeCode' | 'executeCommandInMicrovm'
>;

type RuntimeShellSidecarReceiptRecorder = Pick<
  SidecarExecutionReceiptService,
  'createAuditId' | 'record'
>;

export class RuntimeIsolatedShellSidecarService {
  private readonly sandbox: RuntimeShellSandbox;
  private readonly policy: SandboxPolicyService;
  private readonly receipts: RuntimeShellSidecarReceiptRecorder | null;

  constructor(options: {
    sandbox?: RuntimeShellSandbox;
    policy?: SandboxPolicyService;
    receiptService?: RuntimeShellSidecarReceiptRecorder | null;
  } = {}) {
    this.sandbox = options.sandbox || new SandboxExecutionService();
    this.policy = options.policy || new SandboxPolicyService();
    this.receipts = options.receiptService === undefined
      ? new SidecarExecutionReceiptService()
      : options.receiptService;
  }

  public isConfigured(): boolean {
    return this.sandbox.isDockerAvailable() || this.sandbox.isFirecrackerAvailable();
  }

  public async execute(request: RuntimeShellSidecarRequest): Promise<RuntimeShellSidecarResult> {
    const command = String(request.command || '').trim();
    if (!command) {
      throw new Error('Runtime shell sidecar requires a non-empty command.');
    }

    const requiredLevel = this.resolveRequiredLevel(request.requiredLevel);
    const policy = this.policy.resolveCodeExecutionPolicy(
      'shell',
      command,
      requiredLevel === 'microvm' ? 'microvm' : requiredLevel === 'container' ? 'container' : 'auto',
    );
    const policyLevel: Exclude<SandboxSecurityLevel, 'local-jail' | 'wasm'> =
      policy.securityLevel === 'microvm' ? 'microvm' : 'container';
    const timeoutMs = Number.isFinite(request.timeoutMs) && request.timeoutMs > 0
      ? request.timeoutMs
      : 15_000;
    const auditId = this.createAuditId(`${policyLevel}:${command}`);
    const startedAt = Date.now();

    try {
      if (policyLevel === 'microvm') {
        if (!this.sandbox.isFirecrackerAvailable()) {
          throw new Error(
            'Runtime shell sidecar blocked: MicroVM is required by policy, but Firecracker is not available. There is no fallback to host or container.',
          );
        }

        const result = await this.sandbox.executeCommandInMicrovm(command, timeoutMs);
        const output: RuntimeShellSidecarResult = {
          ...result,
          auditId,
          requiredLevel,
          policyLevel,
          policyReason: policy.reason,
        };
        this.recordShellReceipt(output, {
          command,
          auditId,
          policyReason: policy.reason,
          startedAt,
        });
        return output;
      }

      if (!this.sandbox.isDockerAvailable()) {
        throw new Error(
          'Runtime shell sidecar blocked: container is required by policy, but Docker/gVisor is not available. There is no fallback to host.',
        );
      }

      const result = await this.sandbox.executeCode({
        code: command,
        language: 'shell',
        preferredLevel: 'container',
        timeoutMs,
      });
      const output: RuntimeShellSidecarResult = {
        ...result,
        auditId,
        requiredLevel,
        policyLevel,
        policyReason: policy.reason,
      };
      this.recordShellReceipt(output, {
        command,
        auditId,
        policyReason: policy.reason,
        startedAt,
      });
      return output;
    } catch (error: unknown) {this.recordShellBlock({
        command,
        auditId,
        policyLevel,
        policyReason: policy.reason,
        startedAt,
        error,
      });
      throw error;
    }
  }

  private createAuditId(seed: string): string {
    if (this.receipts) {
      return this.receipts.createAuditId(seed);
    }
    return crypto
      .createHash('sha256')
      .update(seed)
      .digest('hex')
      .slice(0, 16);
  }

  private recordShellReceipt(
    result: RuntimeShellSidecarResult,
    input: {
      command: string;
      auditId: string;
      policyReason: string;
      startedAt: number;
    },
  ): void {
    if (!this.receipts) {
      return;
    }
    try {
      this.receipts.record({
        sidecarId: 'runtime-shell-sidecar',
        kind: 'shell',
        action: this.describeCommand(input.command, input.auditId),
        status: result.exitCode === 0 ? 'succeeded' : 'failed',
        auditId: input.auditId,
        runtime: result.runtime,
        isolationLevel: result.policyLevel,
        durationMs: result.executionTimeMs || (Date.now() - input.startedAt),
        exitCode: result.exitCode,
        summary: result.exitCode === 0
          ? `Shell sidecar executou em ${result.policyLevel}.`
          : `Shell sidecar returned exitCode=${result.exitCode}.`,
        metadata: {
          requiredLevel: result.requiredLevel,
          policyReason: input.policyReason,
          stdoutBytes: Buffer.byteLength(result.stdout || '', 'utf8'),
          stderrBytes: Buffer.byteLength(result.stderr || '', 'utf8'),
        },
      });
    } catch (error: unknown) {// Receipts cannot bring down already isolated execution.
      logger.warn('[Runtime Isolated Shell Sidecar] process execution failed', error);
    }
  }

  private recordShellBlock(input: {
    command: string;
    auditId: string;
    policyLevel: Exclude<SandboxSecurityLevel, 'local-jail' | 'wasm'>;
    policyReason: string;
    startedAt: number;
    error: unknown;
  }): void {
    if (!this.receipts) {
      return;
    }
    try {
      const message = input.error instanceof Error ? input.error.message : String(input.error);
      this.receipts.record({
        sidecarId: 'runtime-shell-sidecar',
        kind: 'shell',
        action: this.describeCommand(input.command, input.auditId),
        status: message.includes('blocked') ? 'blocked' : 'failed',
        auditId: input.auditId,
        runtime: input.policyLevel === 'microvm' ? 'FirecrackerSandboxRuntime' : 'DockerSandboxRuntime',
        isolationLevel: input.policyLevel,
        durationMs: Date.now() - input.startedAt,
        exitCode: null,
        summary: message,
        metadata: {
          policyReason: input.policyReason,
        },
      });
    } catch (error: unknown) {// Receipts cannot mask the original error.
      logger.warn('[Runtime Isolated Shell Sidecar] lifecycle operation failed', error);
    }
  }

  private describeCommand(command: string, auditId: string): string {
    const binary = command.trim().split(/\s+/u)[0] || 'shell';
    return `${binary}#${auditId}`;
  }

  private resolveRequiredLevel(value: unknown): RuntimeShellSidecarLevel {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'microvm' || process.env.ZAVORTH_REMOTE_SHELL_SIDECAR_REQUIRE_MICROVM === 'true') {
      return 'microvm';
    }
    if (normalized === 'container') {
      return 'container';
    }
    return 'auto';
  }
}
