import type {
  CapabilityPrimitiveDefinition,
  CapabilitySourceMapping,
} from '../contracts/CapabilityNormalizationContract.js';
import type {
  NativeCapabilityClosureEntry,
  NativeCapabilityClosureSnapshot,
  NativeCapabilityClosureStatus,
  NativeCapabilityClosureStrategy,
} from '../contracts/NativeCapabilityClosureContract.js';
import { ZAVORTH_NATIVE_CAPABILITY_CLOSURE_CONTRACT_VERSION } from '../contracts/NativeCapabilityClosureContract.js';
import { CapabilityNormalizationService } from './CapabilityNormalizationService.js';
import { ParityCertificationService } from './ParityCertificationService.js';

type NativeCapabilityClosureRuntime = {
  now?: () => Date;
  capabilityNormalizationService?: CapabilityNormalizationService;
  parityCertificationService?: ParityCertificationService;
};

const CLOSED_PRIMITIVES = new Set([
  'speech.transcribe',
  'speech.synthesize',
  'voice.session',
  'memory.wiki',
  'file.transfer',
  'document.extract',
  'diagnostics.trace',
  'migration.import',
]);

export class NativeCapabilityClosureService {
  private readonly now: () => Date;
  private readonly normalization: CapabilityNormalizationService;
  private readonly certification: ParityCertificationService;

  constructor(runtime: NativeCapabilityClosureRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.normalization = runtime.capabilityNormalizationService || new CapabilityNormalizationService({
      now: this.now,
    });
    this.certification = runtime.parityCertificationService || new ParityCertificationService({
      now: this.now,
    });
  }

  public buildSnapshot(): NativeCapabilityClosureSnapshot {
    const capabilitySnapshot = this.normalization.buildSnapshot();
    const certificationSnapshot = this.certification.buildSnapshot();
    const entries = capabilitySnapshot.mappings
      .filter((mapping) => mapping.primitiveId !== null && CLOSED_PRIMITIVES.has(mapping.primitiveId))
      .map((mapping) => this.buildEntry(mapping))
      .sort((left, right) => `${left.primitiveId}:${left.sourceName}`.localeCompare(`${right.primitiveId}:${right.sourceName}`));
    const status: NativeCapabilityClosureStatus = capabilitySnapshot.summary.needsReview === 0
      && capabilitySnapshot.summary.unmapped === 0
      ? 'closed'
      : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_NATIVE_CAPABILITY_CLOSURE_CONTRACT_VERSION,
      status,
      summary: {
        closedSourceModules: entries.length,
        closedPrimitives: new Set(entries.map((entry) => entry.primitiveId)).size,
        remainingCapabilityNeedsReview: capabilitySnapshot.summary.needsReview,
        remainingCapabilityUnmapped: capabilitySnapshot.summary.unmapped,
        certificationP1Gaps: certificationSnapshot.summary.sourceP1Gaps,
        certificationStatus: certificationSnapshot.status,
        releaseReady: certificationSnapshot.summary.releaseReady,
        liveExternalCallRequired: false,
        filesystemWriteRequired: false,
        secretValuesSerialized: false,
      },
      entries,
      capabilitySnapshot: {
        contractVersion: capabilitySnapshot.contractVersion,
        summary: capabilitySnapshot.summary,
      },
      certification: {
        contractVersion: certificationSnapshot.contractVersion,
        profile: certificationSnapshot.profile,
        status: certificationSnapshot.status,
        summary: certificationSnapshot.summary,
      },
      commands: {
        check: 'npm run native-capability-closure:check --silent',
        capabilityNormalization: 'npm run capability-normalization:check --silent',
        certify: 'npm run parity-certify --silent',
        nextStage: 'Etapa 13 - Remaining Runtime Decisions',
      },
      policy: {
        closureIsContractDeclarationOnly: true,
        noExternalCalls: true,
        noFilesystemWrites: true,
        noSecretsSerialized: true,
        runtimeGapsStayVisible: true,
      },
    };
  }

  private buildEntry(mapping: CapabilitySourceMapping): NativeCapabilityClosureEntry {
    const primitive = this.getPrimitive(mapping.primitiveId);
    return {
      sourceName: mapping.normalizedSourceName,
      primitiveId: primitive.primitiveId,
      family: primitive.family,
      previousStatus: 'needs-review',
      currentStatus: mapping.status,
      runtimeStatus: primitive.runtimeStatus,
      closureStrategy: this.resolveStrategy(primitive.primitiveId),
      contractTarget: primitive.contractTarget,
      serviceTarget: primitive.serviceTarget,
      artifactKinds: primitive.artifactKinds,
      receiptKinds: primitive.receiptKinds,
      remainingTier: 'none',
      liveExternalCallRequired: false,
      filesystemWriteRequired: false,
      receipt: `native-capability-closure.${mapping.normalizedSourceName}.receipt`,
    };
  }

  private getPrimitive(primitiveId: string | null): CapabilityPrimitiveDefinition {
    const primitive = this.normalization.getPrimitive(primitiveId);
    if (!primitive) {
      throw new Error(`Cannot close unknown primitive: ${String(primitiveId)}`);
    }
    return primitive;
  }

  private resolveStrategy(primitiveId: string): NativeCapabilityClosureStrategy {
    switch (primitiveId) {
      case 'speech.transcribe':
      case 'speech.synthesize':
        return 'native-speech-contract';
      case 'voice.session':
        return 'native-voice-session-contract';
      case 'memory.wiki':
        return 'native-memory-wiki-contract';
      case 'file.transfer':
        return 'native-file-transfer-contract';
      case 'document.extract':
        return 'native-document-extract-contract';
      case 'diagnostics.trace':
        return 'native-diagnostics-contract';
      default:
        return 'native-migration-contract';
    }
  }
}
