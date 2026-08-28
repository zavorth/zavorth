import type {
  DialecticDebate,
  DissentingOpinion,
  PeerReviewActionInput,
  PeerReviewAssessment,
} from './PeerReviewContract.js';

export interface SemanticReviewEvaluator {
  evaluateSecurityAndInvariants(input: PeerReviewActionInput): Promise<DissentingOpinion[] | null>;
  conductDialecticDebate?(
    topic: string,
    thesisName: string,
    antithesisName: string,
  ): Promise<DialecticDebate | null>;
}

export interface PeerReviewAdvisoryOptions {
  semanticEvaluator?: SemanticReviewEvaluator | null;
  customSecurityRules?: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
  customCleanCodeRules?: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
}

export class PeerReviewAdvisoryService {
  private readonly semanticEvaluator?: SemanticReviewEvaluator | null;
  private readonly customSecurityRules: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;
  private readonly customCleanCodeRules: Array<(input: PeerReviewActionInput) => DissentingOpinion | null>;

  constructor(options?: PeerReviewAdvisoryOptions) {
    this.semanticEvaluator = options?.semanticEvaluator || null;
    this.customSecurityRules = options?.customSecurityRules || [];
    this.customCleanCodeRules = options?.customCleanCodeRules || [];
  }

  public async evaluateAction(input: PeerReviewActionInput): Promise<PeerReviewAssessment> {
    const dissentingOpinions: DissentingOpinion[] = [];

    // 1. LLM-Centered Semantic Evaluation if available
    if (this.semanticEvaluator) {
      try {
        const semanticOpinions = await this.semanticEvaluator.evaluateSecurityAndInvariants(input);
        if (semanticOpinions && Array.isArray(semanticOpinions)) {
          dissentingOpinions.push(...semanticOpinions);
        }
      } catch {
        // Fall back to deterministic structural invariant checks
      }
    }

    // 2. Structural Invariant Checks
    const structuralOpinions = this.evaluateStructuralInvariants(input);
    for (const opinion of structuralOpinions) {
      const isDuplicate = dissentingOpinions.some(
        (existing) => existing.argument === opinion.argument && existing.category === opinion.category,
      );
      if (!isDuplicate) {
        dissentingOpinions.push(opinion);
      }
    }

    // 3. Custom rules
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

    if (this.semanticEvaluator?.conductDialecticDebate) {
      try {
        const debate = await this.semanticEvaluator.conductDialecticDebate(
          topicClean,
          thesisPersona.name,
          antithesisPersona.name,
        );
        if (debate) {
          return debate;
        }
      } catch {
        // Fall back to deterministic dialectic debate framework
      }
    }

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

  private evaluateStructuralInvariants(input: PeerReviewActionInput): DissentingOpinion[] {
    const opinions: DissentingOpinion[] = [];
    const pattern = String(input.pattern || '').trim().toLowerCase();
    const toolName = String(input.toolName || '').trim().toLowerCase();
    const code = String(input.proposedCode || '');

    // 1. Destructive system-wide root deletions
    if (this.isDestructiveSystemDeletion(pattern)) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Destructive root or system-wide directory deletion detected.',
        severity: 'critical',
        suggestedRemedy: 'Perform targeted, atomic file removal within the workspace directory only.',
      });
    }

    // 2. Secret and credential boundary violations
    if (this.isSensitiveHostPath(pattern)) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Unauthorized access to host credential stores or private keys detected.',
        severity: 'critical',
        suggestedRemedy: 'Refrain from accessing host credentials. Use scoped workspace configuration.',
      });
    }

    // 3. Unvetted piped remote script execution in terminal
    if (toolName === 'terminal_backends' && this.isPipedRemoteScript(pattern)) {
      opinions.push({
        evaluatorId: 'security-evaluator',
        evaluatorName: 'Security Evaluator',
        category: 'security',
        argument: 'Unvetted piped remote script execution detected.',
        severity: 'high',
        suggestedRemedy: 'Download script to inspect locally and run in isolated container.',
      });
    }

    // 4. Strict typing clean code invariants
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

  private isDestructiveSystemDeletion(command: string): boolean {
    const tokens = this.tokenizeCommand(command);
    const isRemoveCmd = tokens.some((t) => t === 'rm' || t === 'rmdir' || t === 'remove-item');
    if (!isRemoveCmd) {
      return false;
    }

    const hasRecursiveForce =
      tokens.some((t) => t === '-rf' || t === '-fr' || t === '/s' || t === '-recurse' || t === '-r');

    const targetsRoot = tokens.some(
      (t) =>
        t === '/' ||
        t === '/*' ||
        t === 'c:\\' ||
        t === 'c:/' ||
        t === 'c:\\windows' ||
        t === 'c:\\windows\\system32' ||
        t === 'c:/windows' ||
        t === 'c:/windows/system32',
    );

    return hasRecursiveForce && targetsRoot;
  }

  private isSensitiveHostPath(pathOrCommand: string): boolean {
    const sensitiveTokens = [
      '.ssh/id_rsa',
      '.ssh/id_ed25519',
      '.aws/credentials',
      '.aws/config',
      'system32/config/sam',
      '/etc/shadow',
      '/etc/passwd',
    ];

    const normalized = pathOrCommand.replaceAll('\\', '/');
    return sensitiveTokens.some((token) => normalized.includes(token));
  }

  private isPipedRemoteScript(command: string): boolean {
    const normalized = command.toLowerCase();
    const hasPipe = normalized.includes('|');
    if (!hasPipe) {
      return false;
    }

    const targetsShell =
      normalized.includes('| sh') ||
      normalized.includes('| bash') ||
      normalized.includes('| zsh') ||
      normalized.includes('| pwsh') ||
      normalized.includes('| powershell') ||
      normalized.includes('iex(new-object');

    return targetsShell;
  }

  private tokenizeCommand(command: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      if (char === ' ' || char === '\t' || char === '"' || char === "'") {
        if (current.length > 0) {
          tokens.push(current.toLowerCase());
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      tokens.push(current.toLowerCase());
    }

    return tokens;
  }
}
