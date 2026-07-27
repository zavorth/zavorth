import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { IntegrationHubMcpSnapshot, IntegrationHubMcpServerEntry } from '../contracts/IntegrationHubContract.js';
import { McpManifestLoader, type ResolvedMcpServerManifestEntry } from '../mcp/McpManifest.js';
import type { McpRuntimeSnapshot } from '../mcp/McpRuntimeService.js';
import { logger } from '../logger.js';

type McpCapabilityControlPlaneRuntime = {
  now?: () => Date;
  manifestLoader?: Pick<McpManifestLoader, 'load'>;
  runtimeStateFile?: string;
};

export class McpCapabilityControlPlaneService {
  private readonly now: () => Date;
  private readonly manifestLoader: Pick<McpManifestLoader, 'load'>;
  private readonly runtimeStateFile: string;

  constructor(runtime: McpCapabilityControlPlaneRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.manifestLoader = runtime.manifestLoader || new McpManifestLoader();
    this.runtimeStateFile = path.resolve(runtime.runtimeStateFile || config.mcpRuntimeStateFile);
  }

  public buildSnapshot(): IntegrationHubMcpSnapshot {
    const manifestEntries = this.readManifestEntries();
    const runtimeSnapshot = this.readRuntimeSnapshot();
    const runtimeEntries = new Map(
      (runtimeSnapshot?.entries || []).map((entry) => [entry.id, entry]),
    );

    const mergedEntries: IntegrationHubMcpServerEntry[] = manifestEntries.map((entry) =>
      this.mergeEntry(entry, runtimeEntries.get(entry.id) || null),
    );

    for (const runtimeEntry of runtimeSnapshot?.entries || []) {
      if (mergedEntries.some((entry) => entry.id === runtimeEntry.id)) {
        continue;
      }

      mergedEntries.push({
        id: runtimeEntry.id,
        capability: runtimeEntry.capability || null,
        enabled: runtimeEntry.enabled,
        status: runtimeEntry.status,
        toolCount: Number(runtimeEntry.toolCount || 0),
        toolNames: [...(runtimeEntry.toolNames || [])],
        summary: this.buildEntrySummary(runtimeEntry.status, runtimeEntry.capability || null, Number(runtimeEntry.toolCount || 0)),
        issue: runtimeEntry.lastError || null,
        lastAttemptedAt: runtimeEntry.lastAttemptedAt || null,
        lastConnectedAt: runtimeEntry.lastConnectedAt || null,
      });
    }

    mergedEntries.sort((left, right) => left.id.localeCompare(right.id));
    const capabilities = Array.from(
      new Set(
        mergedEntries
          .map((entry) => String(entry.capability || '').trim())
          .filter(Boolean),
      ),
    );
    const summary = {
      total: mergedEntries.length,
      enabled: mergedEntries.filter((entry) => entry.enabled).length,
      connected: mergedEntries.filter((entry) => entry.status === 'connected').length,
      failed: mergedEntries.filter((entry) => entry.status === 'failed').length,
      disabled: mergedEntries.filter((entry) => entry.status === 'disabled').length,
      stopped: mergedEntries.filter((entry) => entry.status === 'stopped').length,
      toolCount: mergedEntries.reduce((total, entry) => total + Number(entry.toolCount || 0), 0),
      capabilityCount: capabilities.length,
    };
    const recommendations = this.buildRecommendations(summary, mergedEntries);

    return {
      generatedAt: this.now().toISOString(),
      manifestPath: runtimeSnapshot?.manifestPath || config.mcpServersManifestPath,
      summary,
      capabilities,
      entries: mergedEntries,
      recommendations,
      narrative: {
        headline: 'MCP capability control plane',
        operatorSummary: `${summary.connected}/${summary.enabled} server(es) MCP conectado(s), `
          + `${summary.toolCount} tool(s) exposta(s) e ${summary.capabilityCount} capability(s) catalogada(s).`,
      },
    };
  }

  private mergeEntry(
    manifestEntry: ResolvedMcpServerManifestEntry,
    runtimeEntry: McpRuntimeSnapshot['entries'][number] | null,
  ): IntegrationHubMcpServerEntry {
    const manifestEnabled = manifestEntry.enabled !== false;
    const status = manifestEnabled
      ? runtimeEntry?.status || 'manifest_only'
      : 'disabled';
    const toolCount = manifestEnabled ? Number(runtimeEntry?.toolCount || 0) : 0;
    const capability = String(runtimeEntry?.capability || manifestEntry.capability || '').trim() || null;
    return {
      id: manifestEntry.id,
      capability,
      enabled: manifestEnabled,
      status,
      toolCount,
      toolNames: manifestEnabled ? [...(runtimeEntry?.toolNames || [])] : [],
      summary: this.buildEntrySummary(status, capability, toolCount),
      issue: manifestEnabled ? runtimeEntry?.lastError || null : null,
      lastAttemptedAt: manifestEnabled ? runtimeEntry?.lastAttemptedAt || null : null,
      lastConnectedAt: manifestEnabled ? runtimeEntry?.lastConnectedAt || null : null,
    };
  }

  private buildEntrySummary(
    status: IntegrationHubMcpServerEntry['status'],
    capability: string | null,
    toolCount: number,
  ): string {
    const capabilityLabel = capability ? `capability ${capability}` : 'capability not declared';
    if (status === 'connected') {
      return `${capabilityLabel} conectada com ${toolCount} tool(s) registradas.`;
    }
    if (status === 'failed') {
      return `${capabilityLabel} failed no bootstrap do runtime.`;
    }
    if (status === 'disabled') {
      return `${capabilityLabel} kept disabled in the manifest.`;
    }
    if (status === 'stopped') {
      return `${capabilityLabel} foi conectada, mas o runtime MCP already foi encerrado.`;
    }
    return `${capabilityLabel} declared in the manifest and waiting for runtime connection.`;
  }

  private buildRecommendations(
    summary: IntegrationHubMcpSnapshot['summary'],
    entries: IntegrationHubMcpServerEntry[],
  ): string[] {
    const recommendations: string[] = [];
    if (summary.failed > 0) {
      recommendations.push('An MCP server is failing during bootstrap; review manifest, binary, and credentials before trusting this capability.');
    }
    if (summary.connected === 0 && summary.enabled > 0) {
      recommendations.push('The MCP manifest exists, but no capability is actually connected to ToolRegistry right now.');
    }
    if (entries.some((entry) => entry.status === 'manifest_only')) {
      recommendations.push('Algumas capabilities MCP ainda so existem no manifest; iniciar o runtime completa a exposure real das tools.');
    }
    if (summary.capabilityCount === 0 && entries.length > 0) {
      recommendations.push('Declare capability nos servers MCP para melhorar governanca, policy e troubleshooting.');
    }
    if (recommendations.length === 0) {
      recommendations.push('MCP is coerente com o manifest e com o runtime current.');
    }
    return recommendations;
  }

  private readManifestEntries(): ResolvedMcpServerManifestEntry[] {
    try {
      return this.manifestLoader.load();
    } catch (error: unknown) {logger.warn('[Mcp Capability Control Plane] load operation failed', error); return []; }
  }

  private readRuntimeSnapshot(): McpRuntimeSnapshot | null {
    if (!fs.existsSync(this.runtimeStateFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.runtimeStateFile, 'utf8')) as McpRuntimeSnapshot;
    } catch (error: unknown) {logger.warn('[Mcp Capability Control Plane] JSON parse failed', error); return null; }
  }
}
