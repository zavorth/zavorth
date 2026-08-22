import { asErrorLike } from '../../../utils/errorLike';
export type ExecutionMode = "direct" | "sandbox" | "hybrid";

export interface HybridConfig {
  defaultMode: ExecutionMode;
  autoUpgrade: boolean;
  maxDirectDuration: number;
}

export interface HybridExecutionResult {
  mode: "direct" | "sandbox";
  result: Record<string, unknown>;
}

export interface HybridExecutorLike {
  execute: (skillName: string, input: Record<string, unknown>, context?: unknown) => Promise<HybridExecutionResult>;
}

const defaultHybridConfig: HybridConfig = {
  defaultMode: "direct",
  autoUpgrade: true,
  maxDirectDuration: 5000,
};

export class HybridExecutor {
  private config: HybridConfig;
  private directExecutor: HybridExecutorLike | null;
  private sandboxRunner: HybridExecutorLike | null;

  constructor(config: Partial<HybridConfig> = {}) {
    this.config = { ...defaultHybridConfig, ...config };
    this.directExecutor = null;
    this.sandboxRunner = null;
  }

  setConfig(config: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute(skillName: string, input: Record<string, unknown>, _context: unknown): Promise<HybridExecutionResult> {
    const estimatedDuration = Number(input.estimatedDuration) || 0;

    if (this.shouldUseSandbox(estimatedDuration)) {
      return this.executeInSandbox();
    }

    try {
      return await this.executeDirect();
    } catch (error: unknown) {
      const err = asErrorLike(error);
      if (this.config.autoUpgrade && this.isRetryable(err)) {
        return this.executeInSandbox();
      }
      throw err;
    }
  }

  private shouldUseSandbox(estimatedDuration: number): boolean {
    if (this.config.defaultMode === "sandbox") return true;
    if (this.config.defaultMode === "direct") return false;
    return estimatedDuration > this.config.maxDirectDuration;
  }

  private async executeDirect(): Promise<HybridExecutionResult> {
    return { mode: "direct", result: {} };
  }

  private async executeInSandbox(): Promise<HybridExecutionResult> {
    return { mode: "sandbox", result: {} };
  }

  private isRetryable(err: { message?: string }): boolean {
    if (err?.message?.includes("timeout")) return true;
    if (err?.message?.includes("memory")) return true;
    return false;
  }
}

export const hybridExecutor = new HybridExecutor();
