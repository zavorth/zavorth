import type { MemoryDomainPort, MemoryDomainReadModel, MemoryStatusInput } from '../domain/MemoryDomainTypes.js';

type MemoryUseCasesRuntime = {
  now?: () => Date;
  memory?: MemoryDomainPort | null;
};

export class MemoryUseCases {
  private readonly now: () => Date;
  private readonly memory: MemoryDomainPort | null;

  constructor(runtime: MemoryUseCasesRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.memory = runtime.memory || null;
  }

  public buildReadiness(input: MemoryStatusInput): MemoryDomainReadModel {
    if (!this.memory) {
      return {
        generatedAt: this.now().toISOString(),
        persistedMemories: 0,
        relevantMemories: 0,
        artifacts: 0,
        workflowRuns: 0,
        timelineEvents: 0,
        headline: 'Memory domain waiting for the canonical memory plane.',
        operatorSummary: 'No memory adapter was injected into this domain.',
        source: 'empty',
      };
    }
    return this.memory.readMemoryState(input);
  }
}
