import type {
  McpRuntimeServerSnapshot,
  McpRuntimeService,
  McpRuntimeSnapshot,
} from '../../../mcp/McpRuntimeService.js';
import {
  McpQuarantinePolicy,
  summarizeImportedCapabilityTrust,
  type ImportedCapabilityRiskReport,
  type ImportedCapabilityTrustState,
  type ImportedCapabilityTrustSummary,
} from '../security/index.js';
import type { CanonicalColdContextInput } from './CanonicalSessionContextAssembler.js';

export type McpSnapshotRuntime = Pick<McpRuntimeService, 'readSnapshot'>;
export type McpSnapshotQuarantinePolicy = Pick<McpQuarantinePolicy, 'evaluate'>;

export type McpSnapshotAssemblerOptions = {
  quarantinePolicy?: McpSnapshotQuarantinePolicy | null;
};

export type McpSnapshotAssemblerInput = {
  runtime?: McpSnapshotRuntime | null;
  snapshot?: McpRuntimeSnapshot | null;
  metadata?: Record<string, unknown>;
};

export type McpSnapshotStatus = 'available' | 'unavailable' | 'degraded' | 'failed';

export type McpSnapshotEntry = {
  id: string;
  capability: string | null;
  enabled: boolean;
  status: McpRuntimeServerSnapshot['status'];
  toolCount: number;
  toolNames: string[];
  trustState: ImportedCapabilityTrustState;
  quarantined: boolean;
  riskReport: ImportedCapabilityRiskReport;
  lastError: string | null;
};

export type McpContextSnapshot = {
  status: McpSnapshotStatus;
  generatedAt: string | null;
  manifestPath: string | null;
  capabilities: string[];
  summary: {
    total: number;
    enabled: number;
    connected: number;
    failed: number;
    disabled: number;
    stopped: number;
    toolCount: number;
  };
  trustSummary: ImportedCapabilityTrustSummary;
  entries: McpSnapshotEntry[];
  cold: Pick<CanonicalColdContextInput, 'mcpSnapshot' | 'metadata'>;
  metadata: Record<string, unknown>;
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function normalizeArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(
    values
      .map((value) => String(value ?? '').trim())
      .filter(Boolean),
  ));
}

function normalizeSummary(snapshot: McpRuntimeSnapshot | null): McpContextSnapshot['summary'] {
  return {
    total: Number(snapshot?.summary?.total || 0),
    enabled: Number(snapshot?.summary?.enabled || 0),
    connected: Number(snapshot?.summary?.connected || 0),
    failed: Number(snapshot?.summary?.failed || 0),
    disabled: Number(snapshot?.summary?.disabled || 0),
    stopped: Number(snapshot?.summary?.stopped || 0),
    toolCount: Number(snapshot?.summary?.toolCount || 0),
  };
}

function resolveStatus(summary: McpContextSnapshot['summary']): McpSnapshotStatus {
  if (summary.connected > 0) {
    return summary.failed > 0 ? 'degraded' : 'available';
  }

  if (summary.failed > 0) {
    return 'degraded';
  }

  return 'unavailable';
}

export class McpSnapshotAssembler {
  private readonly quarantinePolicy: McpSnapshotQuarantinePolicy;

  constructor(options: McpSnapshotAssemblerOptions = {}) {
    this.quarantinePolicy = options.quarantinePolicy || new McpQuarantinePolicy();
  }

  public assemble(input: McpSnapshotAssemblerInput = {}): McpContextSnapshot {
    try {
      const snapshot = input.snapshot || input.runtime?.readSnapshot() || null;
      return this.fromRuntimeSnapshot(snapshot, input.metadata);
    } catch (error: any) {
      return this.failedSnapshot(error, input.metadata);
    }
  }

  private fromRuntimeSnapshot(
    snapshot: McpRuntimeSnapshot | null,
    metadata: Record<string, unknown> | undefined,
  ): McpContextSnapshot {
    const summary = normalizeSummary(snapshot);
    const status = resolveStatus(summary);
    const entries = (snapshot?.entries || []).map((entry) => this.toEntry(entry));
    const trustSummary = summarizeImportedCapabilityTrust(entries);
    const riskReports = entries.map((entry) => entry.riskReport);
    const contextMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      source: 'McpRuntimeService.readSnapshot',
      status,
      mcpAvailable: status === 'available' || status === 'degraded',
      trustSummary,
      riskReports,
      toolExposureGatedByMcpSnapshot: false,
    };
    const mcpSnapshot = {
      status,
      generatedAt: snapshot?.generatedAt || null,
      manifestPath: snapshot?.manifestPath || null,
      capabilities: normalizeArray(snapshot?.capabilities),
      summary,
      trustSummary,
      riskReports,
      entries,
    };

    return {
      ...mcpSnapshot,
      cold: {
        mcpSnapshot,
        metadata: contextMetadata,
      },
      metadata: contextMetadata,
    };
  }

  private failedSnapshot(error: any, metadata: Record<string, unknown> | undefined): McpContextSnapshot {
    const summary = normalizeSummary(null);
    const trustSummary: ImportedCapabilityTrustSummary = {
      trusted: 0,
      safe: 0,
      quarantined: 0,
    };
    const contextMetadata: Record<string, unknown> = {
      ...(metadata || {}),
      source: 'McpRuntimeService.readSnapshot',
      status: 'failed',
      error: error?.message || String(error),
      mcpAvailable: false,
      trustSummary,
      riskReports: [],
      toolExposureGatedByMcpSnapshot: false,
    };
    const mcpSnapshot = {
      status: 'failed' as const,
      generatedAt: null,
      manifestPath: null,
      capabilities: [],
      summary,
      trustSummary,
      riskReports: [],
      entries: [],
      error: contextMetadata.error,
    };

    return {
      ...mcpSnapshot,
      cold: {
        mcpSnapshot,
        metadata: contextMetadata,
      },
      metadata: contextMetadata,
    };
  }

  private toEntry(entry: McpRuntimeServerSnapshot): McpSnapshotEntry {
    const toolNames = normalizeArray(entry.toolNames);
    const riskReport = {
      ...this.quarantinePolicy.evaluate(entry),
      toolNames,
    };

    return {
      id: normalizeText(entry.id) || 'unknown',
      capability: normalizeText(entry.capability),
      enabled: entry.enabled !== false,
      status: entry.status,
      toolCount: Number(entry.toolCount || 0),
      toolNames,
      trustState: riskReport.trustState,
      quarantined: riskReport.quarantined,
      riskReport,
      lastError: normalizeText(entry.lastError),
    };
  }
}
