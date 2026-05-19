import { CapabilityNormalizationService } from '../../src/services/CapabilityNormalizationService.js';
import { NativeCapabilityClosureService } from '../../src/services/NativeCapabilityClosureService.js';
import { ParityCertificationService } from '../../src/services/ParityCertificationService.js';

describe('NativeCapabilityClosureService Intent model2', () => {
  it('closes formerly needs-review capability primitives with native contracts', () => {
    const snapshot = new NativeCapabilityClosureService({
      now: () => new Date('2026-05-04T22:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.checkpoint-12');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        closedSourceModules: 19,
        closedPrimitives: 8,
        remainingCapabilityNeedsReview: 0,
        remainingCapabilityUnmapped: 0,
        certificationP1Gaps: 0,
        certificationStatus: 'certified',
        releaseReady: true,
        liveExternalCallRequired: false,
        filesystemWriteRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceName: 'voice-call',
          primitiveId: 'voice.session',
          previousStatus: 'needs-review',
          currentStatus: 'normalized',
          runtimeStatus: 'native-contract',
          closureStrategy: 'native-voice-session-contract',
          contractTarget: 'src/contracts/VoiceSessionContract.ts',
          remainingTier: 'none',
        }),
        expect.objectContaining({
          sourceName: 'azure-speech',
          primitiveId: 'speech.transcribe',
          closureStrategy: 'native-speech-contract',
          contractTarget: 'src/contracts/SpeechContract.ts',
        }),
        expect.objectContaining({
          sourceName: 'file-transfer',
          primitiveId: 'file.transfer',
          closureStrategy: 'native-file-transfer-contract',
          contractTarget: 'src/contracts/FileTransferContract.ts',
        }),
        expect.objectContaining({
          sourceName: 'document-extract',
          primitiveId: 'document.extract',
          closureStrategy: 'native-document-extract-contract',
          contractTarget: 'src/contracts/DocumentExtractContract.ts',
        }),
        expect.objectContaining({
          sourceName: 'diagnostics-otel',
          primitiveId: 'diagnostics.trace',
          closureStrategy: 'native-diagnostics-contract',
          contractTarget: 'src/contracts/DiagnosticsContract.ts',
        }),
        expect.objectContaining({
          sourceName: 'migrate-claude',
          primitiveId: 'migration.import',
          closureStrategy: 'native-migration-contract',
          contractTarget: 'src/contracts/MigrationContract.ts',
        }),
        expect.objectContaining({
          sourceName: 'memory-wiki',
          primitiveId: 'memory.wiki',
          closureStrategy: 'native-memory-wiki-contract',
          contractTarget: 'src/contracts/HybridMemoryContract.ts',
        }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        closureIsContractDeclarationOnly: true,
        noExternalCalls: true,
        noFilesystemWrites: true,
        noSecretsSerialized: true,
        runtimeGapsStayVisible: true,
      }),
    );
  });

  it('makes Capability Normalization report no needs-review defaults', () => {
    const capabilitySnapshot = new CapabilityNormalizationService({
      now: () => new Date('2026-05-04T22:10:00.000Z'),
    }).buildSnapshot();

    expect(capabilitySnapshot.summary).toEqual(
      expect.objectContaining({
        sourceModules: 125,
        normalized: 125,
        needsReview: 0,
        unmapped: 0,
        primitives: 24,
        manifestTemplates: 125,
      }),
    );
    expect(capabilitySnapshot.mappings.filter((entry) => entry.status === 'needs-review')).toEqual([]);
  });

  it('hands off to certified parity after remaining runtime decisions close', () => {
    const certification = new ParityCertificationService({
      now: () => new Date('2026-05-04T22:20:00.000Z'),
    }).buildSnapshot();

    expect(certification.summary).toEqual(
      expect.objectContaining({
        sourceOpenGaps: 0,
        sourceP0Gaps: 0,
        sourceP1Gaps: 0,
        sourceP2Gaps: 0,
        failed: 0,
        warned: 0,
        releaseReady: true,
      }),
    );
    expect(certification.commands.nextStage).toBe('Release certification profile hardening');
  });
});
