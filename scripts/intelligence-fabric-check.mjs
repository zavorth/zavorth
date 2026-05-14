#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const staticRules = [
  ruleFilesExist({
    id: 'intelligence-fabric-files',
    label: 'Intelligence Fabric files exist',
    target: 'contract, risk gate, facade, API facade, dynamic gate, tests and docs are present',
    files: [
      'src/contracts/IntelligenceFabricContract.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricCanary.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricDiffReceiptRenderer.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricDraftPromotion.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricDraftMutation.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricDraftWorkspaceExecutor.ts',
      'src/services/IntelligenceTrustModePolicyService.ts',
      'src/services/IntelligenceRiskGateService.ts',
      'src/services/ZavorthIntelligenceFabricService.ts',
      'src/services/ZavorthIntelligenceFabricApiService.ts',
      'src/services/ZavorthIntelligenceFabricLearningService.ts',
      'src/services/IntelligenceFabricPostDefaultHealthService.ts',
      'scripts/intelligence-fabric-gate.ts',
      'scripts/intelligence-fabric-surface-default-gate.ts',
      'scripts/intelligence-fabric-promotion-gate.ts',
      'scripts/intelligence-fabric-release-snapshot.mjs',
      'scripts/intelligence-fabric-rollback-drill.ts',
      'scripts/intelligence-fabric-post-default-health-gate.ts',
      'scripts/intelligence-fabric-operational-cycle-gate.ts',
      'scripts/intelligence-fabric-check.mjs',
      'tests/services/ZavorthIntelligenceFabricService.test.ts',
      'tests/services/IntelligenceFabricPostDefaultHealthService.test.ts',
      'tests/runtime/agent/AgentRunServiceIntelligenceFabricCanary.test.ts',
      'docs/README.md',
      'docs/README.md',
      'docs/README.md',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-contract',
    label: 'Fabric contract captures task, risk, trust, proposal, model, context and eval',
    target: 'contract exposes AI-first shadow snapshot with no live impact',
    files: ['src/contracts/IntelligenceFabricContract.ts'],
    needles: [
      'INTELLIGENCE_FABRIC_CONTRACT_VERSION',
      'IntelligenceRiskLevel',
      'IntelligenceTrustMode',
      'IntelligenceExecutionProposal',
      'IntelligenceModelRoutingInput',
      'IntelligenceContextPack',
      'IntelligenceTaskEval',
      'rawSecretsSerialized: false',
      'liveActionApplied: false',
      'thinkingRequiresApproval: false',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-risk-gate-late',
    label: 'Risk Gate is deterministic and action-based',
    target: 'risk 0-2 are free; risk 3 local owner reversible workspace writes are allowed; risk 4/5 are gated',
    files: ['src/services/IntelligenceRiskGateService.ts'],
    needles: [
      'risk-0-2-thinking-planning-simulation-free',
      'Risk 5 action requires explicit owner approval before impact.',
      'Reversible workspace impact is allowed in local owner/developer fast mode.',
      'Risk 4 action requires sandbox/dry-run or explicit approval before impact.',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-trust-mode-policy',
    label: 'Fabric trust mode policy defaults local owners without weakening surfaces',
    target: 'explicit trust wins; local owner defaults to local_owner; API/remote surfaces can stay stricter by policy/config',
    files: ['src/services/IntelligenceTrustModePolicyService.ts'],
    needles: [
      'owner_local_default',
      'ZAVORTH_INTELLIGENCE_FABRIC_TRUST_MODE',
      'ZAVORTH_INTELLIGENCE_FABRIC_TRUST_',
      "if (surface === 'api') return 'enterprise';",
      "surface === 'telegram' || surface === 'discord'",
      "requested: 'local_owner'",
      'Explicit Intelligence Fabric trust mode',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-thin-orchestrator',
    label: 'Fabric reuses canonical Zavorth services',
    target: 'uses AI-first route plan, Universal Intent, ModelPicker and Capability Hub without creating a parallel runtime',
    files: ['src/services/ZavorthIntelligenceFabricService.ts'],
    needles: [
      'AiFirstRoutePlanContractService',
      'UniversalIntentService',
      'ModelPickerService',
      'ZavorthCapabilityHubApiService',
      'buildShadowSnapshot',
      'risk-gate-before-impact',
      'defaultEnabled: false',
      'liveAllowedByDefault: false',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-agent-run-canary',
    label: 'AgentRunService attaches Fabric canary with current runtime fallback',
    target: 'entrypoint calls the canary adapter before executor dispatch',
    files: ['src/runtime/agent/AgentRunService.ts'],
    needles: [
      'AgentRunIntelligenceFabricCanary',
      'applyIntelligenceFabricCanary',
      'intelligenceFabricCanary',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-agent-run-canary-fallback',
    label: 'Fabric canary helper preserves fallback and rollback',
    target: 'helper records current runtime fallback and rollback without replacing the executor',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricCanary.ts'],
    needles: [
      'intelligenceFabricCanary',
      'dispatchTarget: \'current-runtime\'',
      'current-runtime-fallback',
      'runtimeChanged: false',
      'stateChanged: false',
      'defaultRuntimeChanged: false',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-default-promotion',
    label: 'Intelligence Fabric is promoted as the default orchestrator',
    target: 'AgentRunService defaults to Fabric orchestration while retaining current runtime fallback',
    files: [
      'src/runtime/agent/AgentRunService.ts',
      'src/runtime/agent/AgentRunIntelligenceFabricCanary.ts',
      'tests/runtime/agent/AgentRunServiceIntelligenceFabricCanary.test.ts',
    ],
    needles: [
      "defaultMode: runtime.intelligenceFabricMode || 'default'",
      "'disabled' | 'shadow' | 'canary' | 'default'",
      'intelligence-fabric-default',
      'IntelligenceFabricDefault',
      'intelligence-fabric-default-active',
      'uses Intelligence Fabric as the default orchestrator',
      'currentRuntimeFallbackRetained: true',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-surface-default-entrypoints',
    label: 'Surface entrypoints inherit Fabric default through the canonical gateway',
    target: 'web, CLI, Telegram, Discord and API routes enter through ZavorthAgentGateway/AgentRunService instead of bypassing Fabric',
    files: [
      'src/runtime/agent/ZavorthAgentGateway.ts',
      'src/services/WebAppConversationService.ts',
      'src/telegram/controllers/TelegramConversationController.ts',
      'src/gateways/discord-gateway/DiscordGatewayInboundService.ts',
      'src/cli/ZavorthCliCommandHelpers.ts',
      'src/cli/ZavorthCliFlowHelpers.ts',
      'src/core/CoreOrchestrator.ts',
      'scripts/intelligence-fabric-surface-default-gate.ts',
    ],
    needles: [
      'new AgentRunService(runtime)',
      'new ZavorthAgentGateway',
      'agentGateway.handle',
      'tryHandleNaturalMessageThroughAgentGateway',
      'Fabric mode must be default',
      'IntelligenceFabricDefault',
      'Executor dispatch must not change',
      'Owner-run surfaces must use the local owner default trust source',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-0-2-orientation',
    label: 'Fabric canary orients only risk 0-2 requests',
    target: 'safe requests can receive model/context orientation while executor and tool dispatch remain unchanged',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricCanary.ts'],
    needles: [
      'applyOrientationIfEligible',
      'risk-0-2-safe',
      'Only risk 0-2 requests can receive canary orientation, and risk 3 can only receive draft guidance.',
      'intelligenceFabricContextPack',
      'modelSelectionSourceForMode',
      'executorDispatchChanged: false',
      'toolExecutionChanged: false',
      'snapshotLatencyMs',
      'modelFallbackReason',
      'ModelPicker did not return a ready route',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-draft-guidance',
    label: 'Fabric canary attaches Risk 3 draft guidance without live impact',
    target: 'risk 3 requests get proposal/simulation guidance while patch, tool and commit remain disabled',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricCanary.ts'],
    needles: [
      'risk-3-draft-guidance',
      'intelligenceFabricDraftGuidance',
      'draftGuidanceAttached',
      'executorDispatchChanged: false',
      'toolExecutionChanged: false',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-mutation-plan',
    label: 'Risk 3 draft guidance is backed by Mutation Plane',
    target: 'risk 3 drafts create a Mutation Plane plan and can only be applied via governed apply request',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDraftMutation.ts'],
    needles: [
      'mutationPlane.createPlan',
      'applyDraftGuidancePlan',
      'workspaceExecutor.executePlan',
      'policyAllowExplicit',
      'workspaceWrites',
      'workspacePatches',
      'workspacePatchPreview',
      'workspacePatchVerifier',
      'workspaceDiffReceipt',
      'observability',
      'draftLatencyMs',
      'mutationPlaneStatus',
      'approvalPath',
      'applyState',
      'workspace-diff-receipt-ready',
      'patchPreparedInMemory: false',
      'sideEffectsApplied: false',
      'commitAllowed: false',
      'applyRequiresRiskGate: true',
      'draft-guidance-no-live-action',
      'intelligence-fabric.draft-guidance.apply',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-workspace-executor',
    label: 'Risk 3 draft apply has a reversible workspace executor',
    target: 'explicit write/edit payloads are applied only inside workspace with rollback artifact support',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDraftWorkspaceExecutor.ts'],
    needles: [
      'WorkspaceResolver.ensurePathInsideWorkspace',
      'workspaceWrites',
      'workspacePatches',
      'planDraftWorkspaceWritesFromRun',
      'planDraftWorkspacePatchesFromRun',
      'previewDraftWorkspacePatches',
      'buildDraftWorkspaceDiffReceipt',
      'workspace-diff-receipt',
      'rollbackArtifactPath',
      'restoreRollback',
      'workspace-write:',
      'workspace-patch:',
      'hunks',
      'looksLikeSecret',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-llm-workspace-writes',
    label: 'Risk 3 planner can produce structured workspaceWrites',
    target: 'LLM draft output is parsed into workspaceWrites and promoted to a new Mutation Plane plan',
    files: ['src/runtime/agent/AgentRunLlmRuntimeExecutor.ts'],
    needles: [
      'zavorth-workspace-writes',
      'zavorth-workspace-patches',
      'hunks',
      'extractWorkspaceWrites',
      'intelligenceFabricDraftWorkspaceWrites',
      'intelligenceFabricDraftWorkspacePatches',
      'llm-runtime-zavorth-workspace-writes',
      'llm-runtime-zavorth-workspace-patches',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-promotion',
    label: 'Risk 3 workspaceWrites are promoted after planner output',
    target: 'AgentRunService promotes planner-produced writes to a helper without applying them',
    files: ['src/runtime/agent/AgentRunService.ts'],
    needles: [
      'promoteIntelligenceFabricDraftWorkspaceWrites',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-promotion-helper',
    label: 'Risk 3 workspaceWrites promotion helper records planning receipt',
    target: 'helper records planner writes as a planning event and delegates to canary promotion',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDraftPromotion.ts'],
    needles: [
      'promoteIntelligenceFabricDraftWorkspaceWrites',
      'promoteDraftWorkspaceWrites',
      'workspaceWrites estruturados promovidos',
      'workspacePatches',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-promotion-plan',
    label: 'Risk 3 workspaceWrites promotion creates a new Mutation Plane plan',
    target: 'planner-produced writes update draft guidance with a fresh governed mutation plan',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDraftMutation.ts'],
    needles: [
      'promoteWorkspaceWrites',
      'workspace-writes-promoted-to-mutation-plan',
      'workspace-patches-promoted-to-mutation-plan',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-risk-3-agent-run-apply',
    label: 'AgentRunService applies draft guidance only through Mutation Plane',
    target: 'apply requests are intercepted by plan id and never bypass executor policy',
    files: ['src/runtime/agent/AgentRunService.ts'],
    needles: [
      'applyIntelligenceFabricDraftGuidanceIfRequested',
      'intelligenceFabricApplyDraftPlanId',
      'intelligenceFabricApplyDraftGuidance',
      'intelligenceFabricApproveDraftPlan',
      'intelligenceFabricDraftApply',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-llm-context-pack',
    label: 'LLM runtime consumes Fabric context pack as guidance',
    target: 'Fabric context guides prompt composition but is not treated as tool execution',
    files: ['src/runtime/agent/AgentRunLlmRuntimeExecutor.ts'],
    needles: [
      'buildIntelligenceFabricContextPrompt',
      'buildIntelligenceFabricDraftGuidancePrompt',
      'Intelligence Fabric context pack:',
      'Intelligence Fabric draft guidance:',
      'nao trate como prova de execucao de ferramenta',
      'nao afirme que patch, arquivo ou comando foi aplicado',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-human-diff-receipt',
    label: 'Risk 3 diff receipt has a human renderer',
    target: 'approval/apply replies can show a short human-readable change preview without JSON',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDiffReceiptRenderer.ts'],
    needles: [
      'renderIntelligenceFabricDiffReceipt',
      'Previa de alteracao',
      'so com pedido explicito',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-human-diff-receipt-wired',
    label: 'Human diff receipt is wired into apply result',
    target: 'Mutation apply result and AgentRun metadata expose diffReceiptText for channels/UI',
    files: ['src/runtime/agent/AgentRunIntelligenceFabricDraftMutation.ts'],
    needles: [
      'renderIntelligenceFabricDiffReceipt',
      'diffReceiptText',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-human-diff-receipt-agent-run',
    label: 'Human diff receipt is exposed on AgentRun events',
    target: 'AgentRun apply event carries diffReceiptText alongside the machine-readable receipt',
    files: ['src/runtime/agent/AgentRunService.ts'],
    needles: [
      'diffReceiptText',
      'diffReceipt: result.diffReceipt',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-command-center-apply-action',
    label: 'Command Center can apply governed draft previews',
    target: 'UI button calls a protected API route that re-enters AgentRunService with planId and owner confirmation',
    files: [
      'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOverviewSector.tsx',
      'tests/services/WebAppRuntimeInteractionRouteService.test.ts',
    ],
    needles: [
      '/api/web/agent-runs/apply-draft',
      'onApplyDiffPreview',
      'preview.actions.approveApplyLabel',
      'confirmOwnerControlledApply',
      'intelligenceFabricApplyDraftPlanId',
      'intelligenceFabricApproveDraftPlan',
      'commandCenterApplyDraft',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-risk-3-observability-command-center',
    label: 'Command Center shows Risk 3 draft observability before apply',
    target: 'Run Observatory diff previews expose Mutation Plane status, approval reason, gate decision and no-live-impact state',
    files: [
      'src/runtime/agent/AgentRunIntelligenceFabricDraftMutation.ts',
      'src/runtime/agent/RunObservatory.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterObservabilityContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterRunObservatory.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOverviewSector.tsx',
    ],
    needles: [
      'draftObservability',
      'mutationPlaneStatus',
      'mutationPlaneApprovalStatus',
      'approvalReason',
      'riskGateDecision',
      'applyState',
      'liveActionApplied',
      'Draft {preview.observability.draftReady',
      'Gate {preview.observability.riskGateDecision',
      'sem impacto live',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-release-snapshot',
    label: 'Fabric default release snapshot is materialized',
    target: 'release snapshot records phases 1-7, gates, invariants and rollback instructions',
    files: [
      'scripts/intelligence-fabric-release-snapshot.mjs',
      'docs/README.md',
    ],
    needles: [
      'zavorth-intelligence-fabric-default-release/v1',
      'Zavorth Intelligence Fabric Default',
      'phase: 7',
      'metadata.intelligenceFabricMode = disabled',
      'risk4RequiresSandboxOrApproval',
      'Risk 0-2: pensamento',
      'Pronto para manter como default',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-rollback-observability',
    label: 'Fabric rollback drill is observable',
    target: 'disabled and fallback-current-runtime states stay on current runtime and appear in Run Observatory receipts',
    files: [
      'src/runtime/agent/RunObservatory.ts',
      'scripts/intelligence-fabric-rollback-drill.ts',
    ],
    needles: [
      'Intelligence Fabric desativado',
      'Intelligence Fabric usou fallback atual',
      'currentRuntimeFallbackRetained',
      'intelligence-fabric-rollback',
      'metadata.status === scenario.expectedStatus',
      'Run Observatory must expose an Intelligence Fabric receipt',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-post-default-health',
    label: 'Fabric post-default health monitor is available',
    target: 'health monitor tracks fallback, disabled, error fallback, latency, surfaces and recommends controlled demotion only when degraded',
    files: [
      'src/services/IntelligenceFabricPostDefaultHealthService.ts',
      'scripts/intelligence-fabric-post-default-health-gate.ts',
    ],
    needles: [
      'zavorth-intelligence-fabric-post-default-health/v1',
      'auto_demote_controlled',
      'fallbackRate',
      'errorFallbackRate',
      'disabledRate',
      'p95LatencyMs',
      'Set intelligenceFabricMode=disabled at runtime or request metadata.',
      'healthy-maintain-default',
      'degraded-auto-demote',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-post-default-health-command-center',
    label: 'Fabric post-default health is exposed in Run Observatory and Command Center',
    target: 'Run Observatory publishes Fabric health and Command Center renders status, recommendation, latency and rollback hint',
    files: [
      'src/runtime/agent/RunObservatory.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/contracts/dashboardCommandCenterObservabilityContracts.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterRunObservatory.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOverviewSector.tsx',
      'tests/ai-gateway/control/CommandCenterRunObservatoryWave28.test.ts',
      'tests/runtime/agent/RunObservatoryProduct.test.ts',
    ],
    needles: [
      'intelligenceFabricHealth',
      'DashboardIntelligenceFabricHealthSnapshot',
      'mapFabricHealth',
      'Fabric {fabricHealth.status}: {fabricHealth.recommendation}',
      'auto_demote_controlled',
      'Set intelligenceFabricMode=disabled at runtime or request metadata.',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-controlled-demote-command-center',
    label: 'Command Center can request controlled Fabric demotion',
    target: 'degraded Fabric health can be demoted through a protected owner-confirmed API action with rollback receipt metadata',
    files: [
      'src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterDemoteFabricAction.ts',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterControlShell.tsx',
      'src/ai-gateway/app/(dashboard)/control/command-center/components/CommandCenterOverviewSector.tsx',
      'tests/services/WebAppRuntimeInteractionRouteService.test.ts',
    ],
    needles: [
      '/api/web/agent-runs/demote-fabric',
      'confirmOwnerControlledDemote',
      'commandCenterDemoteFabric',
      'intelligenceFabricMode: \'disabled\'',
      'intelligenceFabricDemoteControlled',
      'onDemoteIntelligenceFabric',
      'Desativar Fabric',
      'globalRuntimeChanged: false',
    ],
  }),
  ruleContainsAcross({
    id: 'intelligence-fabric-operational-cycle-gate',
    label: 'Fabric operational cycle gate closes health, demote and rollback',
    target: 'degraded health leads to explicit Command Center demotion, request-scoped disabled mode and documented rollback',
    files: [
      'scripts/intelligence-fabric-operational-cycle-gate.ts',
      'docs/README.md',
    ],
    needles: [
      'degraded-health-recommends-controlled-demote',
      'command-center-demote-route-is-owner-confirmed',
      'rollback-path-is-non-destructive-and-explicit',
      '/api/web/agent-runs/demote-fabric',
      'confirmOwnerControlledDemote',
      'intelligenceFabricMode=disabled',
      'No external action, install, deploy, secret access, or shell execution',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-learning',
    label: 'Fabric learning recorder persists evals without prompt or secret material',
    target: 'TaskEval records feed a local model scoreboard while keeping live action and raw secrets false',
    files: ['src/services/ZavorthIntelligenceFabricLearningService.ts'],
    needles: [
      'recordSnapshot',
      'buildModelScoreboard',
      'rawSecretsSerialized: false',
      'liveActionApplied: false',
      'IntelligenceFabricModelScore',
    ],
  }),
  ruleContainsAll({
    id: 'intelligence-fabric-workspace-gate',
    label: 'Fabric gate is wired directly into workspace check',
    target: 'workspace check calls direct node gate without adding a public npm script',
    files: ['package.json'],
    needles: [
      'node scripts/intelligence-fabric-check.mjs',
    ],
  }),
];

const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const dynamic = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicRule = {
  id: 'intelligence-fabric-dynamic-gate',
  label: 'Fabric dynamic gate passes',
  status: dynamic.status === 0 ? 'passed' : 'failed',
  observed: dynamic.status === 0 ? 'dynamic acceptance passed' : `dynamic acceptance failed (${dynamic.status})`,
  target: 'simple requests stay approval-free, dangerous actions are gated and unknown capabilities are draft-only',
  details: dynamic.status === 0 ? [] : [
    dynamic.error ? String(dynamic.error.message || dynamic.error) : '',
    dynamic.stdout,
    dynamic.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicSurface = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-surface-default-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicSurfaceRule = {
  id: 'intelligence-fabric-surface-default-dynamic-gate',
  label: 'Fabric default covers canonical surfaces',
  status: dynamicSurface.status === 0 ? 'passed' : 'failed',
  observed: dynamicSurface.status === 0 ? 'surface default routing passed' : `surface default routing failed (${dynamicSurface.status})`,
  target: 'web, CLI, Telegram, Discord, API and unknown safe requests inherit Fabric default through the gateway',
  details: dynamicSurface.status === 0 ? [] : [
    dynamicSurface.error ? String(dynamicSurface.error.message || dynamicSurface.error) : '',
    dynamicSurface.stdout,
    dynamicSurface.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicPromotion = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-promotion-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicPromotionRule = {
  id: 'intelligence-fabric-default-promotion-matrix',
  label: 'Fabric default promotion matrix passes',
  status: dynamicPromotion.status === 0 ? 'passed' : 'failed',
  observed: dynamicPromotion.status === 0 ? 'promotion matrix passed' : `promotion matrix failed (${dynamicPromotion.status})`,
  target: 'risk 0-5, surfaces and trust modes prove safe thinking, draft-only Risk 3, and gated Risk 4/5',
  details: dynamicPromotion.status === 0 ? [] : [
    dynamicPromotion.error ? String(dynamicPromotion.error.message || dynamicPromotion.error) : '',
    dynamicPromotion.stdout,
    dynamicPromotion.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicRelease = spawnSync(process.execPath, ['scripts/intelligence-fabric-release-snapshot.mjs', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicReleaseRule = {
  id: 'intelligence-fabric-release-snapshot-dynamic-gate',
  label: 'Fabric default release snapshot is ready',
  status: dynamicRelease.status === 0 ? 'passed' : 'failed',
  observed: dynamicRelease.status === 0 ? 'release snapshot ready' : `release snapshot failed (${dynamicRelease.status})`,
  target: 'release snapshot replays gates and confirms rollback/no-live-action invariants',
  details: dynamicRelease.status === 0 ? [] : [
    dynamicRelease.error ? String(dynamicRelease.error.message || dynamicRelease.error) : '',
    dynamicRelease.stdout,
    dynamicRelease.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicRollback = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-rollback-drill.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicRollbackRule = {
  id: 'intelligence-fabric-rollback-drill-dynamic-gate',
  label: 'Fabric rollback drill passes',
  status: dynamicRollback.status === 0 ? 'passed' : 'failed',
  observed: dynamicRollback.status === 0 ? 'rollback drill passed' : `rollback drill failed (${dynamicRollback.status})`,
  target: 'request-level disable, runtime disable and Fabric error fallback stay on current runtime with Observatory receipts',
  details: dynamicRollback.status === 0 ? [] : [
    dynamicRollback.error ? String(dynamicRollback.error.message || dynamicRollback.error) : '',
    dynamicRollback.stdout,
    dynamicRollback.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicHealth = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-post-default-health-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicHealthRule = {
  id: 'intelligence-fabric-post-default-health-dynamic-gate',
  label: 'Fabric post-default health gate passes',
  status: dynamicHealth.status === 0 ? 'passed' : 'failed',
  observed: dynamicHealth.status === 0 ? 'post-default health gate passed' : `post-default health gate failed (${dynamicHealth.status})`,
  target: 'healthy default is retained, small sample observes, degraded error fallback/latency recommends controlled demotion',
  details: dynamicHealth.status === 0 ? [] : [
    dynamicHealth.error ? String(dynamicHealth.error.message || dynamicHealth.error) : '',
    dynamicHealth.stdout,
    dynamicHealth.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const dynamicOperationalCycle = spawnSync(process.execPath, [tsxCli, 'scripts/intelligence-fabric-operational-cycle-gate.ts', '--json'], {
  cwd: root,
  encoding: 'utf8',
});
const dynamicOperationalCycleRule = {
  id: 'intelligence-fabric-operational-cycle-dynamic-gate',
  label: 'Fabric operational cycle gate passes',
  status: dynamicOperationalCycle.status === 0 ? 'passed' : 'failed',
  observed: dynamicOperationalCycle.status === 0 ? 'operational cycle passed' : `operational cycle failed (${dynamicOperationalCycle.status})`,
  target: 'degraded health, Command Center controlled demote and explicit rollback stay non-destructive and auditable',
  details: dynamicOperationalCycle.status === 0 ? [] : [
    dynamicOperationalCycle.error ? String(dynamicOperationalCycle.error.message || dynamicOperationalCycle.error) : '',
    dynamicOperationalCycle.stdout,
    dynamicOperationalCycle.stderr,
  ].filter(Boolean).join('\n').split(/\r?\n/).slice(0, 30),
};

const rules = [
  ...staticRules,
  dynamicRule,
  dynamicSurfaceRule,
  dynamicPromotionRule,
  dynamicReleaseRule,
  dynamicRollbackRule,
  dynamicHealthRule,
  dynamicOperationalCycleRule,
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[intelligence-fabric] checking AI-first Fabric gate');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[intelligence-fabric] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 10)) {
      console.log(`  - ${detail}`);
    }
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function ruleFilesExist(input) {
  const missing = input.files.filter((file) => !exists(file));
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: `${input.files.length - missing.length}/${input.files.length} file(s) present`,
    target: input.target,
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsAll(input) {
  const missing = [];
  for (const file of input.files) {
    const contents = read(file);
    if (contents === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of input.needles) {
      if (!contents.includes(needle)) {
        missing.push(`${file}: missing ${needle}`);
      }
    }
  }
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present',
    target: input.target,
    details: missing,
  };
}

function ruleContainsAcross(input) {
  const contentsByFile = input.files.map((file) => ({
    file,
    contents: read(file),
  }));
  const missingFiles = contentsByFile
    .filter((entry) => entry.contents === null)
    .map((entry) => `missing ${entry.file}`);
  const missingNeedles = input.needles
    .filter((needle) => !contentsByFile.some((entry) => entry.contents?.includes(needle)))
    .map((needle) => `missing ${needle}`);
  const missing = [...missingFiles, ...missingNeedles];
  return {
    id: input.id,
    label: input.label,
    status: missing.length > 0 ? 'failed' : 'passed',
    observed: missing.length > 0 ? `${missing.length} missing marker(s)` : 'all markers present across files',
    target: input.target,
    details: missing,
  };
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    return null;
  }
  return fs.readFileSync(absolute, 'utf8');
}
