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
  hermesRoot?: string | null;
  openClawRoot?: string | null;
  openClawWslRoot?: string | null;
  bridgeStatus?: ZavorthExternalRuntimeBridgeStatus;
  existsSync?: typeof fs.existsSync;
  readdirSync?: typeof fs.readdirSync;
};

type SnapshotInput = {
  projectRoot?: string | null;
  hermesRoot?: string | null;
  openClawRoot?: string | null;
  openClawWslRoot?: string | null;
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

const HERMES_DOCS = [
  'docs/291-zavorth-external-runtime-absorption-plan.md',
  'docs/292-natural-first-agent-runtime-pack.md',
];

const OPENCLAW_DOCS = [
  'docs/345-zavorth-openclaw-total-parity-audit-private.md',
  'docs/348-zavorth-openclaw-parity-matrix-private.md',
  'docs/399-zavorth-openclaw-full-surface-audit-private.md',
];

const INVENTORY_ITEMS: InventoryItemDefinition[] = [
  item({
    id: 'hermes:error-classifier',
    title: 'Centralized error classification and recovery strategy',
    sourceRuntimeIds: ['hermes'],
    bridgeCandidateId: 'error-classifier',
    decision: 'absorb',
    targetPhase: 'phase-2-native-engine',
    priority: 1,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      hermesPath('agent/error_classifier.py', 'error taxonomy and recovery strategy reference'),
      hermesPath('agent/retry_utils.py', 'retry/backoff behavior reference'),
      hermesPath('agent/rate_limit_tracker.py', 'rate-limit tracking reference'),
    ],
    evidenceDocs: HERMES_DOCS,
    observedBehavior: 'Classifies operational, provider, rate-limit, permission, context, billing, and syntax failures into recovery strategies.',
    stateConfigDependencies: ['provider error payloads', 'terminal stderr/stdout', 'retry budget', 'operator approval policy'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthErrorClassifierContract', 'ZavorthErrorClassifierService', 'CommandCenterErrorRecoveryStrategy'),
    acceptanceGate: 'Classifies representative provider/terminal/context failures and emits a Zavorth recovery receipt without retrying by itself.',
  }),
  item({
    id: 'hermes:tool-call-repair',
    title: 'Malformed tool-call and JSON repair',
    sourceRuntimeIds: ['hermes'],
    bridgeCandidateId: 'tool-call-repair',
    decision: 'absorb',
    targetPhase: 'phase-2-native-engine',
    priority: 2,
    risk: 'medium',
    naturalFirstRoute: 'tool-preview',
    sourcePaths: [
      hermesPath('run_agent.py', 'tool-call parsing and repair reference'),
      hermesPath('agent/tool_guardrails.py', 'tool safety reference'),
      hermesPath('agent/gemini_schema.py', 'schema-shaping reference'),
    ],
    evidenceDocs: HERMES_DOCS,
    observedBehavior: 'Repairs common malformed tool arguments before the tool layer sees them.',
    stateConfigDependencies: ['tool schema catalog', 'raw model tool-call payload', 'approval context', 'repair receipt store'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthToolCallRepairContract', 'ZavorthToolCallRepairService', 'CommandCenterToolCallRepairReceipt'),
    acceptanceGate: 'Repair is parser/AST-first, cannot add authority, and dangerous repaired calls remain approval-gated.',
  }),
  item({
    id: 'hermes:safe-tool-parallelism',
    title: 'Safe tool parallelism by resource/write set',
    sourceRuntimeIds: ['hermes'],
    bridgeCandidateId: 'safe-tool-parallelism',
    decision: 'absorb',
    targetPhase: 'phase-2-native-engine',
    priority: 3,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      hermesPath('run_agent.py', 'tool batch scheduling reference'),
      hermesPath('agent/file_safety.py', 'file safety reference'),
      hermesPath('agent/tool_guardrails.py', 'tool guardrail reference'),
    ],
    evidenceDocs: HERMES_DOCS,
    observedBehavior: 'Parallelizes independent tool batches and serializes conflicts around shared files/resources.',
    stateConfigDependencies: ['tool resource declarations', 'workspace path policy', 'write intent detector', 'run budget'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthSafeToolParallelismContract', 'ZavorthSafeToolParallelismService', 'CommandCenterSafeParallelismPlan'),
    acceptanceGate: 'Same-file writes and unknown resources serialize; parallel execution emits conflict receipts.',
  }),
  item({
    id: 'hermes:skill-curator',
    title: 'Skill curator with dry-run, merge, archive, pinning, and rollback',
    sourceRuntimeIds: ['hermes'],
    bridgeCandidateId: 'skill-curator',
    decision: 'absorb',
    targetPhase: 'phase-2-native-engine',
    priority: 4,
    risk: 'high',
    naturalFirstRoute: 'approval-proposal',
    sourcePaths: [
      hermesPath('agent/curator.py', 'skill curation reference'),
      hermesPath('agent/skill_utils.py', 'skill library utility reference'),
      hermesPath('agent/skill_preprocessing.py', 'skill preprocessing reference'),
    ],
    evidenceDocs: HERMES_DOCS,
    observedBehavior: 'Reviews skills, discourages micro-skills, merges duplicates, and proposes cleanup of unused or session-specific material.',
    stateConfigDependencies: ['skill library index', 'usage/failure receipts', 'diff snapshot store', 'rollback artifact store', 'approval envelope'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthSkillCuratorContract', 'ZavorthSkillCuratorService', 'CommandCenterSkillCurationPlan'),
    acceptanceGate: 'Produces a dry-run diff and rollback snapshot; no skill write occurs without Zavorth approval.',
  }),
  item({
    id: 'hermes:procedural-memory',
    title: 'Procedural memory for commands, failures, and recovery paths',
    sourceRuntimeIds: ['hermes'],
    bridgeCandidateId: 'procedural-memory',
    decision: 'absorb',
    targetPhase: 'phase-6-sessions-memory-continuation',
    priority: 5,
    risk: 'medium',
    naturalFirstRoute: 'memory-recall',
    sourcePaths: [
      hermesPath('agent/memory_manager.py', 'memory management reference'),
      hermesPath('agent/trajectory.py', 'run trajectory and experience reference'),
      hermesPath('agent/context_engine.py', 'context retrieval reference'),
    ],
    evidenceDocs: HERMES_DOCS,
    observedBehavior: 'Keeps useful operational experience such as successful commands, failed commands, workarounds, and recovery strategies.',
    stateConfigDependencies: ['run observatory receipts', 'memory receipts', 'redaction policy', 'forget/correct commands'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthProceduralMemoryContract', 'ZavorthProceduralMemoryService', 'CommandCenterProceduralMemoryReceipts'),
    acceptanceGate: 'Every procedural memory has provenance and can be cited, corrected, or forgotten.',
  }),
  item({
    id: 'openclaw:extension-inventory',
    title: 'Extension and capability inventory',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: 'external-capability-inventory',
    decision: 'adapt',
    targetPhase: 'phase-0-inventory',
    priority: 6,
    risk: 'medium',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('extensions', 'extension/capability catalog root'),
      openClawPath('skills', 'packaged skills catalog root'),
      openClawPath('packages/plugin-package-contract', 'plugin package manifest contract reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Large ecosystem inventory across extensions, skills, channels, providers, media, memory, tools, docs, and QA surfaces.',
    stateConfigDependencies: ['extension manifests', 'skill manifests', 'plugin package metadata', 'source trust policy'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthExternalCapabilityInventoryContract', 'ZavorthExternalCapabilityInventoryService', 'CommandCenterExternalCapabilityInventory'),
    acceptanceGate: 'Each external capability receives a Zavorth decision, source path, risk, equivalent, and proof gate before exposure.',
  }),
  item({
    id: 'openclaw:channel-gateway-normalization',
    title: 'Channel gateway normalization',
    sourceRuntimeIds: ['openclaw', 'hermes'],
    bridgeCandidateId: 'channel-gateway-normalization',
    decision: 'adapt',
    targetPhase: 'phase-5-channels-messaging',
    priority: 7,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('src/channels', 'channel runtime contracts'),
      openClawPath('extensions/telegram', 'Telegram channel maturity reference'),
      openClawPath('extensions/discord', 'Discord channel maturity reference'),
      openClawPath('extensions/slack', 'Slack channel maturity reference'),
      hermesPath('gateway', 'Hermes gateway reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Normalizes broad chat/channel events and outbound channel replies across many transports.',
    stateConfigDependencies: ['channel credentials', 'session mapping', 'reply ports', 'trust policy', 'rate limits'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthExternalChannelGatewayContract', 'ZavorthExternalChannelGatewayService', 'CommandCenterExternalChannelGateway'),
    acceptanceGate: 'One inbound event enters ZavorthAgentGateway; outbound dry-run is evaluated by Zavorth policy and real send requires approval.',
  }),
  item({
    id: 'openclaw:provider-model-mesh',
    title: 'Provider and model ecosystem breadth',
    sourceRuntimeIds: ['openclaw', 'hermes'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'phase-4-capability-providers',
    priority: 8,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('extensions/amazon-bedrock', 'Bedrock provider reference'),
      openClawPath('extensions/anthropic', 'Anthropic provider reference'),
      openClawPath('extensions/deepinfra', 'long-tail provider reference'),
      openClawPath('src/model-catalog', 'model catalog reference'),
      hermesPath('agent/anthropic_adapter.py', 'Hermes provider adapter reference'),
      hermesPath('agent/bedrock_adapter.py', 'Hermes Bedrock adapter reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Broad provider/model adapter ecosystem with live probes, model catalogs, and provider-specific credential behavior.',
    stateConfigDependencies: ['credential refs', 'provider catalog', 'model metadata', 'billing/rate-limit policy', 'egress guard'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthProviderMeshExpansionContract', 'ZavorthProviderMeshExpansionService', 'CommandCenterProviderMesh'),
    acceptanceGate: 'Provider metadata imports as catalog evidence only; live provider calls require existing Zavorth provider policy.',
  }),
  item({
    id: 'openclaw:plugin-sdk-runtime',
    title: 'Plugin SDK and runtime package surface',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'phase-4-capability-providers',
    priority: 9,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('packages/plugin-sdk', 'public plugin SDK package reference'),
      openClawPath('src/plugin-sdk', 'runtime SDK source reference'),
      openClawPath('src/plugins', 'plugin loader/lifecycle reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Exposes a public plugin SDK, package manifests, lifecycle hooks, install/update flows, and extension release mechanics.',
    stateConfigDependencies: ['plugin manifest schema', 'source trust registry', 'package provenance', 'content scan', 'owner approval'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthPluginOsContract', 'ZavorthPluginOsService', 'CommandCenterPluginOs'),
    acceptanceGate: 'Imported plugins remain quarantined until manifest, provenance, license, prompt-injection, and approval gates pass.',
  }),
  item({
    id: 'openclaw:memory-host-sdk',
    title: 'Memory host SDK and memory plugin surface',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: 'procedural-memory',
    decision: 'adapt',
    targetPhase: 'phase-6-sessions-memory-continuation',
    priority: 10,
    risk: 'medium',
    naturalFirstRoute: 'memory-recall',
    sourcePaths: [
      openClawPath('packages/memory-host-sdk', 'memory host SDK reference'),
      openClawPath('src/memory', 'memory runtime source reference'),
      openClawPath('extensions/memory-core', 'memory-core plugin reference'),
      openClawPath('extensions/memory-lancedb', 'vector memory plugin reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Memory host package and plugins provide storage, query, embeddings, local vector, and multimodal memory surfaces.',
    stateConfigDependencies: ['memory backend', 'embedding provider', 'privacy filtering', 'retention policy', 'receipt ledger'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthMemoryDocumentTerminalContract', 'MemoryWithReceiptsService', 'CommandCenterMemoryWithReceipts'),
    acceptanceGate: 'Imported memories are advisory until normalized with receipt provenance and forget/correct affordances.',
  }),
  item({
    id: 'openclaw:delegated-workers',
    title: 'Delegated workers and task orchestration',
    sourceRuntimeIds: ['openclaw', 'hermes'],
    bridgeCandidateId: 'delegated-workers',
    decision: 'adapt',
    targetPhase: 'phase-7-delegated-workers',
    priority: 11,
    risk: 'high',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      openClawPath('src/agents', 'agent runtime reference'),
      openClawPath('src/tasks', 'task runtime reference'),
      openClawPath('src/trajectory', 'worker trajectory reference'),
      hermesPath('run_agent.py', 'Hermes agent run loop reference'),
    ],
    evidenceDocs: [...HERMES_DOCS, ...OPENCLAW_DOCS],
    observedBehavior: 'Breaks work into agent/task/trajectory units and can delegate bounded work to runtimes or workers.',
    stateConfigDependencies: ['task envelope', 'worker descriptor', 'timeout/cancellation policy', 'artifact mapping', 'approval envelope'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthDelegatedWorkerBridgeContract', 'ZavorthDelegatedWorkerBridgeService', 'CommandCenterDelegatedWorkerBridge'),
    acceptanceGate: 'Worker dispatch is dry-run first, launch is approval-gated, and results return only as Zavorth artifacts/events/status.',
  }),
  item({
    id: 'openclaw:native-apps',
    title: 'Native Android, iOS, macOS, and companion app surfaces',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: null,
    decision: 'externalize',
    targetPhase: 'phase-8-native-replacement',
    priority: 12,
    risk: 'high',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('apps/android', 'Android native app reference'),
      openClawPath('apps/ios', 'iOS/watch/share extension reference'),
      openClawPath('apps/macos', 'macOS app reference'),
      openClawPath('apps/shared/OpenClawKit', 'shared native kit reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Native apps and device companions add mobile/desktop UX, signing, release, watch/share extensions, and appcast behavior.',
    stateConfigDependencies: ['platform signing', 'native build chain', 'device pairing', 'release feed', 'owner product decision'],
    approvalRequiredForLive: true,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthNativeCompanionDeviceContract', 'ZavorthNativeCompanionDeviceService', 'CommandCenterNativeCompanion'),
    acceptanceGate: 'Owner chooses native wrappers or certifies PWA/companion replacement before any native app work starts.',
  }),
  item({
    id: 'openclaw:qa-release-security',
    title: 'QA, release, security, Docker, and workflow matrix',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: null,
    decision: 'adapt',
    targetPhase: 'phase-8-native-replacement',
    priority: 13,
    risk: 'medium',
    naturalFirstRoute: 'governed-execution',
    sourcePaths: [
      openClawPath('scripts', 'script/check/release matrix reference'),
      openClawPath('qa', 'scenario catalog reference'),
      openClawPath('security/opengrep', 'OpenGrep rule reference'),
      openClawPath('.github/workflows', 'CI workflow reference'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Large QA/live/Docker/security/release matrix with scenario assets, opengrep rules, and CI workflow coverage.',
    stateConfigDependencies: ['local QA runner', 'security rule metadata', 'release channel policy', 'CI parity decision'],
    approvalRequiredForLive: false,
    provenanceRequired: true,
    zavorthEquivalent: owner('ZavorthQaSecurityReleaseCertificationContract', 'ZavorthQaSecurityReleaseCertificationService', 'CommandCenterReleaseReadiness'),
    acceptanceGate: 'Convert only valuable scenarios into Zavorth-native checks; do not copy workflow YAML blindly.',
  }),
  item({
    id: 'openclaw:docs-ui-surface',
    title: 'Docs, i18n, and Vite/Lit control UI',
    sourceRuntimeIds: ['openclaw'],
    bridgeCandidateId: null,
    decision: 'reject',
    targetPhase: 'phase-0-inventory',
    priority: 14,
    risk: 'low',
    naturalFirstRoute: 'capability-discovery',
    sourcePaths: [
      openClawPath('docs', 'Mintlify docs and i18n reference'),
      openClawPath('ui', 'Vite/Lit control UI reference'),
      openClawPath('vendor', 'vendored UI/reference material'),
    ],
    evidenceDocs: OPENCLAW_DOCS,
    observedBehavior: 'Public docs, i18n tooling, and separate control UI are useful comparison material but not a direct Zavorth runtime target.',
    stateConfigDependencies: ['docs product decision', 'i18n roadmap', 'Command Center UX comparison'],
    approvalRequiredForLive: false,
    provenanceRequired: false,
    zavorthEquivalent: owner('ZavorthPublicSiteDocsDemoSyncContract', 'PublicSiteDocsDemoSyncService', 'CommandCenterPublicDocsSync'),
    acceptanceGate: 'Use as checklist input only; no source UI/docs copy unless a separate product decision approves it.',
  }),
];

export class ZavorthExternalCapabilityInventoryService {
  private readonly now: () => Date;
  private readonly defaultProjectRoot: string;
  private readonly defaultHermesRoot: string | null;
  private readonly defaultOpenClawRoot: string | null;
  private readonly defaultOpenClawWslRoot: string | null;
  private readonly defaultBridgeStatus: ZavorthExternalRuntimeBridgeStatus;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly readdirSyncImpl: typeof fs.readdirSync;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultProjectRoot = runtime.projectRoot || process.cwd();
    this.defaultHermesRoot = runtime.hermesRoot ?? null;
    this.defaultOpenClawRoot = runtime.openClawRoot ?? null;
    this.defaultOpenClawWslRoot = runtime.openClawWslRoot ?? null;
    this.defaultBridgeStatus = runtime.bridgeStatus || 'bridge-ready';
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthExternalCapabilityInventorySnapshot {
    const projectRoot = path.resolve(input.projectRoot || this.defaultProjectRoot);
    const roots = {
      hermes: path.resolve(input.hermesRoot || this.defaultHermesRoot || path.join(projectRoot, '..', '..', 'temp_hermes_analysis')),
      openclaw: path.resolve(
        input.openClawRoot
          || this.defaultOpenClawRoot
          || process.env.ZAVORTH_OPENCLAW_ROOT
          || 'C:\\Users\\ermys\\.gemini\\zavorthBridge\\scratch\\openclaw',
      ),
    } satisfies Record<ZavorthExternalRuntimeSourceRuntimeId, string>;
    const openClawWslRoot =
      input.openClawWslRoot
      || this.defaultOpenClawWslRoot
      || process.env.ZAVORTH_OPENCLAW_WSL_ROOT
      || '\\\\wsl.localhost\\Ubuntu-24.04\\home\\grey\\openclaw-src';
    const sourceProbes = this.buildSourceProbes(projectRoot, roots, openClawWslRoot);
    const items = INVENTORY_ITEMS.map((definition) => this.materializeItem(definition, roots));
    const decisionSummary = buildDecisionSummary(items);
    const status = this.resolveStatus(input.bridgeStatus || this.defaultBridgeStatus, sourceProbes, items);

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_EXTERNAL_CAPABILITY_INVENTORY_CONTRACT_VERSION,
      status,
      planId: '291 - Plano Zavorth External Runtime Absorption',
      phase: 'phase-0-freeze-and-inventory',
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
        nextPhaseRequiresContractLayer: true,
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
        nextPhase: '291 Phase 1 - Zavorth Contract Layer',
      },
    };
  }

  public formatSnapshotText(snapshot: ZavorthExternalCapabilityInventorySnapshot): string {
    const lines = [
      'Zavorth External Runtime Phase 0 Inventory',
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

    lines.push('', `Next: ${snapshot.commands.nextPhase}`);
    return lines.join('\n');
  }

  private buildSourceProbes(
    projectRoot: string,
    roots: Record<ZavorthExternalRuntimeSourceRuntimeId, string>,
    openClawWslRoot: string,
  ): ZavorthExternalCapabilityInventorySourceProbe[] {
    const probeDefinitions: SourceProbeDefinition[] = [
      {
        runtimeId: 'hermes',
        label: 'Hermes reference runtime',
        rootPath: roots.hermes,
        required: true,
        expected: [
          ['agent/error_classifier.py', 'error classifier reference'],
          ['agent/curator.py', 'skill curator reference'],
          ['run_agent.py', 'agent run loop reference'],
        ],
        evidenceDocs: HERMES_DOCS,
      },
      {
        runtimeId: 'openclaw',
        label: 'OpenClaw capability source',
        rootPath: roots.openclaw,
        required: true,
        expected: [
          ['extensions', 'extension catalog root'],
          ['packages/plugin-sdk', 'plugin SDK reference'],
          ['src/channels', 'channel runtime reference'],
          ['skills', 'packaged skills root'],
        ],
        evidenceDocs: OPENCLAW_DOCS,
      },
      {
        runtimeId: 'openclaw-wsl',
        label: 'OpenClaw WSL source clone',
        rootPath: openClawWslRoot,
        required: false,
        expected: [
          ['extensions', 'WSL extension catalog root'],
          ['packages/plugin-sdk', 'WSL plugin SDK reference'],
          ['src/channels', 'WSL channel runtime reference'],
          ['skills', 'WSL packaged skills root'],
        ],
        evidenceDocs: OPENCLAW_DOCS,
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
    } catch {
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

function hermesPath(relativePath: string, role: string): InventoryItemDefinition['sourcePaths'][number] {
  return { runtimeId: 'hermes', relativePath, role };
}

function openClawPath(relativePath: string, role: string): InventoryItemDefinition['sourcePaths'][number] {
  return { runtimeId: 'openclaw', relativePath, role };
}

function owner(
  contract: string,
  service: string,
  commandCenterProjection: string,
): ZavorthExternalCapabilityInventoryItem['zavorthEquivalent'] {
  return {
    contract,
    service,
    commandCenterProjection,
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
