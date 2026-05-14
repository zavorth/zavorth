export type ImportedCapabilityKind = 'skill' | 'mcp';

export type ImportedCapabilityTrustState = 'trusted' | 'safe' | 'quarantined';

export type ImportedCapabilityRiskLevel = 'low' | 'medium' | 'high';

export type ImportedCapabilityRiskReport = {
  kind: ImportedCapabilityKind;
  id: string;
  toolNames?: string[];
  trustState: ImportedCapabilityTrustState;
  riskLevel: ImportedCapabilityRiskLevel;
  quarantined: boolean;
  requiresReview: boolean;
  canExposeToModel: boolean;
  canExposeTools: boolean;
  reasons: string[];
};

export type ImportedCapabilityRiskReportInput = {
  kind: ImportedCapabilityKind;
  id: string;
  trustState?: ImportedCapabilityTrustState | null;
  reasons?: string[];
};

export type ImportedCapabilityTrustSummary = Record<ImportedCapabilityTrustState, number>;

export function normalizeImportedCapabilityTrustState(value: unknown): ImportedCapabilityTrustState | null {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'trusted' || normalized === 'safe' || normalized === 'quarantined') {
    return normalized;
  }
  return null;
}

export function summarizeImportedCapabilityTrust(
  reports: Array<Pick<ImportedCapabilityRiskReport, 'trustState'>>,
): ImportedCapabilityTrustSummary {
  return reports.reduce<ImportedCapabilityTrustSummary>((summary, report) => {
    summary[report.trustState] += 1;
    return summary;
  }, {
    trusted: 0,
    safe: 0,
    quarantined: 0,
  });
}

export function createImportedCapabilityRiskReport(
  input: ImportedCapabilityRiskReportInput,
): ImportedCapabilityRiskReport {
  const trustState = input.trustState || 'safe';
  const quarantined = trustState === 'quarantined';
  const reasons = Array.from(new Set((input.reasons || []).map((reason) => String(reason || '').trim()).filter(Boolean)));

  return {
    kind: input.kind,
    id: String(input.id || 'unknown').trim() || 'unknown',
    trustState,
    riskLevel: quarantined ? 'high' : trustState === 'trusted' ? 'low' : 'medium',
    quarantined,
    requiresReview: quarantined,
    canExposeToModel: !quarantined,
    canExposeTools: !quarantined,
    reasons: reasons.length > 0 ? reasons : [quarantined ? 'capability-quarantined' : `capability-${trustState}`],
  };
}
