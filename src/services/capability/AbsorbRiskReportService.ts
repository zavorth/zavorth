/**
 * Absorb Risk Report — operator UX for safe capability install under quarantine.
 *
 * Builds a preview risk report from Universal Capability Fabric snapshots
 * (candidates, issues, source kind) without rewriting the fabric service.
 */

import {
  ABSORB_RISK_REPORT_CONTRACT_VERSION,
  type AbsorbRiskDimension,
  type AbsorbRiskFinding,
  type AbsorbRiskProofAction,
  type AbsorbRiskReport,
} from '../../contracts/capability/AbsorbRiskReportContract.js';
import type { ProofEventAppendInput } from '../proof/ProofLedgerService.js';
import type { ProofEventKind, ProofEventStatus, ProofRiskLevel } from '../../contracts/proof/ProofLedgerContract.js';

/** Loose fabric snapshot — avoid hard coupling to full contract shape. */
export type CapabilityFabricSnapshotLike = {
  generatedAt?: string | null;
  status?: string | null;
  apply?: boolean | null;
  source?: {
    raw?: string | null;
    kind?: string | null;
    label?: string | null;
    remoteUrl?: string | null;
    resolvedLocalPath?: string | null;
  } | null;
  candidates?: Array<{
    id?: string | null;
    kind?: string | null;
    name?: string | null;
    title?: string | null;
    description?: string | null;
    relativeEntry?: string | null;
    trustState?: string | null;
    risk?: string | null;
    reasons?: string[] | null;
    tags?: string[] | null;
    executableCodeDetected?: boolean | null;
    instructionOnly?: boolean | null;
    targetDirHint?: string | null;
  }> | null;
  issues?: Array<{
    severity?: string | null;
    code?: string | null;
    message?: string | null;
    candidateId?: string | null;
  }> | null;
  receipts?: Array<{
    kind?: string | null;
    status?: string | null;
    summary?: string | null;
  }> | null;
  summary?: {
    candidates?: number | null;
    skills?: number | null;
    plugins?: number | null;
    mcp?: number | null;
    highRisk?: number | null;
    executableCode?: number | null;
    denied?: number | null;
    heldForApproval?: number | null;
  } | null;
  quarantineRoot?: string | null;
  narrative?: {
    headline?: string | null;
    operatorSummary?: string | null;
    nextSafeAction?: string | null;
  } | null;
};

export type AbsorbRiskReportServiceOptions = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

const SECRET_PATTERNS = [
  /api[_-]?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /credential/i,
  /private[_-]?key/i,
  /BEGIN (RSA |OPENSSH )?PRIVATE KEY/i,
  /secret[_-]?like/i,
];

const SEVERITY_RANK: Record<AbsorbRiskFinding['severity'], number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const OVERALL_RANK: Record<AbsorbRiskReport['overallRisk'], number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function maxSeverity(
  a: AbsorbRiskFinding['severity'],
  b: AbsorbRiskFinding['severity'],
): AbsorbRiskFinding['severity'] {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function riskToSeverity(risk: string | null | undefined): AbsorbRiskFinding['severity'] {
  const text = normalizeText(risk).toLowerCase();
  if (text === 'critical' || text === 'severe') return 'critical';
  if (text === 'high') return 'high';
  if (text === 'medium' || text === 'med') return 'medium';
  if (text === 'low' || text === 'safe' || text === 'info') return 'low';
  if (!text) return 'info';
  if (text.includes('critical')) return 'critical';
  if (text.includes('high')) return 'high';
  if (text.includes('med')) return 'medium';
  if (text.includes('low')) return 'low';
  return 'medium';
}

function issueToSeverity(severity: string | null | undefined): AbsorbRiskFinding['severity'] {
  const text = normalizeText(severity).toLowerCase();
  if (text === 'blocked' || text === 'error' || text === 'critical') return 'critical';
  if (text === 'warn' || text === 'warning' || text === 'high') return 'high';
  if (text === 'medium') return 'medium';
  if (text === 'info' || text === 'low') return 'low';
  return 'medium';
}

function looksSecretLike(text: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(text));
}

/** Presence-only redaction for operator-facing absorb text (never echo raw secrets). */
export function redactSecretLikeText(text: string): string {
  let out = String(text || '');
  out = out.replace(
    /\b(api[_-]?key|secret|token|password|credential|auth)\s*[=:]\s*['"]?[^\s'"]+/gi,
    '$1=[REDACTED]',
  );
  out = out.replace(/\bsk-[a-zA-Z0-9_-]{8,}\b/g, 'sk-[REDACTED]');
  out = out.replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, 'gh*_[REDACTED]');
  out = out.replace(/\bsecret\d+\b/gi, '[REDACTED]');
  return out;
}

function overallFromFindings(
  findings: AbsorbRiskFinding[],
  fallback: AbsorbRiskReport['overallRisk'] = 'unknown',
): AbsorbRiskReport['overallRisk'] {
  if (findings.length === 0) return fallback;
  let max: AbsorbRiskFinding['severity'] = 'info';
  for (const f of findings) {
    max = maxSeverity(max, f.severity);
  }
  if (max === 'critical') return 'critical';
  if (max === 'high') return 'high';
  if (max === 'medium') return 'medium';
  if (max === 'low' || max === 'info') return 'low';
  return fallback;
}

function mapOverallToProofRisk(overall: AbsorbRiskReport['overallRisk']): ProofRiskLevel {
  if (overall === 'critical') return 'critical';
  if (overall === 'high') return 'high';
  if (overall === 'medium') return 'medium';
  if (overall === 'low') return 'low';
  return 'none';
}

function proofStatusForAction(action: AbsorbRiskProofAction): ProofEventStatus {
  if (action === 'reject') return 'failed';
  if (action === 'promote') return 'ok';
  return 'info';
}

export class AbsorbRiskReportService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(options: AbsorbRiskReportServiceOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory =
      options.idFactory ??
      ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public fromFabricSnapshot(snapshot: CapabilityFabricSnapshotLike | null | undefined): AbsorbRiskReport {
    const snap = snapshot || {};
    const candidates = Array.isArray(snap.candidates) ? snap.candidates : [];
    const issues = Array.isArray(snap.issues) ? snap.issues : [];
    const source = snap.source || {};
    const findings: AbsorbRiskFinding[] = [];
    let findingSeq = 0;
    const pushFinding = (
      dimension: AbsorbRiskDimension,
      severity: AbsorbRiskFinding['severity'],
      title: string,
      detail: string,
    ): void => {
      const safeTitle = redactSecretLikeText(title);
      const rawDetail = String(detail || '');
      const safeDetail = looksSecretLike(rawDetail)
        ? 'Secret-like pattern detected (value redacted).'
        : redactSecretLikeText(rawDetail);
      findings.push({
        id: this.idFactory(`finding-${++findingSeq}`),
        dimension,
        severity,
        title: safeTitle,
        detail: safeDetail,
      });
    };

    const sourceLabel =
      normalizeText(source.label) ||
      normalizeText(source.raw) ||
      normalizeText(source.remoteUrl) ||
      'unknown-source';

    const kindCounts = { skill: 0, plugin: 0, mcp: 0, unknown: 0 };
    let executableDetected = false;
    let secretLikeDetected = false;
    let highestCandidateRisk: AbsorbRiskFinding['severity'] = 'info';

    for (const c of candidates) {
      const cKind = normalizeText(c.kind, 'unknown').toLowerCase();
      if (cKind === 'skill') kindCounts.skill += 1;
      else if (cKind === 'plugin') kindCounts.plugin += 1;
      else if (cKind === 'mcp') kindCounts.mcp += 1;
      else kindCounts.unknown += 1;

      const cRisk = riskToSeverity(c.risk);
      highestCandidateRisk = maxSeverity(highestCandidateRisk, cRisk);

      if (c.executableCodeDetected) {
        executableDetected = true;
      }

      const pathBits = [
        normalizeText(c.relativeEntry),
        normalizeText(c.name),
        normalizeText(c.title),
        normalizeText(c.targetDirHint),
        ...(Array.isArray(c.reasons) ? c.reasons.map((r) => normalizeText(r)) : []),
      ]
        .filter(Boolean)
        .join(' ');

      if (pathBits) {
        const fileSeverity =
          cRisk === 'critical' || cRisk === 'high'
            ? cRisk
            : c.executableCodeDetected
              ? 'medium'
              : 'info';
        pushFinding(
          'files',
          fileSeverity,
          `Candidate file surface: ${normalizeText(c.name, c.id || 'candidate')}`,
          pathBits.slice(0, 280),
        );
      }

      if (looksSecretLike(pathBits) || looksSecretLike(normalizeText(c.description))) {
        secretLikeDetected = true;
      }

      if (cRisk === 'high' || cRisk === 'critical') {
        pushFinding(
          'permissions',
          cRisk,
          `Elevated risk candidate: ${normalizeText(c.name, c.id || 'candidate')}`,
          `trustState=${normalizeText(c.trustState, 'unknown')}; kind=${cKind}; risk=${normalizeText(c.risk, cRisk)}`,
        );
      }

      if (cKind === 'mcp') {
        pushFinding(
          'network',
          'medium',
          `MCP pack may open network tools: ${normalizeText(c.name, c.id || 'mcp')}`,
          'MCP packs start disabled; enable requires higher-trust approval.',
        );
      }

      if (cKind === 'plugin' && c.executableCodeDetected) {
        pushFinding(
          'executable',
          'high',
          `Executable plugin held: ${normalizeText(c.name, c.id || 'plugin')}`,
          'Executable plugins stay quarantined until explicit higher-trust enable.',
        );
      }
    }

    if (executableDetected) {
      pushFinding(
        'executable',
        'high',
        'Executable code detected in absorb set',
        `${Number(snap.summary?.executableCode ?? candidates.filter((c) => c.executableCodeDetected).length)} candidate(s) report executableCodeDetected.`,
      );
    }

    const sourceKind = normalizeText(source.kind).toLowerCase();
    const remoteUrl = normalizeText(source.remoteUrl) || normalizeText(source.raw);
    const isHttpSource =
      sourceKind === 'https-url' ||
      sourceKind === 'git-url' ||
      /^https?:\/\//i.test(remoteUrl);

    if (isHttpSource) {
      pushFinding(
        'network',
        'medium',
        'Remote HTTP(S) source',
        `Source fetched over network (${sourceKind || 'url'}): ${remoteUrl.slice(0, 200) || sourceLabel}`,
      );
    }

    if (kindCounts.mcp > 0) {
      pushFinding(
        'network',
        'medium',
        'MCP candidates imply tool/network surface',
        `${kindCounts.mcp} MCP candidate(s); materialize disabled by default.`,
      );
    }

    for (const issue of issues) {
      const message = normalizeText(issue.message);
      const code = normalizeText(issue.code);
      const blob = `${code} ${message}`;
      const severity = issueToSeverity(issue.severity);

      if (looksSecretLike(blob)) {
        secretLikeDetected = true;
        pushFinding(
          'secrets',
          maxSeverity(severity, 'high'),
          `Secret-like signal: ${code || 'issue'}`,
          'Secret-like pattern detected (value redacted).',
        );
        continue;
      }

      const dimension: AbsorbRiskDimension =
        /execut|plugin|code/i.test(blob)
          ? 'executable'
          : /network|http|mcp|remote/i.test(blob)
            ? 'network'
            : /permission|trust|approv|consent|enable/i.test(blob)
              ? 'permissions'
              : /file|path|archiv|quarantine/i.test(blob)
                ? 'files'
                : 'unknown';

      pushFinding(
        dimension,
        severity,
        `Issue ${code || severity}`,
        message.slice(0, 280) || code || 'Fabric issue without detail.',
      );
    }

    if (secretLikeDetected && !findings.some((f) => f.dimension === 'secrets')) {
      pushFinding(
        'secrets',
        'high',
        'Secret-like names or content signals',
        'Candidate paths/descriptions matched secret-like patterns; receipts never serialize raw secrets.',
      );
    }

    if (candidates.length === 0 && findings.length === 0) {
      pushFinding(
        'unknown',
        'info',
        'No candidates discovered',
        'Absorb scan produced zero candidates; review source path or kind hint.',
      );
    }

    // Deduplicate near-identical titles keeping highest severity
    const deduped = dedupeFindings(findings);

    const status = normalizeText(snap.status).toLowerCase();
    let overallRisk = overallFromFindings(deduped, 'unknown');
    if (highestCandidateRisk === 'critical') {
      overallRisk = 'critical';
    } else if (highestCandidateRisk === 'high' && OVERALL_RANK[overallRisk] < OVERALL_RANK.high) {
      overallRisk = 'high';
    }
    if (executableDetected && OVERALL_RANK[overallRisk] < OVERALL_RANK.high) {
      overallRisk = 'high';
    }
    if (status === 'blocked' && OVERALL_RANK[overallRisk] < OVERALL_RANK.high) {
      overallRisk = 'high';
    }

    const primaryKind =
      kindCounts.mcp > 0 && kindCounts.mcp >= kindCounts.plugin && kindCounts.mcp >= kindCounts.skill
        ? 'mcp'
        : kindCounts.plugin > 0 && kindCounts.plugin >= kindCounts.skill
          ? 'plugin'
          : kindCounts.skill > 0
            ? 'skill'
            : candidates.length === 0
              ? 'unknown'
              : normalizeText(candidates[0]?.kind, 'unknown');

    const confidence = deriveConfidence({
      candidateCount: candidates.length,
      issueCount: issues.length,
      hasSource: Boolean(sourceLabel && sourceLabel !== 'unknown-source'),
      status,
    });

    const promoteReady = derivePromoteReady({
      status,
      overallRisk,
      executableDetected,
    });

    const summaryBullets = buildSummaryBullets({
      candidateCount: candidates.length,
      executableDetected,
      secretLikeDetected,
      overallRisk,
      kindCounts,
      isHttpSource,
      quarantineRoot: normalizeText(snap.quarantineRoot) || null,
      promoteReady,
      status,
    });

    const nextSafeAction =
      normalizeText(snap.narrative?.nextSafeAction) ||
      defaultNextSafeAction({ status, overallRisk, promoteReady, executableDetected });

    return {
      contractVersion: ABSORB_RISK_REPORT_CONTRACT_VERSION,
      sourceLabel,
      kind: primaryKind,
      overallRisk,
      confidence,
      findings: deduped,
      summaryBullets,
      quarantineRoot: normalizeText(snap.quarantineRoot) || null,
      candidateCount: candidates.length,
      executableDetected,
      secretLikeDetected,
      promoteReady,
      nextSafeAction,
      generatedAt: normalizeText(snap.generatedAt) || this.now().toISOString(),
    };
  }

  public toMarkdown(report: AbsorbRiskReport): string {
    const lines: string[] = [
      'Risk report:',
      `  overall: ${report.overallRisk}`,
      `  confidence: ${report.confidence}`,
      `  kind: ${report.kind}`,
      `  candidates: ${report.candidateCount}`,
    ];

    if (report.findings.length === 0) {
      lines.push('  (no findings)');
    } else {
      for (const f of report.findings.slice(0, 24)) {
        lines.push(`  - [${f.dimension}/${f.severity}] ${f.title}`);
        if (f.detail && f.detail !== f.title) {
          lines.push(`      ${f.detail}`);
        }
      }
      if (report.findings.length > 24) {
        lines.push(`  ... +${report.findings.length - 24} more findings`);
      }
    }

    lines.push('Summary:');
    for (const bullet of report.summaryBullets) {
      lines.push(`  - ${bullet}`);
    }

    if (report.quarantineRoot) {
      lines.push(`Quarantine: ${report.quarantineRoot}`);
    }
    lines.push(`Promote ready: ${report.promoteReady ? 'yes' : 'no'}`);
    lines.push(`Next: ${report.nextSafeAction}`);

    return lines.join('\n');
  }

  /**
   * Shape suitable for ProofLedgerService.append.
   * kind is marketplace (capability install) with system as secondary semantic in metadata.
   */
  public toProofEventInput(
    report: AbsorbRiskReport,
    action: AbsorbRiskProofAction,
  ): ProofEventAppendInput {
    const kind: ProofEventKind = 'marketplace';
    const riskLevel = mapOverallToProofRisk(report.overallRisk);
    const status = proofStatusForAction(action);
    const actionLabel =
      action === 'promote' ? 'Absorb promote' : action === 'reject' ? 'Absorb reject' : 'Absorb preview';

    return {
      runId: null,
      kind,
      surface: 'cli',
      title: `${actionLabel}: ${report.sourceLabel}`,
      summary: [
        `action=${action}`,
        `overall=${report.overallRisk}`,
        `kind=${report.kind}`,
        `candidates=${report.candidateCount}`,
        report.executableDetected ? 'executable=yes' : 'executable=no',
        report.secretLikeDetected ? 'secrets=yes' : 'secrets=no',
        `promoteReady=${report.promoteReady ? 'yes' : 'no'}`,
      ].join(' · '),
      status,
      riskLevel,
      approvalId: null,
      artifacts: report.quarantineRoot
        ? [{ id: 'quarantine', type: 'quarantine-root', label: report.quarantineRoot }]
        : [],
      source: 'absorb-risk-report',
      metadata: {
        contractVersion: report.contractVersion,
        absorbAction: action,
        overallRisk: report.overallRisk,
        confidence: report.confidence,
        kind: report.kind,
        candidateCount: report.candidateCount,
        executableDetected: report.executableDetected,
        secretLikeDetected: report.secretLikeDetected,
        promoteReady: report.promoteReady,
        findingCount: report.findings.length,
        summaryBullets: report.summaryBullets,
        /** Dual-tag: marketplace primary, system secondary for ops filters */
        secondaryKind: 'system' as ProofEventKind,
        nextSafeAction: report.nextSafeAction,
      },
    };
  }
}

function dedupeFindings(findings: AbsorbRiskFinding[]): AbsorbRiskFinding[] {
  const byTitle = new Map<string, AbsorbRiskFinding>();
  for (const f of findings) {
    const key = `${f.dimension}::${f.title.toLowerCase()}`;
    const prev = byTitle.get(key);
    if (!prev || SEVERITY_RANK[f.severity] > SEVERITY_RANK[prev.severity]) {
      byTitle.set(key, f);
    }
  }
  return Array.from(byTitle.values()).sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

function deriveConfidence(input: {
  candidateCount: number;
  issueCount: number;
  hasSource: boolean;
  status: string;
}): AbsorbRiskReport['confidence'] {
  if (!input.hasSource && input.candidateCount === 0) return 'low';
  if (input.candidateCount === 0) return 'low';
  if (input.status === 'blocked' && input.issueCount === 0) return 'medium';
  if (input.candidateCount >= 1 && (input.issueCount > 0 || input.candidateCount <= 20)) {
    return 'high';
  }
  return 'medium';
}

function derivePromoteReady(input: {
  status: string;
  overallRisk: AbsorbRiskReport['overallRisk'];
  executableDetected: boolean;
}): boolean {
  // Ready means consent path is open for install — not that apply already ran.
  if (input.status === 'blocked') return false;
  if (input.overallRisk === 'critical') return false;
  // High risk / executable packs need higher-trust enable, not standard promote.
  if (input.overallRisk === 'high' || input.executableDetected) return false;
  return (
    input.overallRisk === 'low' ||
    input.overallRisk === 'medium' ||
    input.overallRisk === 'unknown'
  );
}

function buildSummaryBullets(input: {
  candidateCount: number;
  executableDetected: boolean;
  secretLikeDetected: boolean;
  overallRisk: AbsorbRiskReport['overallRisk'];
  kindCounts: { skill: number; plugin: number; mcp: number; unknown: number };
  isHttpSource: boolean;
  quarantineRoot: string | null;
  promoteReady: boolean;
  status: string;
}): string[] {
  const bullets: string[] = [];
  bullets.push(
    `${input.candidateCount} candidate(s) under quarantine` +
      (input.quarantineRoot ? ` (${input.quarantineRoot})` : ''),
  );
  bullets.push(`Overall risk: ${input.overallRisk} · status: ${input.status || 'unknown'}`);

  const kinds: string[] = [];
  if (input.kindCounts.skill) kinds.push(`${input.kindCounts.skill} skill`);
  if (input.kindCounts.plugin) kinds.push(`${input.kindCounts.plugin} plugin`);
  if (input.kindCounts.mcp) kinds.push(`${input.kindCounts.mcp} mcp`);
  if (input.kindCounts.unknown) kinds.push(`${input.kindCounts.unknown} unknown`);
  if (kinds.length) bullets.push(`Kinds: ${kinds.join(', ')}`);

  if (input.executableDetected) {
    bullets.push('Executable code detected — held for higher-trust enable (not live).');
  } else {
    bullets.push('No executable code flagged — instruction / config surface only.');
  }

  if (input.secretLikeDetected) {
    bullets.push('Secret-like signals present — review before promote; raw secrets never serialized.');
  }

  if (input.isHttpSource) {
    bullets.push('Source is remote HTTP(S)/git — network intake under quarantine.');
  }

  if (input.promoteReady) {
    bullets.push('Promote path open with explicit --apply --consent after review.');
  } else {
    bullets.push('Promote not ready: resolve blocks / high risk or use consent path carefully.');
  }

  // Clamp 3–6
  if (bullets.length < 3) {
    bullets.push('Preview is default; nothing becomes live without approval.');
  }
  return bullets.slice(0, 6);
}

function defaultNextSafeAction(input: {
  status: string;
  overallRisk: AbsorbRiskReport['overallRisk'];
  promoteReady: boolean;
  executableDetected: boolean;
}): string {
  if (input.status === 'blocked') {
    return 'Fix blocked issues, re-run absorb --preview, then decide with --apply --consent.';
  }
  if (input.executableDetected || input.overallRisk === 'high' || input.overallRisk === 'critical') {
    return 'Review high-risk findings under quarantine; do not enable executable packs without trust upgrade.';
  }
  if (input.promoteReady || input.overallRisk === 'low' || input.overallRisk === 'medium') {
    return 'Review risk report; install safely with --apply --consent when ready.';
  }
  return 'Keep preview-only; inspect candidates and quarantine before promoting.';
}

/**
 * Map absorb CLI outcome to a Proof OS action.
 *
 * Rules:
 * - deny receipts always count as reject (policy blocked the candidate set)
 * - promote requires BOTH apply intent AND consent (consent alone never promotes)
 * - apply without consent stays preview (CLI also forces fabric apply=false)
 */
export function resolveAbsorbProofAction(input: {
  apply?: boolean;
  consent?: boolean;
  status?: string | null;
  receipts?: Array<{ kind?: string | null; status?: string | null }> | null;
}): AbsorbRiskProofAction {
  const status = normalizeText(input.status).toLowerCase();
  const receipts = Array.isArray(input.receipts) ? input.receipts : [];
  const hasDeny = receipts.some(
    (r) =>
      normalizeText(r.kind).toLowerCase() === 'deny' ||
      normalizeText(r.status).toLowerCase() === 'deny',
  );
  if (hasDeny) return 'reject';
  // Consent authorizes apply of already-allowed candidates only — never elevates risk flags.
  if (input.apply === true && input.consent === true) {
    if (status === 'blocked') return 'reject';
    return 'promote';
  }
  return 'preview';
}
