import type { CapabilitySourceMapping } from '../contracts/CapabilityNormalizationContract.js';
import type { ChannelMeshConsistencyEntry } from '../contracts/ChannelMeshConsistencyContract.js';
import type {
  LiveReadinessEntry,
  LiveReadinessGate,
  LiveReadinessGateStatus,
  LiveReadinessGapGroup,
  LiveReadinessProfile,
  LiveReadinessSnapshot,
  LiveReadinessStatus,
} from '../contracts/LiveReadinessContract.js';
import { ZAVORTH_LIVE_READINESS_CONTRACT_VERSION } from '../contracts/LiveReadinessContract.js';
import { ChannelMeshConsistencyService } from './ChannelMeshConsistencyService.js';

import type { ProviderMeshReadinessProviderEntry } from '../contracts/ProviderMeshReadinessContract.js';
import type { RuntimeFamilyClosureEntry } from '../contracts/RuntimeFamilyClosureContract.js';
import {
  CapabilityNormalizationService,
  DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES,
} from './CapabilityNormalizationService.js';

import { ProviderMeshReadinessService } from './ProviderMeshReadinessService.js';
import { RuntimeFamilyClosureService } from './RuntimeFamilyClosureService.js';

type LiveReadinessRuntime = {
  now?: () => Date;
  sourceModules?: string[];
  normalizationService?: CapabilityNormalizationService;
  providerMeshReadinessService?: ProviderMeshReadinessService;
  channelMeshConsistencyService?: ChannelMeshConsistencyService;
  runtimeFamilyClosureService?: RuntimeFamilyClosureService;
};

type LiveClassification = {
  status: LiveReadinessStatus;
  profileFloor: LiveReadinessProfile;
  recommendedPhase: string;
  reason: string;
  liveAdapterTarget: string | null;
  requiredConfig: string[];
  gaps: string[];
  gates: LiveReadinessGate[];
};

const CHANNEL_LIVE_READY = new Set(['telegram']);
const CHANNEL_PARTIAL_LIVE = new Set([
  'bluebubbles',
  'clickclack',
  'discord',
  'feishu',
  'googlechat',
  'imessage',
  'irc',
  'line',
  'matrix',
  'mattermost',
  'msteams',
  'nextcloud-talk',
  'nostr',
  'qqbot',
  'signal',
  'slack',
  'synology-chat',
  'tlon',
  'twitch',
  'webhooks',
  'whatsapp',
  'wecom',
  'weixin',
  'wechat',
  'zalo',
  'zalouser',
  'yuanbao',
  'sms',
  'home-assistant',
]);
const CHANNEL_DRY_RUN_ONLY = new Set<string>();
const CHANNEL_PLANNED = new Set<string>();
const CHANNEL_TEMPLATE_ONLY = new Set<string>();

const RUNTIME_PARTIAL_LIVE = new Set([
  'file.transfer',
  'document.extract',
  'diagnostics.trace',
  'migration.import',
  'qa.scenario',
  'media.generate',
  'media.understand',
  'search.query',
  'speech.transcribe',
  'speech.synthesize',
  'voice.session',
  'web.extract',
  'device.invoke',
]);

const RUNTIME_DRY_RUN_ONLY = new Set<string>();

const PROVIDER_P0_PARTIAL_LIVE = new Set([
  'anthropic',
  'deepinfra',
  'deepseek',
  'fireworks',
  'google',
  'groq',
  'huggingface',
  'lmstudio',
  'mistral',
  'ollama',
  'openai',
  'openrouter',
  'perplexity',
  'qwen',
  'together',
  'vercel-ai-gateway',
  'vllm',
  'xai',
]);

const PROVIDER_LONG_TAIL_PARTIAL_LIVE = new Set([
  'alibaba',
  'amazon-bedrock',
  'amazon-bedrock-mantle',
  'anthropic-vertex',
  'arcee',
  'cerebras',
  'chutes',
  'cloudflare-ai-gateway',
  'copilot-proxy',
  'github-copilot',
  'gradium',
  'kilocode',
  'kimi-coding',
  'litellm',
  'microsoft',
  'microsoft-foundry',
  'moonshot',
  'nvidia',
  'opencode',
  'opencode-go',
  'qianfan',
  'sglang',
  'stepfun',
  'tencent',
  'tokenjuice',
  'venice',
  'voyage',
  'xiaomi',
  'zai',
]);

export class LiveReadinessService {
  private readonly now: () => Date;
  private readonly sourceModules: string[];
  private readonly normalization: CapabilityNormalizationService;
  private readonly providerMesh: ProviderMeshReadinessService;
  private readonly channelMesh: ChannelMeshConsistencyService;
  private readonly runtimeFamilies: RuntimeFamilyClosureService;

  constructor(runtime: LiveReadinessRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.sourceModules = runtime.sourceModules || DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES;
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService({
      now: this.now,
      sourceModules: this.sourceModules,
    });
    this.providerMesh = runtime.providerMeshReadinessService || new ProviderMeshReadinessService({
      now: this.now,
      normalizationService: this.normalization,
    });
    this.channelMesh = runtime.channelMeshConsistencyService || new ChannelMeshConsistencyService({
      now: this.now,
      normalizationService: this.normalization,
    });
    this.runtimeFamilies = runtime.runtimeFamilyClosureService || new RuntimeFamilyClosureService({
      now: this.now,
      normalizationService: this.normalization,
      sourceModules: this.sourceModules,
    });
  }

  public buildSnapshot(): LiveReadinessSnapshot {
    const normalizationSnapshot = this.normalization.buildSnapshot({ sourceModules: this.sourceModules });
    const mappings = normalizationSnapshot.mappings;
    const providerSources = mappings
      .filter((mapping) => mapping.primitiveId === 'provider.call')
      .map((mapping) => mapping.sourceName);
    const channelSources = mappings
      .filter((mapping) => mapping.primitiveId === 'channel.message')
      .map((mapping) => mapping.sourceName);
    const providerSnapshot = this.providerMesh.buildSnapshot({ sourceProviders: providerSources });
    const channelSnapshot = this.channelMesh.buildSnapshot({ sourceChannels: channelSources });
    const runtimeSnapshot = this.runtimeFamilies.buildSnapshot();

    const providerEntries = new Map(providerSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const channelEntries = new Map(channelSnapshot.entries.map((entry) => [entry.normalizedSourceName, entry]));
    const runtimeEntries = new Map(runtimeSnapshot.entries.map((entry) => [entry.primitiveId, entry]));
    const entries = mappings
      .map((mapping) => this.buildEntry(
        mapping,
        providerEntries.get(mapping.normalizedSourceName) || null,
        channelEntries.get(mapping.normalizedSourceName) || null,
        mapping.primitiveId ? runtimeEntries.get(mapping.primitiveId) || null : null,
      ))
      .sort((left, right) => left.id.localeCompare(right.id));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = this.countStatus(entries, 'blocked');
    const notFullyLive = entries.filter((entry) => entry.status !== 'live-ready').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_LIVE_READINESS_CONTRACT_VERSION,
      profile: 'dry-audit',
      status: blocked > 0 ? 'blocked' : notFullyLive > 0 ? 'attention' : 'live-ready',
      summary: {
        sourceModules: entries.length,
        liveReady: this.countStatus(entries, 'live-ready'),
        partialLive: this.countStatus(entries, 'partial-live'),
        configuredOnly: this.countStatus(entries, 'configured-only'),
        dryRunOnly: this.countStatus(entries, 'dry-run-only'),
        templateOnly: this.countStatus(entries, 'template-only'),
        planned: this.countStatus(entries, 'planned'),
        blocked,
        notFullyLive,
        requiresOperatorConfiguration: entries.filter((entry) => entry.requiredConfig.length > 0).length,
        receipts: receipts.length,
        liveExternalCallRequiredToBuildSnapshot: false,
        liveChannelSendRequiredToBuildSnapshot: false,
        secretValuesSerialized: false,
      },
      entries,
      gaps: this.buildGapGroups(entries),
      receipts,
      policy: {
        noLiveIoDuringReadinessKernel: true,
        noSecretsSerialized: true,
        liveActivationRequiresOperatorConfiguration: true,
        liveActivationRequiresReceipts: true,
        templatesCannotBeCertifiedAsLive: true,
        dryRunCannotBeCertifiedAsLive: true,
        truthfulStatusRequired: true,
      },
      commands: {
        check: 'npm run live-readiness:check --silent',
        focusedTests: ['npx jest tests/services/LiveReadinessService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextAction: 'Preview engine - Channel Live Activation',
      },
    };
  }

  public buildEntry(
    mapping: CapabilitySourceMapping,
    providerEntry: ProviderMeshReadinessProviderEntry | null = null,
    channelEntry: ChannelMeshConsistencyEntry | null = null,
    runtimeEntry: RuntimeFamilyClosureEntry | null = null,
  ): LiveReadinessEntry {
    const classification = this.classify(mapping, providerEntry, channelEntry, runtimeEntry);
    return {
      id: `live-readiness:${mapping.normalizedSourceName}`,
      sourceName: mapping.sourceName,
      normalizedSourceName: mapping.normalizedSourceName,
      primitiveId: mapping.primitiveId,
      family: mapping.family || 'unknown',
      status: classification.status,
      profileFloor: classification.profileFloor,
      recommendedPhase: classification.recommendedPhase,
      reason: classification.reason,
      serviceTarget: mapping.targetFiles.service,
      adapterTarget: mapping.targetFiles.adapter,
      liveAdapterTarget: classification.liveAdapterTarget,
      requiredConfig: classification.requiredConfig,
      gaps: classification.gaps,
      gates: classification.gates,
      receipt: {
        id: `live-readiness.${mapping.normalizedSourceName}.receipt`,
        sourceName: mapping.normalizedSourceName,
        primitiveId: mapping.primitiveId,
        status: classification.status,
        profileFloor: classification.profileFloor,
        noLiveIo: true,
        secretValuesSerialized: false,
      },
    };
  }

  private classify(
    mapping: CapabilitySourceMapping,
    providerEntry: ProviderMeshReadinessProviderEntry | null,
    channelEntry: ChannelMeshConsistencyEntry | null,
    runtimeEntry: RuntimeFamilyClosureEntry | null,
  ): LiveClassification {
    if (!mapping.primitiveId) {
      return this.blocked(mapping, 'No Zavorth primitive is mapped for this source module.');
    }
    if (mapping.primitiveId === 'provider.call' && providerEntry) {
      return this.classifyProvider(mapping, providerEntry);
    }
    if (mapping.primitiveId === 'channel.message' && channelEntry) {
      return this.classifyChannel(mapping, channelEntry);
    }
    if (runtimeEntry) {
      return this.classifyRuntimeFamily(mapping, runtimeEntry);
    }
    return this.classifyNativeSurface(mapping);
  }

  private classifyProvider(
    mapping: CapabilitySourceMapping,
    providerEntry: ProviderMeshReadinessProviderEntry,
  ): LiveClassification {
    const requiredConfig = providerEntry.credentialPolicy.credentialRefs;
    const baseGates = this.commonGates(mapping, requiredConfig);
    if (providerEntry.status === 'unsupported' || providerEntry.status === 'unmapped' || !providerEntry.runtimeSupported) {
      return {
        status: 'blocked',
        profileFloor: 'dry-audit',
        recommendedPhase: 'Connector registry - Provider Runtime P0',
        reason: `${mapping.normalizedSourceName} cannot resolve to a supported provider runtime yet.`,
        liveAdapterTarget: providerEntry.adapterStrategy,
        requiredConfig,
        gaps: ['supported provider runtime adapter is missing'],
        gates: [
          ...baseGates,
          this.gate('runtime-wiring', 'blocked', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
          this.gate('truthful-status', 'passed', 'blocked provider remains explicit in the readiness kernel'),
        ],
      };
    }
    if (PROVIDER_P0_PARTIAL_LIVE.has(mapping.normalizedSourceName)) {
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase: 'Connector registry - Provider Runtime Activation',
        reason: `${mapping.normalizedSourceName} has a Connector registry provider runtime activation path with adapter, config schema and staging smoke command.`,
        liveAdapterTarget: providerEntry.adapterStrategy,
        requiredConfig,
        gaps: ['configured provider doctor receipt is missing', 'staging live provider smoke receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'passed', providerEntry.adapterStrategy, null),
          this.gate('runtime-wiring', 'passed', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
          this.gate('dry-smoke', 'passed', 'Connector registry provider activation proves routing without live IO', 'npm run provider-runtime-activation:check --silent'),
          this.gate('live-smoke', 'missing', 'staging-live provider call requires operator credentials and --confirm-live-io', null),
          this.gate('truthful-status', 'passed', 'P0 provider is runtime-ready but not production-certified without live receipts'),
        ],
      };
    }
    if (PROVIDER_LONG_TAIL_PARTIAL_LIVE.has(mapping.normalizedSourceName)) {
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase: 'Credential vault - Provider Runtime Activation Long Tail',
        reason: `${mapping.normalizedSourceName} has a Credential vault long-tail provider activation path with a named manifest, config schema and staging smoke command.`,
        liveAdapterTarget: providerEntry.adapterStrategy,
        requiredConfig,
        gaps: ['configured provider doctor receipt is missing', 'staging live provider smoke receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'passed', providerEntry.adapterStrategy, null),
          this.gate('runtime-wiring', 'passed', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
          this.gate('dry-smoke', 'passed', 'Credential vault provider long-tail activation proves routing without live IO', 'npm run provider-long-tail-activation:check --silent'),
          this.gate('live-smoke', 'missing', 'staging-live provider call requires operator credentials and --confirm-live-io', null),
          this.gate('truthful-status', 'passed', 'long-tail provider is runtime-ready but not production-certified without live receipts'),
        ],
      };
    }
    if (providerEntry.generatedProviderManifest) {
      return {
        status: 'template-only',
        profileFloor: 'dry-audit',
        recommendedPhase: 'Credential vault - Provider Long Tail',
        reason: `${mapping.normalizedSourceName} is represented by a generated provider manifest, not a dedicated live adapter.`,
        liveAdapterTarget: providerEntry.adapterStrategy,
        requiredConfig,
        gaps: [
          'replace generated provider manifest with a named Zavorth adapter or an explicit compatible-provider decision',
          'add configured doctor and live smoke receipt',
        ],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'missing', 'generatedProviderManifest is true', null),
          this.gate('dry-smoke', 'passed', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
          this.gate('live-smoke', 'missing', 'no live provider call receipt exists yet', null),
          this.gate('truthful-status', 'passed', 'template-only provider cannot be certified as live'),
        ],
      };
    }
    return {
      status: providerEntry.firstClassProvider ? 'partial-live' : 'configured-only',
      profileFloor: providerEntry.firstClassProvider ? 'dry-live' : 'configured-doctor',
      recommendedPhase: providerEntry.firstClassProvider ? 'Connector registry - Provider Runtime P0'
        : 'Credential vault ? Provider Long Tail',
      reason: providerEntry.firstClassProvider ? `${mapping.normalizedSourceName} has a first-class runtime path but still needs configured live smoke evidence.`
        : `${mapping.normalizedSourceName} resolves through a compatible runtime path and needs configured doctor evidence.`,
      liveAdapterTarget: providerEntry.adapterStrategy,
      requiredConfig,
      gaps: ['configured provider doctor receipt is missing', 'live provider smoke receipt is missing'],
      gates: [
        ...baseGates,
        this.gate('real-adapter', providerEntry.firstClassProvider ? 'passed' : 'partial', providerEntry.adapterStrategy, null),
        this.gate('runtime-wiring', 'passed', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
        this.gate('dry-smoke', 'passed', providerEntry.smokeGate.expected, providerEntry.smokeGate.command),
        this.gate('live-smoke', 'missing', 'live provider call intentionally not executed by Intent model', null),
        this.gate('truthful-status', 'passed', 'provider remains below live certification until Connector registry/5'),
      ],
    };
  }

  private classifyChannel(
    mapping: CapabilitySourceMapping,
    channelEntry: ChannelMeshConsistencyEntry,
  ): LiveClassification {
    const name = mapping.normalizedSourceName;
    const requiredConfig = channelEntry.credentialPolicy.credentialRefs;
    const baseGates = this.commonGates(mapping, requiredConfig);
    if (CHANNEL_LIVE_READY.has(name)) {
      return {
        status: 'live-ready',
        profileFloor: 'configured-doctor',
        recommendedPhase: 'Preview engine - Channel Live Activation',
        reason: `${name} has a native channel adapter with a full runtime path; activation still needs operator credentials and live receipts.`,
        liveAdapterTarget: channelEntry.route.adapterTarget,
        requiredConfig,
        gaps: ['operator live-send receipt still required before production certification'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'passed', channelEntry.route.transportStrategy, null),
          this.gate('runtime-wiring', 'passed', channelEntry.smokeGate.expected, channelEntry.smokeGate.command),
          this.gate('configured-doctor', channelEntry.gatewayStatus?.configured ? 'passed' : 'partial', 'gateway adapter status inspected', null),
          this.gate('live-smoke', 'missing', 'no real channel send is executed by Intent model', null),
          this.gate('truthful-status', 'passed', 'channel is code-ready but not production-certified'),
        ],
      };
    }
    if (CHANNEL_PARTIAL_LIVE.has(name)) {
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase: 'Preview engine - Channel Live Activation',
        reason: `${name} has live-capable code paths, but the adapter still needs a configured doctor and live send smoke.`,
        liveAdapterTarget: channelEntry.route.adapterTarget,
        requiredConfig,
        gaps: ['configured channel doctor receipt is missing', 'live inbound/outbound smoke receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'partial', channelEntry.route.transportStrategy, null),
          this.gate('runtime-wiring', 'passed', channelEntry.smokeGate.expected, channelEntry.smokeGate.command),
          this.gate('dry-smoke', 'passed', 'dry inbound/outbound envelopes are normalized', channelEntry.smokeGate.command),
          this.gate('live-smoke', 'missing', 'live channel send intentionally not executed by Intent model', null),
          this.gate('truthful-status', 'passed', 'partial-live channel cannot be certified as complete'),
        ],
      };
    }
    if (CHANNEL_DRY_RUN_ONLY.has(name)) {
      return {
        status: 'dry-run-only',
        profileFloor: 'dry-audit',
        recommendedPhase: 'Preview engine - Channel Live Activation',
        reason: `${name} is currently represented by a local/outbox or dry-run bridge instead of a live delivery adapter.`,
        liveAdapterTarget: channelEntry.route.adapterTarget,
        requiredConfig,
        gaps: ['replace dry-run/outbox bridge with a live send adapter', 'add inbound verification and delivery receipt'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'missing', 'live send adapter is not present yet', null),
          this.gate('dry-smoke', 'passed', channelEntry.smokeGate.expected, channelEntry.smokeGate.command),
          this.gate('live-smoke', 'missing', 'no live delivery path exists yet', null),
          this.gate('truthful-status', 'passed', 'dry-run-only channel remains explicit'),
        ],
      };
    }
    if (CHANNEL_PLANNED.has(name)) {
      return {
        status: 'planned',
        profileFloor: 'dry-audit',
        recommendedPhase: 'Approval gate - Channel Long Tail',
        reason: `${name} needs a device or local bridge implementation before it can be activated live.`,
        liveAdapterTarget: channelEntry.route.adapterTarget,
        requiredConfig,
        gaps: ['device bridge handshake is not implemented as a live activation path'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'missing', 'device bridge is planned only', null),
          this.gate('live-smoke', 'missing', 'no live device bridge receipt exists yet', null),
          this.gate('truthful-status', 'passed', 'planned channel remains explicit'),
        ],
      };
    }
    if (CHANNEL_TEMPLATE_ONLY.has(name) || !channelEntry.gatewayStatus) {
      return {
        status: 'template-only',
        profileFloor: 'dry-audit',
        recommendedPhase: 'Approval gate - Channel Long Tail',
        reason: `${name} is normalized through a channel route template, not a dedicated live adapter.`,
        liveAdapterTarget: channelEntry.route.adapterTarget,
        requiredConfig,
        gaps: ['build dedicated channel adapter', 'add configured doctor and live inbound/outbound smoke'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'missing', 'channel route is template-generated', null),
          this.gate('dry-smoke', 'passed', channelEntry.smokeGate.expected, channelEntry.smokeGate.command),
          this.gate('live-smoke', 'missing', 'no live channel receipt exists yet', null),
          this.gate('truthful-status', 'passed', 'template-only channel cannot be certified as live'),
        ],
      };
    }
    return this.classifyNativeSurface(mapping);
  }

  private classifyRuntimeFamily(
    mapping: CapabilitySourceMapping,
    runtimeEntry: RuntimeFamilyClosureEntry,
  ): LiveClassification {
    const baseGates = this.commonGates(mapping, []);
    if (RUNTIME_PARTIAL_LIVE.has(runtimeEntry.primitiveId)) {
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase: this.phaseForPrimitive(runtimeEntry.primitiveId),
        reason: `${runtimeEntry.primitiveId} has a native runtime contract and partial live-capable adapter coverage.`,
        liveAdapterTarget: runtimeEntry.adapterTarget,
        requiredConfig: [],
        gaps: ['configured provider/input doctor receipt is missing', 'live runtime smoke receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'partial', runtimeEntry.adapterTarget, null),
          this.gate('runtime-wiring', 'passed', runtimeEntry.serviceTarget, null),
          this.gate('artifact-receipt', 'passed', runtimeEntry.receiptKinds.join(', '), null),
          this.gate('dry-smoke', 'passed', `${runtimeEntry.primitiveId} has Worker 7 no-live proof`, null),
          this.gate('live-smoke', 'missing', 'no live runtime call executed by Intent model', null),
          this.gate('truthful-status', 'passed', 'partial runtime coverage is explicit'),
        ],
      };
    }
    if (RUNTIME_DRY_RUN_ONLY.has(runtimeEntry.primitiveId)) {
      return {
        status: 'dry-run-only',
        profileFloor: 'dry-audit',
        recommendedPhase: this.phaseForPrimitive(runtimeEntry.primitiveId),
        reason: `${runtimeEntry.primitiveId} is closed as a contract/runtime proof, but still behaves as a dry-run or planning surface.`,
        liveAdapterTarget: runtimeEntry.adapterTarget,
        requiredConfig: [],
        gaps: ['replace dry-run/planning behavior with executable adapter path', 'add live smoke receipt'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'missing', 'current proof is no-live-IO only', null),
          this.gate('dry-smoke', 'passed', `${runtimeEntry.primitiveId} deterministic no-live proof exists`, null),
          this.gate('live-smoke', 'missing', 'live execution path not proven', null),
          this.gate('truthful-status', 'passed', 'dry-run-only runtime remains explicit'),
        ],
      };
    }
    return this.classifyNativeSurface(mapping);
  }

  private classifyNativeSurface(mapping: CapabilitySourceMapping): LiveClassification {
    const baseGates = this.commonGates(mapping, []);
    const primitiveId = mapping.primitiveId || '';
    const intentModel2Primitives = new Set([
      'agent.runtime',
      'memory.active',
      'memory.vector',
      'memory.wiki',
      'sandbox.remote',
      'task.orchestrate',
      'workspace.command',
      'bridge.protocol',
    ]);
    if (intentModel2Primitives.has(primitiveId) || primitiveId === 'artifact.diff') {
      const recommendedPhase = primitiveId === 'artifact.diff'
        ? 'Certification matrix - File, Document, and Diff Live Activation'
        : 'Intent model2 ? Memory, Artifacts, Runtime Executor';
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase,
        reason: primitiveId === 'artifact.diff'
          ? `${primitiveId} has native Zavorth surfaces, but still needs live execution receipts tied to activation profiles.`
          : `${primitiveId} has a Intent model2 live closure path with memory/artifact/runtime receipts and explicit approval gates.`,
        liveAdapterTarget: mapping.targetFiles.adapter,
        requiredConfig: [],
        gaps: primitiveId === 'artifact.diff'
          ? ['add live activation receipt for this internal runtime surface']
          : ['configured Intent model2 doctor receipt is missing', 'staging live memory/artifact/runtime receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('runtime-wiring', primitiveId === 'artifact.diff' ? 'partial' : 'passed', mapping.targetFiles.service || 'service target missing', null),
          ...(primitiveId === 'artifact.diff'
            ? [this.gate('live-smoke', 'missing', 'no profile-specific live receipt exists yet', null)]
            : [
                this.gate('dry-smoke', 'passed', 'Intent model2 memory/artifact/runtime closure proof exists', 'npm run qa:memory-artifacts-runtime-live-closure --silent'),
                this.gate('live-smoke', 'missing', 'staging-live Intent model2 proof requires --confirm-live-io', null),
              ]),
          this.gate('truthful-status', 'passed', `${primitiveId} remains partial-live until operator staging receipts exist`),
        ],
      };
    }
    if (primitiveId === 'device.invoke') {
      return {
        status: 'partial-live',
        profileFloor: 'dry-live',
        recommendedPhase: 'Satellite and Device Live Activation',
        reason: `${primitiveId} has a Intent model1 paired-device execution path with pairing, heartbeat, offline queue, camera/location/confirmation proof and policy receipts.`,
        liveAdapterTarget: mapping.targetFiles.adapter,
        requiredConfig: [],
        gaps: ['configured Satellite/device doctor receipt is missing', 'staging live paired-device receipt is missing'],
        gates: [
          ...baseGates,
          this.gate('real-adapter', 'partial', mapping.targetFiles.adapter || 'src/services/NodeHostCapabilityService.ts', null),
          this.gate('runtime-wiring', 'passed', 'src/services/SatelliteDeviceLiveService.ts', null),
          this.gate('dry-smoke', 'passed', 'Intent model1 Satellite/device proof covers pairing, heartbeat, camera, location and confirmation', 'npm run qa:satellite-device-live-plane --silent'),
          this.gate('live-smoke', 'missing', 'staging-live paired device receipt requires --confirm-live-io', null),
          this.gate('truthful-status', 'passed', 'device.invoke remains partial-live until operator staging receipts exist'),
        ],
      };
    }
    return {
      status: 'configured-only',
      profileFloor: 'configured-doctor',
      recommendedPhase: this.phaseForPrimitive(primitiveId),
      reason: `${primitiveId} has a normalized Zavorth contract surface and needs configured live validation.`,
      liveAdapterTarget: mapping.targetFiles.adapter,
      requiredConfig: [],
      gaps: ['configured doctor receipt is missing', 'live smoke receipt is missing where applicable'],
      gates: [
        ...baseGates,
        this.gate('runtime-wiring', 'partial', mapping.targetFiles.service || 'service target missing', null),
        this.gate('configured-doctor', 'missing', 'configured doctor not run by Intent model', null),
        this.gate('truthful-status', 'passed', 'configured-only status remains explicit'),
      ],
    };
  }

  private blocked(mapping: CapabilitySourceMapping, reason: string): LiveClassification {
    return {
      status: 'blocked',
      profileFloor: 'dry-audit',
      recommendedPhase: 'Live Consistency Certification',
      reason,
      liveAdapterTarget: null,
      requiredConfig: [],
      gaps: [reason],
      gates: [
        this.gate('native-contract', 'blocked', reason, null),
        this.gate('truthful-status', 'passed', 'blocked readiness entry is explicit', null),
      ],
    };
  }

  private commonGates(mapping: CapabilitySourceMapping, requiredConfig: string[]): LiveReadinessGate[] {
    return [
      this.gate(
        'native-contract',
        mapping.targetFiles.contract ? 'passed' : 'missing',
        mapping.targetFiles.contract || 'contract target missing',
        null,
      ),
      this.gate(
        'operator-config',
        requiredConfig.length > 0 ? 'partial' : 'not-required',
        requiredConfig.length > 0 ? requiredConfig.join(', ') : 'nthe operator credentials required by this entry',
        null,
      ),
      this.gate(
        'safety-policy',
        mapping.targetFiles.policy ? 'passed' : 'missing',
        mapping.targetFiles.policy || 'policy target missing',
        null,
      ),
      this.gate(
        'artifact-receipt',
        'passed',
        'readiness receipt emitted without secret values',
        null,
      ),
    ];
  }

  private buildGapGroups(entries: LiveReadinessEntry[]): LiveReadinessGapGroup[] {
    const grouped = new Map<string, LiveReadinessEntry[]>();
    for (const entry of entries.filter((item) => item.status !== 'live-ready')) {
      const key = `${entry.recommendedPhase}::${entry.status}`;
      grouped.set(key, [...(grouped.get(key) || []), entry]);
    }
    return [...grouped.values()]
      .map((items) => ({
        phase: items[0].recommendedPhase,
        status: items[0].status,
        count: items.length,
        itemIds: items.map((item) => item.normalizedSourceName).sort((left, right) => left.localeCompare(right)),
        summary: `${items.length} ${items[0].status} item(s) for ${items[0].recommendedPhase}.`,
      }))
      .sort((left, right) => left.phase.localeCompare(right.phase) || left.status.localeCompare(right.status));
  }

  private countStatus(entries: LiveReadinessEntry[], status: LiveReadinessStatus): number {
    return entries.filter((entry) => entry.status === status).length;
  }

  private phaseForPrimitive(primitiveId: string): string {
    if (primitiveId === 'media.generate') {
      return 'Runtime gateway - Media Generation Live Activation';
    }
    if (primitiveId === 'media.understand') {
      return 'Runtime gateway - Media Understanding Live Activation';
    }
    if (primitiveId === 'search.query' || primitiveId === 'web.extract') {
      return 'ZavorthControl controls - Research, Web, and Browser Live Activation';
    }
    if (primitiveId === 'speech.transcribe' || primitiveId === 'speech.synthesize' || primitiveId === 'voice.session') {
      return 'Surface controls - Speech, TTS, and Voice Live Activation';
    }
    if (primitiveId === 'file.transfer' || primitiveId === 'document.extract') {
      return 'Certification matrix - File, Document, and Diff Live Activation';
    }
    if (primitiveId === 'artifact.diff') {
      return 'Certification matrix - File, Document, and Diff Live Activation';
    }
    if (primitiveId === 'diagnostics.trace' || primitiveId === 'migration.import' || primitiveId === 'qa.scenario') {
      return 'Diagnostics, QA, and Migration Live Activation';
    }
    if (primitiveId === 'provider.call') {
      return 'Connector registry - Provider Runtime P0';
    }
    if (primitiveId === 'channel.message') {
      return 'Preview engine - Channel Live Activation';
    }
    if (primitiveId === 'device.invoke') {
      return 'Satellite and Device Live Activation';
    }
    return 'Memory, Artifacts, Runtime Executor';
  }

  private gate(
    kind: LiveReadinessGate['kind'],
    status: LiveReadinessGateStatus,
    evidence: string,
    command: string | null = null,
  ): LiveReadinessGate {
    return {
      kind,
      status,
      evidence,
      command,
    };
  }
}
