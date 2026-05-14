export type MemoryStatusInput = {
  userId: string;
  platform?: string | null;
  chatId?: string | null;
  sessionId?: string | null;
  sourceUserId?: string | null;
  workspaceHint?: string | null;
};

export type MemoryPlaneSnapshotPort = {
  buildSnapshotFast: (input: MemoryStatusInput) => {
    generatedAt: string;
    summary: {
      persistedMemories: number;
      relevantMemories: number;
      artifacts: number;
      workflowRuns: number;
      timelineEvents: number;
    };
    narrative: {
      headline: string;
      operatorSummary: string;
    };
  };
};

export type MemoryDomainPort = {
  readMemoryState(input: MemoryStatusInput): MemoryDomainReadModel;
};

export type MemoryDomainReadModel = {
  generatedAt: string;
  persistedMemories: number;
  relevantMemories: number;
  artifacts: number;
  workflowRuns: number;
  timelineEvents: number;
  headline: string;
  operatorSummary: string;
  source: 'memory-plane' | 'empty';
};
