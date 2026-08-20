import type { ZavorthCliFlags, ZavorthCliRuntime, CliExecutionResult, CliWriter } from './ZavorthCliContract.js';
import type { UniversalAgentRun } from '../runtime/agent/index.js';
import {
  buildOperationalSecurityDoctorReport,
  formatOperationalSecurityDoctorReport,
} from '../security/OperationalSecurityDoctor.js';
import {
  buildContinuousSecurityMonitorReport,
  formatContinuousSecurityMonitorReport,
  writeContinuousSecurityBaseline,
} from '../security/ContinuousSecurityMonitor.js';
import {
  applySecurityOperationalPreset,
  formatApplySecurityOperationalPresetResult,
  formatSecurityOperationalPresetInspection,
  formatSecurityOperationalPresetList,
  getSecurityOperationalPreset,
  inspectSecurityOperationalPreset,
  listSecurityOperationalPresets,
} from '../security/SecurityOperationalPreset.js';
import { FirstRunOnboardingContractService } from '../services/FirstRunOnboardingContractService.js';
import { formatZavorthProductizationContractSnapshot } from './ZavorthCliProductizationRenderer.js';
import {
  formatNaturalCapabilityDiscoverySnapshot,
  resolveCapabilityDiscoveryCliText,
} from './ZavorthCliCapabilityDiscoveryRenderer.js';
import { NaturalCapabilityDiscoveryService } from '../runtime/agent/index.js';
import {
  buildSafetyNarrativeCliSnapshot,
  formatSafetyNarrativeSnapshot,
  resolveSafetyNarrativeCliText,
} from './ZavorthCliSafetyNarrativeRenderer.js';
import {
  buildSkillMcpQuarantineCliSnapshot,
  buildSkillMcpQuarantineSnapshotFromRun,
  formatSkillMcpQuarantineSnapshot,
  resolveSkillMcpQuarantineCliText,
} from './ZavorthCliSkillMcpQuarantineRenderer.js';
import {
  buildProviderArenaCliSnapshot,
  buildProviderArenaSnapshotFromRun,
  formatProviderArenaSnapshot,
  resolveProviderArenaCliText,
} from './ZavorthCliProviderArenaRenderer.js';
import {
  buildCapabilityNegotiationCliSnapshot,
  buildCapabilityNegotiationSnapshotFromRun,
  formatCapabilityNegotiationSnapshot,
  resolveCapabilityNegotiationCliText,
} from './ZavorthCliCapabilityNegotiationRenderer.js';
import {
  buildToolRehearsalCliSnapshot,
  buildToolRehearsalSnapshotFromRun,
  formatToolRehearsalSnapshot,
  resolveToolRehearsalCliText,
} from './ZavorthCliToolRehearsalRenderer.js';
import {
  buildSelfConfigCliSnapshot,
  buildSelfConfigSnapshotFromRun,
  formatSelfConfigSnapshot,
  resolveSelfConfigCliText,
} from './ZavorthCliSelfConfigRenderer.js';
import {
  buildArtifactMemoryCliSnapshot,
  buildArtifactMemorySnapshotFromRun,
  formatArtifactMemorySnapshot,
  resolveArtifactMemoryCliText,
} from './ZavorthCliArtifactMemoryRenderer.js';
import {
  buildPersonalOpsAutopilotCliSnapshot,
  buildPersonalOpsAutopilotSnapshotFromRun,
  formatPersonalOpsAutopilotSnapshot,
  resolvePersonalOpsAutopilotCliText,
} from './ZavorthCliPersonalOpsAutopilotRenderer.js';
import {
  buildAgentTeamCompilerCliLaunchResult,
  buildAgentTeamCompilerCliSnapshot,
  buildAgentTeamCompilerLaunchResultFromRun,
  buildAgentTeamCompilerSnapshotFromRun,
  formatAgentTeamCompilerLaunchResult,
  formatAgentTeamCompilerSnapshot,
  resolveAgentTeamCompilerApprovalId,
  resolveAgentTeamCompilerCliAction,
  resolveAgentTeamCompilerCliText,
} from './ZavorthCliAgentTeamCompilerRenderer.js';
import {
  buildGovernedReviewCliSnapshotAsync,
  formatGovernedReviewSnapshot,
  shouldHandleReviewCommand,
} from './ZavorthCliGovernedReviewRenderer.js';
import {
  buildCrossChannelContinuityCliSnapshot,
  buildCrossChannelContinuitySnapshotFromRun,
  formatCrossChannelContinuitySnapshot,
  resolveCrossChannelContinuityCliText,
} from './ZavorthCliCrossChannelContinuityRenderer.js';
import {
  buildAskBeforeAssumptionPolicyCliSnapshot,
  buildAskBeforeAssumptionPolicySnapshotFromRun,
  formatAskBeforeAssumptionPolicySnapshot,
  resolveAskBeforeAssumptionPolicyCliText,
} from './ZavorthCliAskBeforeAssumptionPolicyRenderer.js';
import {
  buildProviderMeshConsolidationCliSnapshot,
  buildProviderMeshConsolidationSnapshotFromRun,
  formatProviderMeshConsolidationSnapshot,
  resolveProviderMeshConsolidationCliText,
} from './ZavorthCliProviderMeshConsolidationRenderer.js';
import {
  buildUniversalIntentTrustCliSnapshot,
  buildUniversalIntentTrustSnapshotFromRun,
  formatUniversalIntentTrustSnapshot,
  resolveUniversalIntentTrustCliText,
} from './ZavorthCliUniversalIntentTrustRenderer.js';
import {
  buildRunArtifactReceiptReplayCliSnapshot,
  buildRunArtifactReceiptReplaySnapshotFromRun,
  formatRunArtifactReceiptReplaySnapshot,
  resolveRunArtifactReceiptReplayCliText,
} from './ZavorthCliRunArtifactReceiptReplayRenderer.js';
import {
  buildProductizationEvidenceCliSnapshot,
  buildProductizationEvidenceSnapshotFromRun,
  formatProductizationEvidenceSnapshot,
  resolveProductizationEvidenceCliText,
} from './ZavorthCliProductizationEvidenceRenderer.js';
import {
  buildProductEntryRuntimeCliSnapshot,
  buildProductEntryRuntimeSnapshotFromRun,
  formatProductEntryRuntimeSnapshot,
  resolveProductEntryRuntimeCliText,
} from './ZavorthCliProductEntryRuntimeRenderer.js';
import {
  buildReleaseInstallerRollbackCliSnapshot,
  buildReleaseInstallerRollbackSnapshotFromRun,
  formatReleaseInstallerRollbackSnapshot,
  resolveReleaseInstallerRollbackCliText,
} from './ZavorthCliReleaseInstallerRollbackRenderer.js';
import {
  buildPublicSiteDocsDemoSyncCliSnapshot,
  buildPublicSiteDocsDemoSyncSnapshotFromRun,
  formatPublicSiteDocsDemoSyncSnapshot,
  resolvePublicSiteDocsDemoSyncCliText,
} from './ZavorthCliPublicSiteDocsDemoSyncRenderer.js';
import {
  buildFeedbackTelemetryProductLoopCliSnapshot,
  buildFeedbackTelemetryProductLoopSnapshotFromRun,
  formatFeedbackTelemetryProductLoopSnapshot,
  resolveFeedbackTelemetryProductLoopCliText,
} from './ZavorthCliFeedbackTelemetryProductLoopRenderer.js';
import {
  buildPublicAdoptionPilotLoopCliSnapshot,
  buildPublicAdoptionPilotLoopSnapshotFromRun,
  formatPublicAdoptionPilotLoopSnapshot,
  resolvePublicAdoptionPilotLoopCliText,
} from './ZavorthCliPublicAdoptionPilotLoopRenderer.js';
import {
  buildIntegrationShowcasePartnerSurfaceCliSnapshot,
  buildIntegrationShowcasePartnerSurfaceSnapshotFromRun,
  formatIntegrationShowcasePartnerSurfaceSnapshot,
  resolveIntegrationShowcasePartnerSurfaceCliText,
} from './ZavorthCliIntegrationShowcasePartnerSurfaceRenderer.js';
import {
  buildReleaseAdoptionReadinessCliSnapshot,
  buildReleaseAdoptionReadinessSnapshotFromRun,
  formatReleaseAdoptionReadinessSnapshot,
  resolveReleaseAdoptionReadinessCliText,
} from './ZavorthCliReleaseAdoptionReadinessRenderer.js';
import {
  buildReleaseCandidatePreCanaryGateCliSnapshot,
  buildReleaseCandidatePreCanaryGateSnapshotFromRun,
  formatReleaseCandidatePreCanaryGateSnapshot,
  resolveReleaseCandidatePreCanaryGateCliText,
} from './ZavorthCliReleaseCandidatePreCanaryGateRenderer.js';
import {
  buildBlueprintCompletionCliSnapshot,
  buildBlueprintCompletionSnapshotFromRun,
  formatBlueprintCompletionSnapshot,
  resolveBlueprintCompletionCliText,
} from './ZavorthCliBlueprintCompletionRenderer.js';
import { logger } from '../logger.js';



import { WebsitePublicContractService } from '../services/WebsitePublicContractService.js';
import { ZavorthProductizationContractService } from '../services/ZavorthProductizationContractService.js';
import { ZavorthSandboxControlPlaneService } from '../services/ZavorthSandboxControlPlaneService.js';
import {
  buildCliOperationsCockpitSnapshot,
  formatCliOperationsCockpitSnapshot,
} from './ZavorthCliOperationsCockpit.js';

import {
  formatRunObservatorySnapshot,
  resolveRunObservatoryCliQuery,
} from './ZavorthCliRunObservatoryRenderer.js';


import {
  buildUniversalPreviewCliSnapshot,
  formatUniversalPreviewModeSnapshot,
  resolveUniversalPreviewCliText,
} from './ZavorthCliUniversalPreviewRenderer.js';

























import * as cliNative from './ZavorthCliNativeRenderers.js';
import * as surfaceHelpers from './ZavorthCliSurfaceHelpers.js';
import { resolveOperationsIntent } from './ZavorthCliCommandHelpers.js';
const {
  buildCliContextSnapshot,
  buildCliHelpSnapshot,
  buildCliDomainsSnapshot,
  buildCliOperationsDoctorSnapshot,
  buildCliRuntimeAccessProbeInput,
  buildCliStatusSnapshot,
  formatAutoRepairRunResult,
  formatCliContextSnapshot,
  formatCliDomainsSnapshot,
  formatCliHelp,
  formatCliOperationsDoctorSnapshot,
  formatCliOpsQualitySnapshot,
  formatCliStatusSnapshot,
  formatOperationsActionDefinitions,
  formatOperationsActionExecution,
  formatOperatorBriefSnapshot,
  formatRuntimeAccessReadinessReport,
  formatRuntimeBootstrapRepairReport,
  formatRuntimeBootstrapReport,
  formatSupervisedReloadResult,
  readCliBriefSnapshot,
  readCliCockpitSnapshot,
  readCliOpsQualitySnapshot,
} = cliNative;

const { formatGatewaySnapshot } = surfaceHelpers;


import {
buildGatewayControlCliPayload,
  formatGatewayControlCliPayload,
  resolveGatewayControlCliCommand,
} from './ZavorthCliGatewayControl.js';

type RegistryCommandParams = {
  runtime: ZavorthCliRuntime;
  effectiveFlags: ZavorthCliFlags;
  commandName: string | null;
  normalized: string;
  args: string;
  writer: CliWriter;
};

export async function handleZavorthCliRegistryOpsCommand(params: RegistryCommandParams): Promise<CliExecutionResult | null> {
  const { runtime, effectiveFlags, commandName, args, writer } = params;

  if (commandName === 'status') {
    const snapshot = await buildCliStatusSnapshot(runtime, effectiveFlags);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCliStatusSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'domains') {
    const snapshot = buildCliDomainsSnapshot(runtime, /^\s*full\b/i.test(args));
    if (!snapshot) {
      const error = 'Domain plane unavailable in this runtime da CLI.';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCliDomainsSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'gateway') {
    const gatewayControlCommand = resolveGatewayControlCliCommand(args);
    if (gatewayControlCommand) {
      if (!runtime.gatewayControlService) {
        const error = 'Gateway Control API unavailable in this runtime da CLI.';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const snapshot = runtime.gatewayControlService.buildGatewayControlApiSnapshot();
      const payload = buildGatewayControlCliPayload(snapshot, gatewayControlCommand);
      const body = effectiveFlags.json
        ? JSON.stringify(payload, null, 2)
        : formatGatewayControlCliPayload(payload, gatewayControlCommand.mode);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const snapshot = await runtime.gatewayService.buildHydratedSnapshot({
      userId: effectiveFlags.userId,
      chatId: effectiveFlags.chatId,
      sessionId: effectiveFlags.sessionId,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatGatewaySnapshot(snapshot);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'productization' || commandName === 'product') {
    const snapshot = buildCliProductizationContractSnapshot(runtime, effectiveFlags);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatZavorthProductizationContractSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'productization-evidence'
    || commandName === 'product-evidence'
    || commandName === 'release-readiness'
    || commandName === 'release-evidence'
    || commandName === 'readiness'
    || commandName === 'ship-readiness'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildProductizationEvidenceSnapshotFromRun(activeRun)
      : buildProductizationEvidenceCliSnapshot({
        text: resolveProductizationEvidenceCliText(args) || resolveProductizationEvidenceCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatProductizationEvidenceSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'product-entry'
    || commandName === 'entry'
    || commandName === 'first-run-runtime'
    || commandName === 'first-run-state'
    || commandName === 'start-runtime'
    || commandName === 'first-run'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildProductEntryRuntimeSnapshotFromRun(activeRun)
      : buildProductEntryRuntimeCliSnapshot({
        text: resolveProductEntryRuntimeCliText(args) || resolveProductEntryRuntimeCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatProductEntryRuntimeSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'release-path'
    || commandName === 'release-installer'
    || commandName === 'installer-rollback'
    || commandName === 'release-readiness-path'
    || commandName === 'rollback-path'
    || commandName === 'release-runtime'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildReleaseInstallerRollbackSnapshotFromRun(activeRun)
      : buildReleaseInstallerRollbackCliSnapshot({
        text: resolveReleaseInstallerRollbackCliText(args) || resolveReleaseInstallerRollbackCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatReleaseInstallerRollbackSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'public-sync'
    || commandName === 'site-docs-demo'
    || commandName === 'public-site-sync'
    || commandName === 'docs-demo-sync'
    || commandName === 'public-product-sync'
    || commandName === 'public-runtime'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildPublicSiteDocsDemoSyncSnapshotFromRun(activeRun)
      : buildPublicSiteDocsDemoSyncCliSnapshot({
        text: resolvePublicSiteDocsDemoSyncCliText(args) || resolvePublicSiteDocsDemoSyncCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatPublicSiteDocsDemoSyncSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'feedback-product-loop'
    || commandName === 'feedback-runtime'
    || commandName === 'telemetry-opt-in'
    || commandName === 'product-loop'
    || commandName === 'feedback-loop-runtime'
    || commandName === 'feedback-sync'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildFeedbackTelemetryProductLoopSnapshotFromRun(activeRun)
      : buildFeedbackTelemetryProductLoopCliSnapshot({
        text: resolveFeedbackTelemetryProductLoopCliText(args) || resolveFeedbackTelemetryProductLoopCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatFeedbackTelemetryProductLoopSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'public-adoption-pilot-loop'
    || commandName === 'pilot-loop-runtime'
    || commandName === 'pilot-feedback-loop'
    || commandName === 'public-pilot-loop'
    || commandName === 'adoption-pilot'
    || commandName === 'support-pilot-loop'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildPublicAdoptionPilotLoopSnapshotFromRun(activeRun)
      : buildPublicAdoptionPilotLoopCliSnapshot({
        text: resolvePublicAdoptionPilotLoopCliText(args) || resolvePublicAdoptionPilotLoopCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatPublicAdoptionPilotLoopSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'integration-showcase-partner-surface'
    || commandName === 'integration-showcase-runtime'
    || commandName === 'partner-surface'
    || commandName === 'integration-partner-surface'
    || commandName === 'showcase-partners'
    || commandName === 'integration-runtime'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildIntegrationShowcasePartnerSurfaceSnapshotFromRun(activeRun)
      : buildIntegrationShowcasePartnerSurfaceCliSnapshot({
        text: resolveIntegrationShowcasePartnerSurfaceCliText(args) || resolveIntegrationShowcasePartnerSurfaceCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatIntegrationShowcasePartnerSurfaceSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'release-adoption-readiness'
    || commandName === 'release-adoption'
    || commandName === 'adoption-readiness'
    || commandName === 'release-readiness'
    || commandName === 'public-adoption-readiness'
    || commandName === 'release-lts'
    || commandName === 'support-readiness'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildReleaseAdoptionReadinessSnapshotFromRun(activeRun)
      : buildReleaseAdoptionReadinessCliSnapshot({
        text: resolveReleaseAdoptionReadinessCliText(args) || resolveReleaseAdoptionReadinessCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatReleaseAdoptionReadinessSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'release-candidate-pre-canary'
    || commandName === 'pre-canary-gate'
    || commandName === 'rc-pre-canary'
    || commandName === 'release-candidate-gate'
    || commandName === 'go-no-go'
    || commandName === 'precanary'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildReleaseCandidatePreCanaryGateSnapshotFromRun(activeRun)
      : buildReleaseCandidatePreCanaryGateCliSnapshot({
        text: resolveReleaseCandidatePreCanaryGateCliText(args) || resolveReleaseCandidatePreCanaryGateCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatReleaseCandidatePreCanaryGateSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'blueprint-completion'
    || commandName === 'blueprint-complete'
    || commandName === 'blueprint-final'
    || commandName === 'runtime-completion'
    || commandName === 'final-gate'
    || commandName === 'complete-blueprint'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildBlueprintCompletionSnapshotFromRun(activeRun)
      : buildBlueprintCompletionCliSnapshot({
        text: resolveBlueprintCompletionCliText(args) || resolveBlueprintCompletionCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatBlueprintCompletionSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'observatory' || commandName === 'runs') {
    if (!runtime.agentGateway) {
      const error = 'Run Observatory unavailable: agent gateway is not attached to this CLI runtime.';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const query = resolveRunObservatoryCliQuery(args);
    const snapshot = runtime.agentGateway.buildSnapshot({
      activeRunId: query.runId,
      activeTraceId: query.traceId,
      activeSessionId: query.sessionId,
      runStatus: query.status,
      runLimit: query.limit ?? 50,
    }).runObservatory;
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatRunObservatorySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'discover' || commandName === 'capability-discovery') {
    const text = resolveCapabilityDiscoveryCliText(args) || resolveCapabilityDiscoveryCliText(String(effectiveFlags.commandText || ''));
    const snapshot = new NaturalCapabilityDiscoveryService().discover({
      text,
      surface: 'cli',
      requestedTools: [],
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatNaturalCapabilityDiscoverySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'preview' || commandName === 'universal-preview') {
    const text = resolveUniversalPreviewCliText(args) || resolveUniversalPreviewCliText(String(effectiveFlags.commandText || ''));
    const snapshot = buildUniversalPreviewCliSnapshot({
      text,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatUniversalPreviewModeSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'safety' || commandName === 'safety-narrative') {
    const text = resolveSafetyNarrativeCliText(args) || resolveSafetyNarrativeCliText(String(effectiveFlags.commandText || ''));
    const snapshot = buildSafetyNarrativeCliSnapshot({
      text,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatSafetyNarrativeSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'quarantine' || commandName === 'skill-mcp-quarantine') {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildSkillMcpQuarantineSnapshotFromRun(activeRun)
      : buildSkillMcpQuarantineCliSnapshot({
        text: resolveSkillMcpQuarantineCliText(args) || resolveSkillMcpQuarantineCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatSkillMcpQuarantineSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'provider-eval' ||
    commandName === 'eval' ||
    commandName === 'benchmark' ||
    commandName === 'arena' ||
    commandName === 'provider-arena'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildProviderArenaSnapshotFromRun(activeRun)
      : buildProviderArenaCliSnapshot({
        text: resolveProviderArenaCliText(args) || resolveProviderArenaCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatProviderArenaSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'negotiate' || commandName === 'capability-negotiation') {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildCapabilityNegotiationSnapshotFromRun(activeRun)
      : buildCapabilityNegotiationCliSnapshot({
        text: resolveCapabilityNegotiationCliText(args) || resolveCapabilityNegotiationCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCapabilityNegotiationSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'rehearse' || commandName === 'tool-rehearsal') {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildToolRehearsalSnapshotFromRun(activeRun)
      : buildToolRehearsalCliSnapshot({
        text: resolveToolRehearsalCliText(args) || resolveToolRehearsalCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatToolRehearsalSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'self-config' ||
    commandName === 'self-configuration' ||
    commandName === 'config' ||
    commandName === 'selfing' ||
    commandName === 'self'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildSelfConfigSnapshotFromRun(activeRun)
      : buildSelfConfigCliSnapshot({
        text: resolveSelfConfigCliText(args) || resolveSelfConfigCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatSelfConfigSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'artifact-memory'
    || commandName === 'artifacts-memory'
    || commandName === 'memory-artifacts'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildArtifactMemorySnapshotFromRun(activeRun)
      : buildArtifactMemoryCliSnapshot({
        text: resolveArtifactMemoryCliText(args) || resolveArtifactMemoryCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatArtifactMemorySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'personal-ops'
    || commandName === 'ops-autopilot'
    || commandName === 'autopilot'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildPersonalOpsAutopilotSnapshotFromRun(activeRun)
      : buildPersonalOpsAutopilotCliSnapshot({
        text: resolvePersonalOpsAutopilotCliText(args) || resolvePersonalOpsAutopilotCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatPersonalOpsAutopilotSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'governed-review'
    || commandName === 'review-kernel'
    || commandName === 'github-review'
    || commandName === 'code-review'
    || commandName === 'security-review'
    || commandName === 'policy-review'
    || commandName === 'regression-review'
    || shouldHandleReviewCommand(commandName, args)
  ) {
    const snapshot = await buildGovernedReviewCliSnapshotAsync({
      commandName,
      args,
      userId: effectiveFlags.userId,
      sessionId: effectiveFlags.sessionId,
      workspace: effectiveFlags.workspaceHint,
    });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatGovernedReviewSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'agent-team'
    || commandName === 'team-compiler'
    || commandName === 'compile-team'
    || commandName === 'team'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildAgentTeamCompilerSnapshotFromRun(activeRun)
      : buildAgentTeamCompilerCliSnapshot({
        text: resolveAgentTeamCompilerCliText(args) || resolveAgentTeamCompilerCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const action = resolveAgentTeamCompilerCliAction(args);
    if (action === 'launch') {
      const approvalId = resolveAgentTeamCompilerApprovalId(args);
      const launchResult = activeRun
        ? buildAgentTeamCompilerLaunchResultFromRun(activeRun, approvalId)
        : buildAgentTeamCompilerCliLaunchResult({
          text: resolveAgentTeamCompilerCliText(args) || resolveAgentTeamCompilerCliText(String(effectiveFlags.commandText || '')),
          userId: effectiveFlags.userId,
          sessionId: effectiveFlags.sessionId,
          approvalId,
        });
      const body = effectiveFlags.json
        ? JSON.stringify(launchResult, null, 2)
        : formatAgentTeamCompilerLaunchResult(launchResult);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (action === 'inspect' || action === 'synthesize') {
      const error = `Action "${action}" has not been implemented for agent-team yet.`;
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatAgentTeamCompilerSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'continuity'
    || commandName === 'cross-channel'
    || commandName === 'channel-continuity'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildCrossChannelContinuitySnapshotFromRun(activeRun)
      : buildCrossChannelContinuityCliSnapshot({
        text: resolveCrossChannelContinuityCliText(args) || resolveCrossChannelContinuityCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCrossChannelContinuitySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'assumptions'
    || commandName === 'ask-before-assumption'
    || commandName === 'ask-policy'
    || commandName === 'ask-first'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildAskBeforeAssumptionPolicySnapshotFromRun(activeRun)
      : buildAskBeforeAssumptionPolicyCliSnapshot({
        text: resolveAskBeforeAssumptionPolicyCliText(args) || resolveAskBeforeAssumptionPolicyCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatAskBeforeAssumptionPolicySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'replay'
    || commandName === 'run-replay'
    || commandName === 'artifact-replay'
    || commandName === 'receipt-replay'
    || commandName === 'replay-hardening'
    || commandName === 'receipts'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildRunArtifactReceiptReplaySnapshotFromRun(activeRun)
      : buildRunArtifactReceiptReplayCliSnapshot({
        text: resolveRunArtifactReceiptReplayCliText(args) || resolveRunArtifactReceiptReplayCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatRunArtifactReceiptReplaySnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'uni'
    || commandName === 'universal-intent'
    || commandName === 'intent'
    || commandName === 'trust'
    || commandName === 'trust-slider'
    || commandName === 'trust-policy'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildUniversalIntentTrustSnapshotFromRun(activeRun)
      : buildUniversalIntentTrustCliSnapshot({
        text: resolveUniversalIntentTrustCliText(args) || resolveUniversalIntentTrustCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatUniversalIntentTrustSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (
    commandName === 'provider-mesh'
    || commandName === 'providers-mesh'
    || commandName === 'model-picker'
    || commandName === 'picker'
    || commandName === 'mesh'
  ) {
    const activeRun = resolveGatewayActiveRun(runtime, effectiveFlags.sessionId);
    const snapshot = activeRun
      ? buildProviderMeshConsolidationSnapshotFromRun(activeRun)
      : buildProviderMeshConsolidationCliSnapshot({
        text: resolveProviderMeshConsolidationCliText(args) || resolveProviderMeshConsolidationCliText(String(effectiveFlags.commandText || '')),
        userId: effectiveFlags.userId,
        sessionId: effectiveFlags.sessionId,
      });
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatProviderMeshConsolidationSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'brief' && runtime.operatorBriefService) {
    const snapshot = readCliBriefSnapshot(runtime, effectiveFlags.live);
    if (!snapshot) {
      const error = 'Briefing do operador unavailable in this runtime da CLI.';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatOperatorBriefSnapshot(snapshot);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  const securityDoctorTokens = String(args || '').trim().split(/\s+/).filter(Boolean);
  const securityDoctorAction = String(securityDoctorTokens[0] || (commandName === 'security' ? 'doctor' : '')).trim().toLowerCase();
  if (
    commandName === 'security'
    && ['continuous', 'monitor', 'baseline'].includes(securityDoctorAction)
  ) {
    if (securityDoctorAction === 'baseline' || securityDoctorTokens.includes('--update-baseline')) {
      const baseline = writeContinuousSecurityBaseline({
        workspace: effectiveFlags.workspaceHint,
        projectRoot: process.cwd(),
      });
      const body = effectiveFlags.json
        ? JSON.stringify({ ok: true, baseline }, null, 2)
        : [
            'Security baseline',
            '',
            'Baseline updated.',
            `updated at: ${baseline.updatedAt}`,
          ].join('\n');
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const report = buildContinuousSecurityMonitorReport({
      strict: securityDoctorTokens.includes('--strict') || securityDoctorTokens.includes('--require-pass'),
      requireBaseline: securityDoctorTokens.includes('--require-baseline'),
      workspace: effectiveFlags.workspaceHint,
      projectRoot: process.cwd(),
    });
    const body = effectiveFlags.json
      ? JSON.stringify(report, null, 2)
      : formatContinuousSecurityMonitorReport(report);
    writer.line(body);
    return { ok: report.ok, handled: true, output: [body], error: report.ok ? null : report.narrative.operatorSummary };
  }
  if (
    commandName === 'security'
    && ['preset', 'presets'].includes(securityDoctorAction)
  ) {
    const presetAction = String(securityDoctorTokens[1] || (securityDoctorAction === 'presets' ? 'list' : '')).trim().toLowerCase();
    if (!presetAction || presetAction === 'list') {
      const presets = listSecurityOperationalPresets();
      const body = effectiveFlags.json
        ? JSON.stringify({ presets }, null, 2)
        : formatSecurityOperationalPresetList();
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    if (presetAction === 'status') {
      const inspection = inspectSecurityOperationalPreset({ projectRoot: process.cwd() });
      const body = effectiveFlags.json
        ? JSON.stringify(inspection, null, 2)
        : formatSecurityOperationalPresetInspection(inspection);
      writer.line(body);
      return { ok: inspection.status === 'ready', handled: true, output: [body], error: inspection.status === 'ready' ? null : inspection.summary };
    }

    const preset = getSecurityOperationalPreset(presetAction);
    if (!preset) {
      const error = `Unknown security preset: ${presetAction}.`;
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }

    if (!securityDoctorTokens.includes('--apply') && !securityDoctorTokens.includes('apply')) {
      const body = effectiveFlags.json
        ? JSON.stringify({ preset }, null, 2)
        : [
            'Security preset preview',
            '',
            `${preset.id}: ${preset.label}`,
            `profile: ${preset.securityProfile}`,
            `MCP: ${preset.mcpPolicy.profile}`,
            `skills: ${preset.skillPolicy.defaultPolicy}`,
            preset.summary,
            '',
            `Apply: zavorth security preset ${preset.id} --apply`,
          ].join('\n');
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }

    const result = applySecurityOperationalPreset({
      preset: preset.id,
      projectRoot: process.cwd(),
      appliedBy: 'zavorth-runtime-cli',
    });
    const body = effectiveFlags.json
      ? JSON.stringify(result, null, 2)
      : formatApplySecurityOperationalPresetResult(result);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }
  if (
    (commandName === 'doctor' && ['security', 'security', 'security'].includes(securityDoctorAction))
    || (commandName === 'security' && ['doctor', 'status', 'check'].includes(securityDoctorAction))
  ) {
    const report = buildOperationalSecurityDoctorReport({
      strict: securityDoctorTokens.includes('--strict') || securityDoctorTokens.includes('--require-pass'),
      workspace: effectiveFlags.workspaceHint,
      projectRoot: process.cwd(),
    });
    const body = effectiveFlags.json
      ? JSON.stringify(report, null, 2)
      : formatOperationalSecurityDoctorReport(report);
    writer.line(body);
    return { ok: report.ok, handled: true, output: [body], error: report.ok ? null : report.narrative.operatorSummary };
  }

  if (commandName === 'doctor' && runtime.runtimeAccessReadinessService) {
    const probeInput = await buildCliRuntimeAccessProbeInput(runtime);
    const report = effectiveFlags.live && typeof runtime.runtimeAccessReadinessService.inspectLive === 'function'
      ? await runtime.runtimeAccessReadinessService.inspectLive(probeInput)
      : runtime.runtimeAccessReadinessService.inspect(probeInput);
    const snapshot = await buildCliOperationsDoctorSnapshot(report, runtime, effectiveFlags);
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCliOperationsDoctorSnapshot(snapshot);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'cockpit') {
    const opsIntent = resolveOperationsIntent(args);
    if (opsIntent.mode === 'brief' && runtime.operatorBriefService) {
      const snapshot = readCliBriefSnapshot(runtime, effectiveFlags.live, readCliCockpitSnapshot(runtime, effectiveFlags.live));
      if (!snapshot) {
        const error = 'Briefing operational unavailable in this runtime da CLI.';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatOperatorBriefSnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'doctor' && runtime.runtimeAccessReadinessService) {
      const probeInput = await buildCliRuntimeAccessProbeInput(runtime);
      const report = effectiveFlags.live && typeof runtime.runtimeAccessReadinessService.inspectLive === 'function'
        ? await runtime.runtimeAccessReadinessService.inspectLive(probeInput)
        : runtime.runtimeAccessReadinessService.inspect(probeInput);
      const snapshot = await buildCliOperationsDoctorSnapshot(report, runtime, effectiveFlags);
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatCliOperationsDoctorSnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'quality') {
      const snapshot = await readCliOpsQualitySnapshot(runtime, effectiveFlags);
      if (!snapshot) {
        const error = 'Ops quality unavailable in this runtime da CLI.';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const body = effectiveFlags.json
        ? JSON.stringify(snapshot, null, 2)
        : formatCliOpsQualitySnapshot(snapshot);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'actions' && runtime.operationsActionService) {
      const definitions = runtime.operationsActionService.listDefinitions();
      const body = effectiveFlags.json
        ? JSON.stringify(definitions, null, 2)
        : formatOperationsActionDefinitions(definitions);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'access' && runtime.runtimeAccessReadinessService) {
      const probeInput = await buildCliRuntimeAccessProbeInput(runtime);
      const report = effectiveFlags.live && typeof runtime.runtimeAccessReadinessService.inspectLive === 'function'
        ? await runtime.runtimeAccessReadinessService.inspectLive(probeInput)
        : runtime.runtimeAccessReadinessService.inspect(probeInput);
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatRuntimeAccessReadinessReport(report);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'bootstrap' && runtime.runtimeBootstrapService) {
      const report = runtime.runtimeBootstrapService.inspect();
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatRuntimeBootstrapReport(report);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'bootstrap-repair' && runtime.runtimeBootstrapRepairService) {
      const report = runtime.runtimeBootstrapRepairService.repair({ dryRun: opsIntent.dryRun });
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : formatRuntimeBootstrapRepairReport(report);
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'changes' && runtime.supervisedRuntimeService) {
      const inspection = runtime.supervisedRuntimeService.inspect();
      const body = effectiveFlags.json
        ? JSON.stringify(inspection, null, 2)
        : runtime.supervisedRuntimeService.summarizeRecentChanges();
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'reload' && runtime.supervisedRuntimeService) {
      const result = await runtime.supervisedRuntimeService.requestReload({
        reason: 'Reload requested via Zavorth CLI.',
        requestedBy: effectiveFlags.userId,
        notifyChatId: null,
        forceRestart: opsIntent.force,
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatSupervisedReloadResult(result);
      writer.line(body);
      return { ok: result.accepted, handled: true, output: [body], error: result.accepted ? null : result.summary };
    }
    if (opsIntent.mode === 'autorepair-status' && runtime.autoRepairService) {
      const report = runtime.autoRepairService.readLastReport();
      const body = effectiveFlags.json
        ? JSON.stringify(report, null, 2)
        : runtime.autoRepairService.summarizeLastRun();
      writer.line(body);
      return { ok: true, handled: true, output: [body], error: null };
    }
    if (opsIntent.mode === 'autorepair' && runtime.autoRepairService) {
      const result = await runtime.autoRepairService.run({
        reason: 'Autorepair requested via Zavorth CLI.',
        requestedBy: effectiveFlags.userId,
        dryRun: opsIntent.dryRun,
        force: opsIntent.force,
        goal: opsIntent.improve ? 'improve' : 'auto',
      });
      const body = effectiveFlags.json
        ? JSON.stringify(result, null, 2)
        : formatAutoRepairRunResult(result);
      writer.line(body);
      return { ok: result.success, handled: true, output: [body], error: result.success ? null : result.summary };
    }
    if (opsIntent.mode === 'run' && runtime.operationsActionService) {
      if (!opsIntent.actionId) {
        const error = 'Uso: ops run <actionId>';
        writer.error(error);
        return { ok: false, handled: true, output: [], error };
      }
      const execution = runtime.operationsActionService.execute(opsIntent.actionId);
      const body = effectiveFlags.json
        ? JSON.stringify(execution, null, 2)
        : formatOperationsActionExecution(execution);
      writer.line(body);
      return { ok: execution.status === 'started', handled: true, output: [body], error: execution.note };
    }
    const snapshot = await buildCliOperationsCockpitSnapshot(runtime, effectiveFlags);
    if (!snapshot) {
      const error = 'Cockpit operational unavailable in this runtime da CLI.';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const body = effectiveFlags.json
      ? JSON.stringify(snapshot, null, 2)
      : formatCliOperationsCockpitSnapshot(snapshot);

    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'actions' && runtime.operationsActionService) {
    const definitions = runtime.operationsActionService.listDefinitions();
    const body = effectiveFlags.json
      ? JSON.stringify(definitions, null, 2)
      : formatOperationsActionDefinitions(definitions);
    writer.line(body);
    return { ok: true, handled: true, output: [body], error: null };
  }

  if (commandName === 'action' && runtime.operationsActionService) {
    const actionId = args.trim();
    if (!actionId) {
      const error = 'Uso: action <actionId>';
      writer.error(error);
      return { ok: false, handled: true, output: [], error };
    }
    const execution = runtime.operationsActionService.execute(actionId);
    const body = effectiveFlags.json
      ? JSON.stringify(execution, null, 2)
      : formatOperationsActionExecution(execution);
    writer.line(body);
    return { ok: execution.status === 'started', handled: true, output: [body], error: execution.note };
  }

  return null;
}

function resolveGatewayActiveRun(runtime: ZavorthCliRuntime, sessionId: string): UniversalAgentRun | null {
  if (!runtime.agentGateway) return null;
  const snapshot = runtime.agentGateway.buildSnapshot({ activeSessionId: sessionId });
  if (snapshot.activeRun) return snapshot.activeRun;
  if (Array.isArray(snapshot.runs) && snapshot.runs.length > 0) {
    return snapshot.runs.find((run: UniversalAgentRun) => run?.sessionId === sessionId)
      ?? snapshot.runs[0]
      ?? null;
  }
  return null;
}


function buildCliProductizationContractSnapshot(
  runtime: ZavorthCliRuntime,
  flags: ZavorthCliFlags,
) {
  const gatewayControlApi = safeBuildSnapshot(() => runtime.gatewayControlService?.buildGatewayControlApiSnapshot() || null);
  const agentGatewaySnapshot = safeBuildSnapshot(() =>
    runtime.agentGateway?.buildSnapshot({
      activeSessionId: flags.sessionId,
      runLimit: 50,
    }) || null,
  );
  const firstRunSnapshot = safeBuildSnapshot(() => new FirstRunOnboardingContractService().buildSnapshot());
  const websiteSnapshot = safeBuildSnapshot(() => new WebsitePublicContractService().buildSnapshot());
  const sandboxSnapshot = safeBuildSnapshot(() => new ZavorthSandboxControlPlaneService().buildSnapshot());

  return new ZavorthProductizationContractService().buildSnapshot({
    runtimeSnapshot: {
      generatedAt: new Date().toISOString(),
      gatewayControlApi: gatewayControlApi || undefined,
      controlPlane: {
        preferredTransport: 'ws',
        availableTransports: ['http', 'sse', 'ws'],
        websocketPath: '/api/web/gateway/ws',
        ssePath: '/api/web/events',
        statePath: '/api/web/state',
        historyPath: '/api/web/gateway/sessions/history',
        sendPath: '/api/web/gateway/sessions/send',
        spawnPath: '/api/web/gateway/sessions/spawn',
        heartbeatIntervalMs: 15_000,
        reconnectStrategy: 'reuse-session-state',
        sessionId: flags.sessionId,
        chatId: flags.chatId,
      },
    },
    gatewayControlApi,
    agentGatewaySnapshot,
    firstRunSnapshot,
    websiteSnapshot,
    sandboxSnapshot,
  });
}

function safeBuildSnapshot<T>(factory: () => T): T | null {
  try {
    return factory();
  } catch (error: unknown) {logger.warn('[Zavorth Cli Registry Ops] connection failed', error); return null; }
}
