import type { LearningCandidateSnapshot } from './ZavorthLearningPlaneService.js';
import type { SkillMiningSnapshot, SkillMiningSuggestion } from '../contracts/PracticalAgencyContract.js';

export class SkillMiningService {
  public mine(input: {
    text?: string | null;
    candidates?: LearningCandidateSnapshot[] | null;
  } = {}): SkillMiningSnapshot {
    const suggestions: SkillMiningSuggestion[] = [];
    const candidates = input.candidates || [];
    const highConfidence = candidates.filter((candidate) => candidate.score >= 0.8 && candidate.reviewState === 'pending');
    for (const candidate of highConfidence.slice(0, 3)) {
      suggestions.push({
        id: `skill-mining.${safeId(candidate.id)}`,
        kind: candidate.kind === 'playbook' ? 'workflow' : candidate.kind,
        title: redact(candidate.title),
        summary: redact(candidate.summary),
        activationDefault: 'disabled',
      });
    }

    return {
      source: 'SkillMiningService',
      suggestions,
      activatesAutomatically: false,
      receipts: [
        'skill-mining-draft-only',
        'skill-mining-requires-review-before-activation',
      ],
    };
  }
}

function normalize(value: string): string {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function safeId(value: string): string {
  return normalize(value).replace(/[^a-z0-9_.-]+/g, '-').replace(/^-|-$/g, '') || 'candidate';
}

function redact(value: string): string {
  return String(value || '')
    .replace(/\b(?:token|api[_ -]...key|secret|password)\s*[:=]\s*([^\s,;]+)/gi, '[redacted-secret]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[redacted-secret]')
    .replace(/\bgh[pousr]_[A-Za-z0-9_]{8,}\b/g, '[redacted-secret]')
    .replace(/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/g, '[redacted-secret]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/g, '[redacted-secret]')
    .slice(0, 240);
}
