import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type { CapabilityAutopilotReleaseCandidateSnapshot } from './CapabilityAutopilotReleaseCandidateGateService.js';

export type CapabilityAutopilotReleaseRolloutPlanStatus =
  | 'rollout_plan_ready'
  | 'blocked';

export type CapabilityAutopilotReleaseRolloutPlanRecommendation =
  | 'prepare_manual_v1_1_rollout'
  | 'hold_release_candidate';

export type CapabilityAutopilotReleaseRolloutPlanOptions = {
  rolloutPlanApproved?: boolean;
  stagedCohortsDefined?: boolean;
  canaryPercent?: number;
  maxCanaryPercent?: number;
  expansionStepCount?: number;
  minExpansionStepCount?: number;
  rollbackWindowHours?: number;
  minRollbackWindowHours?: number;
  rollbackRunbookReady?: boolean;
  changelogReady?: boolean;
  releaseBundleReady?: boolean;
  installerSmokePassed?: boolean;
  docsPublicationReady?: boolean;
  supportCommsReady?: boolean;
  statusPageDraftReady?: boolean;
  telemetryZavorthControlsReady?: boolean;
  releaseOwnerAssigned?: boolean;
  releaseTrainSlotReserved?: boolean;
  artifactRetentionReady?: boolean;
  manualPromotionRequired?: boolean;
  rcFlagDefaultOff?: boolean;
  publishTagEnabled?: boolean;
  globalRolloutEnabled?: boolean;
  autoRolloutEnabled?: boolean;
  actorId?: string | null;
  rolloutPlanReceiptId?: string | null;
  canaryCohortId?: string | null;
  stagedCohortPlanId?: string | null;
  rollbackRunbookId?: string | null;
  changelogId?: string | null;
  releaseBundleId?: string | null;
  installerSmokeReceiptId?: string | null;
  docsPublicationId?: string | null;
  commsPlanId?: string | null;
  telemetryZavorthControlId?: string | null;
  releaseOwnerId?: string | null;
  releaseTrainSlotId?: string | null;
  artifactRetentionPolicyId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotReleaseRolloutPlanSnapshot = {
  gate: 'capability-autopilot-release-rollout-plan';
  rolloutPlanId: string;
  generatedAt: string;
  surface: 'capability-autopilot-release-rollout-plan';
  capabilityId: string;
  status: CapabilityAutopilotReleaseRolloutPlanStatus;
  recommendation: CapabilityAutopilotReleaseRolloutPlanRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityAutopilotReleaseCandidateSnapshot['gate'];
  sourceStatus: CapabilityAutopilotReleaseCandidateSnapshot['status'];
  sourceRecommendation: CapabilityAutopilotReleaseCandidateSnapshot['recommendation'];
  rolloutPlanApproved: boolean;
  rollout: {
    stagedCohortsDefined: boolean;
    canaryPercent: number;
    maxCanaryPercent: number;
    expansionStepCount: number;
    minExpansionStepCount: number;
    rollbackWindowHours: number;
    minRollbackWindowHours: number;
    canaryCohortId: string | null;
    stagedCohortPlanId: string | null;
    limitedCanary: boolean;
  };
  releaseAssets: {
    changelogReady: boolean;
    changelogId: string | null;
    releaseBundleReady: boolean;
    releaseBundleId: string | null;
    installerSmokePassed: boolean;
    installerSmokeReceiptId: string | null;
    docsPublicationReady: boolean;
    docsPublicationId: string | null;
  };
  operations: {
    rollbackRunbookReady: boolean;
    rollbackRunbookId: string | null;
    supportCommsReady: boolean;
    commsPlanId: string | null;
    statusPageDraftReady: boolean;
    telemetryZavorthControlsReady: boolean;
    telemetryZavorthControlId: string | null;
    releaseOwnerAssigned: boolean;
    releaseOwnerId: string | null;
    releaseTrainSlotReserved: boolean;
    releaseTrainSlotId: string | null;
    artifactRetentionReady: boolean;
    artifactRetentionPolicyId: string | null;
  };
  safeguards: {
    manualPromotionRequired: boolean;
    rcFlagDefaultOff: boolean;
    publishTagEnabled: boolean;
    globalRolloutEnabled: boolean;
    autoRolloutEnabled: boolean;
  };
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  audit: {
    sourceGeneratedAt: string;
    sourceReleaseCandidateGateId: string;
    actorId: string | null;
    reason: string | null;
    rolloutPlanReceiptId: string | null;
  };
  nextRecommendedGate: {
    gate: 'capability-autopilot-release-execution';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotReleaseRolloutPlanRuntime = {
  now?: () => Date;
};

type ResolvedOptions = {
  rolloutPlanApproved: boolean;
  stagedCohortsDefined: boolean;
  canaryPercent: number;
  maxCanaryPercent: number;
  expansionStepCount: number;
  minExpansionStepCount: number;
  rollbackWindowHours: number;
  minRollbackWindowHours: number;
  rollbackRunbookReady: boolean;
  changelogReady: boolean;
  releaseBundleReady: boolean;
  installerSmokePassed: boolean;
  docsPublicationReady: boolean;
  supportCommsReady: boolean;
  statusPageDraftReady: boolean;
  telemetryZavorthControlsReady: boolean;
  releaseOwnerAssigned: boolean;
  releaseTrainSlotReserved: boolean;
  artifactRetentionReady: boolean;
  manualPromotionRequired: boolean;
  rcFlagDefaultOff: boolean;
  publishTagEnabled: boolean;
  globalRolloutEnabled: boolean;
  autoRolloutEnabled: boolean;
};

export class CapabilityAutopilotReleaseRolloutPlanService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotReleaseRolloutPlanRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildRolloutPlanSnapshot(
    source: CapabilityAutopilotReleaseCandidateSnapshot,
    options: CapabilityAutopilotReleaseRolloutPlanOptions = {},
  ): CapabilityAutopilotReleaseRolloutPlanSnapshot {
    const generatedAt = this.now().toISOString();
    const resolved = this.resolveOptions(source, options);
    const blockers = this.resolveBlockers(source, resolved);
    const checks = this.buildChecks(source, resolved, blockers);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotReleaseRolloutPlanStatus = failed > 0 || blockers.length > 0
      ? 'blocked'
      : 'rollout_plan_ready';
    const recommendation: CapabilityAutopilotReleaseRolloutPlanRecommendation = status === 'rollout_plan_ready'
      ? 'prepare_manual_v1_1_rollout'
      : 'hold_release_candidate';

    return {
      gate: 'capability-autopilot-release-rollout-plan',
      rolloutPlanId: this.buildRolloutPlanId(source, generatedAt, options.rolloutPlanReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-release-rollout-plan',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'rollout_plan_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotGate: source.gate,
      sourceStatus: source.status,
      sourceRecommendation: source.recommendation,
      rolloutPlanApproved: resolved.rolloutPlanApproved,
      rollout: {
        stagedCohortsDefined: resolved.stagedCohortsDefined,
        canaryPercent: resolved.canaryPercent,
        maxCanaryPercent: resolved.maxCanaryPercent,
        expansionStepCount: resolved.expansionStepCount,
        minExpansionStepCount: resolved.minExpansionStepCount,
        rollbackWindowHours: resolved.rollbackWindowHours,
        minRollbackWindowHours: resolved.minRollbackWindowHours,
        canaryCohortId: options.canaryCohortId || null,
        stagedCohortPlanId: options.stagedCohortPlanId || null,
        limitedCanary: this.isLimitedCanary(resolved),
      },
      releaseAssets: {
        changelogReady: resolved.changelogReady,
        changelogId: options.changelogId || null,
        releaseBundleReady: resolved.releaseBundleReady,
        releaseBundleId: options.releaseBundleId || null,
        installerSmokePassed: resolved.installerSmokePassed,
        installerSmokeReceiptId: options.installerSmokeReceiptId || null,
        docsPublicationReady: resolved.docsPublicationReady,
        docsPublicationId: options.docsPublicationId || null,
      },
      operations: {
        rollbackRunbookReady: resolved.rollbackRunbookReady,
        rollbackRunbookId: options.rollbackRunbookId || null,
        supportCommsReady: resolved.supportCommsReady,
        commsPlanId: options.commsPlanId || null,
        statusPageDraftReady: resolved.statusPageDraftReady,
        telemetryZavorthControlsReady: resolved.telemetryZavorthControlsReady,
        telemetryZavorthControlId: options.telemetryZavorthControlId || null,
        releaseOwnerAssigned: resolved.releaseOwnerAssigned,
        releaseOwnerId: options.releaseOwnerId || null,
        releaseTrainSlotReserved: resolved.releaseTrainSlotReserved,
        releaseTrainSlotId: options.releaseTrainSlotId || null,
        artifactRetentionReady: resolved.artifactRetentionReady,
        artifactRetentionPolicyId: options.artifactRetentionPolicyId || null,
      },
      safeguards: {
        manualPromotionRequired: resolved.manualPromotionRequired,
        rcFlagDefaultOff: resolved.rcFlagDefaultOff,
        publishTagEnabled: resolved.publishTagEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        autoRolloutEnabled: resolved.autoRolloutEnabled,
      },
      blockers,
      checks,
      audit: {
        sourceGeneratedAt: source.generatedAt,
        sourceReleaseCandidateGateId: source.releaseCandidateGateId,
        actorId: options.actorId || null,
        reason: options.reason || null,
        rolloutPlanReceiptId: options.rolloutPlanReceiptId || null,
      },
      nextRecommendedGate: {
        gate: 'capability-autopilot-release-execution',
        title: 'Capability Autopilot v1.1 Release Execution Gate',
        reason:
          'after do rollout plan, o next passo e run a release manualmente com tag/publish gated, canary inicial, rollback e observabilidade.',
      },
      metadata: {
        gate: 'capability-autopilot-release-rollout-plan',
        sourceSnapshotStatus: source.status,
        sourceRecommendation: source.recommendation,
        autoExecute: false,
        recommendation,
        rolloutPlanReady: status === 'rollout_plan_ready',
        canaryPercent: resolved.canaryPercent,
        expansionStepCount: resolved.expansionStepCount,
        rollbackWindowHours: resolved.rollbackWindowHours,
        publishTagEnabled: resolved.publishTagEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        autoRolloutEnabled: resolved.autoRolloutEnabled,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotReleaseRolloutPlanSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-release-rollout] Capability Autopilot v1.1 Release Rollout Plan');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`canary: ${snapshot.rollout.canaryPercent}%/${snapshot.rollout.maxCanaryPercent}% | steps=${snapshot.rollout.expansionStepCount}/${snapshot.rollout.minExpansionStepCount}`);
    lines.push(`rollbackWindow: ${snapshot.rollout.rollbackWindowHours}h/${snapshot.rollout.minRollbackWindowHours}h`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`next recommended step: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private resolveOptions(
    source: CapabilityAutopilotReleaseCandidateSnapshot,
    options: CapabilityAutopilotReleaseRolloutPlanOptions,
  ): ResolvedOptions {
    return {
      rolloutPlanApproved: options.rolloutPlanApproved === true,
      stagedCohortsDefined: options.stagedCohortsDefined === true,
      canaryPercent: this.resolveNumber(options.canaryPercent, 0),
      maxCanaryPercent: this.resolveNumber(options.maxCanaryPercent, 0),
      expansionStepCount: this.resolveNumber(options.expansionStepCount, 0),
      minExpansionStepCount: this.resolveNumber(options.minExpansionStepCount, 0),
      rollbackWindowHours: this.resolveNumber(options.rollbackWindowHours, 0),
      minRollbackWindowHours: this.resolveNumber(options.minRollbackWindowHours, 0),
      rollbackRunbookReady: options.rollbackRunbookReady === true,
      changelogReady: options.changelogReady === true,
      releaseBundleReady: options.releaseBundleReady === true,
      installerSmokePassed: options.installerSmokePassed === true,
      docsPublicationReady: options.docsPublicationReady === true,
      supportCommsReady: options.supportCommsReady === true,
      statusPageDraftReady: options.statusPageDraftReady === true,
      telemetryZavorthControlsReady: options.telemetryZavorthControlsReady === true,
      releaseOwnerAssigned: options.releaseOwnerAssigned === true,
      releaseTrainSlotReserved: options.releaseTrainSlotReserved === true,
      artifactRetentionReady: options.artifactRetentionReady === true,
      manualPromotionRequired: options.manualPromotionRequired === true,
      rcFlagDefaultOff: options.rcFlagDefaultOff === true && source.governance.rcFlagDefaultOff,
      publishTagEnabled: options.publishTagEnabled === true,
      globalRolloutEnabled: options.globalRolloutEnabled === true,
      autoRolloutEnabled: options.autoRolloutEnabled === true,
    };
  }

  private resolveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private resolveBlockers(
    source: CapabilityAutopilotReleaseCandidateSnapshot,
    options: ResolvedOptions,
  ): string[] {
    const blockers: string[] = [];
    if (
      source.status !== 'release_candidate_ready' ||
      source.recommendation !== 'promote_to_release_candidate' ||
      !source.summary.ok
    ) {
      blockers.push(`source_release_candidate_not_ready:${source.status}`);
    }
    if (!options.rolloutPlanApproved) {
      blockers.push('rollout_plan_approval_required');
    }
    if (!options.stagedCohortsDefined) {
      blockers.push('staged_cohorts_required');
    }
    if (!this.isLimitedCanary(options)) {
      blockers.push('canary_percent_out_of_bounds');
    }
    if (
      !Number.isInteger(options.expansionStepCount) ||
      !Number.isInteger(options.minExpansionStepCount) ||
      options.expansionStepCount < options.minExpansionStepCount ||
      options.minExpansionStepCount <= 0
    ) {
      blockers.push('expansion_steps_not_defined');
    }
    if (options.rollbackWindowHours < options.minRollbackWindowHours || options.minRollbackWindowHours <= 0) {
      blockers.push('rollback_window_too_short');
    }
    if (!options.rollbackRunbookReady) {
      blockers.push('rollback_runbook_required');
    }
    if (!options.changelogReady) {
      blockers.push('changelog_required');
    }
    if (!options.releaseBundleReady) {
      blockers.push('release_bundle_required');
    }
    if (!options.installerSmokePassed) {
      blockers.push('installer_smoke_required');
    }
    if (!options.docsPublicationReady) {
      blockers.push('docs_publication_required');
    }
    if (!options.supportCommsReady) {
      blockers.push('support_comms_required');
    }
    if (!options.statusPageDraftReady) {
      blockers.push('status_page_draft_required');
    }
    if (!options.telemetryZavorthControlsReady) {
      blockers.push('telemetry_zavorthControls_required');
    }
    if (!options.releaseOwnerAssigned) {
      blockers.push('release_owner_required');
    }
    if (!options.releaseTrainSlotReserved) {
      blockers.push('release_train_slot_required');
    }
    if (!options.artifactRetentionReady) {
      blockers.push('artifact_retention_required');
    }
    if (!options.manualPromotionRequired) {
      blockers.push('manual_promotion_required');
    }
    if (!options.rcFlagDefaultOff) {
      blockers.push('rc_flag_default_off_required');
    }
    if (options.publishTagEnabled) {
      blockers.push('publish_tag_not_allowed_in_plan');
    }
    if (options.globalRolloutEnabled) {
      blockers.push('global_rollout_not_allowed');
    }
    if (options.autoRolloutEnabled) {
      blockers.push('auto_rollout_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityAutopilotReleaseCandidateSnapshot,
    options: ResolvedOptions,
    blockers: string[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source });

    return [
      this.check(
        'capability-autopilot-release-rollout:source-ready',
        'release candidate source ready',
        source.status === 'release_candidate_ready' && source.recommendation === 'promote_to_release_candidate' && source.summary.ok ? 'pass' : 'fail',
        'Rollout plan can only start from a ready release candidate.',
        [
          `sourceStatus=${source.status}`,
          `sourceRecommendation=${source.recommendation}`,
          `sourceOk=${source.summary.ok}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-rollout:staged-canary',
        'canary e cohorts staged definidos',
        options.rolloutPlanApproved &&
          options.stagedCohortsDefined &&
          this.isLimitedCanary(options) &&
          options.expansionStepCount >= options.minExpansionStepCount ? 'pass'
          : 'fail',
        'Rollout v1.1 requires an approved plan, staged cohorts, limited canary, and gradual steps.',
        [
          `rolloutPlanApproved=${options.rolloutPlanApproved}`,
          `stagedCohortsDefined=${options.stagedCohortsDefined}`,
          `canaryPercent=${options.canaryPercent}`,
          `maxCanaryPercent=${options.maxCanaryPercent}`,
          `expansionStepCount=${options.expansionStepCount}`,
          `minExpansionStepCount=${options.minExpansionStepCount}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-rollout:release-assets',
        'assets de release ready',
        options.changelogReady &&
          options.releaseBundleReady &&
          options.installerSmokePassed &&
          options.docsPublicationReady ? 'pass'
          : 'fail',
        'Rollout plan requires changelog, bundle, installer smoke, and docs ready.',
        [
          `changelogReady=${options.changelogReady}`,
          `releaseBundleReady=${options.releaseBundleReady}`,
          `installerSmokePassed=${options.installerSmokePassed}`,
          `docsPublicationReady=${options.docsPublicationReady}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-rollout:operations',
        'release operation ready',
        options.rollbackWindowHours >= options.minRollbackWindowHours &&
          options.rollbackRunbookReady &&
          options.supportCommsReady &&
          options.statusPageDraftReady &&
          options.telemetryZavorthControlsReady &&
          options.releaseOwnerAssigned &&
          options.releaseTrainSlotReserved &&
          options.artifactRetentionReady ? 'pass'
          : 'fail',
        'Rollout plan requires rollback window, runbook, comms, status page, zavorthControls, owner, train slot, and retention.',
        [
          `rollbackWindowHours=${options.rollbackWindowHours}`,
          `minRollbackWindowHours=${options.minRollbackWindowHours}`,
          `rollbackRunbookReady=${options.rollbackRunbookReady}`,
          `supportCommsReady=${options.supportCommsReady}`,
          `statusPageDraftReady=${options.statusPageDraftReady}`,
          `telemetryZavorthControlsReady=${options.telemetryZavorthControlsReady}`,
          `releaseOwnerAssigned=${options.releaseOwnerAssigned}`,
          `releaseTrainSlotReserved=${options.releaseTrainSlotReserved}`,
          `artifactRetentionReady=${options.artifactRetentionReady}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-rollout:safeguards',
        'salvaguardas de rollout manuais',
        options.manualPromotionRequired &&
          options.rcFlagDefaultOff &&
          !options.publishTagEnabled &&
          !options.globalRolloutEnabled &&
          !options.autoRolloutEnabled ? 'pass'
          : 'fail',
        'This gate prepares rollout, but does not publish a tag, release globally, or execute auto-rollout.',
        [
          `manualPromotionRequired=${options.manualPromotionRequired}`,
          `rcFlagDefaultOff=${options.rcFlagDefaultOff}`,
          `publishTagEnabled=${options.publishTagEnabled}`,
          `globalRolloutEnabled=${options.globalRolloutEnabled}`,
          `autoRolloutEnabled=${options.autoRolloutEnabled}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-rollout:no-blockers',
        'without blockers de rollout plan',
        blockers.length === 0 ? 'pass' : 'fail',
        'There can be no aggregate blocker to prepare rollout v1.1.',
        blockers.length > 0 ? blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-release-rollout:no-raw-payload',
        'without payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Public rollout snapshot cannot reintroduce raw intent.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private isLimitedCanary(options: ResolvedOptions): boolean {
    return options.canaryPercent > 0 &&
      options.maxCanaryPercent > 0 &&
      options.canaryPercent <= options.maxCanaryPercent;
  }

  private buildRolloutPlanId(
    source: CapabilityAutopilotReleaseCandidateSnapshot,
    generatedAt: string,
    rolloutPlanReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.gate,
        source.releaseCandidateGateId,
        source.generatedAt,
        generatedAt,
        rolloutPlanReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-release-rollout-${digest}`;
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
