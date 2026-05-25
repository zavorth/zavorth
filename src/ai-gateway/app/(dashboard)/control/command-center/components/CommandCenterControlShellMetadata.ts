"use client";

export function buildCommandCenterActiveRunMetadata(
  activeRun: Record<string, any> | null | undefined,
): Record<string, any> {
  const metadata = activeRun?.metadata as Record<string, any> | null | undefined;

  return {
    capabilityDiscovery: metadata?.naturalCapabilityDiscovery || null,
    universalPreviewMode: metadata?.universalPreviewMode || null,
    capabilityNegotiation: metadata?.capabilityNegotiation || null,
    toolRehearsal: metadata?.toolRehearsal || null,
    safetyNarrative: metadata?.safetyNarrative || null,
    memoryWithReceipts: metadata?.memoryWithReceipts || null,
    selfingDashboard: metadata?.selfingDashboard || null,
    artifactMemory: metadata?.artifactMemory || null,
    personalOpsAutopilot: metadata?.personalOpsAutopilot || null,
    agentTeamCompiler: metadata?.agentTeamCompiler || null,
    crossChannelContinuity: metadata?.crossChannelContinuity || null,
    askBeforeAssumptionPolicy: metadata?.askBeforeAssumptionPolicy || null,
    providerMeshConsolidation: metadata?.providerMeshConsolidation || null,
    universalIntentTrustEnforcement: metadata?.universalIntentTrustEnforcement || null,
    runArtifactReceiptReplay: metadata?.runArtifactReceiptReplay || null,
    productizationEvidence: metadata?.productizationEvidence || null,
    productEntryRuntime: metadata?.productEntryRuntime || null,
    releaseInstallerRollbackPath: metadata?.releaseInstallerRollbackPath || null,
    publicSiteDocsDemoSync: metadata?.publicSiteDocsDemoSync || null,
    feedbackTelemetryProductLoop: metadata?.feedbackTelemetryProductLoop || null,
    publicAdoptionPilotLoop: metadata?.publicAdoptionPilotLoop || null,
    integrationShowcasePartnerSurface: metadata?.integrationShowcasePartnerSurface || null,
    releaseAdoptionReadiness: metadata?.releaseAdoptionReadiness || null,
    releaseCandidatePreCanaryGate: metadata?.releaseCandidatePreCanaryGate || null,
    blueprintCompletionGate: metadata?.blueprintCompletionGate || null,
    skillMcpQuarantine: metadata?.skillMcpQuarantine || null,
    providerArena: metadata?.providerArena || null,
    providerCockpit: metadata?.providerCockpit || null,
    remoteMeshApprovalUx: metadata?.remoteMeshApprovalUx || metadata?.remoteMeshNotebookApprovalUx || null,
    toolExposureProfile: activeRun?.toolExposure || null,
    replyPorts: Array.isArray(activeRun?.replyPorts) ? activeRun.replyPorts : [],
    modelProfile: activeRun?.modelProfile || null,
    agentEvents: Array.isArray(activeRun?.events) ? activeRun.events : [],
    toolExposures: Array.isArray(activeRun?.toolExposure?.tools) ? activeRun.toolExposure.tools : [],
  };
}
