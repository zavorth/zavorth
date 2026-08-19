import type { DiffFileSummary } from '../diff/ZavorthDiffPagerService.js';

export type ReviewDecision = 'APPROVE' | 'REQUIRE_CONFIRMATION' | 'VETO';

export interface SpeculativeReviewFinding {
  readonly severity: 'INFO' | 'WARNING' | 'CRITICAL';
  readonly category: 'SECURITY' | 'API_BREAKAGE' | 'DESTRUCTIVE_MUTATION' | 'DATA_LOSS';
  readonly message: string;
  readonly lineNumber?: number;
}

export interface SpeculativeReviewResult {
  readonly decision: ReviewDecision;
  readonly overallRisk: 'LOW' | 'MEDIUM' | 'CRITICAL';
  readonly findings: readonly SpeculativeReviewFinding[];
  readonly requiresInteractiveApproval: boolean;
  readonly summary: string;
}

export class ZavorthSpeculativeReviewEngine {
  public reviewDiff(file: DiffFileSummary): SpeculativeReviewResult {
    const findings: SpeculativeReviewFinding[] = [];

    // 1. Check for sensitive credential leaks in additions
    const sensitiveTokens = ['api_key', 'apikey', 'secret_key', 'private_key', 'password', 'bearer '];
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') {
          const lower = line.content.toLowerCase();
          for (const token of sensitiveTokens) {
            if (lower.includes(token) && (lower.includes('=') || lower.includes(':'))) {
              // Ensure it is not an environment variable reference
              if (!lower.includes('process.env') && !lower.includes('os.environ') && !lower.includes('env.')) {
                findings.push({
                  severity: 'CRITICAL',
                  category: 'SECURITY',
                  message: `Possible hardcoded credential or secret detected on line with token "${token}".`,
                  lineNumber: line.newLineNumber,
                });
              }
            }
          }
        }
      }
    }

    // 2. Check for breaking deletions on critical files
    if (file.totalDeletions > 50 && file.totalAdditions === 0) {
      findings.push({
        severity: 'CRITICAL',
        category: 'DATA_LOSS',
        message: `High volume deletion detected: ${file.totalDeletions} lines deleted with 0 additions.`,
      });
    }

    // 3. Check for contract/signature deletion
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'deletion') {
          const trimmed = line.content.trim();
          if (trimmed.startsWith('export ') || trimmed.startsWith('pub ') || trimmed.startsWith('def ')) {
            findings.push({
              severity: 'WARNING',
              category: 'API_BREAKAGE',
              message: `Public exported contract modified or removed: "${trimmed.substring(0, 60)}".`,
              lineNumber: line.oldLineNumber,
            });
          }
        }
      }
    }

    const hasCritical = findings.some((f) => f.severity === 'CRITICAL');
    const hasWarning = findings.some((f) => f.severity === 'WARNING');

    let decision: ReviewDecision = 'APPROVE';
    let overallRisk: 'LOW' | 'MEDIUM' | 'CRITICAL' = 'LOW';

    if (hasCritical) {
      decision = 'VETO';
      overallRisk = 'CRITICAL';
    } else if (hasWarning || file.overallRisk === 'CRITICAL' || file.overallRisk === 'MEDIUM') {
      decision = 'REQUIRE_CONFIRMATION';
      overallRisk = 'MEDIUM';
    }

    const summary =
      decision === 'APPROVE'
        ? `Diff for "${file.filePath}" passed all safety checks.`
        : decision === 'REQUIRE_CONFIRMATION'
        ? `Diff for "${file.filePath}" requires operator review due to ${findings.length} findings.`
        : `Diff for "${file.filePath}" was VETOED due to critical safety violations.`;

    return {
      decision,
      overallRisk,
      findings,
      requiresInteractiveApproval: decision !== 'APPROVE',
      summary,
    };
  }
}
