/**
 * ToolGatekeeper — Cognitive Firewall, Preview engine: Just-In-Time Tool Loading
 *
 * This module receives the intent classification from IntentClassifier and filters
 * as ToolDefinitions a serem injetadas no prompt do LLM. Em vez de enviar
 * TODAS as 16+ tools em every call (como o ExternalExecutor faz), enviamos only
 * the tools that make sense for the detected intent.
 *
 * Result: the prompt sent to the LLM is roughly 60-70% lighter in tokens.
 */

import type { IntentCategory } from './IntentClassifier.js';
import type { ToolDefinition, CompactToolDefinition } from '../providers/ILlmProvider.js';
import { PluginStateService } from '../services/PluginStateService.js';
import { toCompact, toCompactBatch } from './LazyToolDefinition.js';
import { ToolClusterRegistry, type ToolCluster } from './ToolClusterRegistry.js';
import { ToolUsageTracker } from './ToolUsageTracker.js';

export type IntentToolCategoryMap = Partial<Record<IntentCategory | string, string[]>>;
export type ToolGatekeeperHintGroup =
  | 'conversation'
  | 'workspace'
  | 'web'
  | 'execution'
  | 'configuration'
  | 'memory'
  | 'desktop'
  | 'research'
  | 'all';

export type ToolGatekeeperHintProfile = {
  intentCategory: IntentCategory;
  groups: ToolGatekeeperHintGroup[];
  recommendedToolNames: string[];
  tools: ToolDefinition[];
  omittedToolNames: string[];
  quarantinedToolNames: string[];
  totalTools: number;
  filteredTools: number;
  toolExposureGatedByCognitiveFirewall: boolean;
  isHardGate: boolean;
  reason: string;
  /** When compactMode is active, holds the compact tool definitions. */
  compactTools?: CompactToolDefinition[];
  /** Whether compact mode was active for this profile build. */
  isCompactMode?: boolean;
  /** Active cluster names when cluster mode is used. */
  activeClusters?: string[];
  /** Whether cluster mode was active for this profile build. */
  isClusterMode?: boolean;
  /** Tool names predicted by the usage tracker. */
  predictedToolNames?: string[];
  /** Whether predictive loading was active for this profile build. */
  isPredictiveMode?: boolean;
};

/** Agent-team tools shared across execution/research baselines. */
const AGENT_TEAM = ['zavorth_delegate', 'agent_manager', 'capability_discovery'] as const;

/** Intent → recommended tool names. `full_toolset` exposes all tools. */
const DEFAULT_INTENT_TOOL_MAP: Record<IntentCategory, string[] | '*'> = {
  conversation: ['capability_discovery', 'get_datetime'],
  information: ['web_search', 'get_datetime', 'capability_discovery', 'query_external_ai'],
  file_operation: ['read_file', 'create_file', 'list_directory', 'capability_discovery'],
  execution: ['run_sandbox_code', 'remote_shell', 'read_file', 'list_directory', 'zavorth_delegate', 'capability_discovery'],
  configuration: ['configure_llm_profile', 'zavorth_action', 'get_datetime', 'capability_discovery'],
  memory: ['semantic_memory', 'zavorth_action', 'get_datetime', 'capability_discovery'],
  desktop: ['desktop_automation', 'read_file', 'capability_discovery'],
  research: ['web_search', 'query_external_ai', 'get_datetime', 'create_file', ...AGENT_TEAM],
  full_toolset: '*',
};

const INTENT_HINT_GROUPS: Record<IntentCategory, ToolGatekeeperHintGroup[]> = {
  conversation: ['conversation'],
  information: ['web'],
  file_operation: ['workspace'],
  execution: ['execution', 'workspace'],
  configuration: ['configuration'],
  memory: ['memory'],
  desktop: ['desktop', 'workspace'],
  research: ['research', 'web', 'workspace'],
  full_toolset: ['all'],
};

let dynamicIntentToolMap: Record<string, string[]> = {};

export function setDynamicIntentToolMap(map: IntentToolCategoryMap): void {
  const normalized: Record<string, string[]> = {};

  for (const [category, tools] of Object.entries(map || {})) {
    const names = Array.from(
      new Set(
        (tools || [])
          .map((name) => String(name || '').trim())
          .filter(Boolean),
      ),
    );
    if (names.length > 0) {
      normalized[String(category)] = names;
    }
  }

  dynamicIntentToolMap = normalized;
}

export function getDynamicIntentToolMap(): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(dynamicIntentToolMap).map(([category, tools]) => [category, [...tools]]),
  );
}

export interface ToolGatekeeperOptions {
  pluginState?: PluginStateService;
  /** When true, buildHintProfile returns CompactToolDefinitions to save tokens. */
  compactMode?: boolean;
  /** When true, uses cluster-based tool selection instead of individual tools. */
  clusterMode?: boolean;
  /** Custom cluster registry for cluster mode. Uses built-in if not provided. */
  clusterRegistry?: ToolClusterRegistry;
  /** Tool usage tracker for predictive loading. */
  usageTracker?: ToolUsageTracker;
  /** Current session ID for predictive loading context. */
  sessionId?: string;
}

export class ToolGatekeeper {
  private readonly pluginState: PluginStateService;
  private readonly compactMode: boolean;
  private readonly clusterMode: boolean;
  private readonly clusterRegistry: ToolClusterRegistry;
  private readonly usageTracker?: ToolUsageTracker;
  private readonly sessionId?: string;

  constructor(pluginStateOrOptions?: PluginStateService | ToolGatekeeperOptions) {
    if (pluginStateOrOptions instanceof PluginStateService) {
      this.pluginState = pluginStateOrOptions;
      this.compactMode = false;
      this.clusterMode = false;
      this.clusterRegistry = new ToolClusterRegistry();
    } else {
      this.pluginState = pluginStateOrOptions?.pluginState ?? new PluginStateService();
      this.compactMode = pluginStateOrOptions?.compactMode ?? false;
      this.clusterMode = pluginStateOrOptions?.clusterMode ?? false;
      this.clusterRegistry = pluginStateOrOptions?.clusterRegistry ?? new ToolClusterRegistry();
      this.usageTracker = pluginStateOrOptions?.usageTracker;
      this.sessionId = pluginStateOrOptions?.sessionId;
    }
  }

  /**
   * Applies the operator plugin quarantine policy.
   * Removes tools whose pluginId is not approved (trust !== 'trusted' or sourceTrusted !== true).
   * Tools without an associated pluginId are always allowed as native tools.
   */
  private applyPluginQuarantine(tools: ToolDefinition[]): {
    approved: ToolDefinition[];
    quarantined: string[];
  } {
    const approved: ToolDefinition[] = [];
    const quarantined: string[] = [];
    const approvalSnapshot = this.pluginState.getApprovalSnapshot();

    for (const tool of tools) {
      const pluginId = this.resolvePluginId(tool);
      if (pluginId && !approvalSnapshot.isApproved(pluginId)) {
        quarantined.push(tool.name);
      } else {
        approved.push(tool);
      }
    }

    return { approved, quarantined };
  }

  private resolvePluginId(tool: ToolDefinition): string | null {
    const metadata = tool.metadata || {};
    const explicit = [
      metadata.pluginId,
      metadata.sourcePluginId,
      metadata.packageId,
      metadata.serverId,
    ]
      .map((value) => String(value || '').trim())
      .find(Boolean);
    if (explicit) {
      return explicit;
    }

    const source = String(metadata.source || '').trim().toLowerCase();
    if (source === 'mcp' || source === 'plugin' || source === 'external-plugin') {
      return `untrusted-source:${source}:${tool.name}`;
    }

    return null;
  }

  public buildHintProfile(
    allTools: ToolDefinition[],
    intentCategory: IntentCategory,
  ): ToolGatekeeperHintProfile {
    const defaultAllowedNames = DEFAULT_INTENT_TOOL_MAP[intentCategory];
    const totalTools = allTools.length;

    // Step 1: quarantine plugin tools that the operator has not approved.
    const { approved: approvedTools, quarantined: quarantinedToolNames } = this.applyPluginQuarantine(allTools);
    const pluginGateApplied = quarantinedToolNames.length > 0;

    if (defaultAllowedNames === '*') {
      const recommendedToolNames = approvedTools.map((tool) => tool.name);
      let predictedToolNames: string[] | undefined;
      if (this.usageTracker && this.sessionId) {
        const prediction = this.usageTracker.predictNextTools(
          this.sessionId,
          recommendedToolNames,
        );
        if (prediction.predictedTools.length > 0) {
          predictedToolNames = prediction.predictedTools;
        }
      }
      const activeClusters = this.clusterMode
        ? this.clusterRegistry.getAllClusters().map((cluster) => cluster.name)
        : undefined;
      return {
        intentCategory,
        groups: INTENT_HINT_GROUPS[intentCategory],
        recommendedToolNames,
        tools: [...approvedTools],
        omittedToolNames: [],
        quarantinedToolNames,
        totalTools,
        filteredTools: approvedTools.length,
        toolExposureGatedByCognitiveFirewall: pluginGateApplied,
        isHardGate: pluginGateApplied,
        reason: pluginGateApplied ? `Intent hint recommends the full toolset; ${quarantinedToolNames.length} tool(s) blocked by operator plugin policy.`
          : 'Intent hint recommends the full available toolset; final exposure belongs to runtime policy.',
        ...(this.compactMode ? { compactTools: toCompactBatch(approvedTools), isCompactMode: true } : {}),
        ...(this.clusterMode ? { activeClusters, isClusterMode: true } : {}),
        ...(predictedToolNames ? { predictedToolNames, isPredictiveMode: true } : {}),
      };
    }

    // Step 2: determine allowed tool names (cluster-aware or individual).
    let intendedToolNames: string[];
    let activeClusters: string[] | undefined;

    if (this.clusterMode) {
      // Cluster mode: get tools from clusters matching the intent.
      const clusterTools = this.clusterRegistry.getToolsForIntent(intentCategory);
      const clusters = this.clusterRegistry.getClustersForIntent(intentCategory);
      activeClusters = clusters.map((c) => c.name);

      // Merge with default and dynamic maps
      intendedToolNames = Array.from(
        new Set([
          ...(defaultAllowedNames || []),
          ...(dynamicIntentToolMap[intentCategory] || []),
          ...clusterTools,
        ]),
      );
    } else {
      intendedToolNames = Array.from(
        new Set([
          ...(defaultAllowedNames || []),
          ...(dynamicIntentToolMap[intentCategory] || []),
        ]),
      );
    }

    // Step 3: apply intent filtering over the already approved pool.
    const allowedSet = new Set(intendedToolNames);
    const tools = approvedTools.filter((tool) => allowedSet.has(tool.name));
    const selectedNames = new Set(tools.map((tool) => tool.name));
    const recommendedToolNames = tools.map((tool) => tool.name);

    // Step 4: predictive loading — add tools predicted by usage history.
    let predictedToolNames: string[] | undefined;
    let finalTools = tools;

    if (this.usageTracker && this.sessionId) {
      const prediction = this.usageTracker.predictNextTools(
        this.sessionId,
        recommendedToolNames,
      );

      if (prediction.predictedTools.length > 0) {
        predictedToolNames = prediction.predictedTools;

        // Add predicted tools that aren't already in the set
        const predictedSet = new Set(prediction.predictedTools);
        const additionalTools = approvedTools.filter(
          (tool) => predictedSet.has(tool.name) && !selectedNames.has(tool.name),
        );

        if (additionalTools.length > 0) {
          finalTools = [...tools, ...additionalTools];
        }
      }
    }

    return {
      intentCategory,
      groups: INTENT_HINT_GROUPS[intentCategory],
      recommendedToolNames,
      tools: finalTools,
      omittedToolNames: approvedTools
        .map((tool) => tool.name)
        .filter((name) => !finalTools.some((t) => t.name === name)),
      quarantinedToolNames,
      totalTools,
      filteredTools: finalTools.length,
      toolExposureGatedByCognitiveFirewall: pluginGateApplied,
      isHardGate: pluginGateApplied,
      reason: pluginGateApplied ? `Intent classifier filtered by intent; ${quarantinedToolNames.length} tool(s) blocked by operator plugin policy.`
        : 'Intent classifier produced a tool hint only; final exposure belongs to runtime policy.',
      ...(this.compactMode ? { compactTools: toCompactBatch(finalTools), isCompactMode: true } : {}),
      ...(this.clusterMode ? { activeClusters, isClusterMode: true } : {}),
      ...(predictedToolNames ? { predictedToolNames, isPredictiveMode: true } : {}),
    };
  }

  /**
   * Filters tool definitions based on the detected intent category.
   * Returns only the ones the LLM may actually need.
   *
   * @param allTools - Todas as tools registradas no ToolRegistry
   * @param intentCategory - Category detected by IntentClassifier
   * @returns Subconjunto filtrado de ToolDefinitions (ou vazio para chat puro)
   */
  public filterTools(allTools: ToolDefinition[], intentCategory: IntentCategory): ToolDefinition[] {
    return this.buildHintProfile(allTools, intentCategory).tools;
  }

  /**
   * Returns savings statistics for logging.
   */
  public getFilterStats(
    totalTools: number,
    filteredTools: number,
    intentCategory: IntentCategory,
    quarantinedCount = 0,
    compactMode = false,
    clusterMode = false,
    predictiveMode = false,
  ): string {
    const saved = totalTools - filteredTools;
    const percent = totalTools > 0 ? Math.round((saved / totalTools) * 100) : 0;
    const quarantineInfo = quarantinedCount > 0 ? ` | Quarantine: ${quarantinedCount} blocked` : '';
    const compactInfo = compactMode ? ' | Compact: active' : '';
    const clusterInfo = clusterMode ? ' | Clusters: active' : '';
    const predictiveInfo = predictiveMode ? ' | Predictive: active' : '';
    return `[Cognitive Firewall] Intent: ${intentCategory} | Tools: ${filteredTools}/${totalTools} recommended (${percent}% estimated savings${quarantineInfo}${compactInfo}${clusterInfo}${predictiveInfo})`;
  }
}
