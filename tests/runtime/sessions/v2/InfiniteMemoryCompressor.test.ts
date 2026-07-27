import { InfiniteMemoryCompressor } from '../../../../src/runtime/sessions/v2/InfiniteMemoryCompressor.js';

describe('InfiniteMemoryCompressor', () => {
  it('compresses old context and recalls memories by keyword overlap', () => {
    const compressor = new InfiniteMemoryCompressor('memory-session-1', {
      compressionThreshold: 20,
      maxRetrievedMemories: 3,
      similarityThreshold: 0.1,
    });

    compressor.pushMessage('Zavorth session planner researching deployment rollback health checks.');
    compressor.pushMessage('Deployment rollback health checks must inspect logs memory and tunnel state.');
    compressor.pushMessage('Operator notes mention rollout health and rollback checklist again.');

    const snapshot = compressor.getSnapshot();
    const recalled = compressor.recall('rollback health');

    expect(snapshot.storedChunks).toBeGreaterThan(0);
    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled[0].compressedSummary).toMatch(/Compressed memory|Compressed memory|rollback|health/i);
  });
});
