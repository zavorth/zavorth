import { createHash } from 'node:crypto';
import type {
  GovernedReviewFinding,
  GovernedReviewSeverity,
} from './GovernedReviewTypes.js';

export class ReviewFindingNormalizer {
  public normalize(
    rawFindings: Array<Partial<GovernedReviewFinding>> | null | undefined,
  ): GovernedReviewFinding[] {
    if (!Array.isArray(rawFindings)) {
      return [];
    }

    const byFingerprint = new Map<string, GovernedReviewFinding>();
    for (const raw of rawFindings) {
      const finding = this.normalizeOne(raw);
      const existing = byFingerprint.get(this.fingerprint(finding));
      if (!existing || finding.confidence > existing.confidence) {
        byFingerprint.set(this.fingerprint(finding), finding);
      }
    }

    return Array.from(byFingerprint.values()).sort(compareFindings);
  }

  private normalizeOne(raw: Partial<GovernedReviewFinding>): GovernedReviewFinding {
    const title = normalizeText(raw.title, 'Review finding');
    const severity = normalizeSeverity(raw.severity);
    const evidence = uniqueStrings(raw.evidence).slice(0, 8);
    const sourceAgentId = normalizeText(raw.sourceAgentId, 'gate-4-import');
    const file = normalizeOptionalText(raw.file);
    const line = normalizeLine(raw.line);
    const recommendation = normalizeText(
      raw.recommendation,
      'Review this finding before taking action.',
    );
    const confidence = clampConfidence(raw.confidence);
    const id = normalizeText(raw.id)
      || `grf_${hashStable({ title, severity, file, line, sourceAgentId }).slice(0, 16)}`;

    return {
      id,
      title,
      severity,
      confidence,
      ...(file ? { file } : {}),
      ...(line ? { line } : {}),
      evidence,
      recommendation,
      sourceAgentId,
      tags: uniqueStrings([
        ...(raw.tags || []),
        `severity:${severity}`,
        confidence >= 80 ? 'confidence:high' : confidence >= 60 ? 'confidence:review' : 'confidence:speculative',
      ]),
      metadata: raw.metadata ? { ...raw.metadata } : {},
    };
  }

  private fingerprint(finding: GovernedReviewFinding): string {
    return hashStable({
      title: finding.title.toLowerCase(),
      file: finding.file || '',
      line: finding.line || 0,
      recommendation: finding.recommendation.toLowerCase(),
    });
  }
}

function compareFindings(left: GovernedReviewFinding, right: GovernedReviewFinding): number {
  const severityDelta = severityRank(left.severity) - severityRank(right.severity);
  if (severityDelta !== 0) {
    return severityDelta;
  }
  return right.confidence - left.confidence;
}

function severityRank(severity: GovernedReviewSeverity): number {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  }[severity];
}

function normalizeSeverity(value: unknown): GovernedReviewSeverity {
  return value === 'critical'
    || value === 'high'
    || value === 'medium'
    || value === 'low'
    || value === 'info'
    ? value
    : 'medium';
}

function clampConfidence(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 50;
  }
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeLine(value: unknown): number | undefined {
  const line = Number(value);
  return Number.isFinite(line) && line > 0 ? Math.floor(line) : undefined;
}

function normalizeOptionalText(value: unknown): string | undefined {
  const text = normalizeText(value);
  return text || undefined;
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function uniqueStrings(values?: readonly unknown[] | null): string[] {
  return Array.from(new Set((values || []).map((value) => normalizeText(value)).filter(Boolean)));
}

function hashStable(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex');
}
