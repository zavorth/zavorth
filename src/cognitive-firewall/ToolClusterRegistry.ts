/**
 * ToolClusterRegistry — groups related tools into logical clusters.
 *
 * Instead of selecting individual tools, the LLM can select a cluster
 * and get all tools in that cluster. This simplifies tool selection
 * and ensures related tools are always available together.
 */

import type { IntentCategory } from './IntentClassifier.js';

export interface ToolCluster {
  /** Unique cluster identifier. */
  name: string;
  /** Human-readable description of what this cluster provides. */
  description: string;
  /** Tool names included in this cluster. */
  toolNames: string[];
  /** Intent categories that auto-activate this cluster. */
  intentHints: IntentCategory[];
}

/**
 * Built-in tool clusters.
 * Tool names must match the registered ToolDefinition names in the system.
 */
const BUILTIN_CLUSTERS: ToolCluster[] = [
  {
    name: 'file_ops',
    description: 'Read, write, create, and manage files and directories.',
    toolNames: ['read_file', 'create_file', 'list_directory', 'file_system_advanced'],
    intentHints: ['file_operation', 'execution', 'desktop'],
  },
  {
    name: 'web',
    description: 'Search the web, browse pages, and fetch URLs.',
    toolNames: ['web_search', 'browser_automation', 'browser_cdp', 'webhook_receiver'],
    intentHints: ['information', 'research'],
  },
  {
    name: 'devops',
    description: 'Manage containers, SSH tunnels, and deployment infrastructure.',
    toolNames: ['docker_compose', 'container_manager', 'ssh_tunnel', 'cloud_storage'],
    intentHints: ['execution'],
  },
  {
    name: 'execution',
    description: 'Run code in sandbox or remote shell environments.',
    toolNames: ['run_sandbox_code', 'remote_shell'],
    intentHints: ['execution'],
  },
  {
    name: 'memory',
    description: 'Semantic memory, graph memory, and session search.',
    toolNames: ['semantic_memory', 'memory_graph', 'session_search'],
    intentHints: ['memory'],
  },
  {
    name: 'communication',
    description: 'Send emails, channel messages, and notifications.',
    toolNames: ['email', 'channel_send', 'notification'],
    intentHints: ['configuration'],
  },
  {
    name: 'code_intel',
    description: 'Code intelligence, formatting, review, and dependency analysis.',
    toolNames: ['code_intelligence', 'code_formatter', 'code_review', 'dependency_analyzer'],
    intentHints: ['execution', 'research'],
  },
  {
    name: 'ai_ml',
    description: 'Query external AI, configure LLM profiles, and ML operations.',
    toolNames: ['query_external_ai', 'configure_llm_profile', 'ml_ops'],
    intentHints: ['research', 'configuration'],
  },
  {
    name: 'desktop',
    description: 'Desktop automation, mouse, keyboard, and window management.',
    toolNames: ['desktop_automation'],
    intentHints: ['desktop'],
  },
  {
    name: 'media',
    description: 'Image generation, video, TTS, STT, and media analysis.',
    toolNames: ['image_generation', 'video_generation', 'tts', 'stt', 'media_analysis'],
    intentHints: ['research', 'configuration'],
  },
];

export class ToolClusterRegistry {
  private readonly clusters: Map<string, ToolCluster>;

  constructor(customClusters?: ToolCluster[]) {
    this.clusters = new Map<string, ToolCluster>();

    // Load built-in clusters
    for (const cluster of BUILTIN_CLUSTERS) {
      this.clusters.set(cluster.name, { ...cluster });
    }

    // Override/extend with custom clusters
    if (customClusters) {
      for (const cluster of customClusters) {
        this.clusters.set(cluster.name, { ...cluster });
      }
    }
  }

  /**
   * Returns all registered clusters.
   */
  getAllClusters(): ToolCluster[] {
    return Array.from(this.clusters.values());
  }

  /**
   * Returns a specific cluster by name.
   */
  getCluster(name: string): ToolCluster | null {
    return this.clusters.get(name) ?? null;
  }

  /**
   * Returns clusters that are relevant for the given intent category.
   */
  getClustersForIntent(category: IntentCategory): ToolCluster[] {
    return Array.from(this.clusters.values()).filter(
      (cluster) => cluster.intentHints.includes(category),
    );
  }

  /**
   * Expands a cluster name into its list of tool names.
   * Returns empty array for unknown clusters.
   */
  expandCluster(clusterName: string): string[] {
    const cluster = this.clusters.get(clusterName);
    return cluster ? [...cluster.toolNames] : [];
  }

  /**
   * Expands multiple cluster names into a deduplicated list of tool names.
   */
  expandClusters(clusterNames: string[]): string[] {
    const toolNames = new Set<string>();
    for (const name of clusterNames) {
      const cluster = this.clusters.get(name);
      if (cluster) {
        for (const toolName of cluster.toolNames) {
          toolNames.add(toolName);
        }
      }
    }
    return Array.from(toolNames);
  }

  /**
   * Returns the union of all tool names across clusters matching the given intent.
   */
  getToolsForIntent(category: IntentCategory): string[] {
    const clusters = this.getClustersForIntent(category);
    const toolNames = new Set<string>();
    for (const cluster of clusters) {
      for (const toolName of cluster.toolNames) {
        toolNames.add(toolName);
      }
    }
    return Array.from(toolNames);
  }

  /**
   * Finds which cluster(s) a given tool belongs to.
   */
  findClustersForTool(toolName: string): ToolCluster[] {
    return Array.from(this.clusters.values()).filter(
      (cluster) => cluster.toolNames.includes(toolName),
    );
  }

  /**
   * Returns the number of registered clusters.
   */
  get size(): number {
    return this.clusters.size;
  }
}
