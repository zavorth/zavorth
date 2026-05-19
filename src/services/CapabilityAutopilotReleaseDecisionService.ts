export type CapabilityAutopilotReleaseGateEvidence = {
  phase: '60' | '61' | '62' | '63' | '64' | '65';
  gate: string;
  passed: boolean;
  summary: string;
  risk: 'low' | 'medium' | 'high';
};

export type CapabilityAutopilotReleaseDecision =
  | 'ship_v1_1_flagged'
  | 'ship_v1_1_default_on'
  | 'needs_more_evidence'
  | 'hold_backlog';

export type CapabilityAutopilotReleaseDecisionSnapshot = {
  generatedAt: string;
  versionCandidate: 'v1.1.0';
  decision: CapabilityAutopilotReleaseDecision;
  featureFlag: {
    name: 'ZAVORTH_CAPABILITY_AUTOPILOT';
    defaultEnabled: boolean;
    reason: string;
  };
  requiredCheckpoints: string[];
  passedCheckpoints: string[];
  missingCheckpoints: string[];
  failedCheckpoints: string[];
  riskPosture: 'low' | 'medium' | 'high';
  releaseChannel: 'alpha' | 'beta' | 'stable' | 'backlog';
  rolloutPlan: string[];
  rollbackPlan: string[];
  guardrails: string[];
  evidence: CapabilityAutopilotReleaseGateEvidence[];
  summary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotReleaseDecisionInput = {
  evidence: CapabilityAutopilotReleaseGateEvidence[];
  allowDefaultOn?: boolean;
};

export type CapabilityAutopilotReleaseDecisionRuntime = {
  now?: () => Date;
};

const REQUIRED_STAGES: Array<CapabilityAutopilotReleaseGateEvidence['phase']> = [
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
];

export class CapabilityAutopilotReleaseDecisionService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotReleaseDecisionRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildDecision(
    input: CapabilityAutopilotReleaseDecisionInput,
  ): CapabilityAutopilotReleaseDecisionSnapshot {
    const evidence = this.normalizeEvidence(input.evidence);
    const passedCheckpoints = REQUIRED_STAGES.filter((phase) =>
      evidence.some((entry) => entry.phase === phase && entry.passed),
    );
    const failedCheckpoints = REQUIRED_STAGES.filter((phase) =>
      evidence.some((entry) => entry.phase === phase && !entry.passed),
    );
    const missingCheckpoints = REQUIRED_STAGES.filter((phase) =>
      !evidence.some((entry) => entry.phase === phase),
    );
    const riskPosture = this.resolveRiskPosture(evidence, failedCheckpoints, missingCheckpoints);
    const decision = this.resolveDecision({
      failedCheckpoints,
      missingCheckpoints,
      riskPosture,
      allowDefaultOn: Boolean(input.allowDefaultOn),
    });

    return {
      generatedAt: this.now().toISOString(),
      versionCandidate: 'v1.1.0',
      decision,
      featureFlag: {
        name: 'ZAVORTH_CAPABILITY_AUTOPILOT',
        defaultEnabled: decision === 'ship_v1_1_default_on',
        reason: this.featureFlagReason(decision, riskPosture),
      },
      requiredCheckpoints: REQUIRED_STAGES.slice(),
      passedCheckpoints,
      missingCheckpoints,
      failedCheckpoints,
      riskPosture,
      releaseChannel: this.resolveReleaseChannel(decision),
      rolloutPlan: this.buildRolloutPlan(decision),
      rollbackPlan: this.buildRollbackPlan(decision),
      guardrails: this.buildGuardrails(),
      evidence,
      summary: this.buildSummary(decision, passedCheckpoints, missingCheckpoints, failedCheckpoints, riskPosture),
      metadata: {
        phase: 'capability-autopilot-checkpoint-66',
        baseline: 'v1.0.0',
        candidate: 'v1.1.0',
        defaultOnAllowed: Boolean(input.allowDefaultOn),
        requiredCheckpointCount: REQUIRED_STAGES.length,
      },
    };
  }

  public defaultEvidence(): CapabilityAutopilotReleaseGateEvidence[] {
    return [
      this.evidence('60', 'qa:phase:60', 'Preflight, diagnosis, repair plan, receipt and permission mapping are deterministic.', 'medium'),
      this.evidence('61', 'qa:phase:61', 'Approved repair runner blocks missing permission and defaults to dry-run.', 'medium'),
      this.evidence('62', 'qa:phase:62', 'Validation/resume loop recomputes readiness before resuming intent.', 'medium'),
      this.evidence('63', 'qa:phase:63', 'Cross-surface UX preserves canonical receipt and explicit actions.', 'low'),
      this.evidence('64', 'qa:phase:64', 'Memory/replay stores hashes and redacted lessons only.', 'low'),
      this.evidence('65', 'qa:phase:65', 'Provider expansion covers executors, providers, local runtimes and channels with explicit fallback.', 'medium'),
    ];
  }

  private evidence(
    phase: CapabilityAutopilotReleaseGateEvidence['phase'],
    gate: string,
    summary: string,
    risk: CapabilityAutopilotReleaseGateEvidence['risk'],
  ): CapabilityAutopilotReleaseGateEvidence {
    return {
      phase,
      gate,
      passed: true,
      summary,
      risk,
    };
  }

  private normalizeEvidence(
    evidence: CapabilityAutopilotReleaseGateEvidence[],
  ): CapabilityAutopilotReleaseGateEvidence[] {
    return evidence
      .filter((entry): entry is CapabilityAutopilotReleaseGateEvidence => Boolean(entry?.phase && entry.gate))
      .sort((left, right) => left.phase.localeCompare(right.phase));
  }

  private resolveRiskPosture(
    evidence: CapabilityAutopilotReleaseGateEvidence[],
    failedCheckpoints: string[],
    missingCheckpoints: string[],
  ): CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'] {
    if (failedCheckpoints.length > 0) {
      return 'high';
    }
    if (missingCheckpoints.length > 0) {
      return 'medium';
    }
    if (evidence.some((entry) => entry.risk === 'high')) {
      return 'high';
    }
    if (evidence.some((entry) => entry.risk === 'medium')) {
      return 'medium';
    }
    return 'low';
  }

  private resolveDecision(input: {
    failedCheckpoints: string[];
    missingCheckpoints: string[];
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'];
    allowDefaultOn: boolean;
  }): CapabilityAutopilotReleaseDecision {
    if (input.failedCheckpoints.length > 0) {
      return 'hold_backlog';
    }
    if (input.missingCheckpoints.length > 0) {
      return 'needs_more_evidence';
    }
    if (input.allowDefaultOn && input.riskPosture === 'low') {
      return 'ship_v1_1_default_on';
    }
    return 'ship_v1_1_flagged';
  }

  private featureFlagReason(
    decision: CapabilityAutopilotReleaseDecision,
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'],
  ): string {
    if (decision === 'ship_v1_1_default_on') {
      return 'All required gates passed with low risk and default-on was explicitly allowed.';
    }
    if (decision === 'ship_v1_1_flagged') {
      return `All gates passed, but risk posture is ${riskPosture}; ship behind explicit feature flag.`;
    }
    if (decision === 'needs_more_evidence') {
      return 'Missing phase evidence; keep feature disabled until gates are complete.';
    }
    return 'At least one required gate failed; keep feature out of release.';
  }

  private resolveReleaseChannel(
    decision: CapabilityAutopilotReleaseDecision,
  ): CapabilityAutopilotReleaseDecisionSnapshot['releaseChannel'] {
    switch (decision) {
      case 'ship_v1_1_default_on':
        return 'beta';
      case 'ship_v1_1_flagged':
        return 'alpha';
      case 'needs_more_evidence':
        return 'backlog';
      case 'hold_backlog':
      default:
        return 'backlog';
    }
  }

  private buildRolloutPlan(decision: CapabilityAutopilotReleaseDecision): string[] {
    if (decision === 'hold_backlog' || decision === 'needs_more_evidence') {
      return [
        'Do not include Capability Autopilot in the v1.1 release train.',
        'Keep scripts and docs available only as development evidence.',
        'Re-run missing or failed checkpoint gates before reconsidering release.',
      ];
    }

    return [
      'Ship Capability Autopilot in v1.1.0 behind ZAVORTH_CAPABILITY_AUTOPILOT.',
      'Keep default disabled for stable users; enable only for alpha/operator sessions.',
      'Require explicit permission for repair, fallback and provider handoff.',
      'Collect redacted receipts and checkpoint gate evidence before beta promotion.',
    ];
  }

  private buildRollbackPlan(decision: CapabilityAutopilotReleaseDecision): string[] {
    if (decision === 'hold_backlog') {
      return ['No rollback required because the feature remains out of release.'];
    }

    return [
      'Disable ZAVORTH_CAPABILITY_AUTOPILOT to remove the feature from runtime paths.',
      'Keep existing v1.0.0 baseline and v1.0.x hotfix policy unchanged.',
      'Preserve receipts for audit; do not replay failed repairs automatically.',
      'Move the feature back to backlog if any approval, privacy or fallback gate regresses.',
    ];
  }

  private buildGuardrails(): string[] {
    return [
      'Preflight is read-only until explicit approval.',
      'Repair runner defaults to dry-run in QA and requires scoped permissions.',
      'Readiness is recalculated before resuming the original intent.',
      'Fallback requires explicit user selection and permission when sensitive.',
      'Memory/replay stores hashes and redacted lessons, not raw intent or workspace.',
      'Provider expansion degrades to readiness/issue instead of starting sidecars.',
    ];
  }

  private buildSummary(
    decision: CapabilityAutopilotReleaseDecision,
    passedCheckpoints: string[],
    missingCheckpoints: string[],
    failedCheckpoints: string[],
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'],
  ): string {
    if (decision === 'ship_v1_1_flagged') {
      return `Capability Autopilot can enter v1.1.0 behind flag: ${passedCheckpoints.length}/${REQUIRED_STAGES.length} checkpoint gates passed; risk=${riskPosture}.`;
    }
    if (decision === 'ship_v1_1_default_on') {
      return 'Capability Autopilot can enter v1.1.0 default-on because all evidence is low risk.';
    }
    if (decision === 'needs_more_evidence') {
      return `Capability Autopilot needs more evidence before release; missing phases: ${missingCheckpoints.join(', ') || 'none'}.`;
    }
    return `Capability Autopilot stays in backlog; failed phases: ${failedCheckpoints.join(', ') || 'unknown'}.`;
  }
}
