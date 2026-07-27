import type { AgentRunIntelligenceFabricCanary } from './AgentRunIntelligenceFabricCanary.js';
import type { UniversalAgentRun } from './UniversalAgentRuntimeTypes.js';

export function promoteIntelligenceFabricDraftWorkspaceWrites(input: {
  run: UniversalAgentRun;
  canary: Pick<AgentRunIntelligenceFabricCanary, 'promoteDraftWorkspaceWrites'>;
  now: string;
  idFactory: (prefix: string) => string;
}): boolean {
  const writes = input.run.metadata.intelligenceFabricDraftWorkspaceWrites;
  const patches = input.run.metadata.intelligenceFabricDraftWorkspacePatches;
  const writeCount = Array.isArray(writes) ? writes.length : 0;
  const patchCount = Array.isArray(patches) ? patches.length : 0;
  if (writeCount === 0 && patchCount === 0) {
    return false;
  }
  const promoted = input.canary.promoteDraftWorkspaceWrites({ run: input.run, writes, patches });
  if (!promoted) {
    return false;
  }
  const guidance = readRecord(input.run.metadata.intelligenceFabricDraftGuidance);
  const mutationPlan = readRecord(guidance.mutationPlan);
  input.run.events.push({
    id: input.idFactory('agent-event'),
    runId: input.run.id,
    kind: 'planning',
    title: 'workspaceWrites estruturados promovidos',
    detail: 'The planner/LLM produced workspaceWrites/workspacePatches; the Mutation Plane received a new plan pending explicit apply.',
    status: 'done',
    createdAt: input.now,
    metadata: {
      source: 'intelligence-fabric-draft-promotion',
      writeCount,
      patchCount,
      planId: mutationPlan.id || null,
    },
  });
  return true;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
