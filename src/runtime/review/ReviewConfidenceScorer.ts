import type {
  GovernedReviewContext,
  GovernedReviewFinding,
} from './GovernedReviewTypes.js';

export type ReviewConfidenceScore = {
  originalConfidence: number;
  adjustedConfidence: number;
  reasons: string[];
};

export class ReviewConfidenceScorer {
  public score(input: {
    finding: GovernedReviewFinding;
    context: GovernedReviewContext;
  }): ReviewConfidenceScore {
    const reasons: string[] = [];
    let score = input.finding.confidence;

    if (input.finding.evidence.length > 0) {
      score += Math.min(8, input.finding.evidence.length * 2);
      reasons.push('evidence-present');
    } else {
      score -= 18;
      reasons.push('missing-evidence');
    }

    if (input.finding.file) {
      score += 4;
      reasons.push('file-scoped');
    } else {
      score -= 6;
      reasons.push('no-file-scope');
    }

    if (input.finding.line) {
      score += 3;
      reasons.push('line-scoped');
    }

    if (input.finding.recommendation && !/review this finding before taking action/i.test(input.finding.recommendation)) {
      score += 4;
      reasons.push('actionable-recommendation');
    } else {
      score -= 4;
      reasons.push('generic-recommendation');
    }

    if (input.context.files.some((file) => file.path === input.finding.file)) {
      score += 5;
      reasons.push('matches-review-context');
    }

    if (input.finding.severity === 'critical' || input.finding.severity === 'high') {
      score += 2;
      reasons.push('high-impact-severity');
    }

    if (/speculative|guess|maybe/i.test(input.finding.tags.join(' '))) {
      score -= 12;
      reasons.push('speculative-tag');
    }

    return {
      originalConfidence: input.finding.confidence,
      adjustedConfidence: clampScore(score),
      reasons,
    };
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
