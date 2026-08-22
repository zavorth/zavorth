import { asErrorLike } from '../../../utils/errorLike';
export type ExecutionMode = "direct" | "sandbox" | "hybrid";

export interface HybridConfig {
  defaultMode: ExecutionMode;
  autoUpgrade: boolean;
  maxDirectDuration: number;
}

const defaultHybridConfig: HybridConfig = {
  defaultMode: "direct",
  autoUpgrade: true,
  maxDirectDuration: 5000,
};

export class HybridExecutor {
  private config: HybridConfig;
  private directExecutor: any;
  private sandboxRunner: any;

  constructor(config: Partial<HybridConfig> = {}) {
    this.config = { ...defaultHybridConfig, ...config };
  }

  setConfig(config: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async execute(skillName: string, input: any, _context: any): Promise<any> {
    const estimatedDuration = input.estimatedDuration || 0;

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

  private async executeDirect(): Promise<any> {
    return { mode: "direct", result: {} };
  }

  private async executeInSandbox(): Promise<any> {
    return { mode: "sandbox", result: {} };
  }

  private isRetryable(err: any): boolean {
    if (err?.message?.includes("timeout")) return true;
    if (err?.message?.includes("memory")) return true;
    return false;
  }
}

export const hybridExecutor = new HybridExecutor();
