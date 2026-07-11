/**
 * Desktop bridge for Absorb risk reports (capability install under quarantine).
 *
 * Pure types + formatters mirroring monorepo AbsorbRiskReport.
 * No Node filesystem I/O — safe for renderer.
 */

export type DesktopAbsorbRiskDimension =
  | 'files'
  | 'executable'
  | 'network'
  | 'permissions'
  | 'secrets'
  | 'unknown';

export type DesktopAbsorbRiskSeverity =
  | 'info'
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type DesktopAbsorbRiskFinding = {
  id: string;
  dimension: DesktopAbsorbRiskDimension | string;
  severity: DesktopAbsorbRiskSeverity | string;
  title: string;
  detail: string;
};

/** Mirrors monorepo AbsorbRiskReport for marketplace / skills UX. */
export type DesktopAbsorbRiskReport = {
  contractVersion: string;
  sourceLabel: string;
  kind: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical' | 'unknown' | string;
  confidence: 'high' | 'medium' | 'low' | string;
  findings: DesktopAbsorbRiskFinding[];
  summaryBullets: string[];
  quarantineRoot: string | null;
  candidateCount: number;
  executableDetected: boolean;
  secretLikeDetected: boolean;
  promoteReady: boolean;
  nextSafeAction: string;
  generatedAt: string;
};

/**
 * Operator-facing bullet lines from an absorb risk report.
 * Prefers summaryBullets; falls back to top findings.
 */
export function formatAbsorbRiskBullets(
  report: DesktopAbsorbRiskReport | null | undefined,
): string[] {
  if (!report) return ['Absorb risk report unavailable'];

  if (Array.isArray(report.summaryBullets) && report.summaryBullets.length > 0) {
    return report.summaryBullets
      .map((b) => String(b || '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  const findings = Array.isArray(report.findings) ? report.findings : [];
  if (findings.length === 0) {
    return [
      `Overall risk: ${report.overallRisk || 'unknown'}`,
      `${Number(report.candidateCount) || 0} candidate(s)`,
      report.promoteReady ? 'Promote path available with consent' : 'Promote not ready',
    ];
  }

  return findings.slice(0, 6).map((f) => {
    const dim = String(f.dimension || 'unknown');
    const sev = String(f.severity || 'info');
    const title = String(f.title || '').trim() || 'Finding';
    return `[${dim}/${sev}] ${title}`;
  });
}

export function absorbOverallRiskLabel(
  risk: string | null | undefined,
): string {
  const text = String(risk || '').trim().toLowerCase();
  if (text === 'critical') return 'Critical';
  if (text === 'high') return 'High';
  if (text === 'medium' || text === 'med') return 'Medium';
  if (text === 'low') return 'Low';
  if (text === 'unknown') return 'Unknown';
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Unknown';
}

/**
 * Compact one-liner for marketplace / skills strip honesty.
 * Example: `High risk · 2 candidates · executable · quarantine`
 */
export function formatAbsorbRiskStatusLine(
  report: DesktopAbsorbRiskReport | null | undefined,
): string {
  if (!report) return 'Absorb · risk unavailable';
  const parts = [
    `${absorbOverallRiskLabel(report.overallRisk)} risk`,
    `${Number(report.candidateCount) || 0} candidate(s)`,
  ];
  if (report.executableDetected) parts.push('executable');
  if (report.secretLikeDetected) parts.push('secrets');
  if (report.quarantineRoot) parts.push('quarantine');
  if (!report.promoteReady) parts.push('hold');
  return parts.join(' · ');
}
