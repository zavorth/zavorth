import type {
  ProductEvidenceClaimManifest,
  ProductEvidenceExecution,
  ProductEvidenceScorecardClaim,
  ProductEvidenceScorecardResult,
} from '../contracts/ProductEvidenceScorecardContract.js';

const SHELL_METACHARACTERS = /[\u0060;&|$<>()]/;
const PORTUGUESE_LOCALE = /^pt(-br)?$/i;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;

export class ProductEvidenceScorecardService {
  private readonly now: () => Date;

  public constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  public build(input: {
    claims: ProductEvidenceClaimManifest[];
    executions: ProductEvidenceExecution[];
    locale?: string;
  }): ProductEvidenceScorecardResult {
    const now = this.now();
    const locale = String(input.locale || '').trim() || 'en-US';
    const claims = (input.claims || []).map((claim) => this.evaluateClaim(claim, input.executions || [], now, locale));
    const status = claims.length > 0 && claims.every((claim) => claim.status === 'verified') ? 'verified' : 'unverified';
    return {
      claims,
      status,
      locale,
      benchmarkPolicy: {
        externalScoresAssigned: false,
      },
    };
  }

  public render(result: ProductEvidenceScorecardResult): string {
    const isPortuguese = PORTUGUESE_LOCALE.test(result.locale);
    const title = isPortuguese ? 'Evidence scorecard' : 'Product evidence scorecard';
    const lines: string[] = [title, ''];
    if (result.claims.length === 0) {
      lines.push('No evidence claims were evaluated.');
    } else {
      for (const claim of result.claims) {
        lines.push(`- ${claim.id}: ${claim.status}${claim.marketable ? ' (marketable)' : ''}`);
        if (claim.reasons.length > 0) {
          lines.push(`  rejected: ${claim.reasons.join(', ')}`);
        }
      }
    }
    lines.push('', 'External scores are not assigned by Zavorth. Benchmark policy keeps externalScoresAssigned false.');
    return lines.join('\n');
  }

  private evaluateClaim(
    claim: ProductEvidenceClaimManifest,
    executions: ProductEvidenceExecution[],
    now: Date,
    locale: string,
  ): ProductEvidenceScorecardClaim {
    const reasons: string[] = [];

    if (SHELL_METACHARACTERS.test(claim.evidence.script)) {
      reasons.push('evidence-command-not-allowlisted');
    }

    const execution = executions.find((item) => item.script === claim.evidence.script);
    if (!execution) {
      reasons.push('evidence-missing');
    } else {
      if (execution.exitCode !== 0) {
        reasons.push('evidence-command-failed');
      }
      const completedAtMs = new Date(execution.completedAt).getTime();
      const maxAgeMs = Number(claim.evidence.maxAgeHours || 0) * MILLISECONDS_PER_HOUR;
      if (now.getTime() - completedAtMs > maxAgeMs) {
        reasons.push('evidence-stale');
      }
      const artifactsPresent = new Set(execution.artifactsPresent || []);
      for (const artifact of claim.evidence.artifacts || []) {
        if (!artifactsPresent.has(artifact)) {
          reasons.push('evidence-artifact-missing');
        }
      }
    }

    if (!String(claim.provenance.source || '').trim() || !String(claim.provenance.owner || '').trim()) {
      reasons.push('provenance-missing');
    }

    const verified = reasons.length === 0;
    return {
      id: claim.id,
      status: verified ? 'verified' : 'unverified',
      marketable: verified,
      text: this.localizeClaim(claim, locale),
      reasons,
    };
  }

  private localizeClaim(claim: ProductEvidenceClaimManifest, locale: string): string {
    const normalized = locale.toLowerCase();
    if (normalized === 'pt' || normalized === 'pt-br') {
      return claim.claim['pt-BR'] ?? claim.claim['en-US'];
    }
    return claim.claim['en-US'] ?? claim.claim['pt-BR'];
  }
}
