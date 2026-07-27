import type { DynamicHierarchyLaunchResult } from '../../domain/execution/infrastructure/DynamicHierarchySwarmService.js';
import type { SelfModificationPreviewResult } from '../../services/SelfModificationCommandService.js';
import type { WatchModeRunSnapshot } from '../../services/ComputerUseWatchModeService.js';
import type { TrustSliderLevel, TrustSliderPolicyDecision, UniversalIntentUserRole } from '../uni/UniversalIntentContracts.js';
import type { CapabilityNegotiationSnapshot } from './CapabilityNegotiationService.js';
import type { ToolRehearsalSnapshot } from './ToolRehearsalService.js';
import type { UniversalAgentExecutor, UniversalAgentRequest, UniversalAgentRun, UniversalAgentRunResult, UniversalApprovalRequest } from './UniversalAgentRuntimeTypes.js';
import { type AgentRunFlowHost, hasRequestedTool, normalizeStringList, normalizeText, recordOrNull } from './AgentRunSpecializedFlowUtils.js';

export function installAgentRunEvidenceFlows(AgentRunServiceClass: { prototype: AgentRunFlowHost }): void {
  const proto = AgentRunServiceClass.prototype;

  proto.applyProviderArena = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    const snapshot = this.providerArena.buildSnapshot({
      run,
      modelPickerContract: this.readModelPickerContractForProviderArena(),
      generatedAt,
    });
    if (!snapshot.summary.hasProviderEvidence && !recordOrNull(run.metadata.providerArena)) {
      return null;
    }
    run.metadata = {
      ...run.metadata,
      providerArena: snapshot,
    };
    return snapshot;
  };

  proto.applyProviderMeshConsolidation = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'providerMeshConsolidation', () => (
      this.providerMeshConsolidation.buildSnapshot({
        run,
        modelPickerContract: this.readModelPickerContractForProviderArena(),
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        providerMeshConsolidation: snapshot,
      };
    });
  };

  proto.applyArtifactMemory = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'artifactMemory', () => (
      this.artifactMemory.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        artifactMemory: snapshot,
      };
    });
  };

  proto.applyPersonalOpsAutopilot = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'personalOpsAutopilot', () => (
      this.personalOpsAutopilot.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        personalOpsAutopilot: snapshot,
      };
    });
  };

  proto.applyAgentTeamCompiler = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'agentTeamCompiler', () => (
      this.agentTeamCompiler.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        agentTeamCompiler: snapshot,
      };
    });
  };

  proto.applyAskBeforeAssumptionPolicy = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'askBeforeAssumptionPolicy', () => (
      this.askBeforeAssumptionPolicy.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        askBeforeAssumptionPolicy: snapshot,
      };
    });
  };

  proto.applyCrossChannelContinuity = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'crossChannelContinuity', () => (
      this.crossChannelContinuity.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        crossChannelContinuity: snapshot,
      };
    });
  };

  proto.applySelfingZavorthControl = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'selfingZavorthControl', () => (
      this.selfingZavorthControl.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        selfingZavorthControl: snapshot,
      };
    });
  };

  proto.applyRunArtifactReceiptReplay = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'runArtifactReceiptReplay', () => (
      this.runArtifactReceiptReplay.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        runArtifactReceiptReplay: snapshot,
      };
    });
  };

  proto.applyProductizationEvidence = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'productizationEvidence', () => (
      this.productizationEvidence.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        productizationEvidence: snapshot,
      };
    });
  };

  proto.applyProductEntryRuntime = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'productEntryRuntime', () => (
      this.productEntryRuntime.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        productEntryRuntime: snapshot,
      };
    });
  };

  proto.applyReleaseInstallerRollbackPath = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'releaseInstallerRollbackPath', () => (
      this.releaseInstallerRollbackPath.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        releaseInstallerRollbackPath: snapshot,
      };
    });
  };

  proto.applyPublicSiteDocsDemoSync = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'publicSiteDocsDemoSync', () => (
      this.publicSiteDocsDemoSync.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        publicSiteDocsDemoSync: snapshot,
      };
    });
  };

  proto.applyFeedbackTelemetryProductLoop = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'feedbackTelemetryProductLoop', () => (
      this.feedbackTelemetryProductLoop.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        feedbackTelemetryProductLoop: snapshot,
      };
    });
  };

  proto.applyPublicAdoptionPilotLoop = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'publicAdoptionPilotLoop', () => (
      this.publicAdoptionPilotLoop.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        publicAdoptionPilotLoop: snapshot,
      };
    });
  };

  proto.applyIntegrationShowcasePartnerSurface = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'integrationShowcasePartnerSurface', () => (
      this.integrationShowcasePartnerSurface.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        integrationShowcasePartnerSurface: snapshot,
      };
    });
  };

  proto.applyReleaseAdoptionReadiness = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'releaseAdoptionReadiness', () => (
      this.releaseAdoptionReadiness.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        releaseAdoptionReadiness: snapshot,
      };
    });
  };

  proto.applyReleaseCandidatePreCanaryGate = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'releaseCandidatePreCanaryGate', () => (
      this.releaseCandidatePreCanaryGate.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        releaseCandidatePreCanaryGate: snapshot,
      };
    });
  };

  proto.applyBlueprintCompletionGate = function (this: AgentRunFlowHost,
    run: UniversalAgentRun,
    generatedAt: string = run.updatedAt || this.now().toISOString(),
  ) {
    return this.applyCachedEvidenceSnapshot(run, 'blueprintCompletionGate', () => (
      this.blueprintCompletionGate.buildSnapshot({
        run,
        generatedAt,
      })
    ), (snapshot: Record<string, unknown>) => {
      run.metadata = {
        ...run.metadata,
        blueprintCompletionGate: snapshot,
      };
    });
  };
}
