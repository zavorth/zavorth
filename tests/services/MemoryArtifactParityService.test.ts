import { MemoryArtifactParityService } from '../../src/services/MemoryArtifactParityService.js';
import { PluginRegistryService } from '../../src/services/PluginRegistryService.js';

describe('MemoryArtifactParityService Phase 7', () => {
  it('builds Memory/Artifact parity over the current Zavorth memory plane without writes', () => {
    const snapshot = new MemoryArtifactParityService({
      now: () => new Date('2026-05-04T17:00:00.000Z'),
    }).buildSnapshot();

    expect(snapshot.contractVersion).toBe('2026-05-04.phase-7');
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        surfaces: 15,
        native: 4,
        artifactReady: 1,
        backendReady: 10,
        declaredOnly: 0,
        templateReady: 0,
        missing: 0,
        decisionRequired: 0,
        sourceModulesMapped: 5,
        liveMemoryWriteRequired: false,
        filesystemReadRequired: false,
        secretValuesSerialized: false,
      }),
    );
    expect(snapshot.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ surface: 'artifact-memory-index', status: 'native' }),
        expect.objectContaining({ surface: 'memory-with-receipts', status: 'native' }),
        expect.objectContaining({ surface: 'hybrid-recall', status: 'backend-ready' }),
        expect.objectContaining({ surface: 'persistent-memory', status: 'backend-ready' }),
        expect.objectContaining({ surface: 'wiki-memory', status: 'backend-ready' }),
        expect.objectContaining({ surface: 'vector-backend-choice', status: 'backend-ready' }),
      ]),
    );
    expect(snapshot.policy).toEqual(
      expect.objectContaining({
        parityIsReadOnly: true,
        memoryWritePerformed: false,
        filesystemReadPerformed: false,
        promotionRequiresExplicitAction: true,
        reusedArtifactMustCiteOrigin: true,
      }),
    );
  });

  it('maps the private memory extension inventory into Zavorth-native surfaces', () => {
    const snapshot = new MemoryArtifactParityService().buildSnapshot();

    expect(snapshot.sourceModules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceModule: 'memory-core',
          targetSurface: 'persistent-memory',
          primitiveId: 'memory.remember',
          status: 'backend-ready',
        }),
        expect.objectContaining({
          sourceModule: 'active-memory',
          targetSurface: 'hybrid-recall',
          primitiveId: 'memory.recall',
          status: 'backend-ready',
        }),
        expect.objectContaining({
          sourceModule: 'memory-lancedb',
          targetSurface: 'vector-backend-choice',
          status: 'backend-ready',
        }),
        expect.objectContaining({
          sourceModule: 'memory-wiki',
          targetSurface: 'wiki-memory',
          status: 'backend-ready',
        }),
        expect.objectContaining({
          sourceModule: 'thread-ownership',
          targetSurface: 'thread-ownership',
          status: 'backend-ready',
        }),
      ]),
    );
  });

  it('runs dry proof through Artifact Memory, Memory With Receipts, and Run Artifact Replay', () => {
    const proof = new MemoryArtifactParityService({
      now: () => new Date('2026-05-04T17:10:00.000Z'),
    }).buildSnapshot().dryProof;

    expect(proof.artifactMemory).toEqual(
      expect.objectContaining({
        status: 'ready',
        entries: 3,
        reusable: 3,
        searchReady: true,
        citationRequired: true,
      }),
    );
    expect(proof.memoryWithReceipts).toEqual(
      expect.objectContaining({
        receipts: 1,
        allMemoryHasReceipt: true,
        sourceQuestionsSupported: true,
      }),
    );
    expect(proof.runArtifactReplay).toEqual(
      expect.objectContaining({
        replayable: true,
        receiptLinked: true,
      }),
    );
    expect(proof.runArtifactReplay.frames).toBeGreaterThan(0);
    expect(proof.runArtifactReplay.artifactLinks).toBeGreaterThan(0);
  });

  it('keeps partial import/export memory support visible instead of overstating parity', () => {
    const service = new MemoryArtifactParityService({
      files: {
        settingsExport: 'export',
        settingsImport: '',
        memoryService: 'listAll',
      },
    });
    const entry = service.buildEntryForSurface('memory-import-export');

    expect(entry.status).toBe('declared-only');
    expect(entry.findings.join(' ')).toContain('remember(');
    expect(entry.smokeGate.liveMemoryWriteRequired).toBe(false);
    expect(entry.smokeGate.filesystemReadRequired).toBe(false);
  });

  it('emits a Memory/Artifact Plugin OS manifest that can be installed and invoked as a plan', async () => {
    const manifest = new MemoryArtifactParityService({
      now: () => new Date('2026-05-04T17:20:00.000Z'),
    }).buildSnapshot().generatedPluginManifests[0];
    const registry = new PluginRegistryService({
      now: () => new Date('2026-05-04T17:21:00.000Z'),
      manifests: [manifest],
    });

    expect(manifest.id).toBe('zavorth.memory.artifact-plane');
    expect(manifest.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'artifact.index', intent: 'artifact_index' }),
        expect.objectContaining({ id: 'artifact.memory.index', intent: 'artifact_memory_index' }),
        expect.objectContaining({ id: 'memory.receipt', intent: 'memory_receipt' }),
        expect.objectContaining({ id: 'memory.recall', intent: 'memory_recall' }),
        expect.objectContaining({ id: 'session.replay', intent: 'session_replay' }),
      ]),
    );
    expect(registry.install(manifest.id, { approved: true }).status).toBe('applied');
    expect(registry.enable(manifest.id, { approved: true }).status).toBe('applied');
    await expect(registry.invoke({
      pluginId: manifest.id,
      capabilityId: 'memory.recall',
      approved: true,
    })).resolves.toEqual(expect.objectContaining({ status: 'planned' }));
  });
});
