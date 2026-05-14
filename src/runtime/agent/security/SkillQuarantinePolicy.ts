import type { SkillManifest } from '../../../context-engine/SkillScanner.js';
import {
  createImportedCapabilityRiskReport,
  normalizeImportedCapabilityTrustState,
  type ImportedCapabilityRiskReport,
} from './ImportedCapabilityRiskReport.js';

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function truthy(value: unknown): boolean {
  return value === true || String(value ?? '').trim().toLowerCase() === 'true';
}

export class SkillQuarantinePolicy {
  public evaluate(manifest: SkillManifest): ImportedCapabilityRiskReport {
    const metadata = metadataRecord(manifest.metadata);
    const trustState = this.resolveTrustState(metadata);
    const reasons = this.resolveReasons(metadata, trustState);

    return createImportedCapabilityRiskReport({
      kind: 'skill',
      id: manifest.id,
      trustState,
      reasons,
    });
  }

  private resolveTrustState(metadata: Record<string, unknown>): ImportedCapabilityRiskReport['trustState'] {
    const explicit = normalizeImportedCapabilityTrustState(
      metadata.trustState ?? metadata.trust_state ?? metadata.trust,
    );
    if (explicit) {
      return explicit;
    }

    if (
      truthy(metadata.quarantined)
      || String(metadata.lifecycle || '').trim().toLowerCase() === 'quarantined'
      || String(metadata.origin || '').trim().toLowerCase() === 'quarantined'
    ) {
      return 'quarantined';
    }

    if (
      truthy(metadata.trusted)
      || String(metadata.origin || '').trim().toLowerCase() === 'official'
      || String(metadata.source || '').trim().toLowerCase() === 'official'
    ) {
      return 'trusted';
    }

    return 'safe';
  }

  private resolveReasons(
    metadata: Record<string, unknown>,
    trustState: ImportedCapabilityRiskReport['trustState'],
  ): string[] {
    if (trustState === 'quarantined') {
      return ['skill-requires-review'];
    }
    if (trustState === 'trusted') {
      return ['skill-trusted-source'];
    }
    if (metadata.firewall_category || metadata.category) {
      return ['skill-has-category-metadata'];
    }
    return ['skill-default-safe'];
  }
}
