import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import {
  ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
  type ZavorthExternalRuntimeBridgeStatus,
  type ZavorthExternalRuntimeCapabilityId,
  type ZavorthExternalRuntimeDecision,
  type ZavorthExternalRuntimeNaturalFirstRoute,
  type ZavorthExternalRuntimeSourceRuntimeId,
} from '../contracts/ZavorthExternalRuntimeBridgeContract.js';

import {
ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION,
  type ZavorthExternalCapabilityInventoryItem,
  type ZavorthExternalCapabilityInventoryProbeRuntimeId,
  type ZavorthExternalCapabilityInventoryRisk,
  type ZavorthExternalCapabilityInventorySnapshot,
  type ZavorthExternalCapabilityInventorySourceProbe,
  type ZavorthExternalCapabilityInventoryStatus,
} from '../contracts/ZavorthExternalCapabilityInventoryContract.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  referenceRuntimeRoot?: string | null;
  compatibilitySidecarRoot?: string | null;
  compatibilityFixtureRoot?: string | null;
  bridgeStatus?: ZavorthExternalRuntimeBridgeStatus;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
};

type SnapshotInput = {
  projectRoot?: string | null;
  referenceRuntimeRoot?: string | null;
  compatibilitySidecarRoot?: string | null;
  compatibilityFixtureRoot?: string | null;
  bridgeStatus?: ZavorthExternalRuntimeBridgeStatus | null;
};

type InventoryItemDefinition = {
  id: string;
  title: string;
  sourceRuntimeIds: ZavorthExternalRuntimeSourceRuntimeId[];
  bridgeCandidateId: ZavorthExternalRuntimeCapabilityId | null;
  decision: ZavorthExternalRuntimeDecision;
  targetPhase: ZavorthExternalCapabilityInventoryItem['targetPhase'];
  priority: number;
  risk: ZavorthExternalCapabilityInventoryRisk;
  naturalFirstRoute: ZavorthExternalRuntimeNaturalFirstRoute;
  sourcePaths: Array<{
    runtimeId: ZavorthExternalRuntimeSourceRuntimeId;
    relativePath: string;
    role: string;
  }>;
  evidenceDocs: string[];
  observedBehavior: string;
  stateConfigDependencies: string[];
  approvalRequiredForLive: boolean;
  provenanceRequired: boolean;
  zavorthEquivalent: ZavorthExternalCapabilityInventoryItem['zavorthEquivalent'];
  acceptanceGate: string;
  notes: string[];
};

type SourceProbeDefinition = {
  runtimeId: ZavorthExternalCapabilityInventoryProbeRuntimeId;
  label: string;
  rootPath: string;
  required: boolean;
  expected: Array<[relativePath: string, purpose: string]>;
  evidenceDocs: string[];
};

const REFERENCE_RUNTIME_DOCS = [
  'docs/product-direction.md',
  'docs/product-direction.md',
];

const ACP_COMPATIBILITY_DOCS = [
  'docs/product-direction.md',
  'docs/product-direction.md',
  'docs/product-direction.md',
];

const INVENTORY_ITEMS: InventoryItemDefinition[] = [
  item({
    id: 'reference-runtime:error-classifier',
    title: 'Centralized error classification and recovery strategy',
    sourceRuntimeIds: ['reference-runtime'],
    bridgeCandidateId: 'error-classifier',
    decision: 'absorb',
    targetPhase: 'native-engine',
    priority: 1,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      referenceRuntimePath('agent/error_classifier.py', 'error taxonomy and recovery strategy reference'),
      referenceRuntimePath('agent/retry_utils.py', 'retry/backoff behavior reference'),
      referenceRuntimePath('agent/rate_limit_tracker.py', 'rate-limit tracking reference'),
    ],
    evidenceDocs: REFERENCE_RUNTIME_DOCS,
    observedBehavior: 'Classifies operational, provider, rate-limit, permission, context, billing, and syntax failures into recovery strategies.',
    stateConfigDependencies: ['provider error payloads', 'terminal stderr/stdout', 'retry budget', 'operator approval policy'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthErrorClassifierContract', 'ZavorthErrorClassifierService', 'ZavorthControlErrorRecoveryStrategy'),
    acceptanceGate: 'Classifies representative provider/terminal/context failures and emits a Zavorth recovery receipt without retrying by itself.',
  }),
  item({
    id: 'reference-runtime:tool-call-repair',
    title: 'Malformed tool-call and JSON repair',
    sourceRuntimeIds: ['reference-runtime'],
    bridgeCandidateId: 'tool-call-repair',
    decision: 'absorb',
    targetPhase: 'native-engine',
    priority: 2,
    risk: 'medium',
    naturalFirstRoute: 'tool-preview',
    sourcePaths: [
      referenceRuntimePath('run_agent.py', 'tool-call parsing and repair reference'),
      referenceRuntimePath('agent/tool_guardrails.py', 'tool safety reference'),
      referenceRuntimePath('agent/gemini_schema.py', 'schema-shaping reference'),
    ],
    evidenceDocs: REFERENCE_RUNTIME_DOCS,
    observedBehavior: 'Repairs common malformed tool arguments before the tool layer sees them.',
    stateConfigDependencies: ['tool schema catalog', 'raw model tool-call payload', 'approval context', 'repair receipt store'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthToolCallRepairContract', 'ZavorthToolCallRepairService', 'ZavorthControlToolCallRepairReceipt'),
    acceptanceGate: 'Repair is parser/AST-first, cannot add authority, and dangerous repaired calls remain approval-gated.',
  }),
  item({
    id: 'reference-runtime:safe-tool-parallelism',
    title: 'Safe tool parallelism by resource/write set',
    sourceRuntimeIds: ['reference-runtime'],
    bridgeCandidateId: 'safe-tool-parallelism',
    decision: 'absorb',
    targetPhase: 'native-engine',
    priority: 3,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      referenceRuntimePath('run_agent.py', 'tool batch scheduling reference'),
      referenceRuntimePath('agent/file_safety.py', 'file safety reference'),
      referenceRuntimePath('agent/tool_guardrails.py', 'tool guardrail reference'),
    ],
    evidenceDocs: REFERENCE_RUNTIME_DOCS,
    observedBehavior: 'Parallelizes independent tool batches and serializes conflicts around shared files/resources.',
    stateConfigDependencies: ['tool resource declarations', 'workspace path policy', 'write intent detector', 'run budget'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthSafeToolParallelismContract', 'ZavorthSafeToolParallelismService', 'ZavorthControlSafeParallelismPlan'),
    acceptanceGate: 'Same-file writes and unknown resources serialize; parallel execution emits conflict receipts.',
  }),
  item({
    id: 'reference-runtime:skill-curator',
    title: 'Skill curator with dry-run, merge, archive, pinning, and rollback',
    sourceRuntimeIds: ['reference-runtime'],
    bridgeCandidateId: 'skill-curator',
    decision: 'absorb',
    targetPhase: 'native-engine',
    priority: 4,
    risk: 'high',
    naturalFirstRoute: 'approval-proposal',
    sourcePaths: [
      referenceRuntimePath('agent/curator.py', 'skill curation reference'),
      referenceRuntimePath('agent/skill_utils.py', 'skill library utility reference'),
      referenceRuntimePath('agent/skill_preprocessing.py', 'skill preprocessing reference'),
    ],
    evidenceDocs: REFERENCE_RUNTIME_DOCS,
    observedBehavior: 'Reviews skills, discourages micro-skills, merges duplicates, and proposes cleanup of unused or session-specific material.',
    stateConfigDependencies: ['skill library index', 'usage/failure receipts', 'diff snapshot store', 'rollback artifact store', 'approval envelope'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthSkillCuratorContract', 'ZavorthSkillCuratorService', 'ZavorthControlSkillCurationPlan'),
    acceptanceGate: 'Produces a dry-run diff and rollback snapshot; no skill write occurs without Zavorth approval.',
  }),
  item({
    id: 'reference-runtime:procedural-memory',
    title: 'Procedural memory for commands, failures, and recovery paths',
    sourceRuntimeIds: ['reference-runtime'],
    bridgeCandidateId: 'procedural-memory',
    decision: 'absorb',
    targetPhase: 'sessions-memory-continuation',
    priority: 5,
    risk: 'medium',
    naturalFirstRoute: 'memory-recall',
    sourcePaths: [
      referenceRuntimePath('agent/memory_manager.py', 'memory management reference'),
      referenceRuntimePath('agent/trajectory.py', 'run trajectory and experience reference'),
      referenceRuntimePath('agent/context_engine.py', 'context retrieval reference'),
    ],
    evidenceDocs: REFERENCE_RUNTIME_DOCS,
    observedBehavior: 'Keeps useful operational experience such as successful commands, failed commands, workarounds, and recovery strategies.',
    stateConfigDependencies: ['run observatory receipts', 'memory receipts', 'redaction policy', 'forget/correct commands'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthProceduralMemoryContract', 'ZavorthProceduralMemoryService', 'ZavorthControlProceduralMemoryReceipts'),
    acceptanceGate: 'Every procedural memory has provenance and can be cited, corrected, or forgotten.',
  }),
  item({
    id: 'acp-compatible-sidecar:extension-inventory',
    title: 'Extension and capability inventory',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: 'external-capability-inventory',
    decision: 'adapt',
    targetPhase: 'inventory',
    priority: 6,
    risk: 'medium',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('extensions', 'extension/capability catalog root'),
      compatibilitySidecarPath('skills', 'packaged skills catalog root'),
      compatibilitySidecarPath('packages/plugin-package-contract', 'plugin package manifest contract reference'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Large ecosystem inventory across extensions, skills, channels, providers, media, memory, tools, docs, and QA surfaces.',
    stateConfigDependencies: ['extension manifests', 'skill manifests', 'plugin package metadata', 'source trust policy'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthExternalCapabilityInventoryContract', 'ZavorthExternalCapabilityInventoryService', 'ZavorthControlExternalCapabilityInventory'),
    acceptanceGate: 'Each external capability receives a Zavorth decision, source path, risk, equivalent, and proof gate before exposure.',
  }),
  item({
    id: 'acp-compatible-sidecar:channel-gateway-normalization',
    title: 'Channel gateway normalization',
    sourceRuntimeIds: ['acp-compatible-sidecar', 'reference-runtime'],
    bridgeCandidateId: 'channel-gateway-normalization',
    decision: 'adapt',
    targetPhase: 'channels-messaging',
    priority: 7,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('src/channels', 'channel runtime contracts'),
      compatibilitySidecarPath('extensions/telegram', 'Telegram channel maturity reference'),
      compatibilitySidecarPath('extensions/discord', 'Discord channel maturity reference'),
      compatibilitySidecarPath('extensions/slack', 'Slack channel maturity reference'),
      referenceRuntimePath('gateway', 'Reference gateway behavior'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Normalizes broad chat/channel events and outbound channel replies across many transports.',
    stateConfigDependencies: ['channel credentials', 'session mapping', 'reply ports', 'trust policy', 'rate limits'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthExternalChannelGatewayContract', 'ZavorthExternalChannelGatewayService', 'ZavorthControlExternalChannelGateway'),
    acceptanceGate: 'One inbound event enters ZavorthAgentGateway; outbound dry-run is evaluated by Zavorth policy and real send requires approval.',
  }),
  item({
    id: 'acp-compatible-sidecar:provider-model-mesh',
    title: 'Provider and model ecosystem breadth',
    sourceRuntimeIds: ['acp-compatible-sidecar', 'reference-runtime'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'capability-providers',
    priority: 8,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('extensions/amazon-bedrock', 'Bedrock provider reference'),
      compatibilitySidecarPath('extensions/anthropic', 'Anthropic provider reference'),
      compatibilitySidecarPath('extensions/deepinfra', 'long-tail provider reference'),
      compatibilitySidecarPath('src/model-catalog', 'model catalog reference'),
      referenceRuntimePath('agent/anthropic_adapter.py', 'Reference provider adapter behavior'),
      referenceRuntimePath('agent/bedrock_adapter.py', 'Reference Bedrock adapter behavior'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Broad provider/model adapter ecosystem with live probes, model catalogs, and provider-specific credential behavior.',
    stateConfigDependencies: ['credential refs', 'provider catalog', 'model metadata', 'billing/rate-limit policy', 'egress guard'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthProviderMeshExpansionContract', 'ZavorthProviderMeshExpansionService', 'ZavorthControlProviderMesh'),
    acceptanceGate: 'Provider metadata imports as catalog evidence only; live provider calls require existing Zavorth provider policy.',
  }),
  item({
    id: 'acp-compatible-sidecar:plugin-sdk-runtime',
    title: 'Plugin SDK and runtime package surface',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'capability-providers',
    priority: 9,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('packages/plugin-sdk', 'public plugin SDK package reference'),
      compatibilitySidecarPath('src/plugin-sdk', 'runtime SDK source reference'),
      compatibilitySidecarPath('src/plugins', 'plugin loader/lifecycle reference'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Exposes a public plugin SDK, package manifests, lifecycle hooks, install/update flows, and extension release mechanics.',
    stateConfigDependencies: ['plugin manifest schema', 'source trust registry', 'package provenance', 'content scan', 'owner approval'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthPluginOsContract', 'ZavorthPluginOsService', 'ZavorthControlPluginOs'),
    acceptanceGate: 'Imported plugins remain quarantined until manifest, provenance, license, prompt-injection, and approval gates pass.',
  }),
  item({
    id: 'acp-compatible-sidecar:memory-host-sdk',
    title: 'Memory host SDK and memory plugin surface',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: 'procedural-memory',
    decision: 'adapt',
    targetPhase: 'sessions-memory-continuation',
    priority: 10,
    risk: 'medium',
    naturalFirstRoute: 'memory-recall',
    sourcePaths: [
      compatibilitySidecarPath('packages/memory-host-sdk', 'memory host SDK reference'),
      compatibilitySidecarPath('src/memory', 'memory runtime source reference'),
      compatibilitySidecarPath('extensions/memory-core', 'memory-core plugin reference'),
      compatibilitySidecarPath('extensions/memory-lancedb', 'vector memory plugin reference'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Memory host package and plugins provide storage, query, embeddings, local vector, and multimodal memory surfaces.',
    stateConfigDependencies: ['memory backend', 'embedding provider', 'privacy filtering', 'retention policy', 'receipt ledger'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthMemoryDocumentTerminalContract', 'MemoryWithReceiptsService', 'ZavorthControlMemoryWithReceipts'),
    acceptanceGate: 'Imported memories are advisory until normalized with receipt provenance and forget/correct affordances.',
  }),
  item({
    id: 'acp-compatible-sidecar:delegated-workers',
    title: 'Delegated workers and task orchestration',
    sourceRuntimeIds: ['acp-compatible-sidecar', 'reference-runtime'],
    bridgeCandidateId: 'delegated-workers',
    decision: 'adapt',
    targetPhase: 'delegated-workers',
    priority: 11,
    risk: 'high',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      compatibilitySidecarPath('src/agents', 'agent runtime reference'),
      compatibilitySidecarPath('src/tasks', 'task runtime reference'),
      compatibilitySidecarPath('src/trajectory', 'worker trajectory reference'),
      referenceRuntimePath('run_agent.py', 'Reference agent run loop behavior'),
    ],
    evidenceDocs: [...REFERENCE_RUNTIME_DOCS, ...ACP_COMPATIBILITY_DOCS],
    observedBehavior: 'Breaks work into agent/task/trajectory units and can delegate bounded work to runtimes or workers.',
    stateConfigDependencies: ['task envelope', 'worker descriptor', 'timeout/cancellation policy', 'artifact mapping', 'approval envelope'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthDelegatedWorkerBridgeContract', 'ZavorthDelegatedWorkerBridgeService', 'ZavorthControlDelegatedWorkerBridge'),
    acceptanceGate: 'Worker dispatch is dry-run first, launch is approval-gated, and results return only as Zavorth artifacts/events/status.',
  }),
  item({
    id: 'acp-compatible-sidecar:native-apps',
    title: 'Native Android, iOS, macOS, and companion app surfaces',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: null,
    decision: 'externalize',
    targetPhase: 'native-replacement',
    priority: 12,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('apps/android', 'Android native app reference'),
      compatibilitySidecarPath('apps/ios', 'iOS/watch/share extension reference'),
      compatibilitySidecarPath('apps/macos', 'macOS app reference'),
      compatibilitySidecarPath('apps/shared/native-kit', 'shared native kit reference'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Native apps and device companions add mobile/desktop UX, signing, release, watch/share extensions, and appcast behavior.',
    stateConfigDependencies: ['platform signing', 'native build chain', 'device pairing', 'release feed', 'owner product decision'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthNativeCompanionDeviceContract', 'ZavorthNativeCompanionDeviceService', 'ZavorthControlNativeCompanion'),
    acceptanceGate: 'Owner chooses native wrappers or certifies PWA/companion replacement before any native app work starts.',
  }),
  item({
    id: 'acp-compatible-sidecar:qa-release-security',
    title: 'QA, release, security, Docker, and workflow matrix',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'native-replacement',
    priority: 13,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      compatibilitySidecarPath('scripts', 'script/check/release matrix reference'),
      compatibilitySidecarPath('qa', 'scenario catalog reference'),
      compatibilitySidecarPath('security/opengrep', 'OpenGrep rule reference'),
      compatibilitySidecarPath('.github/workflows', 'CI workflow reference'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Large QA/live/Docker/security/release matrix with scenario assets, opengrep rules, and CI workflow coverage.',
    stateConfigDependencies: ['local QA runner', 'security rule metadata', 'release channel policy', 'CI consistency decision'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthQaSecurityReleaseCertificationContract', 'ZavorthQaSecurityReleaseCertificationService', 'ZavorthControlReleaseReadiness'),
    acceptanceGate: 'Convert only valuable scenarios into Zavorth-native checks; do not copy workflow YAML blindly.',
  }),
  item({
    id: 'acp-compatible-sidecar:docs-ui-surface',
    title: 'Docs, i18n, and Vite/Lit control UI',
    sourceRuntimeIds: ['acp-compatible-sidecar'],
    bridgeCandidateId: null,
    decision: 'reject',
    targetPhase: 'inventory',
    priority: 14,
    risk: 'low',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      compatibilitySidecarPath('docs', 'Mintlify docs and i18n reference'),
      compatibilitySidecarPath('ui', 'Vite/Lit control UI reference'),
      compatibilitySidecarPath('vendor', 'vendored UI/reference material'),
    ],
    evidenceDocs: ACP_COMPATIBILITY_DOCS,
    observedBehavior: 'Public docs, i18n tooling, and separate control UI are useful comparison material but not a direct Zavorth runtime target.',
    stateConfigDependencies: ['docs product decision', 'i18n roadmap', 'ZavorthControl UX comparison'],
    approvalRequiredForLive: false,
    provenanceRequired: false,
    zavorthEquivalent: owner('ZavorthPublicSiteDocsDemoSyncContract', 'PublicSiteDocsDemoSyncService', 'ZavorthControlPublicDocsSync'),
    acceptanceGate: 'Use as checklist input only; no source UI/docs copy unless a separate product decision approves it.',
  }),
];

export class ZavorthExternalCapabilityInventoryService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly defaultReferenceRuntimeRoot: string | null;
  private readonly defaultCompatibilitySidecarRoot: string | null;
  private readonly defaultCompatibilityFixtureRoot: string | null;
  private readonly defaultBridgeStatus: ZavorthExternalRuntimeBridgeStatus;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || process.cwd();
    this.defaultReferenceRuntimeRoot = runtime.referenceRuntimeRoot ?? null;
    this.defaultCompatibilitySidecarRoot = runtime.compatibilitySidecarRoot ?? null;
    this.defaultCompatibilityFixtureRoot = runtime.compatibilityFixtureRoot ?? null;
    this.defaultBridgeStatus = runtime.bridgeStatus || 'bridge-ready';
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthExternalCapabilityInventorySnapshot {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const roots = {
      'reference-runtime': path.resolve(input.referenceRuntimeRoot || this.defaultReferenceRuntimeRoot || path.join(projectRoot, '..', '..', 'temp_reference_runtime_analysis')),
      'acp-compatible-sidecar': path.resolve(
        input.compatibilitySidecarRoot
          || this.defaultCompatibilitySidecarRoot
          || process.env.ZAVORTH_ACP_COMPATIBLE_SIDECAR_ROOT
          || 'C:\\Users\\ermys\\.gemini\\zavorthBridge\\scratch\\acp-compatible-sidecar',
      ),
    } satisfies Record<ZavorthExternalRuntimeSourceRuntimeId, string>;
    const compatibilityFixtureRoot =
      input.compatibilityFixtureRoot
      || this.defaultCompatibilityFixtureRoot
      || process.env.ZAVORTH_ACP_COMPATIBILITY_FIXTURE_ROOT
      || '\\\\wsl.localhost\\Ubuntu-24.04\\home\\grey\\acp-compatible-sidecar-src';
    const sourceProbes = this.buildSourceProbes(projectRoot, roots, compatibilityFixtureRoot);
    const items = INVENTORY_ITEMS.map((definition) => this.materializeItem(definition, roots));
    const decisionSummary = buildDecisionSummary(items);
    const status = this.resolveStatus(input.bridgeStatus || this.defaultBridgeStatus, sourceProbes, items);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      phase: 'checkpoint-0-freeze-and-inventory',
      bridgeContractVersion: ZAVORTH_EXTERNAL_RUNTIME_BRIDGE_CONTRACT_VERSION,
      bridgeStatus: input.bridgeStatus || this.defaultBridgeStatus,
      sourceProbes,
      items,
      decisionSummary,
      freezePolicy: {
        noRuntimeMixing: true,
        noSourceRuntimeNamingAsPublicIdentity: true,
        noImplementationBeyondReadOnlyInventory: true,
        sourceNamesAllowedOnlyInDiagnostics: true,
        importedCapabilitiesAdvisoryOnly: true,
        nextStageRequiresContractLayer: true,
      },
      safety: {
        executionPerformed: false,
        sourceRuntimeCodeExecuted: false,
        dependencyInstallPerformed: false,
        sidecarsStarted: false,
        toolsExposed: false,
        filesMutatedOutsideZavorthInventory: false,
        publicIdentityLeak: false,
      },
      commands: {
        inspect: 'npm run zavorth:external-capability-inventory',
        inspectJson: 'npm run zavorth:external-capability-inventory:json',
        check: 'npm run zavorth:external-capability-inventory:check --silent',
        nextStage: '291 Intent model - Zavorth Contract Layer',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthExternalCapabilityInventorySnapshot): string {
    const lines = [
      'Zavorth External Runtime Security contract Inventory',
      '',
      `Status: ${snapshot.status}`,
      `Bridge: ${snapshot.bridgeStatus}`,
      `Items: ${snapshot.decisionSummary.total} | absorb=${snapshot.decisionSummary.absorb} | adapt=${snapshot.decisionSummary.adapt} | externalize=${snapshot.decisionSummary.externalize} | reject=${snapshot.decisionSummary.reject}`,
      `Source path missing refs: ${snapshot.decisionSummary.sourcePathMissing}`,
      `Execution performed: ${snapshot.safety.executionPerformed}`,
      '',
      'Source probes:',
      ...snapshot.sourceProbes.map((probe) => `- ${probe.runtimeId}: ${probe.availability} | required=${probe.required} | ${probe.rootPath}`),
      '',
      'Inventory:',
    ];

    for (const entry of snapshot.items) {
      lines.push(`- P${entry.priority} ${entry.id}: ${entry.decision} -> ${entry.targetPhase}`);
      lines.push(`  behavior: ${entry.observedBehavior}`);
      lines.push(`  gate: ${entry.acceptanceGate}`);
    }

    lines.push('', `Next: ${snapshot.commands.nextStage}`);
    return lines.join('\n');
  }

  private buildSourceProbes(
    projectRoot: string,
    roots: Record<ZavorthExternalRuntimeSourceRuntimeId, string>,
    compatibilityFixtureRoot: string,
  ): ZavorthExternalCapabilityInventorySourceProbe[] {
    const probeDefinitions: SourceProbeDefinition[] = [
      {
        runtimeId: 'reference-runtime',
        label: 'Reference runtime fixture',
        rootPath: roots['reference-runtime'],
        required: false,
        expected: [
          ['agent/error_classifier.py', 'error classifier reference'],
          ['agent/curator.py', 'skill curator reference'],
          ['run_agent.py', 'agent run loop reference'],
        ],
        evidenceDocs: REFERENCE_RUNTIME_DOCS,
      },
      {
        runtimeId: 'acp-compatible-sidecar',
        label: 'ACP-compatible sidecar source',
        rootPath: roots['acp-compatible-sidecar'],
        required: false,
        expected: [
          ['extensions', 'extension catalog root'],
          ['packages/plugin-sdk', 'plugin SDK reference'],
          ['src/channels', 'channel runtime reference'],
          ['skills', 'packaged skills root'],
        ],
        evidenceDocs: ACP_COMPATIBILITY_DOCS,
      },
      {
        runtimeId: 'acp-compatibility-fixture',
        label: 'ACP compatibility fixture clone',
        rootPath: compatibilityFixtureRoot,
        required: false,
        expected: [
          ['extensions', 'WSL extension catalog root'],
          ['packages/plugin-sdk', 'WSL plugin SDK reference'],
          ['src/channels', 'WSL channel runtime reference'],
          ['skills', 'WSL packaged skills root'],
        ],
        evidenceDocs: ACP_COMPATIBILITY_DOCS,
      },
    ];

    return probeDefinitions.map((entry) => {
      const present = this.existsSyncImpl(entry.rootPath);
      const expectedPaths = entry.expected.map(([relativePath, purpose]) => {
        const fullPath = path.join(entry.rootPath, relativePath);
        return { path: fullPath, present: this.existsSyncImpl(fullPath), purpose };
      });
      const evidenceDocs = entry.evidenceDocs.map((docPath) => path.join(projectRoot, docPath));
      return {
        runtimeId: entry.runtimeId,
        label: entry.label,
        rootPath: entry.rootPath,
        required: entry.required,
        present,
        availability: present ? 'source-present' : evidenceDocs.some((docPath) => this.existsSyncImpl(docPath)) ? 'docs-only' : 'missing',
        expectedPaths,
        evidenceDocs,
        observedTopLevel: this.readTopLevel(entry.rootPath, present),
        safety: {
          readOnlyProbe: true,
          noSourceRuntimeCodeExecuted: true,
          noDependencyInstall: true,
          noSidecarStarted: true,
          noToolExposed: true,
        },
      } satisfies ZavorthExternalCapabilityInventorySourceProbe;
    });
  }

  private materializeItem(
    definition: InventoryItemDefinition,
    roots: Record<ZavorthExternalRuntimeSourceRuntimeId, string>,
  ): ZavorthExternalCapabilityInventoryItem {
    return {
      id: definition.id,
      title: definition.title,
      sourceRuntimeIds: [...definition.sourceRuntimeIds],
      bridgeCandidateId: definition.bridgeCandidateId,
      decision: definition.decision,
      targetPhase: definition.targetPhase,
      priority: definition.priority,
      risk: definition.risk,
      naturalFirstRoute: definition.naturalFirstRoute,
      sourcePaths: definition.sourcePaths.map((sourcePath) => {
        const fullPath = path.join(roots[sourcePath.runtimeId], sourcePath.relativePath);
        return {
          runtimeId: sourcePath.runtimeId,
          path: fullPath,
          present: this.existsSyncImpl(fullPath),
          role: sourcePath.role,
        };
      }),
      evidenceDocs: [...definition.evidenceDocs],
      observedBehavior: definition.observedBehavior,
      stateConfigDependencies: [...definition.stateConfigDependencies],
      securityBoundary: {
        readOnlyInventoryOnly: true,
        noImplementationCopied: true,
        noSourceRuntimeCodeExecution: true,
        noDirectToolExposure: true,
        noExternalReplyBypass: true,
        approvalRequiredForLive: definition.approvalRequiredForLive,
        provenanceRequired: definition.provenanceRequired,
      },
      zavorthEquivalent: { ...definition.zavorthEquivalent },
      acceptanceGate: definition.acceptanceGate,
      notes: [...definition.notes],
    };
  }

  private readTopLevel(rootPath: string, present: boolean): ZavorthExternalCapabilityInventorySourceProbe['observedTopLevel'] {
    if (!present) {
      return { files: 0, dirs: 0, names: [] };
    }
    try {
      const entries = this.readdirSyncImpl(rootPath, { withFileTypes: true }) as fs.Dirent[];
      const names = entries.slice(0, 40).map((entry) => entry.name);
      return {
        files: entries.filter((entry) => entry.isFile()).length,
        dirs: entries.filter((entry) => entry.isDirectory()).length,
        names,
      };
    } catch (error: unknown) {logger.warn('[Zavorth External Capability Inventory] filesystem operation failed', error);
    return { files: 0, dirs: 0, names: [] };
  }
  }

  private resolveStatus(
    bridgeStatus: ZavorthExternalRuntimeBridgeStatus,
    probes: ZavorthExternalCapabilityInventorySourceProbe[],
    items: ZavorthExternalCapabilityInventoryItem[],
  ): ZavorthExternalCapabilityInventoryStatus {
    if (bridgeStatus !== 'bridge-ready') {
      return 'blocked';
    }
    if (items.some((entry) => !entry.decision || !entry.acceptanceGate || entry.sourcePaths.length === 0)) {
      return 'blocked';
    }
    if (probes.some((entry) => entry.required && entry.availability === 'missing')) {
      return 'attention';
    }
    return 'inventory-ready';
  }
}

function item(input: Omit<InventoryItemDefinition, 'notes'> & { notes?: string[] }): InventoryItemDefinition {
  return {
    ...input,
    notes: input.notes || [],
  };
}

function referenceRuntimePath(relativePath: string, role: string): InventoryItemDefinition['sourcePaths'][number] {
  return { runtimeId: 'reference-runtime', relativePath, role };
}

function compatibilitySidecarPath(relativePath: string, role: string): InventoryItemDefinition['sourcePaths'][number] {
  return { runtimeId: 'acp-compatible-sidecar', relativePath, role };
}

function owner(
  contract: string,
  service: string,
  zavorthControlProjection: string,
): ZavorthExternalCapabilityInventoryItem['zavorthEquivalent'] {
  return {
    contract,
    service,
    zavorthControlProjection,
    publicName: 'Zavorth',
  };
}

function buildDecisionSummary(items: ZavorthExternalCapabilityInventoryItem[]): ZavorthExternalCapabilityInventorySnapshot['decisionSummary'] {
  const count = (decision: ZavorthExternalRuntimeDecision) => items.filter((entry) => entry.decision === decision).length;
  return {
    total: items.length,
    absorb: count('absorb'),
    adapt: count('adapt'),
    externalize: count('externalize'),
    replace: count('replace'),
    reject: count('reject'),
    approvalRequiredForLive: items.filter((entry) => entry.securityBoundary.approvalRequiredForLive).length,
    sourcePathMissing: items.reduce((total, entry) => total + entry.sourcePaths.filter((sourcePath) => !sourcePath.present).length, 0),
    docsEvidenceCount: new Set(items.flatMap((entry) => entry.evidenceDocs)).size,
  };
}
