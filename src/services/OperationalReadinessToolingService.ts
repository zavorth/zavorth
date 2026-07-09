import type { CapabilityNormalizationSnapshot } from '../contracts/CapabilityNormalizationContract.js';
import type { ChannelMeshConsistencySnapshot } from '../contracts/ChannelMeshConsistencyContract.js';
import type { MemoryArtifactConsistencySnapshot } from '../contracts/MemoryArtifactConsistencyContract.js';
import type {
  OperationalReadinessGap,
  OperationalReadinessGate,
  OperationalReadinessPhaseRecord,
  OperationalReadinessPluginInventoryItem,
  OperationalReadinessSnapshot,
  OperationalReadinessStatus,
} from '../contracts/OperationalReadinessToolingContract.js';
import { ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION } from '../contracts/OperationalReadinessToolingContract.js';

import type { PluginRegistrySnapshot } from './PluginRegistryService.js';
import { PluginRegistryService } from './PluginRegistryService.js';
import type { ProviderMeshReadinessSnapshot } from '../contracts/ProviderMeshReadinessContract.js';
import type { SatelliteAppConsistencySnapshot } from '../contracts/SatelliteAppConsistencyContract.js';
import type { ZavorthPluginManifest } from '../contracts/PluginManifestContract.js';
import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';
import { ChannelMeshConsistencyService } from './ChannelMeshConsistencyService.js';
import { MemoryArtifactConsistencyService } from './MemoryArtifactConsistencyService.js';
import { ProviderMeshReadinessService } from './ProviderMeshReadinessService.js';
import { SatelliteAppConsistencyService } from './SatelliteAppConsistencyService.js';

type OperationalReadinessToolingRuntime = {
  now?: () => Date;
  capabilityNormalizationService?: CapabilityNormalizationService;
  providerMeshReadinessService?: ProviderMeshReadinessService;
  channelMeshConsistencyService?: ChannelMeshConsistencyService;
  satelliteAppConsistencyService?: SatelliteAppConsistencyService;
  memoryArtifactConsistencyService?: MemoryArtifactConsistencyService;
};

type PhaseInputs = {
  capability: CapabilityNormalizationSnapshot;
  provider: ProviderMeshReadinessSnapshot;
  channel: ChannelMeshConsistencySnapshot;
  satellite: SatelliteAppConsistencySnapshot;
  memory: MemoryArtifactConsistencySnapshot;
  pluginRegistry: PluginRegistrySnapshot;
};

export class OperationalReadinessToolingService {
  private readonly now: () => Date;
  private readonly capabilityNormalization: CapabilityNormalizationService;
  private readonly providerMesh: ProviderMeshReadinessService;
  private readonly channelMesh: ChannelMeshConsistencyService;
  private readonly satelliteApp: SatelliteAppConsistencyService;
  private readonly memoryArtifact: MemoryArtifactConsistencyService;

  constructor(runtime: OperationalReadinessToolingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityNormalization = runtime.capabilityNormalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.providerMesh = runtime.providerMeshReadinessService || new ProviderMeshReadinessService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.channelMesh = runtime.channelMeshConsistencyService || new ChannelMeshConsistencyService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.satelliteApp = runtime.satelliteAppConsistencyService || new SatelliteAppConsistencyService({
      now: this.now,
    });
    this.memoryArtifact = runtime.memoryArtifactConsistencyService || new MemoryArtifactConsistencyService({
      now: this.now,
    });
  }

  public buildSnapshot(): OperationalReadinessSnapshot {
    const generatedAt = this.now().toISOString();
    const capability = this.capabilityNormalization.buildSnapshot();
    const provider = this.providerMesh.buildSnapshot();
    const channel = this.channelMesh.buildSnapshot();
    const satellite = this.satelliteApp.buildSnapshot();
    const memory = this.memoryArtifact.buildSnapshot();
    const generatedPluginManifests = this.uniquePluginManifests([
      ...provider.generatedPluginManifests,
      ...channel.generatedPluginManifests,
      ...satellite.generatedPluginManifests,
      ...memory.generatedPluginManifests,
    ]);
    const pluginRegistry = new PluginRegistryService({
      now: this.now,
      manifests: generatedPluginManifests,
    }).buildSnapshot();
    const phases = this.buildPhases({
      capability,
      provider,
      channel,
      satellite,
      memory,
      pluginRegistry,
    });
    const gates = this.buildGates();
    const gaps = this.buildGaps({ capability, provider, channel, satellite, memory, pluginRegistry });
    const status = this.resolveStatus(phases);
    const gapTotals = this.countGaps(gaps);

    return {
      generatedAt,
      contractVersion: ZAVORTH_OPERATIONAL_READINESS_TOOLING_CONTRACT_VERSION,
      status,
      summary: {
        phases: phases.length,
        passed: phases.filter((phase) => phase.status === 'passed').length,
        attention: phases.filter((phase) => phase.status === 'attention').length,
        blocked: phases.filter((phase) => phase.status === 'blocked').length,
        staticGates: gates.filter((gate) => gate.kind === 'static-check').length,
        jestGates: gates.filter((gate) => gate.kind === 'jest').length,
        doctorCommands: gates.filter((gate) => gate.kind === 'doctor').length,
        privateSourceModules: capability.summary.sourceModules,
        normalizedSourceModules: capability.summary.normalized,
        sourceModulesNeedingReview: capability.summary.needsReview,
        generatedPluginManifests: generatedPluginManifests.length,
        pluginCapabilities: pluginRegistry.summary.capabilities,
        openGaps: gapTotals.total,
        p0Gaps: gapTotals.p0,
        p1Gaps: gapTotals.p1,
        p2Gaps: gapTotals.p2,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      },
      phases,
      gates,
      gaps,
      pluginRegistry,
      pluginInventory: this.buildPluginInventory(pluginRegistry),
      generatedPluginManifests,
      commands: {
        doctor: 'npm run release-readiness-doctor --silent',
        doctorJson: 'npm run release-readiness-doctor:json --silent',
        staticGate: 'npm run operational-readiness-tooling:check --silent',
        focusedTests: [
          'npx jest tests/services/OperationalReadinessToolingService.test.ts --runInBand',
          'npm run operational-readiness-tooling:check --silent',
          'npm run release-readiness-doctor --silent',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Etapa 9 - Certification',
      },
      certification: {
        releaseReady: gapTotals.total === 0 && status === 'passed',
        reason: gapTotals.total === 0
          ? 'Operational readiness tooling has no tracked gaps.'
          : 'Operational tooling is ready, but consistency certification still has tracked gaps.',
        minimumNextAction: gapTotals.total === 0
          ? 'Run the certification phase against the full release profile.'
          : 'Start Certification matrix - Certification to turn tracked gaps into signed pass/fail release gates.',
      },
      policy: {
        operationalToolingOnly: true,
        noExternalCalls: true,
        noLiveSends: true,
        noDeviceAccess: true,
        noMemoryWrites: true,
        noArtifactBodyReads: true,
        secretsSerialized: false,
      },
    };
  }

  public formatDoctorText(snapshot: OperationalReadinessSnapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Operational Consistency Doctor',
      `Status: ${snapshot.status}`,
      `Phases: ${snapshot.summary.phases} (passed ${snapshot.summary.passed}, attention ${snapshot.summary.attention}, blocked ${snapshot.summary.blocked})`,
      `Plugin OS manifests: ${snapshot.summary.generatedPluginManifests} / capabilities ${snapshot.summary.pluginCapabilities}`,
      `Open gaps: ${snapshot.summary.openGaps} (P0 ${snapshot.summary.p0Gaps}, P1 ${snapshot.summary.p1Gaps}, P2 ${snapshot.summary.p2Gaps})`,
      '',
      'Phases:',
      ...snapshot.phases.map((phase) =>
        `- ${phase.title}: ${phase.status} (${phase.gapCount} gap count)`,
      ),
      '',
      'Top gaps:',
      ...snapshot.gaps.slice(0, 8).map((gap) =>
        `- [${gap.severity}] ${gap.surface}: ${gap.count} ${gap.status} - ${gap.nextAction}`,
      ),
      '',
      `Policy: external calls ${snapshot.summary.liveExternalCallRequired}, live sends ${snapshot.summary.liveChannelSendRequired}, live device ${snapshot.summary.liveDeviceRequired}, memory writes ${snapshot.summary.liveMemoryWriteRequired}`,
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }

  private buildPhases(input: PhaseInputs): OperationalReadinessPhaseRecord[] {
    const providerGapCount = input.provider.summary.templateReady
      + input.provider.summary.unsupported
      + input.provider.summary.unmapped;
    const channelGapCount = input.channel.summary.webhookTemplates
      + input.channel.summary.bridgeTemplates
      + input.channel.summary.templateReady
      + input.channel.summary.unsupported
      + input.channel.summary.unmapped;
    const satelliteGapCount = input.satellite.summary.declaredOnly
      + input.satellite.summary.templateReady
      + input.satellite.summary.missing
      + input.satellite.summary.decisionRequired;
    const memoryGapCount = input.memory.summary.declaredOnly
      + input.memory.summary.templateReady
      + input.memory.summary.missing
      + input.memory.summary.decisionRequired;

    return [
      {
        id: 'checkpoint-1-consistency-matrix',
        title: 'Intent model - Consistency Matrix',
        status: 'passed',
        document: 'docs/product-direction.md',
        service: null,
        checkCommand: 'npm run operational-readiness-tooling:check --silent',
        testCommand: null,
        summary: {
          privateSourceModules: input.capability.summary.sourceModules,
          trackedSurfaces: input.capability.summary.manifestTemplates,
        },
        gapCount: 0,
        generatedPluginManifests: 0,
        notes: ['Private source inventory is normalized into later phase gates.'],
      },
      {
        id: 'checkpoint-2-plugin-os',
        title: 'Preview engine - Plugin OS',
        status: input.pluginRegistry.summary.total > 0 ? 'passed' : 'blocked',
        document: 'docs/product-direction.md',
        service: 'src/services/PluginRegistryService.ts',
        checkCommand: 'npm run plugin-os:check --silent',
        testCommand: 'npx jest tests/services/PluginRegistryService.test.ts --runInBand',
        summary: {
          registryManifests: input.pluginRegistry.summary.total,
          pluginCapabilities: input.pluginRegistry.summary.capabilities,
          blockedPlugins: input.pluginRegistry.summary.blocked,
        },
        gapCount: input.pluginRegistry.summary.total > 0 ? 0 : 1,
        generatedPluginManifests: input.pluginRegistry.summary.total,
        notes: ['Plugin OS can register generated consistency manifests without invoking live handlers.'],
      },
      {
        id: 'checkpoint-3-capability-normalization',
        title: 'Approval gate - Capability Normalization',
        status: input.capability.summary.needsReview > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/CapabilityNormalizationService.ts',
        checkCommand: 'npm run capability-normalization:check --silent',
        testCommand: 'npx jest tests/services/CapabilityNormalizationService.test.ts --runInBand',
        summary: input.capability.summary,
        gapCount: input.capability.summary.needsReview + input.capability.summary.unmapped,
        generatedPluginManifests: input.capability.summary.manifestTemplates,
        notes: ['All private modules are mapped; some primitives still need native contracts or runtime proof.'],
      },
      {
        id: 'checkpoint-4-provider-mesh',
        title: 'Connector registry - Provider Mesh',
        status: providerGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/ProviderMeshReadinessService.ts',
        checkCommand: 'npm run provider-mesh-readiness:check --silent',
        testCommand: 'npx jest tests/services/ProviderMeshReadinessService.test.ts --runInBand',
        summary: input.provider.summary,
        gapCount: providerGapCount,
        generatedPluginManifests: input.provider.summary.generatedPluginManifests,
        notes: ['Provider readiness is manifest-complete; template and unsupported adapters remain tracked.'],
      },
      {
        id: 'checkpoint-5-channel-mesh',
        title: 'Credential vault - Channel Mesh',
        status: channelGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/ChannelMeshConsistencyService.ts',
        checkCommand: 'npm run channel-mesh-consistency:check --silent',
        testCommand: 'npx jest tests/services/ChannelMeshConsistencyService.test.ts --runInBand',
        summary: input.channel.summary,
        gapCount: channelGapCount,
        generatedPluginManifests: input.channel.summary.generatedPluginManifests,
        notes: ['Channel consistency simulates inbound/outbound envelopes without live sends.'],
      },
      {
        id: 'checkpoint-6-satellite-apps',
        title: 'Runtime gateway - Satellite/Apps',
        status: satelliteGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/SatelliteAppConsistencyService.ts',
        checkCommand: 'npm run satellite-app-consistency:check --silent',
        testCommand: 'npx jest tests/services/SatelliteAppConsistencyService.test.ts --runInBand',
        summary: input.satellite.summary,
        gapCount: satelliteGapCount,
        generatedPluginManifests: input.satellite.summary.generatedPluginManifests,
        notes: ['Satellite PWA/app consistency is inspectable without a live mobile device.'],
      },
      {
        id: 'checkpoint-7-memory-artifacts',
        title: 'Surface controls - Memory/Artifacts',
        status: memoryGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/MemoryArtifactConsistencyService.ts',
        checkCommand: 'npm run memory-artifact-consistency:check --silent',
        testCommand: 'npx jest tests/services/MemoryArtifactConsistencyService.test.ts --runInBand',
        summary: input.memory.summary,
        gapCount: memoryGapCount,
        generatedPluginManifests: input.memory.summary.generatedPluginManifests,
        notes: ['Memory/artifact consistency proves receipts and replay through dry-run snapshots.'],
      },
      {
        id: 'checkpoint-8-operational-tooling',
        title: 'ZavorthControl controls - Operational Tooling',
        status: 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/OperationalReadinessToolingService.ts',
        checkCommand: 'npm run operational-readiness-tooling:check --silent',
        testCommand: 'npx jest tests/services/OperationalReadinessToolingService.test.ts --runInBand',
        summary: {
          staticGates: 7,
          doctorCommands: 1,
          secretValuesSerialized: false,
        },
        gapCount: 0,
        generatedPluginManifests: 0,
        notes: ['Doctor tooling aggregates consistency state and policy flags for certification.'],
      },
    ];
  }

  private buildGates(): OperationalReadinessGate[] {
    const staticGates: OperationalReadinessGate[] = [
      gate('plugin-os-static', 'checkpoint-2-plugin-os', 'static-check', 'npm run plugin-os:check --silent'),
      gate('capability-normalization-static', 'checkpoint-3-capability-normalization', 'static-check', 'npm run capability-normalization:check --silent'),
      gate('provider-mesh-readiness-static', 'checkpoint-4-provider-mesh', 'static-check', 'npm run provider-mesh-readiness:check --silent'),
      gate('channel-mesh-consistency-static', 'checkpoint-5-channel-mesh', 'static-check', 'npm run channel-mesh-consistency:check --silent'),
      gate('satellite-app-consistency-static', 'checkpoint-6-satellite-apps', 'static-check', 'npm run satellite-app-consistency:check --silent'),
      gate('memory-artifact-consistency-static', 'checkpoint-7-memory-artifacts', 'static-check', 'npm run memory-artifact-consistency:check --silent'),
      gate('operational-readiness-tooling-static', 'checkpoint-8-operational-tooling', 'static-check', 'npm run operational-readiness-tooling:check --silent'),
    ];
    const jestGates: OperationalReadinessGate[] = [
      gate('plugin-os-jest', 'checkpoint-2-plugin-os', 'jest', 'npx jest tests/services/PluginRegistryService.test.ts --runInBand'),
      gate('capability-normalization-jest', 'checkpoint-3-capability-normalization', 'jest', 'npx jest tests/services/CapabilityNormalizationService.test.ts --runInBand'),
      gate('provider-mesh-readiness-jest', 'checkpoint-4-provider-mesh', 'jest', 'npx jest tests/services/ProviderMeshReadinessService.test.ts --runInBand'),
      gate('channel-mesh-consistency-jest', 'checkpoint-5-channel-mesh', 'jest', 'npx jest tests/services/ChannelMeshConsistencyService.test.ts --runInBand'),
      gate('satellite-app-consistency-jest', 'checkpoint-6-satellite-apps', 'jest', 'npx jest tests/services/SatelliteAppConsistencyService.test.ts --runInBand'),
      gate('memory-artifact-consistency-jest', 'checkpoint-7-memory-artifacts', 'jest', 'npx jest tests/services/MemoryArtifactConsistencyService.test.ts --runInBand'),
      gate('operational-readiness-tooling-jest', 'checkpoint-8-operational-tooling', 'jest', 'npx jest tests/services/OperationalReadinessToolingService.test.ts --runInBand'),
    ];
    return [
      ...staticGates,
      ...jestGates,
      gate('release-readiness-doctor-text', 'checkpoint-8-operational-tooling', 'doctor', 'npm run release-readiness-doctor --silent'),
      gate('runtime-typecheck', 'checkpoint-8-operational-tooling', 'typecheck', 'npm run runtime:check --silent'),
      gate('operational-consistency-doc', 'checkpoint-8-operational-tooling', 'documentation', 'docs/product-direction.md'),
    ];
  }

  private buildGaps(input: PhaseInputs): OperationalReadinessGap[] {
    const channelTemplateCount = input.channel.summary.webhookTemplates
      + input.channel.summary.bridgeTemplates
      + input.channel.summary.templateReady;

    return [
      gap({
        id: 'capability-native-contracts',
        phaseId: 'checkpoint-3-capability-normalization',
        severity: 'p1',
        status: 'tracked',
        surface: 'capability primitives',
        count: input.capability.summary.needsReview,
        reason: 'Some normalized private modules still point to primitives that need a Zavorth-native contract or runtime proof.',
        nextAction: 'promote needs-review primitives into first-class contracts and service tests',
        command: 'npm run capability-normalization:check --silent',
      }),
      gap({
        id: 'provider-template-runtime-adapters',
        phaseId: 'checkpoint-4-provider-mesh',
        severity: 'p1',
        status: 'tracked',
        surface: 'provider.call',
        count: input.provider.summary.templateReady,
        reason: 'Generated provider manifests exist, but template-ready providers still need concrete adapter wiring.',
        nextAction: 'implement or catalog runtime adapters behind Provider Mesh',
        command: 'npm run provider-mesh-readiness:check --silent',
      }),
      gap({
        id: 'provider-unsupported-runtime-adapters',
        phaseId: 'checkpoint-4-provider-mesh',
        severity: 'p0',
        status: 'open',
        surface: 'provider.call',
        count: input.provider.summary.unsupported,
        reason: 'Unsupported provider routes are explicit and cannot be certified as full consistency yet.',
        nextAction: 'decide adapter support or mark provider intentionally out-of-scope',
        command: 'npm run provider-mesh-readiness:check --silent',
      }),
      gap({
        id: 'channel-template-routes',
        phaseId: 'checkpoint-5-channel-mesh',
        severity: 'p1',
        status: 'tracked',
        surface: 'channel.message',
        count: channelTemplateCount,
        reason: 'Webhook, bridge, and template-ready channel routes are planned but not all have native adapters.',
        nextAction: 'turn channel route templates into adapter-backed implementations',
        command: 'npm run channel-mesh-consistency:check --silent',
      }),
      gap({
        id: 'channel-unsupported-routes',
        phaseId: 'checkpoint-5-channel-mesh',
        severity: 'p1',
        status: 'open',
        surface: 'channel.message',
        count: input.channel.summary.unsupported,
        reason: 'Unsupported channel route remains a product/runtime decision.',
        nextAction: 'choose adapter support or explicit non-goal for unsupported channels',
        command: 'npm run channel-mesh-consistency:check --silent',
      }),
      gap({
        id: 'satellite-native-wrapper-decision',
        phaseId: 'checkpoint-6-satellite-apps',
        severity: 'p2',
        status: 'decision-required',
        surface: 'satellite native wrapper',
        count: input.satellite.summary.decisionRequired,
        reason: 'PWA consistency is the current path; native Android/iOS wrappers remain a product decision.',
        nextAction: 'keep PWA-first or open a native wrapper implementation track',
        command: 'npm run satellite-app-consistency:check --silent',
      }),
      gap({
        id: 'memory-wiki-template',
        phaseId: 'checkpoint-7-memory-artifacts',
        severity: 'p1',
        status: 'tracked',
        surface: 'memory.wiki',
        count: input.memory.summary.templateReady,
        reason: 'Wiki memory has a native target but not a completed runtime surface.',
        nextAction: 'implement wiki memory as a Zavorth-native knowledge surface with receipts',
        command: 'npm run memory-artifact-consistency:check --silent',
      }),
      gap({
        id: 'memory-vector-backend-choice',
        phaseId: 'checkpoint-7-memory-artifacts',
        severity: 'p2',
        status: 'decision-required',
        surface: 'memory.vector.backend',
        count: input.memory.summary.decisionRequired,
        reason: 'Vector backend choice is still a product decision because SQLite/JSON fallback already exists.',
        nextAction: 'keep current MemoryVectorStore or certify a stronger backend requirement',
        command: 'npm run memory-artifact-consistency:check --silent',
      }),
    ].filter((item) => item.count > 0);
  }

  private buildPluginInventory(snapshot: PluginRegistrySnapshot): OperationalReadinessPluginInventoryItem[] {
    return snapshot.entries.map((entry) => ({
      pluginId: entry.manifest.id,
      moduleKind: entry.manifest.moduleKind,
      capabilityCount: entry.manifest.capabilities.length,
      permissionCount: entry.manifest.permissions.length,
      source: entry.manifest.source.locator,
      defaultTrust: entry.manifest.policy.defaultTrust,
      requiresApproval: entry.manifest.policy.requiresApproval,
    }));
  }

  private uniquePluginManifests(manifests: ZavorthPluginManifest[]): ZavorthPluginManifest[] {
    return Array.from(
      manifests.reduce((current, manifest) => current.set(manifest.id, manifest), new Map<string, ZavorthPluginManifest>()).values(),
    ).sort((left, right) => left.id.localeCompare(right.id));
  }

  private countGaps(gaps: OperationalReadinessGap[]): { total: number; p0: number; p1: number; p2: number } {
    return {
      total: gaps.reduce((total, gapItem) => total + gapItem.count, 0),
      p0: gaps.filter((gapItem) => gapItem.severity === 'p0').reduce((total, gapItem) => total + gapItem.count, 0),
      p1: gaps.filter((gapItem) => gapItem.severity === 'p1').reduce((total, gapItem) => total + gapItem.count, 0),
      p2: gaps.filter((gapItem) => gapItem.severity === 'p2').reduce((total, gapItem) => total + gapItem.count, 0),
    };
  }

  private resolveStatus(phases: OperationalReadinessPhaseRecord[]): OperationalReadinessStatus {
    if (phases.some((phase) => phase.status === 'blocked')) {
      return 'blocked';
    }
    if (phases.some((phase) => phase.status === 'attention')) {
      return 'attention';
    }
    return 'passed';
  }
}

function gate(
  id: string,
  phaseId: OperationalReadinessGate['phaseId'],
  kind: OperationalReadinessGate['kind'],
  command: string,
): OperationalReadinessGate {
  return {
    id,
    phaseId,
    kind,
    command,
    required: true,
    status: 'passed',
    reason: 'gate is registered for the operational readiness certification path',
  };
}

function gap(input: OperationalReadinessGap): OperationalReadinessGap {
  return input;
}
