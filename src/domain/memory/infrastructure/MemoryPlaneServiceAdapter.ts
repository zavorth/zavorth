import type { MemoryDomainPort, MemoryDomainReadModel, MemoryPlaneSnapshotPort, MemoryStatusInput } from '../domain/MemoryDomainTypes.js';

type MemoryPlaneServiceAdapterRuntime = {
  now?: () => Date;
  memoryPlaneService?: MemoryPlaneSnapshotPort | null;
};

export class MemoryPlaneServiceAdapter implements MemoryDomainPort {
  private readonly now: () => Date;
  private readonly memoryPlaneService: MemoryPlaneSnapshotPort | null;

  constructor(runtime: MemoryPlaneServiceAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memoryPlaneService = runtime.memoryPlaneService || null;
  }

  public readMemoryState(input: MemoryStatusInput): MemoryDomainReadModel {
    if (!this.memoryPlaneService) {
      return {
        generatedAt: this.now().toISOString(),
        persistedMemories: 0,
        relevantMemories: 0,
        artifacts: 0,
        workflowRuns: 0,
        timelineEvents: 0,
        headline: 'Memory domain waiting for the canonical memory plane.',
        operatorSummary: 'No memory plane foi injetado neste contexto.',
        source: 'empty',
      };
    }

    const snapshot = this.memoryPlaneService.buildSnapshotFast(input);
    return {
      generatedAt: snapshot.generatedAt,
      persistedMemories: snapshot.summary.persistedMemories,
      relevantMemories: snapshot.summary.relevantMemories,
      artifacts: snapshot.summary.artifacts,
      workflowRuns: snapshot.summary.workflowRuns,
      timelineEvents: snapshot.summary.timelineEvents,
      headline: snapshot.narrative.headline,
      operatorSummary: snapshot.narrative.operatorSummary,
      source: 'memory-plane',
    };
  }
}
