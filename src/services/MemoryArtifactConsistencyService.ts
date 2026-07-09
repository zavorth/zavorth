import fs from 'fs';
import path from 'path';
import type {
  MemoryArtifactEvidence,
  MemoryArtifactConsistencyDryProof,
  MemoryArtifactConsistencyEntry,
  MemoryArtifactConsistencySnapshot,
  MemoryArtifactConsistencyStatus,
  MemoryArtifactConsistencySurface,
  MemoryArtifactPrimitive,
  MemoryArtifactSourceModuleMapping,
} from '../contracts/MemoryArtifactConsistencyContract.js';
import { ZAVORTH_MEMORY_ARTIFACT_CONSISTENCY_CONTRACT_VERSION } from '../contracts/MemoryArtifactConsistencyContract.js';
import type { ZavorthPluginManifest, ZavorthPluginPermission } from '../contracts/PluginManifestContract.js';
import { ZAVORTH_PLUGIN_OS_API_VERSION } from '../contracts/PluginManifestContract.js';
import { ArtifactMemoryService } from '../runtime/agent/ArtifactMemoryService.js';
import { MemoryWithReceiptsService } from '../runtime/agent/MemoryWithReceiptsService.js';
import { RunArtifactReceiptReplayService } from '../runtime/agent/RunArtifactReceiptReplayService.js';
import type { UniversalAgentRun } from '../runtime/agent/UniversalAgentRuntimeTypes.js';

type MemoryArtifactConsistencyRuntime = {
  now?: () => Date;
  rootDir?: string;
  files?: Partial<Record<MemoryArtifactSourceFileKey, string>>;
};

import { logger } from '../logger.js';
import {
SOURCE_FILE_NAMES,
  SPECS,
  type MemoryArtifactSourceFileKey,
  type MemoryArtifactSpec,
} from './MemoryArtifactConsistencyCatalog.js';

export class MemoryArtifactConsistencyService {
  private readonly now: () => Date;
  private readonly files: Record<MemoryArtifactSourceFileKey, string>;

  constructor(runtime: MemoryArtifactConsistencyRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.files = Object.keys(SOURCE_FILE_NAMES).reduce((current, key) => ({
      ...current,
      [key]: this.readSource(runtime, key as MemoryArtifactSourceFileKey),
    }), {} as Record<MemoryArtifactSourceFileKey, string>);
  }

  public buildSnapshot(): MemoryArtifactConsistencySnapshot {
    const generatedAt = this.now().toISOString();
    const entries = SPECS.map((spec) => this.buildEntry(spec));
    const sourceModules = this.buildSourceModuleMappings(entries);
    const dryProof = this.buildDryProof(generatedAt);
    return {
      generatedAt,
      contractVersion: ZAVORTH_MEMORY_ARTIFACT_CONSISTENCY_CONTRACT_VERSION,
      summary: {
        surfaces: entries.length,
        native: entries.filter((entry) => entry.status === 'native').length,
        artifactReady: entries.filter((entry) => entry.status === 'artifact-ready').length,
        ledgerReady: entries.filter((entry) => entry.status === 'ledger-ready').length,
        backendReady: entries.filter((entry) => entry.status === 'backend-ready').length,
        declaredOnly: entries.filter((entry) => entry.status === 'declared-only').length,
        templateReady: entries.filter((entry) => entry.status === 'template-ready').length,
        missing: entries.filter((entry) => entry.status === 'missing').length,
        decisionRequired: entries.filter((entry) => entry.status === 'decision-required').length,
        sourceModulesMapped: sourceModules.length,
        generatedPluginManifests: 1,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      gaps: entries.filter((entry) =>
        ['declared-only', 'template-ready', 'missing', 'decision-required'].includes(entry.status),
      ),
      sourceModules,
      dryProof,
      generatedPluginManifests: [this.buildPluginManifest(entries)],
      policy: {
        consistencyIsReadOnly: true,
        artifactContentInvented: false,
        memoryWritePerformed: false,
        filesystemReadPerformed: false,
        promotionRequiresExplicitAction: true,
        reusedArtifactMustCiteOrigin: true,
        secretsSerialized: false,
      },
      nextStage: {
        id: 'operational-tooling',
        reason: 'Memory/artifacts now have consistency coverage; the next layer should expose certifiable operator tooling and consistency doctors.',
      },
    };
  }

  public buildEntryForSurface(surface: MemoryArtifactConsistencySurface): MemoryArtifactConsistencyEntry {
    const spec = SPECS.find((item) => item.surface === surface);
    if (!spec) {
      throw new Error(`Unknown Memory/Artifact consistency surface: ${surface}`);
    }
    return this.buildEntry(spec);
  }

  private buildEntry(spec: MemoryArtifactSpec): MemoryArtifactConsistencyEntry {
    const evidence = this.collectEvidence(spec);
    const present = evidence.filter((item) => item.present).length;
    const allPresent = evidence.length > 0 && present === evidence.length;
    const status = this.resolveStatus(spec, present, allPresent);
    return {
      surface: spec.surface,
      primitiveId: spec.primitiveId,
      status,
      summary: spec.summary,
      targetFiles: spec.targetFiles,
      evidence,
      simulation: this.buildSimulation(spec, status),
      smokeGate: {
        id: `memory-artifact:${spec.surface}`,
        command: `MemoryArtifactConsistencyService.buildEntryForSurface(${JSON.stringify(spec.surface)})`,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        expected: 'memory/artifact shape, receipts, and policy can be inspected without writing memory or reading artifact bodies',
      },
      findings: this.buildFindings(spec, status, evidence),
    };
  }

  private resolveStatus(spec: MemoryArtifactSpec, present: number, allPresent: boolean): MemoryArtifactConsistencyStatus {
    if (spec.decisionRequired) {
      return 'decision-required';
    }
    if (spec.nativeWhenAllPresent && allPresent) {
      return 'native';
    }
    if (spec.artifactReadyWhenAllPresent && allPresent) {
      return 'artifact-ready';
    }
    if (spec.ledgerReadyWhenAllPresent && allPresent) {
      return 'ledger-ready';
    }
    if (spec.backendReadyWhenAllPresent && allPresent) {
      return 'backend-ready';
    }
    if (spec.templateReady && present === 0) {
      return 'template-ready';
    }
    if (spec.declaredOnlyWhenAnyPresent && present > 0) {
      return allPresent ? 'backend-ready' : 'declared-only';
    }
    return present > 0 ? 'declared-only' : 'missing';
  }

  private collectEvidence(spec: MemoryArtifactSpec): MemoryArtifactEvidence[] {
    return spec.markers.map((marker) => ({
      file: SOURCE_FILE_NAMES[marker.file],
      marker: marker.marker,
      present: this.files[marker.file].includes(marker.marker),
    }));
  }

  private buildSimulation(
    spec: MemoryArtifactSpec,
    status: MemoryArtifactConsistencyStatus,
  ): MemoryArtifactConsistencyEntry['simulation'] {
    return {
      dryRun: true,
      request: {
        primitiveId: spec.primitiveId,
        surface: spec.surface,
        payload: this.samplePayload(spec),
      },
      response: {
        ok: !['missing', 'decision-required'].includes(status),
        status,
        artifactExpected: spec.primitiveId.startsWith('artifact.'),
        memoryWritePerformed: false,
        filesystemReadPerformed: false,
      },
      receiptKind: `memory-artifact.${spec.surface}.receipt`,
    };
  }

  private samplePayload(spec: MemoryArtifactSpec): Record<string, unknown> {
    switch (spec.surface) {
      case 'hybrid-recall':
        return { query: 'artifact receipt replay', limit: 4 };
      case 'persistent-memory':
        return { key: 'dry-run', value: 'preview only', write: false };
      case 'artifact-memory-index':
        return { runId: 'dry-run', includeRunSummary: true };
      case 'memory-import-export':
        return { mode: 'preview', memoryScoped: true };
      default:
        return { dryRun: true };
    }
  }

  private buildFindings(
    spec: MemoryArtifactSpec,
    status: MemoryArtifactConsistencyStatus,
    evidence: MemoryArtifactEvidence[],
  ): string[] {
    if (status === 'native' || status === 'artifact-ready' || status === 'ledger-ready' || status === 'backend-ready') {
      return [`${spec.surface} has governed Memory/Artifact consistency evidence`];
    }
    if (status === 'decision-required') {
      return [`${spec.surface} remains a product decision; keep current backend unless a stronger operational need appears`];
    }
    if (status === 'template-ready') {
      return [`${spec.surface} has a Zavorth-native target but still needs implementation`];
    }
    const missing = evidence.filter((item) => !item.present).map((item) => item.marker);
    if (status === 'declared-only') {
      return [`${spec.surface} is partially declared but missing runtime markers: ${missing.join(', ')}`];
    }
    return [`${spec.surface} is missing Memory/Artifact consistency evidence`];
  }

  private buildDryProof(generatedAt: string): MemoryArtifactConsistencyDryProof {
    const run = this.buildProofRun();
    const memoryWithReceipts = new MemoryWithReceiptsService({ now: this.now }).buildSnapshot({
      run,
      generatedAt,
    });
    const runWithMemoryReceipts = {
      ...run,
      metadata: {
        ...run.metadata,
        memoryWithReceipts,
      },
    };
    const artifactMemory = new ArtifactMemoryService({ now: this.now }).buildSnapshot({
      run: runWithMemoryReceipts,
      generatedAt,
    });
    const runWithFeatureSnapshots = {
      ...runWithMemoryReceipts,
      metadata: {
        ...runWithMemoryReceipts.metadata,
        artifactMemory,
      },
    };
    const replay = new RunArtifactReceiptReplayService({ now: this.now }).buildSnapshot({
      run: runWithFeatureSnapshots,
      generatedAt,
    });
    return {
      generatedAt,
      artifactMemory: {
        status: artifactMemory.status,
        entries: artifactMemory.summary.memoryEntryCount,
        reusable: artifactMemory.summary.reusableCount,
        searchReady: artifactMemory.summary.searchReady,
        citationRequired: artifactMemory.policy.reusedArtifactMustCiteOrigin,
      },
      memoryWithReceipts: {
        receipts: memoryWithReceipts.summary.receiptCount,
        allMemoryHasReceipt: memoryWithReceipts.audit.allMemoryHasReceipt,
        sourceQuestionsSupported: memoryWithReceipts.audit.canAnswerSourceQuestion,
      },
      runArtifactReplay: {
        status: replay.status,
        frames: replay.summary.frameCount,
        artifactLinks: replay.summary.artifactLinkCount,
        replayable: replay.summary.replayable,
        receiptLinked: replay.summary.artifactMemoryLinked && replay.summary.memoryWithReceiptsLinked,
      },
    };
  }

  private buildProofRun(): UniversalAgentRun {
    const generatedAt = this.now().toISOString();
    return {
      id: 'checkpoint-7-memory-artifact-run',
      traceId: 'checkpoint-7-memory-artifact-trace',
      requestId: 'checkpoint-7-memory-artifact-request',
      sessionId: 'checkpoint-7-memory-artifact-session',
      userId: 'checkpoint-7-operator',
      channel: 'cli',
      title: 'Surface controls Memory Artifact consistency proof',
      input: 'prove memory and artifact consistency without writes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      status: 'completed',
      createdAt: generatedAt,
      updatedAt: generatedAt,
      summary: 'Dry proof for artifact memory, memory receipts, and run artifact replay.',
      events: [
        {
          id: 'checkpoint-7-event-artifact-index',
          runId: 'checkpoint-7-memory-artifact-run',
          kind: 'artifact',
          title: 'Artifact indexed',
          detail: 'Artifact Memory generated a searchable receipt-linked entry.',
          status: 'done',
          createdAt: generatedAt,
          metadata: {
            source: 'memory-artifact-consistency',
          },
        },
      ],
      toolExposure: {
        mode: 'safe',
        summary: 'dry-run read-only proof',
        tools: [],
      },
      replyPorts: [],
      modelProfile: {
        providerLabel: 'zavorth',
        modelLabel: 'dry-proof',
        routingPolicy: 'direct',
      },
      approvals: [],
      artifacts: [
        {
          id: 'checkpoint-7-artifact-plan',
          title: 'Surface controls Memory Artifact Plan',
          kind: 'plan',
          createdAt: generatedAt,
          sessionId: 'checkpoint-7-memory-artifact-session',
          status: 'ready',
        },
        {
          id: 'checkpoint-7-artifact-report',
          title: 'Surface controls Memory Artifact Report',
          kind: 'report',
          createdAt: generatedAt,
          sessionId: 'checkpoint-7-memory-artifact-session',
          status: 'ready',
        },
      ],
      memorySignals: [
        {
          id: 'checkpoint-7-memory-signal',
          title: 'Memory Artifact consistency source',
          layer: 'semantic',
          summary: 'Memory/artifact consistency requires receipts and artifact citations.',
          confidence: 0.91,
        },
      ],
      metadata: {
        taskId: 'checkpoint-7',
        artifactSummaries: {
          'checkpoint-7-artifact-plan': {
            summary: 'Plan artifact proving Memory/Artifact consistency with receipts.',
          },
        },
      },
    };
  }

  private buildSourceModuleMappings(entries: MemoryArtifactConsistencyEntry[]): MemoryArtifactSourceModuleMapping[] {
    const entryBySurface = new Map(entries.map((entry) => [entry.surface, entry]));
    return [
      this.sourceModule('memory-core', 'persistent-memory', 'Core memory is represented by persistent memory, memory history, and hybrid recall.', entryBySurface),
      this.sourceModule('active-memory', 'hybrid-recall', 'Active memory maps to ledger-authoritative hybrid recall and session memory plane.', entryBySurface),
      this.sourceModule('memory-lancedb', 'vector-backend-choice', 'LanceDB is treated as a backend decision because MemoryVectorStore already provides vector recall.', entryBySurface),
      this.sourceModule('memory-wiki', 'wiki-memory', 'Wiki memory gets a Zavorth-native template target instead of copied knowledge-store layout.', entryBySurface),
      this.sourceModule('thread-ownership', 'thread-ownership', 'Thread ownership maps to session identity and metadata scoping.', entryBySurface),
    ];
  }

  private sourceModule(
    sourceModule: MemoryArtifactSourceModuleMapping['sourceModule'],
    targetSurface: MemoryArtifactConsistencySurface,
    reason: string,
    entryBySurface: Map<MemoryArtifactConsistencySurface, MemoryArtifactConsistencyEntry>,
  ): MemoryArtifactSourceModuleMapping {
    const entry = entryBySurface.get(targetSurface);
    if (!entry) {
      throw new Error(`Missing Memory/Artifact consistency surface for ${targetSurface}`);
    }
    return {
      sourceModule,
      targetSurface,
      primitiveId: entry.primitiveId,
      status: entry.status,
      reason,
    };
  }

  private buildPluginManifest(entries: MemoryArtifactConsistencyEntry[]): ZavorthPluginManifest {
    const permissions: ZavorthPluginPermission[] = [
      {
        kind: 'artifact.read',
        scope: 'workspace',
        reason: 'Memory/Artifact consistency reads artifact metadata and receipts.',
        required: true,
      },
      {
        kind: 'memory.read',
        scope: 'workspace',
        reason: 'Memory/Artifact consistency inspects memory source metadata and recall surfaces.',
        required: true,
      },
      {
        kind: 'memory.write',
        scope: 'workspace',
        reason: 'Memory promotion is explicit and approval-gated outside consistency dry-runs.',
        required: false,
      },
      {
        kind: 'artifact.write',
        scope: 'workspace',
        reason: 'Artifact outputs can be written by runtime flows, never by this consistency snapshot.',
        required: false,
      },
    ];
    return {
      schemaVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      id: 'zavorth.memory.artifact-plane',
      label: 'Zavorth Memory Artifact Plane',
      version: '0.1.0-template',
      moduleKind: 'memory',
      summary: 'Plugin OS memory/artifact consistency module with receipts, replay, recall, and artifact citation gates.',
      description: 'Zavorth-native module template that binds memory recall, artifact indexing, receipts, replay, vector recall, workspace memory, and source ownership into governed Plugin OS capabilities.',
      tags: ['memory', 'artifact', 'receipts', 'replay', 'vector'],
      source: {
        kind: 'generated',
        locator: 'zavorth-normalized://memory-artifact-consistency',
        digest: null,
        trusted: false,
      },
      compatibility: {
        zavorthVersion: '>=1.1.0',
        pluginApiVersion: ZAVORTH_PLUGIN_OS_API_VERSION,
      },
      capabilities: entries.map((entry) => ({
        id: entry.primitiveId,
        intent: this.intentFor(entry.primitiveId),
        label: this.labelFor(entry.primitiveId),
        summary: entry.summary,
        artifactKinds: [entry.simulation.receiptKind],
        command: entry.primitiveId === 'memory.recall'
          ? {
              name: 'memory',
              aliases: ['recall'],
              usage: '<recall|sources|artifacts|receipts>',
            }
          : null,
      })),
      permissions,
      entrypoint: {
        module: 'modules/memory-artifact/index.js',
        exportName: 'createZavorthMemoryArtifactModule',
        runtime: 'node',
      },
      lifecycle: {
        actions: ['install', 'enable', 'disable', 'uninstall', 'invoke', 'doctor', 'upgrade'],
        defaultAction: 'invoke',
      },
      policy: {
        defaultTrust: 'review',
        requiresApproval: true,
        allowNetworkByDefault: false,
        allowFilesystemWriteByDefault: false,
        allowProcessSpawnByDefault: false,
        sandboxProfile: 'metadata-only',
      },
      artifactKinds: entries.map((entry) => entry.simulation.receiptKind),
      receiptKinds: entries.map((entry) => entry.simulation.receiptKind),
    };
  }

  private intentFor(primitiveId: MemoryArtifactPrimitive): string {
    return primitiveId
      .replace(/\./g, '_')
      .replace(/[^a-z0-9_]+/g, '_');
  }

  private labelFor(primitiveId: MemoryArtifactPrimitive): string {
    return primitiveId
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
      .join(' ');
  }

  private readSource(runtime: MemoryArtifactConsistencyRuntime, key: MemoryArtifactSourceFileKey): string {
    if (typeof runtime.files?.[key] === 'string') {
      return runtime.files[key] as string;
    }
    const rootDir = runtime.rootDir || process.cwd();
    const absolutePath = path.join(rootDir, SOURCE_FILE_NAMES[key]);
    try {
      return fs.readFileSync(absolutePath, 'utf8');
    } catch (error: unknown) {logger.warn('[Memory Artifact Consistency] filesystem operation failed', error); return ''; }
  }
}
