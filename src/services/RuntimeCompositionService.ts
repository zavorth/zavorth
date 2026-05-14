import { config } from '../config/index.js';
import type { ToolExecutor } from '../execution/ToolExecutor.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import { GraphRuntimeService } from './graph/GraphRuntimeService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { MemoryRuntimeService } from './memory/MemoryRuntimeService.js';
import { SandboxExecutionService } from './SandboxExecutionService.js';
import { TelemetryRuntimeService } from './telemetry/TelemetryRuntimeService.js';
import { ToolRuntimeService } from './tools/ToolRuntimeService.js';

type RuntimeCompositionOptions = {
  toolRegistry?: ToolRegistry;
  toolExecutor?: ToolExecutor;
  toolRuntime?: ToolRuntimeService;
  telemetryRuntime?: TelemetryRuntimeService;
  llmRuntime?: LlmRuntimeService;
};

export class RuntimeCompositionService {
  private llmRuntime: LlmRuntimeService | null = null;
  private graphRuntime: GraphRuntimeService | null = null;
  private memoryRuntime: MemoryRuntimeService | null = null;
  private telemetryRuntime: TelemetryRuntimeService | null = null;
  private toolRuntime: ToolRuntimeService | null = null;
  private sandboxRuntime: SandboxExecutionService | null = null;

  constructor(private readonly options: RuntimeCompositionOptions = {}) {}

  public getLlmRuntime(): LlmRuntimeService {
    if (!this.llmRuntime) {
      this.llmRuntime = this.options.llmRuntime || new LlmRuntimeService();
    }

    return this.llmRuntime;
  }

  public getGraphRuntime(): GraphRuntimeService {
    if (!this.graphRuntime) {
      this.graphRuntime = new GraphRuntimeService({
        llmRuntime: this.getLlmRuntime(),
        toolRuntime: this.getToolRuntime(),
        maxIterations: config.maxIterations,
        maxToolRounds: config.graphMaxToolRounds,
        telemetryRuntime: this.getTelemetryRuntime(),
      });
    }

    return this.graphRuntime;
  }

  public getToolRuntime(): ToolRuntimeService {
    if (!this.toolRuntime) {
      this.toolRuntime =
        this.options.toolRuntime ||
        new ToolRuntimeService(this.options.toolRegistry, this.options.toolExecutor);
    }

    return this.toolRuntime;
  }

  public getMemoryRuntime(): MemoryRuntimeService {
    if (!this.memoryRuntime) {
      this.memoryRuntime = new MemoryRuntimeService();
    }

    return this.memoryRuntime;
  }

  public getTelemetryRuntime(): TelemetryRuntimeService {
    if (!this.telemetryRuntime) {
      this.telemetryRuntime = this.options.telemetryRuntime || new TelemetryRuntimeService();
    }

    return this.telemetryRuntime;
  }

  public getSandboxRuntime(): SandboxExecutionService {
    if (!this.sandboxRuntime) {
      this.sandboxRuntime = new SandboxExecutionService();
    }

    return this.sandboxRuntime;
  }
}
