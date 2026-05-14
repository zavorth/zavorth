import { DiagnosticsTraceService } from '../../src/services/DiagnosticsTraceService.js';
import { DocumentExtractService } from '../../src/services/DocumentExtractService.js';
import { FileTransferService } from '../../src/services/FileTransferService.js';
import { MigrationImportService } from '../../src/services/MigrationImportService.js';
import { RuntimeFamilyClosureService } from '../../src/services/RuntimeFamilyClosureService.js';
import { SpeechRuntimeService } from '../../src/services/SpeechRuntimeService.js';
import { VoiceSessionService } from '../../src/services/VoiceSessionService.js';
import { WebExtractService } from '../../src/services/WebExtractService.js';
import { CapabilityNormalizationService } from '../../src/services/CapabilityNormalizationService.js';

describe('RuntimeFamilyClosureService Worker 6', () => {
  it('closes C6 through C9 with runtime family receipts and no live IO', () => {
    const snapshot = new RuntimeFamilyClosureService({
      now: () => new Date('2026-05-04T23:58:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.worker-6');
    expect(snapshot.status).toBe('closed');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        closureItems: 4,
        primitives: 12,
        sourceModules: 40,
        modeProofs: 44,
        runtimeProofs: 12,
        blocked: 0,
        receipts: 12,
        liveExternalCallRequired: false,
        liveChannelSendRequired: false,
        liveDeviceRequired: false,
        filesystemWriteRequired: false,
        artifactBodyReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        noLiveProviderCalls: true,
        noLiveVoiceCalls: true,
        noLiveBrowserNetwork: true,
        noFilesystemWrites: true,
        artifactFirst: true,
        receiptRequired: true,
        unsupportedModesMustBeExplicit: true,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          closureItem: 'C6-media',
          primitiveId: 'media.generate',
          status: 'runtime-proof',
          modes: ['image', 'video', 'audio'],
        }),
        expect.objectContaining({
          closureItem: 'C7-voice',
          primitiveId: 'voice.session',
          status: 'runtime-proof',
          modes: ['push_to_talk', 'live_call', 'meeting_bridge'],
        }),
        expect.objectContaining({
          closureItem: 'C8-web',
          primitiveId: 'web.extract',
          status: 'runtime-proof',
          modes: ['fetch', 'readability', 'crawl', 'browser-capture'],
        }),
        expect.objectContaining({
          closureItem: 'C9-docs-diagnostics-migration',
          primitiveId: 'migration.import',
          status: 'runtime-proof',
        }),
      ]),
    );
  });

  it('promotes web.extract to a native runtime proof target', () => {
    const normalization = new CapabilityNormalizationService();

    expect(normalization.getPrimitive('web.extract')).toEqual(
      expect.objectContaining({
        runtimeStatus: 'native-contract',
        serviceTarget: 'src/services/WebExtractService.ts',
      }),
    );
    expect(normalization.resolveSourceModule('web-readability')).toEqual(
      expect.objectContaining({
        primitiveId: 'web.extract',
        status: 'normalized',
        targetFiles: expect.objectContaining({
          service: 'src/services/WebExtractService.ts',
        }),
      }),
    );
  });

  it('provides deterministic runtime service paths for voice, files, documents, diagnostics, migration and web extraction', () => {
    const now = () => new Date('2026-05-04T23:58:00.000Z');
    const speech = new SpeechRuntimeService({ now });
    const voice = new VoiceSessionService({ now });
    const fileTransfer = new FileTransferService({ now });
    const documentExtract = new DocumentExtractService({ now });
    const diagnostics = new DiagnosticsTraceService({ now });
    const migration = new MigrationImportService({ now });
    const webExtract = new WebExtractService();

    expect(speech.transcribe({
      source: {
        artifactId: 'audio-1',
        contentType: 'audio/wav',
        storageRef: 'artifact://audio-1',
      },
      speakerLabels: true,
    })).toEqual(
      expect.objectContaining({
        ok: true,
        transcriptArtifactId: 'speech.transcript.audio-1',
        receiptId: 'speech.transcribe.audio-1.receipt',
      }),
    );
    expect(speech.synthesize({ text: 'Hello Zavorth', format: 'mp3' })).toEqual(
      expect.objectContaining({
        ok: true,
        audioArtifact: expect.objectContaining({
          contentType: 'audio/mpeg',
        }),
      }),
    );
    expect(voice.planSession({
      mode: 'live_call',
      participants: ['operator'],
      goal: 'test call',
    })).toEqual(
      expect.objectContaining({
        status: 'waiting_consent',
        consent: expect.objectContaining({
          required: true,
        }),
      }),
    );
    expect(fileTransfer.planTransfer({
      direction: 'import',
      source: { kind: 'artifact-ref', ref: 'artifact://input' },
      destination: { kind: 'workspace-path', ref: 'workspace/out.txt' },
    })).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'planned',
        policyDecision: expect.objectContaining({
          requiresApproval: true,
          redacted: true,
        }),
      }),
    );
    expect(documentExtract.extract({
      source: {
        storageRef: 'artifact://doc-1',
        contentType: 'application/pdf',
      },
      mode: 'full',
    })).toEqual(
      expect.objectContaining({
        ok: true,
        outputArtifactId: 'document.extracted.artifact:-doc-1',
        policyDecision: expect.objectContaining({
          redactionApplied: false,
        }),
      }),
    );
    expect(diagnostics.snapshot({ scope: 'runtime', includeLogs: true })).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'healthy',
        reportArtifactId: 'diagnostics.runtime.report',
      }),
    );
    expect(migration.planImport({
      source: { kind: 'directory', ref: 'C:/private/source' },
      targetNamespace: 'zavorth',
      dryRun: true,
    })).toEqual(
      expect.objectContaining({
        ok: true,
        status: 'dry_run',
        reportArtifactId: 'migration.report.c:-private-source',
      }),
    );
    expect(webExtract.buildPlan({
      mode: 'readability',
      target: 'https://example.test/article',
    })).toEqual(
      expect.objectContaining({
        ok: true,
        networkCallRequired: false,
        browserLaunchRequired: false,
        secretValuesSerialized: false,
      }),
    );
  });
});
