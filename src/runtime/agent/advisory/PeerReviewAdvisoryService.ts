import type {
  DialecticDebate,
  DissentingOpinion,
  PeerReviewActionInput,
  PeerReviewAssessment,
} from './PeerReviewContract.js';

export interface PeerReviewAdvisoryOptions {
  customSecurityRules?: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
  customCleanCodeRules?: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
}

export class PeerReviewAdvisoryService {
  private readonly customSecurityRules: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
  private readonly customCleanCodeRules: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;

  constructor(options?: PeerReviewAdvisoryOptions) {
    this.customSecurityRules = options?.customSecurityRules || [];
    this.customCleanCodeRules = options?.customCleanCodeRules || [];
  }

  public async evaluateAction(input: PeerReviewActionInput): Promise<PeerReviewAssessment> {
    const dissentingOpinions: DissentingOpinion[] = [];

    const securityOpinions = this.evaluateSecurityInvariants(input);
    dissentingOpinions.push(...securityOpinions);

    const cleanCodeOpinions = this.evaluateCleanCodeInvariants(input);
    dissentingOpinions.push(...cleanCodeOpinions);

    for (const rule of this.customSecurityRules) {
      const opinion = rule(input);
      if (opinion) dissentingOpinions.push(opinion);
    }
    for (const rule of this.customCleanCodeRules) {
      const opinion = rule(input);
      if (opinion) dissentingOpinions.push(opinion);
    }

    const hasCriticalOrHigh = dissentingOpinions.some(
      (o) => o.severity === 'critical' || o.severity === 'high',
    );
    const hasMedium = dissentingOpinions.some((o) => o.severity === 'medium');

    let verdict: 'approved' | 'attention' | 'vetoed' = 'approved';
    let approved = true;

    if (hasCriticalOrHigh) {
      verdict = 'vetoed';
      approved = false;
    } else if (hasMedium) {
      verdict = 'attention';
      approved = false;
    }

    const consensusSummary = approved
      ? 'Peer review council consensus: Proposed action conforms to security and clean-code invariants.'
      : `Peer review council veto: ${dissentingOpinions.length} dissenting opinion(s) recorded against this action.`;

    return {
      approved,
      verdict,
      dissentingOpinions,
      consensusSummary,
    };
  }

  public async conductDialecticDebate(
    topic: string,
    options?: {
      thesisPersona?: { id: string; name: string };
      antithesisPersona?: { id: string; name: string };
    },
  ): Promise<DialecticDebate> {
    const thesisPersona = options?.thesisPersona || {
      id: 'executor',
      name: 'Executor (@executor)',
    };
    const antithesisPersona = options?.antithesisPersona || {
      id: 'security-evaluator',
      name: 'Security Evaluator (@security-evaluator)',
    };

    const topicClean = topic.trim();

    return {
      topic: topicClean,
      thesis: {
        personaId: thesisPersona.id,
        name: thesisPersona.name,
        position: `Prioritize direct velocity, simplicity, and immediate working implementation for: "${topicClean}".`,
        arguments: [
          'Direct implementation minimizes architectural bloat and indirection.',
          'Enables rapid feedback loops and test-driven validation in the local workspace.',
          'Focuses compute and tokens strictly on solving the immediate user goal.',
        ],
      },
      antithesis: {
        personaId: antithesisPersona.id,
        name: antithesisPersona.name,
        position: `Identify systemic risks, strict boundary violations, and regression potentials in: "${topicClean}".`,
        counterArguments: [
          'Unconstrained execution may bypass isolation boundaries and compromise credentials.',
          'Quick implementations often introduce untyped dynamic casts and technical debt.',
          'Actions touching the filesystem or external network must fail closed if unverified.',
        ],
      },
      synthesis: {
        consensusPoints: [
          'Deliver working functionality without delaying progress.',
          'Enforce strict typing (zero any) and domain-scoped isolation on all boundary interfaces.',
          'Record immutable audit receipts before committing system state changes.',
        ],
        openRisks: [
          'Ensure test coverage covers edge cases and network timeouts.',
          'Verify that ephemeral directories are shredded on exit.',
        ],
        actionableRecommendation: `Proceed with implementation under direct mode with automated unit test gates and strict type checking. If untrusted network access is required, isolate in container.`,
      },
    };
  }

  private evaluateSecurityInvariants(input: PeerReviewActionInput): DissentingOpinion[] {
    const opinions: DissentingOpinion[] = [];
    const patternLower = String(input.pattern || '').toLowerCase();
    const toolLower = String(input.toolName || '').toLowerCase();

    if (
      patternLower.includes('rm -rf /') ||
      patternLower.includes('rmdir /s /q c:\\') ||
      patternLower.includes('remove-item -recurse c:\\')
    ) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Destructive root or system-wide directory deletion detected.',
        severity: 'critical',
        suggestedRemedy: 'Perform targeted, atomic file removal within the workspace directory only.',
      });
    }

    if (
      patternLower.includes('.ssh/id_rsa') ||
      patternLower.includes('.aws/credentials') ||
      patternLower.includes('windows/system32/config/sam')
    ) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Unauthorized access to host credential stores or private keys detected.',
        severity: 'critical',
        suggestedRemedy: 'Refrain from accessing host credentials. Use scoped workspace configuration.',
      });
    }

    if (toolLower === 'terminal_backends' && (patternLower.includes('| sh') || patternLower.includes('| bash') || patternLower.includes('iex(new-object'))) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Unvetted piped remote script execution detected.',
        severity: 'high',
        suggestedRemedy: 'Download script to inspect locally and run in isolated container.',
      });
    }

    return opinions;
  }

  private evaluateCleanCodeInvariants(input: PeerReviewActionInput): DissentingOpinion[] {
    const opinions: DissentingOpinion[] = [];
    const code = String(input.proposedCode || '');

    if (code.includes(': any') || code.includes('as any')) {
      opinions.push({
        evaluatorId: 'clean-code-evaluator',
        evaluatorName: 'Clean Code Evaluator',
        category: 'clean_code',
        argument: 'Use of untyped dynamic casting ("any") violates strict typing invariant (/clean-code Rule 5).',
        severity: 'high',
        suggestedRemedy: 'Replace "any" with explicit TypeScript interface or union type.',
      });
    }

    return opinions;
  }
}
