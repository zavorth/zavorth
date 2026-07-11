import {
  GOVERNED_REVIEW_CONTRACT_VERSION,
  GovernedReviewService,
} from '../../../src/runtime/review';

describe('GovernedReviewService', () => {
  it('creates a read-only governed review result with agent runtime plan, verifier and policy gate', () => {
    const result = new GovernedReviewService().run({
      reviewId: 'review-test-1',
      mode: 'security-review',
      objective: 'review auth changes for prompt injection and secrets',
      workspace: 'C:/repo',
      targetRef: 'HEAD',
      baseRef: 'main',
      files: [
        {
          path: 'src/auth.ts',
          status: 'modified',
          additions: 12,
          deletions: 4,
          language: 'typescript',
        },
      ],
      instructions: ['Use read-only analysis only.'],
      rawFindings: [
        {
          title: 'Token may be logged',
          severity: 'high',
          confidence: 82,
          file: 'src/auth.ts',
          line: 42,
          evidence: ['logger receives token-like value'],
          recommendation: 'Redact token before logging.',
          sourceAgentId: 'security-review-agent',
        },
      ],
    });

    expect(result.contractVersion).toBe(GOVERNED_REVIEW_CONTRACT_VERSION);
    expect(result.status).toBe('completed');
    expect(result.policy).toEqual({
      readOnlyPhase: true,
      noMutationApplied: true,
      approvalRequiredBeforeMutation: true,
      externalEgressNotPerformed: true,
    });
    expect(result.agentPlan.map((role) => role.id)).toEqual(expect.arrayContaining([
      'context-agent',
      'security-review-agent',
      'verifier-agent',
    ]));
    expect(result.agentPlan.every((role) => role.readOnly)).toBe(true);
    expect(result.agentRuntimePlan).toEqual(expect.objectContaining({
      source: 'ReviewAgentOrchestrator',
      status: 'waiting-approval',
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        compilerOnly: true,
        budgetsDefaultToZero: true,
        approvalRequiredBeforeLaunch: true,
        reviewAgentsReadOnly: true,
      }),
    }));
    expect(result.agentRuntimePlan.teamCompiler.source).toBe('AgentTeamCompilerService');
    expect(result.agentRuntimePlan.teamCompiler.summary.roleCount).toBe(result.agentPlan.length);
    expect(result.agentRuntimePlan.subagentReceipts).toHaveLength(result.agentPlan.length);
    expect(result.agentRuntimePlan.roleLinks.every((link) => link.budgetZero)).toBe(true);
    expect(result.agentRuntimePlan.roleLinks.every((link) => link.scopeMode === 'blocked')).toBe(true);
    expect(result.verification).toEqual(expect.objectContaining({
      source: 'ReviewFindingVerifier',
      acceptedThreshold: 80,
      humanReviewThreshold: 60,
      inputFindingCount: 1,
      acceptedFindingCount: 1,
      needsHumanReviewFindingCount: 0,
      discardedFindingCount: 0,
    }));
    expect(result.policyGate).toEqual(expect.objectContaining({
      source: 'ReviewPolicyGate',
      status: 'approval-required',
    }));
    expect(result.policyGate.decisions).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'show-findings', allowed: true, requiresApproval: false }),
      expect.objectContaining({ action: 'comment-on-pr', allowed: false, requiresApproval: true }),
      expect.objectContaining({ action: 'apply-patch', allowed: false, requiresApproval: true }),
      expect.objectContaining({ action: 'launch-live-agents', allowed: false, requiresApproval: true }),
    ]));
    expect(result.context.files).toHaveLength(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toEqual(expect.objectContaining({
      severity: 'high',
      confidence: 100,
      sourceAgentId: 'security-review-agent',
    }));
    expect(result.findings[0]?.verification).toEqual(expect.objectContaining({
      status: 'accepted',
      originalConfidence: 82,
      adjustedConfidence: 100,
    }));
    expect(result.receipts.map((receipt) => receipt.kind)).toEqual(expect.arrayContaining([
      'review-created',
      'context-collected',
      'agent-plan-created',
      'agent-team-compiled',
      'subagent-receipts-prepared',
      'finding-normalized',
      'finding-scored',
      'finding-verified',
      'policy-gate-evaluated',
      'policy-boundary',
      'review-completed',
    ]));
  });

  it('deduplicates equivalent findings and keeps the highest confidence', () => {
    const result = new GovernedReviewService().run({
      reviewId: 'review-test-2',
      objective: 'review code',
      rawFindings: [
        {
          title: 'Missing null guard',
          confidence: 61,
          file: 'src/a.ts',
          line: 10,
          recommendation: 'Add guard.',
        },
        {
          title: 'Missing null guard',
          confidence: 91,
          file: 'src/a.ts',
          line: 10,
          recommendation: 'Add guard.',
        },
      ],
    });

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.confidence).toBe(84);
    expect(result.findings[0]?.verification.originalConfidence).toBe(91);
  });

  it('compiles regression review roles through the existing agent team compiler without launching subagents', () => {
    const result = new GovernedReviewService().run({
      reviewId: 'review-test-3',
      mode: 'regression-review',
      objective: 'review changed task runtime for compatibility regressions',
      files: [
        { path: 'src/runtime/task.ts', status: 'modified' },
      ],
    });

    expect(result.agentPlan.map((role) => role.id)).toEqual(expect.arrayContaining([
      'context-agent',
      'bug-review-agent',
      'regression-review-agent',
      'verifier-agent',
    ]));
    expect(result.agentRuntimePlan.teamCompiler.policy).toEqual(expect.objectContaining({
      noSubagentsLaunched: true,
      approvalRequiredBeforeLaunch: true,
      budgetsDefaultToZero: true,
    }));
    expect(result.agentRuntimePlan.teamCompiler.roles.every((role) => role.approval.required)).toBe(true);
    expect(result.agentRuntimePlan.subagentReceipts.every((receipt) => receipt.status === 'planned')).toBe(true);
    expect(result.summary).toContain('governed subagent receipt(s) prepared');
  });

  it('separates accepted, human-review and discarded findings by confidence threshold', () => {
    const result = new GovernedReviewService().run({
      reviewId: 'review-test-4',
      mode: 'code-review',
      objective: 'review code with mixed finding confidence',
      files: [
        { path: 'src/a.ts', status: 'modified' },
      ],
      rawFindings: [
        {
          title: 'Accepted finding',
          severity: 'high',
          confidence: 80,
          file: 'src/a.ts',
          line: 12,
          evidence: ['specific branch can throw'],
          recommendation: 'Guard the branch before use.',
          sourceAgentId: 'bug-review-agent',
        },
        {
          title: 'Needs human review finding',
          severity: 'medium',
          confidence: 60,
          file: 'src/a.ts',
          evidence: ['behavior may differ in one path'],
          recommendation: 'Ask the operator to confirm desired behavior.',
          sourceAgentId: 'verifier-agent',
        },
        {
          title: 'Discarded speculative finding',
          severity: 'low',
          confidence: 45,
          tags: ['speculative'],
          sourceAgentId: 'policy-review-agent',
        },
      ],
    });

    expect(result.verification.acceptedFindingCount).toBe(1);
    expect(result.verification.needsHumanReviewFindingCount).toBe(1);
    expect(result.verification.discardedFindingCount).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.verification.needsHumanReviewFindings[0]?.verification.status).toBe('needs-human-review');
    expect(result.verification.discardedFindings[0]?.verification.status).toBe('discarded');
    expect(result.summary).toContain('1 finding(s) discarded by verifier');
  });
});
