export type CapabilityAutopilotReleaseGateEvidence = {
  id: 'capability-autopilot-preflight-diagnosis' | 'capability-autopilot-repair-runner' | 'capability-autopilot-validation-resume' | 'capability-autopilot-cross-surface-ux' | 'capability-autopilot-memory-replay' | 'capability-autopilot-provider-expansion';
  script: string;
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
  requiredGates: string[];
  passedGates: string[];
  missingGates: string[];
  failedGates: string[];
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

const REQUIRED_PHASES: Array<CapabilityAutopilotReleaseGateEvidence['id']> = [
  'capability-autopilot-preflight-diagnosis',
  'capability-autopilot-repair-runner',
  'capability-autopilot-validation-resume',
  'capability-autopilot-cross-surface-ux',
  'capability-autopilot-memory-replay',
  'capability-autopilot-provider-expansion',
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
    const passedGates = REQUIRED_PHASES.filter((id) =>
      evidence.some((entry) => entry.id === id && entry.passed),
    );
    const failedGates = REQUIRED_PHASES.filter((id) =>
      evidence.some((entry) => entry.id === id && !entry.passed),
    );
    const missingGates = REQUIRED_PHASES.filter((id) =>
      !evidence.some((entry) => entry.id === id),
    );
    const riskPosture = this.resolveRiskPosture(evidence, failedGates, missingGates);
    const decision = this.resolveDecision({
      failedGates,
      missingGates,
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
      requiredGates: REQUIRED_PHASES.slice(),
      passedGates,
      missingGates,
      failedGates,
      riskPosture,
      releaseChannel: this.resolveReleaseChannel(decision),
      rolloutPlan: this.buildRolloutPlan(decision),
      rollbackPlan: this.buildRollbackPlan(decision),
      guardrails: this.buildGuardrails(),
      evidence,
      summary: this.buildSummary(decision, passedGates, missingGates, failedGates, riskPosture),
      metadata: {
        gate: 'capability-autopilot-fallback-handoff',
        baseline: 'v1.0.0',
        candidate: 'v1.1.0',
        defaultOnAllowed: Boolean(input.allowDefaultOn),
        requiredGateCount: REQUIRED_PHASES.length,
      },
    };
  }

  public defaultEvidence(): CapabilityAutopilotReleaseGateEvidence[] {
    return [
      this.evidence('capability-autopilot-preflight-diagnosis', 'qa:capability-autopilot-preflight-diagnosis', 'Preflight, diagnosis, repair plan, receipt and permission mapping are deterministic.', 'medium'),
      this.evidence('capability-autopilot-repair-runner', 'qa:capability-autopilot-repair-runner', 'Approved repair runner blocks missing permission and defaults to dry-run.', 'medium'),
      this.evidence('capability-autopilot-validation-resume', 'qa:capability-autopilot-validation-resume', 'Validation/resume loop recomputes readiness before resuming intent.', 'medium'),
      this.evidence('capability-autopilot-cross-surface-ux', 'qa:capability-autopilot-cross-surface-ux', 'Cross-surface UX preserves canonical receipt and explicit actions.', 'low'),
      this.evidence('capability-autopilot-memory-replay', 'qa:capability-autopilot-memory-replay', 'Memory/replay stores hashes and redacted lessons only.', 'low'),
      this.evidence('capability-autopilot-provider-expansion', 'qa:capability-autopilot-provider-expansion', 'Provider expansion covers executors, providers, local runtimes and channels with explicit fallback.', 'medium'),
    ];
  }

  private evidence(
    id: CapabilityAutopilotReleaseGateEvidence['id'],
    script: string,
    summary: string,
    risk: CapabilityAutopilotReleaseGateEvidence['risk'],
  ): CapabilityAutopilotReleaseGateEvidence {
    return {
      id,
      script,
      passed: true,
      summary,
      risk,
    };
  }

  private normalizeEvidence(
    evidence: CapabilityAutopilotReleaseGateEvidence[],
  ): CapabilityAutopilotReleaseGateEvidence[] {
    return evidence
      .filter((entry): entry is CapabilityAutopilotReleaseGateEvidence => Boolean(entry?.id && entry.script))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private resolveRiskPosture(
    evidence: CapabilityAutopilotReleaseGateEvidence[],
    failedGates: string[],
    missingGates: string[],
  ): CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'] {
    if (failedGates.length > 0) {
      return 'high';
    }
    if (missingGates.length > 0) {
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
    failedGates: string[];
    missingGates: string[];
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'];
    allowDefaultOn: boolean;
  }): CapabilityAutopilotReleaseDecision {
    if (input.failedGates.length > 0) {
      return 'hold_backlog';
    }
    if (input.missingGates.length > 0) {
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
      return 'Missing gate evidence; keep feature disabled until gates are complete.';
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
        'Re-run missing or failed verification gates before reconsidering release.',
      ];
    }

    return [
      'Ship Capability Autopilot in v1.1.0 behind ZAVORTH_CAPABILITY_AUTOPILOT.',
      'Keep default disabled for stable users; enable only for alpha/operator sessions.',
      'Require explicit permission for repair, fallback and provider handoff.',
      'Collect redacted receipts and verification gate evidence before beta promotion.',
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
    passedGates: string[],
    missingGates: string[],
    failedGates: string[],
    riskPosture: CapabilityAutopilotReleaseDecisionSnapshot['riskPosture'],
  ): string {
    if (decision === 'ship_v1_1_flagged') {
      return `Capability Autopilot can enter v1.1.0 behind flag: ${passedGates.length}/${REQUIRED_PHASES.length} verification gates passed; risk=${riskPosture}.`;
    }
    if (decision === 'ship_v1_1_default_on') {
      return 'Capability Autopilot can enter v1.1.0 default-on because all evidence is low risk.';
    }
    if (decision === 'needs_more_evidence') {
      return `Capability Autopilot needs more evidence before release; missing gates: ${missingGates.join(', ') || 'none'}.`;
    }
    return `Capability Autopilot stays in backlog; failed gates: ${failedGates.join(', ') || 'unknown'}.`;
  }
}
