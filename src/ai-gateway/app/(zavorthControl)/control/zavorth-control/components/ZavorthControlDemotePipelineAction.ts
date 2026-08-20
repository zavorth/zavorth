type FetchLike = typeof fetch;

export type ZavorthControlApplyDraftRequest = {
  runId?: string | null;
  sessionId?: string | null;
  planId: string;
  approvalId?: string | null;
  workspace?: string | null;
};

export type ZavorthControlDemotePipelineRequest = {
  runId?: string | null;
  sessionId?: string | null;
  status?: string | null;
  recommendation?: string | null;
  rollbackInstruction?: string | null;
  workspace?: string | null;
};
export type ZavorthControlDemoteFabricRequest = ZavorthControlDemotePipelineRequest;

export const ZAVORTH_CONTROL_DEMOTE_PIPELINE_LABEL = 'Disable Pipeline';
export const ZAVORTH_CONTROL_DEMOTE_FABRIC_LABEL = ZAVORTH_CONTROL_DEMOTE_PIPELINE_LABEL;

export const ZAVORTH_CONTROL_PIPELINE_DEMOTE_INVARIANTS = {
  intelligenceFabricMode: 'disabled',
  globalRuntimeChanged: false,
};
export const ZAVORTH_CONTROL_FABRIC_DEMOTE_INVARIANTS = ZAVORTH_CONTROL_PIPELINE_DEMOTE_INVARIANTS;

export async function zavorthControlApplyDraft(
  input: ZavorthControlApplyDraftRequest,
  fetchImpl: FetchLike = fetch,
) {
  return fetchImpl('/api/web/agent-runs/apply-draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      confirmOwnerControlledApply: true,
    }),
  });
}

export async function zavorthControlDemotePipeline(
  input: ZavorthControlDemotePipelineRequest,
  fetchImpl: FetchLike = fetch,
) {
  return fetchImpl('/api/web/agent-runs/demote-fabric', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...input,
      intelligenceFabricMode: 'disabled',
      confirmOwnerControlledDemote: true,
    }),
  });
}

export const zavorthControlDemoteFabric = zavorthControlDemotePipeline;
