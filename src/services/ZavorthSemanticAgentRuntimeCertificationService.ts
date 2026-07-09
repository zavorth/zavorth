import type {
  SourceAgentRuntimeBridgePackSnapshot,
  SourceAgentRuntimeBridgeReadiness,
  SourceAgentRuntimePackageEvidence,
  SourceAgentRuntimePackageName,
  SourceAgentRuntimeToolPolicyDecisionReceipt,
  SourceAgentRuntimeToolPolicyDoctorSnapshot,
} from '../contracts/SourceAgentRuntimeBridgeContract.js';
import { SourceAgentRuntimeBridgeService } from './SourceAgentRuntimeBridgeService.js';
import { ZAVORTH_SEMANTIC_AGENT_RUNTIME_CERTIFICATION_CONTRACT_VERSION } from '../contracts/ZavorthSemanticAgentRuntimeCertificationContract.js';

import { SourceAgentRuntimeToolPolicyService } from './SourceAgentRuntimeToolPolicyService.js';
import type {
  ZavorthSemanticAgentRuntimeCertificationSnapshot,
  ZavorthSemanticAgentRuntimeCertificationStatus,
  ZavorthSemanticAgentRuntimeClaim,
  ZavorthSemanticAgentRuntimeClaimKind,
  ZavorthSemanticAgentRuntimeClaimPriority,
  ZavorthSemanticAgentRuntimeClaimStatus,
  ZavorthSemanticAgentRuntimePolicyScenario,
} from '../contracts/ZavorthSemanticAgentRuntimeCertificationContract.js';

type Runtime = {
  now?: () => Date;
  sourceRoot?: string;
  zavorthRoot?: string;
  bridgeService?: Pick<SourceAgentRuntimeBridgeService, 'buildSnapshot'>;
  toolPolicyService?: SourceAgentRuntimeToolPolicyService;
};

type ClaimInput = {
  kind: ZavorthSemanticAgentRuntimeClaimKind;
  status: ZavorthSemanticAgentRuntimeClaimStatus;
  priority: ZavorthSemanticAgentRuntimeClaimPriority;
  packageName?: SourceAgentRuntimePackageName;
  bridgeId?: string;
  directness?: ZavorthSemanticAgentRuntimeClaim['directness'];
  usageKind?: ZavorthSemanticAgentRuntimeClaim['usageKind'];
  expectedBehavior: string;
  zavorthEquivalent: string;
  evidence: string[];
  receiptIds?: string[];
  notes?: string[];
};

const AGENT_RECEIPT_PREFIX = 'zavorth.semantic.s2.agent-runtime';

export class ZavorthSemanticAgentRuntimeCertificationService {
  private readonly now: () => Date;
  private readonly sourceRoot?: string;
  private readonly zavorthRoot?: string;
  private readonly bridgeService: Pick<SourceAgentRuntimeBridgeService, 'buildSnapshot'>;
  private readonly toolPolicyService: SourceAgentRuntimeToolPolicyService;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceRoot = runtime.sourceRoot;
    this.zavorthRoot = runtime.zavorthRoot;
    this.bridgeService = runtime.bridgeService || new SourceAgentRuntimeBridgeService({
      now: this.now,
      sourceRoot: this.sourceRoot,
      zavorthRoot: this.zavorthRoot,
    });
    this.toolPolicyService = runtime.toolPolicyService || new SourceAgentRuntimeToolPolicyService({
      now: this.now,
    });
  }

  public buildSnapshot(input: {
    sourceRoot?: string | null;
    zavorthRoot?: string | null;
  } = {}): ZavorthSemanticAgentRuntimeCertificationSnapshot {
    const bridge = this.bridgeService.buildSnapshot({
      sourceRoot: input.sourceRoot || this.sourceRoot,
      zavorthRoot: input.zavorthRoot || this.zavorthRoot,
    });
    const toolPolicyScenarios = this.buildToolPolicyScenarios();
    const claims = this.buildClaims(bridge, toolPolicyScenarios);
    const gaps = claims.filter((claim) => claim.status === 'gap').length;
    const status: ZavorthSemanticAgentRuntimeCertificationStatus =
      bridge.status === 'passed'
      && gaps === 0
      && toolPolicyScenarios.every((scenario) => scenario.status === 'passed')
      && bridge.summary.liveExecutionPerformed === false
      && bridge.summary.enabledByDefault === false
      && bridge.summary.bypassPermissionsAllowed === false
        ? 'passed'
        : 'failed';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_SEMANTIC_AGENT_RUNTIME_CERTIFICATION_CONTRACT_VERSION,
      status,
      semanticPhase: 'S2',
      statement: 'Agent runtime semantics are certified as optional Zavorth-native provider and bridge behavior with policy, cwd control and artifact-first receipts.',
      sourceRoot: bridge.sourceRoot,
      zavorthRoot: bridge.zavorthRoot,
      bridgeStatus: bridge.status,
      bridgeContractVersion: bridge.contractVersion,
      claims,
      toolPolicyScenarios,
      summary: {
        semanticClaims: claims.length,
        covered: countStatus(claims, 'covered'),
        replaced: countStatus(claims, 'replaced'),
        ownerGated: countStatus(claims, 'owner-gated'),
        rejected: countStatus(claims, 'rejected'),
        gaps,
        p0Claims: countPriority(claims, 'P0'),
        p1Claims: countPriority(claims, 'P1'),
        p2Claims: countPriority(claims, 'P2'),
        receiptBackedClaims: claims.filter((claim) => claim.receiptIds.length > 0).length,
        packagesClassified: claims.filter((claim) => claim.kind === 'package-usage').length,
        bridgesCertified: claims.filter((claim) => claim.kind === 'bridge-policy').length,
        bridgeStatuses: Object.fromEntries(bridge.bridges.map((entry) => [entry.bridgeId, entry.status])),
        toolPolicyScenariosPassed: toolPolicyScenarios.filter((scenario) => scenario.status === 'passed').length,
        liveExecutionPerformed: false,
        enabledByDefault: false,
        bypassPermissionsAllowed: false,
        sourceCodeCopied: false,
        secretValuesSerialized: false,
      },
      configRoutes: {
        apiKey: 'ANTHROPIC_API_KEY',
        bedrock: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=bedrock',
        vertex: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=vertex',
        foundry: 'ZAVORTH_CLAUDE_AGENT_SDK_ROUTE=foundry',
        localModelRecommendation: 'Provider Mesh via Ollama, LM Studio, vLLM or OpenAI-compatible local providers',
      },
      policy: {
        semanticClaimRequiredForEveryAgentRuntimePackage: true,
        claudeAgentSdkOptionalProviderOnly: true,
        toolPolicyRequiredBeforeLiveTools: true,
        writesAndShellRequireExplicitApproval: true,
        canUseToolMustDenyOutsidePolicy: true,
        acpAndCliBridgesOwnerGated: true,
        sandboxCwdControlled: true,
        noRuntimeAdapterRuntimeExecutionDuringCertification: true,
        noAnthropicApiImpersonation: true,
        noProviderBypass: true,
        noImportPathShim: true,
        artifactFirstReceipts: true,
        gapsBlockRelease: true,
      },
      commands: {
        inspect: 'npm run semantic-agent-runtime-certification --silent',
        inspectJson: 'npm run semantic-agent-runtime-certification:json --silent',
        check: 'npm run semantic-agent-runtime-certification:check --silent',
        qa: 'npm run qa:semantic-agent-runtime-certification --silent',
        nextStage: 'S3 - Provider Mesh Semantics',
      },
    };
  }

  public formatSnapshotText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Semantic Agent Runtime Certification - S2',
      `Status: ${snapshot.status}`,
      `Contract: ${snapshot.contractVersion}`,
      `Bridge status: ${snapshot.bridgeStatus}`,
      `Claims: ${snapshot.summary.semanticClaims}`,
      `Covered/replaced/owner-gated/rejected/gaps: ${snapshot.summary.covered}/${snapshot.summary.replaced}/${snapshot.summary.ownerGated}/${snapshot.summary.rejected}/${snapshot.summary.gaps}`,
      `P0/P1/P2: ${snapshot.summary.p0Claims}/${snapshot.summary.p1Claims}/${snapshot.summary.p2Claims}`,
      `Receipt-backed claims: ${snapshot.summary.receiptBackedClaims}`,
      `Packages classified: ${snapshot.summary.packagesClassified}`,
      `Bridges certified: ${snapshot.summary.bridgesCertified}`,
      `Tool policy scenarios passed: ${snapshot.summary.toolPolicyScenariosPassed}/${snapshot.toolPolicyScenarios.length}`,
      `Live execution performed: ${snapshot.summary.liveExecutionPerformed}`,
      `Enabled by default: ${snapshot.summary.enabledByDefault}`,
      `Bypass permissions allowed: ${snapshot.summary.bypassPermissionsAllowed}`,
      'Claim groups:',
      ...snapshot.claims.map((claim) =>
        `- ${claim.status} ${claim.priority} ${claim.id}: ${claim.expectedBehavior} -> ${claim.zavorthEquivalent}`,
      ),
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildClaims(
    bridge: SourceAgentRuntimeBridgePackSnapshot,
    scenarios: ZavorthSemanticAgentRuntimePolicyScenario[],
  ): ZavorthSemanticAgentRuntimeClaim[] {
    return [
      ...bridge.packageEvidence.map((evidence) => this.packageUsageClaim(evidence)),
      ...this.runtimeAdapterClaims(bridge),
      ...this.bridgePolicyClaims(bridge),
      ...this.toolPolicyClaims(scenarios),
      ...this.providerRouteClaims(bridge),
      ...this.receiptAndExecutionClaims(bridge),
    ];
  }

  private packageUsageClaim(evidence: SourceAgentRuntimePackageEvidence): ZavorthSemanticAgentRuntimeClaim {
    const status = packageStatus(evidence);
    return this.claim({
      kind: 'package-usage',
      status,
      priority: packagePriority(evidence.packageName),
      packageName: evidence.packageName,
      directness: evidence.directness,
      usageKind: evidence.usageKind,
      expectedBehavior: `${evidence.packageName} usage is classified before any runtime adoption decision.`,
      zavorthEquivalent: packageEquivalent(evidence.packageName),
      evidence: [
        `directness=${evidence.directness}`,
        `usageKind=${evidence.usageKind}`,
        `inSourcePackageJson=${evidence.inSourcePackageJson}`,
        `inSourceLockfile=${evidence.inSourceLockfile}`,
        `inSourceSource=${evidence.inSourceSource}`,
        `inZavorthPackageJson=${evidence.inZavorthPackageJson}`,
        `sourceReferences=${evidence.sourceReferenceFiles.length}`,
      ],
      notes: evidence.notes,
    });
  }

  private runtimeAdapterClaims(bridge: SourceAgentRuntimeBridgePackSnapshot): ZavorthSemanticAgentRuntimeClaim[] {
    const guards = bridge.adapterGuards;
    const claudeAgentSdk = findBridge(bridge, 'claude-agent-sdk');
    return [
      this.claim({
        kind: 'runtime-adapter',
        status: claudeAgentSdk?.status === 'ready' && guards.hasClaudeAgentSdkAdapter ? 'covered' : 'gap',
        priority: 'P0',
        bridgeId: 'claude-agent-sdk',
        expectedBehavior: 'Claude Agent SDK is available only as an optional Zavorth runtime provider.',
        zavorthEquivalent: 'ClaudeAgentSdkRuntimeAdapter plugs into LlmRuntimeService and AgentRunService as provider claude-agent-sdk.',
        evidence: [
          `bridgeStatus=${claudeAgentSdk?.status || 'missing'}`,
          `hasClaudeAgentSdkAdapter=${guards.hasClaudeAgentSdkAdapter}`,
          `enabledByDefault=${claudeAgentSdk?.enabledByDefault ?? false}`,
          `liveExecutionPerformed=${claudeAgentSdk?.liveExecutionPerformed ?? false}`,
        ],
        receiptIds: [
          `${AGENT_RECEIPT_PREFIX}.runtime-adapter.claude-agent-sdk`,
          'source-agent-runtime-bridge.runtime-receipt',
        ],
        notes: ['Runtime is disabled unless explicitly enabled and credentialed.'],
      }),
      this.claim({
        kind: 'permission-guard',
        status: guards.hasCanUseToolGuard && guards.forbidsBypassPermissions ? 'covered' : 'gap',
        priority: 'P0',
        bridgeId: 'claude-agent-sdk',
        expectedBehavior: 'Live SDK tool calls are filtered through Zavorth policy before allow or deny.',
        zavorthEquivalent: 'ClaudeAgentSdkRuntimeAdapter buildCanUseTool denies every tool outside effectiveAllowedTools.',
        evidence: [
          `hasCanUseToolGuard=${guards.hasCanUseToolGuard}`,
          `hasDontAskModeOnlyAfterPolicy=${guards.hasDontAskModeOnlyAfterPolicy}`,
          `forbidsBypassPermissions=${guards.forbidsBypassPermissions}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.permission-guard.can-use-tool`],
        notes: ['The SDK is never granted unconditional permission bypass.'],
      }),
      this.claim({
        kind: 'cwd-sandbox',
        status: guards.hasCwdControl ? 'covered' : 'gap',
        priority: 'P0',
        bridgeId: 'claude-agent-sdk',
        expectedBehavior: 'Agent runtime execution is bound to a controlled cwd and workspace-root policy.',
        zavorthEquivalent: 'ClaudeAgentSdkRuntimeAdapter checks allowedWorkspaceRoots before SDK execution.',
        evidence: [
          `adapterPath=${guards.adapterPath}`,
          `hasCwdControl=${guards.hasCwdControl}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.cwd-sandbox.workspace-roots`],
        notes: ['S2 certifies cwd behavior without running runtime adapter code.'],
      }),
      this.claim({
        kind: 'runtime-adapter',
        status: guards.hasPlanMode && guards.hasDontAskModeOnlyAfterPolicy ? 'covered' : 'gap',
        priority: 'P0',
        bridgeId: 'claude-agent-sdk',
        expectedBehavior: 'The SDK remains in plan mode unless policy yields approved effective tools.',
        zavorthEquivalent: 'Permission mode resolves to plan with no effective tools and dontAsk only after Zavorth approval.',
        evidence: [
          `hasPlanMode=${guards.hasPlanMode}`,
          `hasDontAskModeOnlyAfterPolicy=${guards.hasDontAskModeOnlyAfterPolicy}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.runtime-adapter.permission-mode`],
        notes: ['This is the guard that prevents hidden write/shell enablement.'],
      }),
    ];
  }

  private bridgePolicyClaims(bridge: SourceAgentRuntimeBridgePackSnapshot): ZavorthSemanticAgentRuntimeClaim[] {
    return bridge.bridges.map((entry) => this.claim({
      kind: 'bridge-policy',
      status: bridgeClaimStatus(entry),
      priority: entry.bridgeId === 'claude-agent-sdk' ? 'P0' : 'P1',
      bridgeId: entry.bridgeId,
      usageKind: entry.usageKind,
      expectedBehavior: `${entry.bridgeId} bridge behavior is explicit, non-default and policy-governed.`,
      zavorthEquivalent: bridgeEquivalent(entry),
      evidence: [
        `status=${entry.status}`,
        `decision=${entry.decision}`,
        `enabledByDefault=${entry.enabledByDefault}`,
        `enabledByEnv=${entry.enabledByEnv}`,
        `liveExecutionPerformed=${entry.liveExecutionPerformed}`,
        `dryRunAvailable=${entry.dryRunAvailable}`,
        `requiresOwnerApproval=${entry.requiresOwnerApproval}`,
      ],
      receiptIds: [`${AGENT_RECEIPT_PREFIX}.bridge.${entry.bridgeId}`],
      notes: [
        entry.reason,
        `artifactKinds=${entry.artifactReceipts.kinds.join(',')}`,
      ],
    }));
  }

  private toolPolicyClaims(
    scenarios: ZavorthSemanticAgentRuntimePolicyScenario[],
  ): ZavorthSemanticAgentRuntimeClaim[] {
    return scenarios.map((scenario) => this.claim({
      kind: 'tool-policy',
      status: scenario.status === 'passed' ? 'covered' : 'gap',
      priority: 'P0',
      expectedBehavior: toolScenarioExpectedBehavior(scenario.id),
      zavorthEquivalent: toolScenarioEquivalent(scenario.id),
      evidence: [
        `scenario=${scenario.id}`,
        `mode=${scenario.doctor.mode}`,
        `allowed=${scenario.doctor.summary.allowed}`,
        `denied=${scenario.doctor.summary.denied}`,
        `approvalRequired=${scenario.doctor.summary.approvalRequired}`,
        `dangerousToolsWithoutApproval=${scenario.doctor.summary.dangerousToolsWithoutApproval}`,
      ],
      receiptIds: [`${AGENT_RECEIPT_PREFIX}.tool-policy.${scenario.id}`],
      notes: scenario.doctor.decisions.map((decision) =>
        `${decision.toolName}:${decision.decision}:${decision.risk}`,
      ),
    }));
  }

  private providerRouteClaims(bridge: SourceAgentRuntimeBridgePackSnapshot): ZavorthSemanticAgentRuntimeClaim[] {
    return [
      this.claim({
        kind: 'provider-route',
        status: 'covered',
        priority: 'P1',
        expectedBehavior: 'Claude Agent SDK can be configured through API key, Bedrock, Vertex or Foundry routes.',
        zavorthEquivalent: 'Credential route is explicit config, not an API impersonation layer.',
        evidence: [
          `apiKey=${bridge.configRoutes.apiKey}`,
          `bedrock=${bridge.configRoutes.bedrock}`,
          `vertex=${bridge.configRoutes.vertex}`,
          `foundry=${bridge.configRoutes.foundry}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.provider-routes.cloud`],
        notes: ['Provider route selection stays visible in runtime metadata and receipts.'],
      }),
      this.claim({
        kind: 'local-model-policy',
        status: 'covered',
        priority: 'P1',
        expectedBehavior: 'Local model use does not pretend to be an Anthropic runtime.',
        zavorthEquivalent: bridge.configRoutes.localModelRecommendation,
        evidence: [
          `localModelRecommendation=${bridge.configRoutes.localModelRecommendation}`,
          `noProviderBypass=${bridge.policy.noProviderBypass}`,
          `noAnthropicApiImpersonation=${bridge.policy.noAnthropicApiImpersonation}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.provider-routes.local-models`],
        notes: ['Local models belong in Provider Mesh through local or OpenAI-compatible providers.'],
      }),
      this.claim({
        kind: 'provider-route',
        status: bridge.policy.noAnthropicApiImpersonation ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject pretending to be the Anthropic API.',
        zavorthEquivalent: 'Zavorth uses explicit provider routes and Provider Mesh rather than provider impersonation.',
        evidence: [`noAnthropicApiImpersonation=${bridge.policy.noAnthropicApiImpersonation}`],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.provider-routes.reject-api-impersonation`],
        notes: ['Rejected here means intentionally not implemented.'],
      }),
      this.claim({
        kind: 'provider-route',
        status: bridge.policy.noProviderBypass ? 'rejected' : 'gap',
        priority: 'P0',
        expectedBehavior: 'The architecture must reject provider bypass paths.',
        zavorthEquivalent: 'All runtime calls remain visible to provider/runtime policy and receipts.',
        evidence: [`noProviderBypass=${bridge.policy.noProviderBypass}`],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.provider-routes.reject-provider-bypass`],
        notes: ['Rejected here means intentionally blocked by architecture.'],
      }),
    ];
  }

  private receiptAndExecutionClaims(bridge: SourceAgentRuntimeBridgePackSnapshot): ZavorthSemanticAgentRuntimeClaim[] {
    const liveExecutionPerformed = bridge.summary.liveExecutionPerformed;
    const enabledByDefault = bridge.summary.enabledByDefault;
    const bypassPermissionsAllowed = bridge.summary.bypassPermissionsAllowed;
    return [
      this.claim({
        kind: 'live-execution-policy',
        status: liveExecutionPerformed === false && enabledByDefault === false ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'S2 certification must not execute runtime adapter runtimes or enable them by default.',
        zavorthEquivalent: 'Certification reads guards, dry-run receipts and policy doctors only.',
        evidence: [
          `liveExecutionPerformed=${liveExecutionPerformed}`,
          `enabledByDefault=${enabledByDefault}`,
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.execution-policy.no-live-default`],
        notes: ['Live use remains an explicit operator decision.'],
      }),
      this.claim({
        kind: 'permission-guard',
        status: bypassPermissionsAllowed === false ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Permission bypass is not allowed for agent runtimes.',
        zavorthEquivalent: 'Bridge and adapter guard evidence report bypassPermissionsAllowed=false.',
        evidence: [`bypassPermissionsAllowed=${bypassPermissionsAllowed}`],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.permission-guard.no-bypass`],
        notes: ['This protects tool policy from hidden escalation.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: bridge.policy.artifactFirstReceipts ? 'covered' : 'gap',
        priority: 'P0',
        expectedBehavior: 'Agent runtime behavior is artifact-first and receipt-backed.',
        zavorthEquivalent: 'Bridge readiness, tool decisions and runtime routing emit evidence receipts.',
        evidence: [`artifactFirstReceipts=${bridge.policy.artifactFirstReceipts}`],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.receipts.artifact-first`],
        notes: ['S2 stores policy evidence, not secret values.'],
      }),
      this.claim({
        kind: 'receipt-policy',
        status: 'covered',
        priority: 'P0',
        expectedBehavior: 'Certification must not copy source code or serialize secret values.',
        zavorthEquivalent: 'S2 reports sourceCodeCopied=false and secretValuesSerialized=false.',
        evidence: [
          'sourceCodeCopied=false',
          'secretValuesSerialized=false',
        ],
        receiptIds: [`${AGENT_RECEIPT_PREFIX}.receipts.no-source-copy-no-secrets`],
        notes: ['Evidence is metadata, package classification and guard checks.'],
      }),
    ];
  }

  private buildToolPolicyScenarios(): ZavorthSemanticAgentRuntimePolicyScenario[] {
    const disabled = this.toolPolicyService.buildDoctor({
      mode: 'disabled',
      requestedTools: ['Read', 'Bash', 'Write'],
    });
    const readOnly = this.toolPolicyService.buildDoctor({
      mode: 'read-only',
    });
    const configuredWithoutApproval = this.toolPolicyService.buildDoctor({
      mode: 'configured',
      requestedTools: ['Write', 'Bash'],
      allowedTools: ['Write', 'Bash'],
      approvedToolIds: [],
      approvalGranted: false,
    });
    const configuredSingleWriteApproval = this.toolPolicyService.buildDoctor({
      mode: 'configured',
      requestedTools: ['Write', 'Bash'],
      allowedTools: ['Write', 'Bash'],
      approvedToolIds: ['write_file'],
      approvalGranted: true,
    });

    return [
      {
        id: 'disabled-tools',
        status: disabled.status === 'passed' && disabled.summary.denied === 3 && disabled.summary.allowed === 0
          ? 'passed'
          : 'failed',
        doctor: disabled,
      },
      {
        id: 'read-only-tools',
        status: readOnly.status === 'passed'
          && readOnly.summary.readOnlyToolsAllowed >= 4
          && readOnly.summary.approvalRequired === 0
          ? 'passed'
          : 'failed',
        doctor: readOnly,
      },
      {
        id: 'configured-without-write-approval',
        status: configuredWithoutApproval.status === 'passed'
          && configuredWithoutApproval.summary.approvalRequired === 2
          && configuredWithoutApproval.summary.allowed === 0
          ? 'passed'
          : 'failed',
        doctor: configuredWithoutApproval,
      },
      {
        id: 'configured-single-write-approval',
        status: configuredSingleWriteApproval.status === 'passed'
          && decision(configuredSingleWriteApproval, 'Write')?.decision === 'allow'
          && decision(configuredSingleWriteApproval, 'Bash')?.decision === 'approval_required'
          ? 'passed'
          : 'failed',
        doctor: configuredSingleWriteApproval,
      },
    ];
  }

  private claim(input: ClaimInput): ZavorthSemanticAgentRuntimeClaim {
    const id = `${input.kind}:${slug([
      input.bridgeId,
      input.packageName,
      input.expectedBehavior,
    ].filter(Boolean).join('-'))}`;
    return {
      id,
      kind: input.kind,
      status: input.status,
      priority: input.priority,
      ...(input.packageName ? { packageName: input.packageName } : {}),
      ...(input.bridgeId ? { bridgeId: input.bridgeId } : {}),
      ...(input.directness ? { directness: input.directness } : {}),
      ...(input.usageKind ? { usageKind: input.usageKind } : {}),
      expectedBehavior: input.expectedBehavior,
      zavorthEquivalent: input.zavorthEquivalent,
      evidence: input.evidence,
      receiptIds: input.receiptIds || [`${AGENT_RECEIPT_PREFIX}.${id}`],
      notes: input.notes || [],
    };
  }
}

function packageStatus(evidence: SourceAgentRuntimePackageEvidence): ZavorthSemanticAgentRuntimeClaimStatus {
  if (evidence.directness === 'not-present') {
    return 'gap';
  }
  if (evidence.packageName === '@anthropic-ai/claude-agent-sdk') {
    return evidence.inZavorthPackageJson ? 'covered' : 'gap';
  }
  if (evidence.packageName === '@anthropic-ai/sdk' || evidence.packageName === '@anthropic-ai/vertex-sdk') {
    return 'replaced';
  }
  return 'owner-gated';
}

function packagePriority(packageName: SourceAgentRuntimePackageName): ZavorthSemanticAgentRuntimeClaimPriority {
  if (packageName === '@anthropic-ai/claude-agent-sdk') return 'P0';
  if (packageName === '@anthropic-ai/sdk' || packageName === '@anthropic-ai/vertex-sdk') return 'P0';
  if (packageName === '@anthropic-ai/claude-code') return 'P1';
  return 'P1';
}

function packageEquivalent(packageName: SourceAgentRuntimePackageName): string {
  switch (packageName) {
    case '@anthropic-ai/claude-agent-sdk':
      return 'ClaudeAgentSdkRuntimeAdapter as optional Zavorth provider claude-agent-sdk.';
    case '@anthropic-ai/sdk':
      return 'Zavorth Provider Mesh and LlmRuntimeService provider route.';
    case '@anthropic-ai/vertex-sdk':
      return 'Zavorth Provider Mesh Vertex route, owner-configured.';
    case '@anthropic-ai/claude-code':
      return 'Owner-gated Claude Code CLI bridge with dry-run receipt only by default.';
    case '@agentclientprotocol/claude-agent-acp':
    case 'acpx':
    case '@zed-industries/codex-acp':
      return 'Owner-gated ACP bridge family with Zavorth tool policy and cwd control.';
    default:
      return 'Zavorth-native agent runtime policy.';
  }
}

function bridgeClaimStatus(entry: SourceAgentRuntimeBridgeReadiness): ZavorthSemanticAgentRuntimeClaimStatus {
  if (entry.bridgeId === 'claude-agent-sdk') {
    return entry.status === 'ready' && !entry.enabledByDefault ? 'covered' : 'gap';
  }
  if (entry.bridgeId === 'anthropic-direct-sdk' || entry.bridgeId === 'anthropic-vertex-sdk') {
    return entry.status === 'disabled' ? 'replaced' : 'gap';
  }
  if (entry.status === 'owner_decision_required' && entry.requiresOwnerApproval) {
    return 'owner-gated';
  }
  return entry.status === 'missing' ? 'gap' : 'covered';
}

function bridgeEquivalent(entry: SourceAgentRuntimeBridgeReadiness): string {
  if (entry.bridgeId === 'claude-agent-sdk') {
    return 'Optional Zavorth provider with policy-gated tools, controlled cwd and receipts.';
  }
  if (entry.bridgeId === 'anthropic-direct-sdk' || entry.bridgeId === 'anthropic-vertex-sdk') {
    return 'Provider Mesh route rather than copied direct SDK layout.';
  }
  return 'Optional owner-gated bridge family, dry-run by default.';
}

function toolScenarioExpectedBehavior(id: ZavorthSemanticAgentRuntimePolicyScenario['id']): string {
  switch (id) {
    case 'disabled-tools':
      return 'Disabled tool mode denies all requested tools.';
    case 'read-only-tools':
      return 'Read-only tool mode allows safe read tools without write or shell exposure.';
    case 'configured-without-write-approval':
      return 'Configured write and shell tools require explicit approval before execution.';
    case 'configured-single-write-approval':
      return 'An approval enables only the matching tool and leaves unapproved tools blocked.';
    default:
      return 'Tool policy scenario is certified.';
  }
}

function toolScenarioEquivalent(id: ZavorthSemanticAgentRuntimePolicyScenario['id']): string {
  switch (id) {
    case 'disabled-tools':
      return 'SourceAgentRuntimeToolPolicyService mode=disabled.';
    case 'read-only-tools':
      return 'SourceAgentRuntimeToolPolicyService mode=read-only.';
    case 'configured-without-write-approval':
      return 'Zavorth approval gate returns approval_required for dangerous tools.';
    case 'configured-single-write-approval':
      return 'Zavorth aliases map write_file to Write while Bash remains blocked.';
    default:
      return 'Zavorth tool policy receipt.';
  }
}

function findBridge(
  bridge: SourceAgentRuntimeBridgePackSnapshot,
  bridgeId: string,
): SourceAgentRuntimeBridgeReadiness | undefined {
  return bridge.bridges.find((entry) => entry.bridgeId === bridgeId);
}

function decision(
  doctor: SourceAgentRuntimeToolPolicyDoctorSnapshot,
  toolName: string,
): SourceAgentRuntimeToolPolicyDecisionReceipt | undefined {
  return doctor.decisions.find((entry) => entry.toolName === toolName);
}

function countStatus(
  claims: ZavorthSemanticAgentRuntimeClaim[],
  status: ZavorthSemanticAgentRuntimeClaimStatus,
): number {
  return claims.filter((claim) => claim.status === status).length;
}

function countPriority(
  claims: ZavorthSemanticAgentRuntimeClaim[],
  priority: ZavorthSemanticAgentRuntimeClaimPriority,
): number {
  return claims.filter((claim) => claim.priority === priority).length;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}
