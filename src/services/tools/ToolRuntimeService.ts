import type { ToolDefinition } from '../../providers/ILlmProvider.js';
import type { ToolExecutor } from '../../execution/ToolExecutor.js';
import type { ToolRegistry } from '../../tools/ToolRegistry.js';
import type { OperatorContinuityEnvelope } from '../../runtime/operator/OperatorContinuityEnvelope.js';
import { ToolResultCache } from '../../cognitive-firewall/ToolResultCache.js';
import {
  ToolCatalogService,
  type RuntimeToolCatalogEntry,
  type RuntimeToolGroup,
} from './ToolCatalogService.js';

type ToolExecutorLike = Pick<ToolExecutor, 'executeTool' | 'getLastContinuityEnvelope'>;
type ToolRegistryLike = Pick<
  ToolRegistry,
  | 'getTool'
  | 'getAllTools'
  | 'getToolDefinitions'
  | 'getToolSecurityDefinition'
>;

const NON_CACHEABLE_TOOL_PATTERN = /(write|delete|apply|exec|shell|spawn|mutation|send|install|uninstall|deploy|commit|patch|edit)/i;

export interface ToolRuntimeServiceOptions {
  /** Enable tool result caching. Default: true */
  cacheEnabled?: boolean;
  /** Max cache entries. Default: 500 */
  cacheMaxEntries?: number;
  /** Cache TTL in ms. Default: 300000 (5 min) */
  cacheTtlMs?: number;
}

export class ToolRuntimeService {
  private readonly catalog: ToolCatalogService;
  private readonly cache: ToolResultCache;
  private readonly cacheEnabled: boolean;

  constructor(
    private readonly registry?: ToolRegistryLike,
    private readonly executor?: ToolExecutorLike,
    options?: ToolRuntimeServiceOptions,
  ) {
    this.catalog = new ToolCatalogService(registry);
    this.cacheEnabled = options?.cacheEnabled ?? true;
    this.cache = new ToolResultCache({
      maxEntries: options?.cacheMaxEntries,
      defaultTtlMs: options?.cacheTtlMs,
    });
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

  public getLastContinuityEnvelope(): OperatorContinuityEnvelope | null {
    if (!this.executor || typeof this.executor.getLastContinuityEnvelope !== 'function') {
      return null;
    }
    return this.executor.getLastContinuityEnvelope();
  }

  public async executeTool(toolName: string, args: unknown): Promise<string> {
    if (!this.executor) {
      throw new Error('Tool runtime without executor configured nesta session.');
    }

    const canCache = this.cacheEnabled
      && typeof args === 'object'
      && args !== null
      && !NON_CACHEABLE_TOOL_PATTERN.test(String(toolName || ''));

    if (canCache) {
      const cached = this.cache.get(toolName, args as Record<string, unknown>);
      if (cached !== null) {
        return cached;
      }
    }

    const result = await this.executor.executeTool(toolName, args);

    if (canCache) {
      this.cache.set(toolName, args as Record<string, unknown>, result);
    }

    return result;
  }

  /**
   * Returns tool result cache statistics.
   */
  public getCacheStats(): { hits: number; misses: number; evictions: number; size: number } {
    return this.cache.getStats();
  }
}
