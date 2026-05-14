import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import type { IntegrationHubMcpSnapshot, IntegrationHubMcpServerEntry } from '../contracts/IntegrationHubContract.js';
import { McpManifestLoader, type ResolvedMcpServerManifestEntry } from '../mcp/McpManifest.js';
import type { McpRuntimeSnapshot } from '../mcp/McpRuntimeService.js';

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
        operatorSummary: `${summary.connected}/${summary.enabled} servidor(es) MCP conectado(s), `
          + `${summary.toolCount} tool(s) exposta(s) e ${summary.capabilityCount} capability(s) catalogada(s).`,
      },
    };
  }

  private mergeEntry(
    manifestEntry: ResolvedMcpServerManifestEntry,
    runtimeEntry: McpRuntimeSnapshot['entries'][number] | null,
  ): IntegrationHubMcpServerEntry {
    const status = runtimeEntry?.status || (manifestEntry.enabled ? 'manifest_only' : 'disabled');
    const toolCount = Number(runtimeEntry?.toolCount || 0);
    const capability = String(runtimeEntry?.capability || manifestEntry.capability || '').trim() || null;
    return {
      id: manifestEntry.id,
      capability,
      enabled: manifestEntry.enabled !== false,
      status,
      toolCount,
      toolNames: [...(runtimeEntry?.toolNames || [])],
      summary: this.buildEntrySummary(status, capability, toolCount),
      issue: runtimeEntry?.lastError || null,
      lastAttemptedAt: runtimeEntry?.lastAttemptedAt || null,
      lastConnectedAt: runtimeEntry?.lastConnectedAt || null,
    };
  }

  private buildEntrySummary(
    status: IntegrationHubMcpServerEntry['status'],
    capability: string | null,
    toolCount: number,
  ): string {
    const capabilityLabel = capability ? `capability ${capability}` : 'capability nao declarada';
    if (status === 'connected') {
      return `${capabilityLabel} conectada com ${toolCount} tool(s) registradas.`;
    }
    if (status === 'failed') {
      return `${capabilityLabel} falhou no bootstrap do runtime.`;
    }
    if (status === 'disabled') {
      return `${capabilityLabel} mantida desabilitada no manifesto.`;
    }
    if (status === 'stopped') {
      return `${capabilityLabel} foi conectada, mas o runtime MCP ja foi encerrado.`;
    }
    return `${capabilityLabel} declarada no manifesto e aguardando conexao do runtime.`;
  }

  private buildRecommendations(
    summary: IntegrationHubMcpSnapshot['summary'],
    entries: IntegrationHubMcpServerEntry[],
  ): string[] {
    const recommendations: string[] = [];
    if (summary.failed > 0) {
      recommendations.push('Existe servidor MCP falhando no bootstrap; vale revisar manifesto, binario e credenciais antes de confiar nessa capability.');
    }
    if (summary.connected === 0 && summary.enabled > 0) {
      recommendations.push('O manifesto MCP existe, mas nenhuma capability esta realmente conectada ao ToolRegistry agora.');
    }
    if (entries.some((entry) => entry.status === 'manifest_only')) {
      recommendations.push('Algumas capabilities MCP ainda so existem no manifesto; iniciar o runtime completa a exposicao real das tools.');
    }
    if (summary.capabilityCount === 0 && entries.length > 0) {
      recommendations.push('Declare capability nos servidores MCP para melhorar governanca, policy e troubleshooting.');
    }
    if (recommendations.length === 0) {
      recommendations.push('MCP esta coerente com o manifesto e com o runtime atual.');
    }
    return recommendations;
  }

  private readManifestEntries(): ResolvedMcpServerManifestEntry[] {
    try {
      return this.manifestLoader.load();
    } catch {
      return [];
    }
  }

  private readRuntimeSnapshot(): McpRuntimeSnapshot | null {
    if (!fs.existsSync(this.runtimeStateFile)) {
      return null;
    }

    try {
      return JSON.parse(fs.readFileSync(this.runtimeStateFile, 'utf8')) as McpRuntimeSnapshot;
    } catch {
      return null;
    }
  }
}
