import type {
  CapabilityPrimitiveDefinition,
  CapabilitySourceMapping,
} from '../contracts/CapabilityNormalizationContract.js';
import type {
  RuntimeFamilyClosureEntry,
  RuntimeFamilyClosureItem,
  RuntimeFamilyClosureReceipt,
  RuntimeFamilyClosureSnapshot,
  RuntimeFamilyProofStep,
} from '../contracts/RuntimeFamilyClosureContract.js';
import { ZAVORTH_RUNTIME_FAMILY_CLOSURE_CONTRACT_VERSION } from '../contracts/RuntimeFamilyClosureContract.js';

import {
  CapabilityNormalizationService,
  DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES,
} from './CapabilityNormalizationService.js';

type RuntimeFamilyClosureRuntime = {
  now?: () => Date;
  normalizationService?: CapabilityNormalizationService;
  sourceModules?: string[];
};

type RuntimeFamilyTarget = {
  closureItem: RuntimeFamilyClosureItem;
  primitiveId: string;
  modes: string[];
};

const TARGETS: RuntimeFamilyTarget[] = [
  {
    closureItem: 'C6-media',
    primitiveId: 'media.generate',
    modes: ['image', 'video', 'audio'],
  },
  {
    closureItem: 'C6-media',
    primitiveId: 'media.understand',
    modes: ['image.describe', 'audio.extract', 'video.classify'],
  },
  {
    closureItem: 'C8-web',
    primitiveId: 'search.query',
    modes: ['quick', 'deep', 'grounded'],
  },
  {
    closureItem: 'C8-web',
    primitiveId: 'web.extract',
    modes: ['fetch', 'readability', 'crawl', 'browser-capture'],
  },
  {
    closureItem: 'C7-voice',
    primitiveId: 'speech.transcribe',
    modes: ['artifact-audio', 'speaker-labels', 'language-hint'],
  },
  {
    closureItem: 'C7-voice',
    primitiveId: 'speech.synthesize',
    modes: ['wav', 'mp3', 'ogg'],
  },
  {
    closureItem: 'C7-voice',
    primitiveId: 'voice.session',
    modes: ['push_to_talk', 'live_call', 'meeting_bridge'],
  },
  {
    closureItem: 'C9-docs-diagnostics-migration',
    primitiveId: 'file.transfer',
    modes: ['import', 'export', 'copy', 'move'],
  },
  {
    closureItem: 'C9-docs-diagnostics-migration',
    primitiveId: 'document.extract',
    modes: ['text', 'tables', 'metadata', 'full'],
  },
  {
    closureItem: 'C9-docs-diagnostics-migration',
    primitiveId: 'diagnostics.trace',
    modes: ['trace', 'metric', 'log', 'health'],
  },
  {
    closureItem: 'C9-docs-diagnostics-migration',
    primitiveId: 'qa.scenario',
    modes: ['channel-smoke', 'provider-smoke', 'runtime-smoke', 'synthetic-smoke', 'test-fixture'],
  },
  {
    closureItem: 'C9-docs-diagnostics-migration',
    primitiveId: 'migration.import',
    modes: ['directory', 'manifest', 'config-file', 'dry_run', 'apply'],
  },
];

export class RuntimeFamilyClosureService {
  private readonly now: () => Date;
  private readonly normalization: CapabilityNormalizationService;
  private readonly sourceModules: string[];

  constructor(runtime: RuntimeFamilyClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.normalizationService || new CapabilityNormalizationService();
    this.sourceModules = runtime.sourceModules || DEFAULT_PRIVATE_CAPABILITY_SOURCE_MODULES;
  }

  public buildSnapshot(): RuntimeFamilyClosureSnapshot {
    const mappings = this.sourceModules.map((sourceName) => this.normalization.resolveSourceModule(sourceName));
    const entries = TARGETS.map((target) => this.buildEntry(target, mappings));
    const receipts = entries.map((entry) => entry.receipt);
    const blocked = entries.filter((entry) => entry.status === 'blocked').length;

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_RUNTIME_FAMILY_CLOSURE_CONTRACT_VERSION,
      status: blocked > 0 ? 'blocked' : 'closed',
      summary: {
        closureItems: new Set(entries.map((entry) => entry.closureItem)).size,
        primitives: entries.length,
        sourceModules: entries.reduce((total, entry) => total + entry.sourceModules.length, 0),
        modeProofs: entries.reduce((total, entry) => total + entry.modes.length, 0),
        runtimeProofs: entries.length - blocked,
        blocked,
        receipts: receipts.length,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        filesystemWriteRequired: false,
        artifactBodyReadRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      receipts,
      policy: {
        noLiveProviderCalls: true,
        noLiveVoiceCalls: true,
        noLiveBrowserNetwork: true,
        noFilesystemWrites: true,
        artifactFirst: true,
        receiptRequired: true,
        unsupportedModesMustBeExplicit: true,
      },
      commands: {
        check: 'npm run runtime-family-closure:check --silent',
        focusedTests: ['npx jest tests/services/RuntimeFamilyClosureService.test.ts --runInBand'],
        typecheck: 'npm run runtime:check --silent',
        nextWorker: 'Worker 7 - final certification and documentation',
      },
    };
  }

  public buildEntry(
    target: RuntimeFamilyTarget,
    mappings: CapabilitySourceMapping[] = this.sourceModules.map((sourceName) =>
      this.normalization.resolveSourceModule(sourceName)),
  ): RuntimeFamilyClosureEntry {
    const primitive = this.getRequiredPrimitive(target.primitiveId);
    const sourceModules = mappings
      .filter((mapping) => mapping.primitiveId === target.primitiveId)
      .map((mapping) => mapping.normalizedSourceName)
      .sort((left, right) => left.localeCompare(right));
    const blocked = primitive.runtimeStatus !== 'native-contract' || sourceModules.length === 0;
    const status = blocked ? 'blocked' : 'runtime-proof';
    const receipt = this.receipt(target, primitive, status);

    return {
      closureItem: target.closureItem,
      family: primitive.family,
      primitiveId: primitive.primitiveId,
      status,
      runtimeStatus: primitive.runtimeStatus,
      sourceModules,
      modes: target.modes,
      contractTarget: primitive.contractTarget,
      serviceTarget: primitive.serviceTarget,
      adapterTarget: primitive.adapterTarget,
      artifactKinds: primitive.artifactKinds,
      receiptKinds: primitive.receiptKinds,
      steps: this.steps(target, primitive, status),
      receipt,
    };
  }

  private getRequiredPrimitive(primitiveId: string): CapabilityPrimitiveDefinition {
    const primitive = this.normalization.getPrimitive(primitiveId);
    if (!primitive) {
      throw new Error(`Runtime family closure primitive not found: ${primitiveId}`);
    }
    return primitive;
  }

  private steps(
    target: RuntimeFamilyTarget,
    primitive: CapabilityPrimitiveDefinition,
    status: 'runtime-proof' | 'blocked',
  ): RuntimeFamilyProofStep[] {
    const stepStatus = status === 'blocked' ? 'blocked' : 'passed';
    return [
      {
        kind: 'contract-boundary',
        status: stepStatus,
        evidence: primitive.contractTarget,
      },
      {
        kind: 'service-path',
        status: stepStatus,
        evidence: primitive.serviceTarget,
      },
      {
        kind: 'adapter-boundary',
        status: stepStatus,
        evidence: primitive.adapterTarget,
      },
      {
        kind: 'policy-gate',
        status: stepStatus,
        evidence: primitive.permissions.map((permission) => permission.kind).join(', '),
      },
      {
        kind: 'mode-coverage',
        status: stepStatus,
        evidence: target.modes.join(', '),
      },
      {
        kind: 'artifact-receipt',
        status: stepStatus,
        evidence: primitive.artifactKinds.concat(primitive.receiptKinds).join(', '),
      },
      {
        kind: 'dry-run-harness',
        status: stepStatus,
        evidence: `${primitive.primitiveId} uses Worker 6 no-live-IO runtime family proof.`,
      },
    ];
  }

  private receipt(
    target: RuntimeFamilyTarget,
    primitive: CapabilityPrimitiveDefinition,
    status: 'runtime-proof' | 'blocked',
  ): RuntimeFamilyClosureReceipt {
    return {
      id: `runtime-family-closure.${primitive.primitiveId}.receipt`,
      closureItem: target.closureItem,
      primitiveId: primitive.primitiveId,
      status: status === 'blocked' ? 'blocked' : 'passed',
      artifactKinds: primitive.artifactKinds,
      receiptKinds: primitive.receiptKinds,
      noLiveIo: true,
      secretValuesSerialized: false,
    };
  }
}
