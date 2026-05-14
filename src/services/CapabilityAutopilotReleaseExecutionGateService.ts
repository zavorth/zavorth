import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type { CapabilityAutopilotReleaseRolloutPlanSnapshot } from './CapabilityAutopilotReleaseRolloutPlanService.js';

export type CapabilityAutopilotReleaseExecutionStatus =
  | 'release_execution_ready'
  | 'blocked';

export type CapabilityAutopilotReleaseExecutionRecommendation =
  | 'execute_manual_v1_1_release'
  | 'hold_rollout_plan';

export type CapabilityAutopilotReleaseExecutionOptions = {
  releaseExecutionApproved?: boolean;
  manualOperatorPresent?: boolean;
  releaseVersion?: string | null;
  releaseTag?: string | null;
  versionManifestReady?: boolean;
  releaseBranchClean?: boolean;
  tagCreationApproved?: boolean;
  publishApproved?: boolean;
  releaseBundleVerified?: boolean;
  signedArtifactsReady?: boolean;
  provenanceReady?: boolean;
  changelogFrozen?: boolean;
  docsFrozen?: boolean;
  canaryLaunchApproved?: boolean;
  initialCanaryPercent?: number;
  maxInitialCanaryPercent?: number;
  canaryCohortReady?: boolean;
  smokeBeforeCanaryPassed?: boolean;
  rollbackCheckpointReady?: boolean;
  rollbackDryRunPassed?: boolean;
  observabilityLive?: boolean;
  incidentCommanderAssigned?: boolean;
  supportBridgeReady?: boolean;
  auditSinkReady?: boolean;
  autoExecuteEnabled?: boolean;
  globalRolloutEnabled?: boolean;
  skipCanaryEnabled?: boolean;
  actorId?: string | null;
  executionGateReceiptId?: string | null;
  versionManifestId?: string | null;
  tagApprovalReceiptId?: string | null;
  publishApprovalReceiptId?: string | null;
  artifactVerificationReceiptId?: string | null;
  provenanceReceiptId?: string | null;
  canaryLaunchReceiptId?: string | null;
  smokeReceiptId?: string | null;
  rollbackCheckpointId?: string | null;
  rollbackDryRunReceiptId?: string | null;
  observabilityDashboardId?: string | null;
  incidentCommanderId?: string | null;
  supportBridgeId?: string | null;
  auditReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotReleaseExecutionSnapshot = {
  phase: '82';
  releaseExecutionGateId: string;
  generatedAt: string;
  surface: 'capability-autopilot-release-execution-gate';
  capabilityId: string;
  status: CapabilityAutopilotReleaseExecutionStatus;
  recommendation: CapabilityAutopilotReleaseExecutionRecommendation;
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityAutopilotReleaseRolloutPlanSnapshot['phase'];
  sourceStatus: CapabilityAutopilotReleaseRolloutPlanSnapshot['status'];
  sourceRecommendation: CapabilityAutopilotReleaseRolloutPlanSnapshot['recommendation'];
  executionIntent: {
    releaseExecutionApproved: boolean;
    manualOperatorPresent: boolean;
    releaseVersion: string | null;
    releaseTag: string | null;
    versionManifestReady: boolean;
    versionManifestId: string | null;
    releaseBranchClean: boolean;
  };
  publishGate: {
    tagCreationApproved: boolean;
    tagApprovalReceiptId: string | null;
    publishApproved: boolean;
    publishApprovalReceiptId: string | null;
  };
  artifacts: {
    releaseBundleVerified: boolean;
    artifactVerificationReceiptId: string | null;
    signedArtifactsReady: boolean;
    provenanceReady: boolean;
    provenanceReceiptId: string | null;
    changelogFrozen: boolean;
    docsFrozen: boolean;
  };
  canary: {
    canaryLaunchApproved: boolean;
    canaryLaunchReceiptId: string | null;
    initialCanaryPercent: number;
    maxInitialCanaryPercent: number;
    canaryCohortReady: boolean;
    smokeBeforeCanaryPassed: boolean;
    smokeReceiptId: string | null;
  };
  rollbackAndObservability: {
    rollbackCheckpointReady: boolean;
    rollbackCheckpointId: string | null;
    rollbackDryRunPassed: boolean;
    rollbackDryRunReceiptId: string | null;
    observabilityLive: boolean;
    observabilityDashboardId: string | null;
    incidentCommanderAssigned: boolean;
    incidentCommanderId: string | null;
    supportBridgeReady: boolean;
    supportBridgeId: string | null;
    auditSinkReady: boolean;
    auditReceiptId: string | null;
  };
  safeguards: {
    autoExecuteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipCanaryEnabled: boolean;
  };
  blockers: string[];
  checks: CapabilityAutopilotPreflightCheck[];
  audit: {
    sourceGeneratedAt: string;
    sourceRolloutPlanId: string;
    actorId: string | null;
    reason: string | null;
    executionGateReceiptId: string | null;
  };
  nextRecommendedPhase: {
    phase: '83';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotReleaseExecutionGateRuntime = {
  now?: () => Date;
};

type ResolvedOptions = {
  releaseExecutionApproved: boolean;
  manualOperatorPresent: boolean;
  releaseVersion: string | null;
  releaseTag: string | null;
  versionManifestReady: boolean;
  releaseBranchClean: boolean;
  tagCreationApproved: boolean;
  publishApproved: boolean;
  releaseBundleVerified: boolean;
  signedArtifactsReady: boolean;
  provenanceReady: boolean;
  changelogFrozen: boolean;
  docsFrozen: boolean;
  canaryLaunchApproved: boolean;
  initialCanaryPercent: number;
  maxInitialCanaryPercent: number;
  canaryCohortReady: boolean;
  smokeBeforeCanaryPassed: boolean;
  rollbackCheckpointReady: boolean;
  rollbackDryRunPassed: boolean;
  observabilityLive: boolean;
  incidentCommanderAssigned: boolean;
  supportBridgeReady: boolean;
  auditSinkReady: boolean;
  autoExecuteEnabled: boolean;
  globalRolloutEnabled: boolean;
  skipCanaryEnabled: boolean;
};

export class CapabilityAutopilotReleaseExecutionGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotReleaseExecutionGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildExecutionSnapshot(
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
    options: CapabilityAutopilotReleaseExecutionOptions = {},
  ): CapabilityAutopilotReleaseExecutionSnapshot {
    const generatedAt = this.now().toISOString();
    const resolved = this.resolveOptions(source, options);
    const blockers = this.resolveBlockers(source, resolved);
    const checks = this.buildChecks(source, resolved, blockers);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;
    const status: CapabilityAutopilotReleaseExecutionStatus = failed > 0 || blockers.length > 0
      ? 'blocked'
      : 'release_execution_ready';
    const recommendation: CapabilityAutopilotReleaseExecutionRecommendation = status === 'release_execution_ready'
      ? 'execute_manual_v1_1_release'
      : 'hold_rollout_plan';

    return {
      phase: '82',
      releaseExecutionGateId: this.buildExecutionGateId(source, generatedAt, options.executionGateReceiptId || null),
      generatedAt,
      surface: 'capability-autopilot-release-execution-gate',
      capabilityId: source.capabilityId,
      status,
      recommendation,
      summary: {
        ok: status === 'release_execution_ready',
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      sourceStatus: source.status,
      sourceRecommendation: source.recommendation,
      executionIntent: {
        releaseExecutionApproved: resolved.releaseExecutionApproved,
        manualOperatorPresent: resolved.manualOperatorPresent,
        releaseVersion: resolved.releaseVersion,
        releaseTag: resolved.releaseTag,
        versionManifestReady: resolved.versionManifestReady,
        versionManifestId: options.versionManifestId || null,
        releaseBranchClean: resolved.releaseBranchClean,
      },
      publishGate: {
        tagCreationApproved: resolved.tagCreationApproved,
        tagApprovalReceiptId: options.tagApprovalReceiptId || null,
        publishApproved: resolved.publishApproved,
        publishApprovalReceiptId: options.publishApprovalReceiptId || null,
      },
      artifacts: {
        releaseBundleVerified: resolved.releaseBundleVerified,
        artifactVerificationReceiptId: options.artifactVerificationReceiptId || null,
        signedArtifactsReady: resolved.signedArtifactsReady,
        provenanceReady: resolved.provenanceReady,
        provenanceReceiptId: options.provenanceReceiptId || null,
        changelogFrozen: resolved.changelogFrozen,
        docsFrozen: resolved.docsFrozen,
      },
      canary: {
        canaryLaunchApproved: resolved.canaryLaunchApproved,
        canaryLaunchReceiptId: options.canaryLaunchReceiptId || null,
        initialCanaryPercent: resolved.initialCanaryPercent,
        maxInitialCanaryPercent: resolved.maxInitialCanaryPercent,
        canaryCohortReady: resolved.canaryCohortReady,
        smokeBeforeCanaryPassed: resolved.smokeBeforeCanaryPassed,
        smokeReceiptId: options.smokeReceiptId || null,
      },
      rollbackAndObservability: {
        rollbackCheckpointReady: resolved.rollbackCheckpointReady,
        rollbackCheckpointId: options.rollbackCheckpointId || null,
        rollbackDryRunPassed: resolved.rollbackDryRunPassed,
        rollbackDryRunReceiptId: options.rollbackDryRunReceiptId || null,
        observabilityLive: resolved.observabilityLive,
        observabilityDashboardId: options.observabilityDashboardId || null,
        incidentCommanderAssigned: resolved.incidentCommanderAssigned,
        incidentCommanderId: options.incidentCommanderId || null,
        supportBridgeReady: resolved.supportBridgeReady,
        supportBridgeId: options.supportBridgeId || null,
        auditSinkReady: resolved.auditSinkReady,
        auditReceiptId: options.auditReceiptId || null,
      },
      safeguards: {
        autoExecuteEnabled: resolved.autoExecuteEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        skipCanaryEnabled: resolved.skipCanaryEnabled,
      },
      blockers,
      checks,
      audit: {
        sourceGeneratedAt: source.generatedAt,
        sourceRolloutPlanId: source.rolloutPlanId,
        actorId: options.actorId || null,
        reason: options.reason || null,
        executionGateReceiptId: options.executionGateReceiptId || null,
      },
      nextRecommendedPhase: {
        phase: '83',
        title: 'Capability Autopilot v1.1 Canary Monitoring And Promotion Gate',
        reason:
          'Depois da execucao manual gated, o proximo passo e monitorar o canary e decidir expandir, pausar ou acionar rollback.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-82',
        sourceSnapshotStatus: source.status,
        sourceRecommendation: source.recommendation,
        autoExecute: false,
        recommendation,
        releaseExecutionReady: status === 'release_execution_ready',
        releaseVersion: resolved.releaseVersion,
        releaseTag: resolved.releaseTag,
        initialCanaryPercent: resolved.initialCanaryPercent,
        autoExecuteEnabled: resolved.autoExecuteEnabled,
        globalRolloutEnabled: resolved.globalRolloutEnabled,
        skipCanaryEnabled: resolved.skipCanaryEnabled,
      },
    };
  }

  public renderReport(snapshot: CapabilityAutopilotReleaseExecutionSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-release-execution] Fase 82 - Capability Autopilot v1.1 Release Execution Gate');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`recommendation: ${snapshot.recommendation}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`release: ${snapshot.executionIntent.releaseTag || '<no-tag>'} (${snapshot.executionIntent.releaseVersion || '<no-version>'})`);
    lines.push(`canary: ${snapshot.canary.initialCanaryPercent}%/${snapshot.canary.maxInitialCanaryPercent}%`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveOptions(
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
    options: CapabilityAutopilotReleaseExecutionOptions,
  ): ResolvedOptions {
    const releaseVersion = this.resolveString(options.releaseVersion);
    const releaseTag = this.resolveString(options.releaseTag);

    return {
      releaseExecutionApproved: options.releaseExecutionApproved === true,
      manualOperatorPresent: options.manualOperatorPresent === true,
      releaseVersion,
      releaseTag,
      versionManifestReady: options.versionManifestReady === true,
      releaseBranchClean: options.releaseBranchClean === true,
      tagCreationApproved: options.tagCreationApproved === true,
      publishApproved: options.publishApproved === true,
      releaseBundleVerified: options.releaseBundleVerified === true,
      signedArtifactsReady: options.signedArtifactsReady === true,
      provenanceReady: options.provenanceReady === true,
      changelogFrozen: options.changelogFrozen === true,
      docsFrozen: options.docsFrozen === true,
      canaryLaunchApproved: options.canaryLaunchApproved === true,
      initialCanaryPercent: this.resolveNumber(options.initialCanaryPercent, source.rollout.canaryPercent),
      maxInitialCanaryPercent: this.resolveNumber(options.maxInitialCanaryPercent, source.rollout.canaryPercent),
      canaryCohortReady: options.canaryCohortReady === true,
      smokeBeforeCanaryPassed: options.smokeBeforeCanaryPassed === true,
      rollbackCheckpointReady: options.rollbackCheckpointReady === true,
      rollbackDryRunPassed: options.rollbackDryRunPassed === true,
      observabilityLive: options.observabilityLive === true,
      incidentCommanderAssigned: options.incidentCommanderAssigned === true,
      supportBridgeReady: options.supportBridgeReady === true,
      auditSinkReady: options.auditSinkReady === true,
      autoExecuteEnabled: options.autoExecuteEnabled === true,
      globalRolloutEnabled: options.globalRolloutEnabled === true,
      skipCanaryEnabled: options.skipCanaryEnabled === true,
    };
  }

  private resolveString(value: string | null | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private resolveNumber(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private resolveBlockers(
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
    options: ResolvedOptions,
  ): string[] {
    const blockers: string[] = [];
    if (
      source.status !== 'rollout_plan_ready' ||
      source.recommendation !== 'prepare_manual_v1_1_rollout' ||
      !source.summary.ok
    ) {
      blockers.push(`source_rollout_plan_not_ready:${source.status}`);
    }
    if (!options.releaseExecutionApproved) {
      blockers.push('release_execution_approval_required');
    }
    if (!options.manualOperatorPresent) {
      blockers.push('manual_operator_required');
    }
    if (!options.releaseVersion) {
      blockers.push('release_version_required');
    }
    if (!options.releaseTag) {
      blockers.push('release_tag_required');
    }
    if (options.releaseVersion && options.releaseTag && !options.releaseTag.includes(options.releaseVersion)) {
      blockers.push('release_tag_version_mismatch');
    }
    if (!options.versionManifestReady) {
      blockers.push('version_manifest_required');
    }
    if (!options.releaseBranchClean) {
      blockers.push('release_branch_clean_required');
    }
    if (!options.tagCreationApproved) {
      blockers.push('tag_creation_approval_required');
    }
    if (!options.publishApproved) {
      blockers.push('publish_approval_required');
    }
    if (!options.releaseBundleVerified) {
      blockers.push('release_bundle_verification_required');
    }
    if (!options.signedArtifactsReady) {
      blockers.push('signed_artifacts_required');
    }
    if (!options.provenanceReady) {
      blockers.push('provenance_required');
    }
    if (!options.changelogFrozen) {
      blockers.push('changelog_freeze_required');
    }
    if (!options.docsFrozen) {
      blockers.push('docs_freeze_required');
    }
    if (!options.canaryLaunchApproved) {
      blockers.push('canary_launch_approval_required');
    }
    if (!this.isInitialCanarySafe(options, source)) {
      blockers.push('initial_canary_percent_out_of_bounds');
    }
    if (!options.canaryCohortReady) {
      blockers.push('canary_cohort_required');
    }
    if (!options.smokeBeforeCanaryPassed) {
      blockers.push('pre_canary_smoke_required');
    }
    if (!options.rollbackCheckpointReady) {
      blockers.push('rollback_checkpoint_required');
    }
    if (!options.rollbackDryRunPassed) {
      blockers.push('rollback_dry_run_required');
    }
    if (!options.observabilityLive) {
      blockers.push('observability_live_required');
    }
    if (!options.incidentCommanderAssigned) {
      blockers.push('incident_commander_required');
    }
    if (!options.supportBridgeReady) {
      blockers.push('support_bridge_required');
    }
    if (!options.auditSinkReady) {
      blockers.push('audit_sink_required');
    }
    if (options.autoExecuteEnabled) {
      blockers.push('auto_execute_not_allowed');
    }
    if (options.globalRolloutEnabled) {
      blockers.push('global_rollout_not_allowed');
    }
    if (options.skipCanaryEnabled) {
      blockers.push('skip_canary_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
    options: ResolvedOptions,
    blockers: string[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source });

    return [
      this.check(
        'capability-autopilot-release-execution:source-ready',
        'rollout plan source ready',
        source.status === 'rollout_plan_ready' && source.recommendation === 'prepare_manual_v1_1_rollout' && source.summary.ok ? 'pass' : 'fail',
        'Release execution so pode partir de rollout plan pronto.',
        [
          `sourceStatus=${source.status}`,
          `sourceRecommendation=${source.recommendation}`,
          `sourceOk=${source.summary.ok}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:manual-intent',
        'intencao de execucao manual aprovada',
        options.releaseExecutionApproved &&
          options.manualOperatorPresent &&
          Boolean(options.releaseVersion) &&
          Boolean(options.releaseTag) &&
          options.versionManifestReady &&
          options.releaseBranchClean
          ? 'pass'
          : 'fail',
        'Execucao exige aprovacao manual, operador presente, versao/tag, manifesto e branch limpa.',
        [
          `releaseExecutionApproved=${options.releaseExecutionApproved}`,
          `manualOperatorPresent=${options.manualOperatorPresent}`,
          `releaseVersion=${options.releaseVersion || '<none>'}`,
          `releaseTag=${options.releaseTag || '<none>'}`,
          `versionManifestReady=${options.versionManifestReady}`,
          `releaseBranchClean=${options.releaseBranchClean}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:tag-publish-gate',
        'tag e publish explicitamente aprovados',
        options.tagCreationApproved &&
          options.publishApproved &&
          options.releaseBundleVerified &&
          options.signedArtifactsReady &&
          options.provenanceReady &&
          options.changelogFrozen &&
          options.docsFrozen
          ? 'pass'
          : 'fail',
        'Execucao exige approvals de tag/publish e assets imutaveis verificados.',
        [
          `tagCreationApproved=${options.tagCreationApproved}`,
          `publishApproved=${options.publishApproved}`,
          `releaseBundleVerified=${options.releaseBundleVerified}`,
          `signedArtifactsReady=${options.signedArtifactsReady}`,
          `provenanceReady=${options.provenanceReady}`,
          `changelogFrozen=${options.changelogFrozen}`,
          `docsFrozen=${options.docsFrozen}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:canary',
        'canary inicial seguro',
        options.canaryLaunchApproved &&
          this.isInitialCanarySafe(options, source) &&
          options.canaryCohortReady &&
          options.smokeBeforeCanaryPassed
          ? 'pass'
          : 'fail',
        'Execucao precisa iniciar por canary limitado, com coorte pronta e smoke antes do canary.',
        [
          `canaryLaunchApproved=${options.canaryLaunchApproved}`,
          `initialCanaryPercent=${options.initialCanaryPercent}`,
          `maxInitialCanaryPercent=${options.maxInitialCanaryPercent}`,
          `sourceCanaryPercent=${source.rollout.canaryPercent}`,
          `canaryCohortReady=${options.canaryCohortReady}`,
          `smokeBeforeCanaryPassed=${options.smokeBeforeCanaryPassed}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:rollback-observability',
        'rollback e observabilidade prontos',
        options.rollbackCheckpointReady &&
          options.rollbackDryRunPassed &&
          options.observabilityLive &&
          options.incidentCommanderAssigned &&
          options.supportBridgeReady &&
          options.auditSinkReady
          ? 'pass'
          : 'fail',
        'Execucao exige checkpoint, rollback dry-run, dashboards, incident commander, suporte e audit sink.',
        [
          `rollbackCheckpointReady=${options.rollbackCheckpointReady}`,
          `rollbackDryRunPassed=${options.rollbackDryRunPassed}`,
          `observabilityLive=${options.observabilityLive}`,
          `incidentCommanderAssigned=${options.incidentCommanderAssigned}`,
          `supportBridgeReady=${options.supportBridgeReady}`,
          `auditSinkReady=${options.auditSinkReady}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:safeguards',
        'sem automacao ampla',
        !options.autoExecuteEnabled && !options.globalRolloutEnabled && !options.skipCanaryEnabled ? 'pass' : 'fail',
        'A Fase 82 permite execucao manual gated, mas bloqueia auto-execute, rollout global e skip-canary.',
        [
          `autoExecuteEnabled=${options.autoExecuteEnabled}`,
          `globalRolloutEnabled=${options.globalRolloutEnabled}`,
          `skipCanaryEnabled=${options.skipCanaryEnabled}`,
        ],
      ),
      this.check(
        'capability-autopilot-release-execution:no-blockers',
        'sem blockers de execucao',
        blockers.length === 0 ? 'pass' : 'fail',
        'Nao pode haver blocker agregado para liberar execucao manual v1.1.',
        blockers.length > 0 ? blockers : ['blockers=0'],
      ),
      this.check(
        'capability-autopilot-release-execution:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshot publico de execucao nao pode reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private isInitialCanarySafe(
    options: ResolvedOptions,
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
  ): boolean {
    return options.initialCanaryPercent > 0 &&
      options.maxInitialCanaryPercent > 0 &&
      options.initialCanaryPercent <= options.maxInitialCanaryPercent &&
      options.initialCanaryPercent <= source.rollout.canaryPercent;
  }

  private buildExecutionGateId(
    source: CapabilityAutopilotReleaseRolloutPlanSnapshot,
    generatedAt: string,
    executionGateReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        source.capabilityId,
        source.phase,
        source.rolloutPlanId,
        source.generatedAt,
        generatedAt,
        executionGateReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${source.capabilityId}-release-execution-${digest}`;
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
