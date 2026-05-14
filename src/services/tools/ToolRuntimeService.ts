import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { ToolExecutor } from '../../execution/ToolExecutor.js';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';
import {
  ToolCatalogService,
  type RuntimeToolCatalogEntry,
  type RuntimeToolGroup,
} from './ToolCatalogService.js';

type ToolExecutorLike = Pick<ToolExecutor, 'executeTool'>;
type ToolRegistryLike = Pick<
  ToolRegistry,
  | 'getTool'
  | 'getAllTools'
  | 'getToolDefinitions'
  | 'getToolSecurityDefinition'
>;

export class ToolRuntimeService {
  private readonly catalog: ToolCatalogService;

  constructor(
    private readonly registry?: ToolRegistryLike,
    private readonly executor?: ToolExecutorLike,
  ) {
    this.catalog = new ToolCatalogService(registry);
  }

  public getToolDefinitions(): ToolDefinition[] {
    return this.catalog.getToolDefinitions();
  }

  public getRegisteredToolNames(): string[] {
    return this.catalog.getRegisteredToolNames();
  }

  public listTools(): RuntimeToolCatalogEntry[] {
    return this.catalog.listTools();
  }

  public listToolsByGroup(group: RuntimeToolGroup): RuntimeToolCatalogEntry[] {
    return this.catalog.listToolsByGroup(group);
  }

  public getToolEntry(name: string): RuntimeToolCatalogEntry | null {
    return this.catalog.getToolEntry(name);
  }

  public hasTool(name: string): boolean {
    return this.catalog.hasTool(name);
  }

  public isAvailable(): boolean {
    return this.catalog.count() > 0 && Boolean(this.executor);
  }

  public async executeTool(toolName: string, args: unknown): Promise<string> {
    if (!this.executor) {
      throw new Error('Tool runtime sem executor configurado nesta sessao.');
    }

    return this.executor.executeTool(toolName, args);
  }
}
