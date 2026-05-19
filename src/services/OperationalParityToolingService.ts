import type { CapabilityNormalizationSnapshot } from '../contracts/CapabilityNormalizationContract.js';
import type { ChannelMeshParitySnapshot } from '../contracts/ChannelMeshParityContract.js';
import type { MemoryArtifactParitySnapshot } from '../contracts/MemoryArtifactParityContract.js';
import type {
  OperationalParityGap,
  OperationalParityGate,
  OperationalParityPhaseRecord,
  OperationalParityPluginInventoryItem,
  OperationalParitySnapshot,
  OperationalParityStatus,
} from '../contracts/OperationalParityToolingContract.js';
import { ZAVORTH_OPERATIONAL_PARITY_TOOLING_CONTRACT_VERSION } from '../contracts/OperationalParityToolingContract.js';
import type { PluginRegistrySnapshot } from './PluginRegistryService.js';
import { PluginRegistryService } from './PluginRegistryService.js';
import type { ProviderMeshParitySnapshot } from '../contracts/ProviderMeshParityContract.js';
import type { SatelliteAppParitySnapshot } from '../contracts/SatelliteAppParityContract.js';
import type { ZavorthPluginManifest } from '../contracts/PluginManifestContract.js';
import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';
import { ChannelMeshParityService } from './ChannelMeshParityService.js';
import { MemoryArtifactParityService } from './MemoryArtifactParityService.js';
import { ProviderMeshParityService } from './ProviderMeshParityService.js';
import { SatelliteAppParityService } from './SatelliteAppParityService.js';

type OperationalParityToolingRuntime = {
  now?: () => Date;
  capabilityNormalizationService?: CapabilityNormalizationService;
  providerMeshParityService?: ProviderMeshParityService;
  channelMeshParityService?: ChannelMeshParityService;
  satelliteAppParityService?: SatelliteAppParityService;
  memoryArtifactParityService?: MemoryArtifactParityService;
};

type PhaseInputs = {
  capability: CapabilityNormalizationSnapshot;
  provider: ProviderMeshParitySnapshot;
  channel: ChannelMeshParitySnapshot;
  satellite: SatelliteAppParitySnapshot;
  memory: MemoryArtifactParitySnapshot;
  pluginRegistry: PluginRegistrySnapshot;
};

export class OperationalParityToolingService {
  private readonly now: () => Date;
  private readonly capabilityNormalization: CapabilityNormalizationService;
  private readonly providerMesh: ProviderMeshParityService;
  private readonly channelMesh: ChannelMeshParityService;
  private readonly satelliteApp: SatelliteAppParityService;
  private readonly memoryArtifact: MemoryArtifactParityService;

  constructor(runtime: OperationalParityToolingRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityNormalization = runtime.capabilityNormalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.providerMesh = runtime.providerMeshParityService || new ProviderMeshParityService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.channelMesh = runtime.channelMeshParityService || new ChannelMeshParityService({
      now: this.now,
      normalizationService: this.capabilityNormalization,
    });
    this.satelliteApp = runtime.satelliteAppParityService || new SatelliteAppParityService({
      now: this.now,
    });
    this.memoryArtifact = runtime.memoryArtifactParityService || new MemoryArtifactParityService({
      now: this.now,
    });
  }

  public buildSnapshot(): OperationalParitySnapshot {
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
      contractVersion: ZAVORTH_OPERATIONAL_PARITY_TOOLING_CONTRACT_VERSION,
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
        doctor: 'npm run parity-doctor --silent',
        doctorJson: 'npm run parity-doctor:json --silent',
        staticGate: 'npm run operational-parity-tooling:check --silent',
        focusedTests: [
          'npx jest tests/services/OperationalParityToolingService.test.ts --runInBand',
          'npm run operational-parity-tooling:check --silent',
          'npm run parity-doctor --silent',
        ],
        typecheck: 'npm run runtime:check --silent',
        nextStage: 'Etapa 9 - Certification',
      },
      certification: {
        releaseReady: gapTotals.total === 0 && status === 'passed',
        reason: gapTotals.total === 0
          ? 'Operational parity tooling has no tracked gaps.'
          : 'Operational tooling is ready, but parity certification still has tracked gaps.',
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

  public formatDoctorText(snapshot: OperationalParitySnapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Operational Parity Doctor',
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

  private buildPhases(input: PhaseInputs): OperationalParityPhaseRecord[] {
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
        id: 'checkpoint-1-parity-matrix',
        title: 'Intent model - Parity Matrix',
        status: 'passed',
        document: 'docs/product-direction.md',
        service: null,
        checkCommand: 'npm run operational-parity-tooling:check --silent',
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
        notes: ['Plugin OS can register generated parity manifests without invoking live handlers.'],
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
        service: 'src/services/ProviderMeshParityService.ts',
        checkCommand: 'npm run provider-mesh-parity:check --silent',
        testCommand: 'npx jest tests/services/ProviderMeshParityService.test.ts --runInBand',
        summary: input.provider.summary,
        gapCount: providerGapCount,
        generatedPluginManifests: input.provider.summary.generatedPluginManifests,
        notes: ['Provider parity is manifest-complete; template and unsupported adapters remain tracked.'],
      },
      {
        id: 'checkpoint-5-channel-mesh',
        title: 'Credential vault - Channel Mesh',
        status: channelGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/ChannelMeshParityService.ts',
        checkCommand: 'npm run channel-mesh-parity:check --silent',
        testCommand: 'npx jest tests/services/ChannelMeshParityService.test.ts --runInBand',
        summary: input.channel.summary,
        gapCount: channelGapCount,
        generatedPluginManifests: input.channel.summary.generatedPluginManifests,
        notes: ['Channel parity simulates inbound/outbound envelopes without live sends.'],
      },
      {
        id: 'checkpoint-6-satellite-apps',
        title: 'Runtime gateway - Satellite/Apps',
        status: satelliteGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/SatelliteAppParityService.ts',
        checkCommand: 'npm run satellite-app-parity:check --silent',
        testCommand: 'npx jest tests/services/SatelliteAppParityService.test.ts --runInBand',
        summary: input.satellite.summary,
        gapCount: satelliteGapCount,
        generatedPluginManifests: input.satellite.summary.generatedPluginManifests,
        notes: ['Satellite PWA/app parity is inspectable without a live mobile device.'],
      },
      {
        id: 'checkpoint-7-memory-artifacts',
        title: 'Surface controls - Memory/Artifacts',
        status: memoryGapCount > 0 ? 'attention' : 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/MemoryArtifactParityService.ts',
        checkCommand: 'npm run memory-artifact-parity:check --silent',
        testCommand: 'npx jest tests/services/MemoryArtifactParityService.test.ts --runInBand',
        summary: input.memory.summary,
        gapCount: memoryGapCount,
        generatedPluginManifests: input.memory.summary.generatedPluginManifests,
        notes: ['Memory/artifact parity proves receipts and replay through dry-run snapshots.'],
      },
      {
        id: 'checkpoint-8-operational-tooling',
        title: 'Dashboard controls - Operational Tooling',
        status: 'passed',
        document: 'docs/product-direction.md',
        service: 'src/services/OperationalParityToolingService.ts',
        checkCommand: 'npm run operational-parity-tooling:check --silent',
        testCommand: 'npx jest tests/services/OperationalParityToolingService.test.ts --runInBand',
        summary: {
          staticGates: 7,
          doctorCommands: 1,
          secretValuesSerialized: false,
        },
        gapCount: 0,
        generatedPluginManifests: 0,
        notes: ['Doctor tooling aggregates parity state and policy flags for certification.'],
      },
    ];
  }

  private buildGates(): OperationalParityGate[] {
    const staticGates: OperationalParityGate[] = [
      gate('plugin-os-static', 'checkpoint-2-plugin-os', 'static-check', 'npm run plugin-os:check --silent'),
      gate('capability-normalization-static', 'checkpoint-3-capability-normalization', 'static-check', 'npm run capability-normalization:check --silent'),
      gate('provider-mesh-parity-static', 'checkpoint-4-provider-mesh', 'static-check', 'npm run provider-mesh-parity:check --silent'),
      gate('channel-mesh-parity-static', 'checkpoint-5-channel-mesh', 'static-check', 'npm run channel-mesh-parity:check --silent'),
      gate('satellite-app-parity-static', 'checkpoint-6-satellite-apps', 'static-check', 'npm run satellite-app-parity:check --silent'),
      gate('memory-artifact-parity-static', 'checkpoint-7-memory-artifacts', 'static-check', 'npm run memory-artifact-parity:check --silent'),
      gate('operational-parity-tooling-static', 'checkpoint-8-operational-tooling', 'static-check', 'npm run operational-parity-tooling:check --silent'),
    ];
    const jestGates: OperationalParityGate[] = [
      gate('plugin-os-jest', 'checkpoint-2-plugin-os', 'jest', 'npx jest tests/services/PluginRegistryService.test.ts --runInBand'),
      gate('capability-normalization-jest', 'checkpoint-3-capability-normalization', 'jest', 'npx jest tests/services/CapabilityNormalizationService.test.ts --runInBand'),
      gate('provider-mesh-parity-jest', 'checkpoint-4-provider-mesh', 'jest', 'npx jest tests/services/ProviderMeshParityService.test.ts --runInBand'),
      gate('channel-mesh-parity-jest', 'checkpoint-5-channel-mesh', 'jest', 'npx jest tests/services/ChannelMeshParityService.test.ts --runInBand'),
      gate('satellite-app-parity-jest', 'checkpoint-6-satellite-apps', 'jest', 'npx jest tests/services/SatelliteAppParityService.test.ts --runInBand'),
      gate('memory-artifact-parity-jest', 'checkpoint-7-memory-artifacts', 'jest', 'npx jest tests/services/MemoryArtifactParityService.test.ts --runInBand'),
      gate('operational-parity-tooling-jest', 'checkpoint-8-operational-tooling', 'jest', 'npx jest tests/services/OperationalParityToolingService.test.ts --runInBand'),
    ];
    return [
      ...staticGates,
      ...jestGates,
      gate('parity-doctor-text', 'checkpoint-8-operational-tooling', 'doctor', 'npm run parity-doctor --silent'),
      gate('runtime-typecheck', 'checkpoint-8-operational-tooling', 'typecheck', 'npm run runtime:check --silent'),
      gate('operational-parity-doc', 'checkpoint-8-operational-tooling', 'documentation', 'docs/product-direction.md'),
    ];
  }

  private buildGaps(input: PhaseInputs): OperationalParityGap[] {
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
        command: 'npm run provider-mesh-parity:check --silent',
      }),
      gap({
        id: 'provider-unsupported-runtime-adapters',
        phaseId: 'checkpoint-4-provider-mesh',
        severity: 'p0',
        status: 'open',
        surface: 'provider.call',
        count: input.provider.summary.unsupported,
        reason: 'Unsupported provider routes are explicit and cannot be certified as full parity yet.',
        nextAction: 'decide adapter support or mark provider intentionally out-of-scope',
        command: 'npm run provider-mesh-parity:check --silent',
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
        command: 'npm run channel-mesh-parity:check --silent',
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
        command: 'npm run channel-mesh-parity:check --silent',
      }),
      gap({
        id: 'satellite-native-wrapper-decision',
        phaseId: 'checkpoint-6-satellite-apps',
        severity: 'p2',
        status: 'decision-required',
        surface: 'satellite native wrapper',
        count: input.satellite.summary.decisionRequired,
        reason: 'PWA parity is the current path; native Android/iOS wrappers remain a product decision.',
        nextAction: 'keep PWA-first or open a native wrapper implementation track',
        command: 'npm run satellite-app-parity:check --silent',
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
        command: 'npm run memory-artifact-parity:check --silent',
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
        command: 'npm run memory-artifact-parity:check --silent',
      }),
    ].filter((item) => item.count > 0);
  }

  private buildPluginInventory(snapshot: PluginRegistrySnapshot): OperationalParityPluginInventoryItem[] {
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

  private countGaps(gaps: OperationalParityGap[]): { total: number; p0: number; p1: number; p2: number } {
    return {
      total: gaps.reduce((total, gapItem) => total + gapItem.count, 0),
      p0: gaps.filter((gapItem) => gapItem.severity === 'p0').reduce((total, gapItem) => total + gapItem.count, 0),
      p1: gaps.filter((gapItem) => gapItem.severity === 'p1').reduce((total, gapItem) => total + gapItem.count, 0),
      p2: gaps.filter((gapItem) => gapItem.severity === 'p2').reduce((total, gapItem) => total + gapItem.count, 0),
    };
  }

  private resolveStatus(phases: OperationalParityPhaseRecord[]): OperationalParityStatus {
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
  phaseId: OperationalParityGate['phaseId'],
  kind: OperationalParityGate['kind'],
  command: string,
): OperationalParityGate {
  return {
    id,
    phaseId,
    kind,
    command,
    required: true,
    status: 'passed',
    reason: 'gate is registered for the operational parity certification path',
  };
}

function gap(input: OperationalParityGap): OperationalParityGap {
  return input;
}
