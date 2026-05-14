import type { McpRuntimeServerSnapshot } from '../../../mcp/McpRuntimeService.js';
import {
  createImportedCapabilityRiskReport,
  type ImportedCapabilityRiskReport,
} from './ImportedCapabilityRiskReport.js';

export class McpQuarantinePolicy {
  public evaluate(entry: McpRuntimeServerSnapshot): ImportedCapabilityRiskReport {
    const trustState = this.resolveTrustState(entry);

    return createImportedCapabilityRiskReport({
      kind: 'mcp',
      id: entry.id,
      trustState,
      reasons: this.resolveReasons(entry, trustState),
    });
  }

  private resolveTrustState(entry: McpRuntimeServerSnapshot): ImportedCapabilityRiskReport['trustState'] {
    if (entry.enabled === false || entry.status === 'failed' || entry.status === 'disabled' || entry.status === 'stopped') {
      return 'quarantined';
    }

    const id = String(entry.id || '').trim().toLowerCase();
    const capability = String(entry.capability || '').trim().toLowerCase();
    if (id.startsWith('zavorth') || capability === 'core') {
      return 'trusted';
    }

    return 'safe';
  }

  private resolveReasons(
    entry: McpRuntimeServerSnapshot,
    trustState: ImportedCapabilityRiskReport['trustState'],
  ): string[] {
    if (trustState === 'quarantined') {
      return [`mcp-${entry.status || 'unavailable'}`];
    }
    if (trustState === 'trusted') {
      return ['mcp-trusted-runtime'];
    }
    return ['mcp-connected-safe'];
  }
}
