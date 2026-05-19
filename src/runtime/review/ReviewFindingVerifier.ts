import { ReviewConfidenceScorer } from './ReviewConfidenceScorer.js';
import type {
  GovernedReviewContext,
  GovernedReviewFinding,
  GovernedReviewFindingVerificationStatus,
  GovernedReviewVerificationSummary,
  GovernedReviewVerifiedFinding,
} from './GovernedReviewTypes.js';

export class ReviewFindingVerifier {
  private readonly scorer: ReviewConfidenceScorer;
  private readonly acceptedThreshold: number;
  private readonly humanReviewThreshold: number;

  constructor(runtime: {
    scorer?: ReviewConfidenceScorer;
    acceptedThreshold?: number;
    humanReviewThreshold?: number;
  } = {}) {
    this.scorer = runtime.scorer || new ReviewConfidenceScorer();
    this.acceptedThreshold = normalizeThreshold(runtime.acceptedThreshold, 80);
    this.humanReviewThreshold = Math.min(
      this.acceptedThreshold,
      normalizeThreshold(runtime.humanReviewThreshold, 60),
    );
  }

  public verify(input: {
    findings: GovernedReviewFinding[];
    context: GovernedReviewContext;
  }): GovernedReviewVerificationSummary {
    const verified = input.findings.map((finding) => this.verifyOne(finding, input.context));
    const acceptedFindings = verified.filter((finding) => finding.verification.status === 'accepted');
    const needsHumanReviewFindings = verified.filter((finding) => finding.verification.status === 'needs-human-review');
    const discardedFindings = verified.filter((finding) => finding.verification.status === 'discarded');

    return {
      source: 'ReviewFindingVerifier',
      acceptedThreshold: this.acceptedThreshold,
      humanReviewThreshold: this.humanReviewThreshold,
      inputFindingCount: input.findings.length,
      acceptedFindingCount: acceptedFindings.length,
      needsHumanReviewFindingCount: needsHumanReviewFindings.length,
      discardedFindingCount: discardedFindings.length,
      acceptedFindings,
      needsHumanReviewFindings,
      discardedFindings,
      policyTags: [
        'governed-review',
        'checkpoint-4',
        'confidence-scoring',
        `accepted-threshold:${this.acceptedThreshold}`,
        `human-review-threshold:${this.humanReviewThreshold}`,
      ],
    };
  }

  private verifyOne(
    finding: GovernedReviewFinding,
    context: GovernedReviewContext,
  ): GovernedReviewVerifiedFinding {
    const score = this.scorer.score({ finding, context });
    const status = this.resolveStatus(score.adjustedConfidence);
    const reasons = [
      ...score.reasons,
      status === 'accepted'
        ? 'accepted-threshold-met'
        : status === 'needs-human-review'
          ? 'human-review-threshold-met'
          : 'below-human-review-threshold',
    ];

    return {
      ...finding,
      confidence: score.adjustedConfidence,
      tags: Array.from(new Set([
        ...finding.tags,
        `verification:${status}`,
      ])).sort(),
      metadata: {
        ...finding.metadata,
        originalConfidence: score.originalConfidence,
      },
      verification: {
        source: 'ReviewFindingVerifier',
        status,
        originalConfidence: score.originalConfidence,
        adjustedConfidence: score.adjustedConfidence,
        acceptedThreshold: this.acceptedThreshold,
        humanReviewThreshold: this.humanReviewThreshold,
        reasons,
      },
    };
  }

  private resolveStatus(confidence: number): GovernedReviewFindingVerificationStatus {
    if (confidence >= this.acceptedThreshold) {
      return 'accepted';
    }
    if (confidence >= this.humanReviewThreshold) {
      return 'needs-human-review';
    }
    return 'discarded';
  }
}

function normalizeThreshold(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(parsed)));
}
