type FetchLike = typeof fetch;

export type ZavorthControlApplyDraftRequest = {
  runId?: string | null;
  sessionId?: string | null;
  planId: string;
  approvalId?: string | null;
  workspace?: string | null;
};

export type ZavorthControlDemoteFabricRequest = {
  runId?: string | null;
  sessionId?: string | null;
  status?: string | null;
  recommendation?: string | null;
  rollbackInstruction?: string | null;
  workspace?: string | null;
};

export const ZAVORTH_CONTROL_DEMOTE_FABRIC_LABEL = 'Desativar Fabric';
export const ZAVORTH_CONTROL_FABRIC_DEMOTE_INVARIANTS = {
  intelligenceFabricMode: 'disabled',
  globalRuntimeChanged: false,
};

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

export async function zavorthControlDemoteFabric(
  input: ZavorthControlDemoteFabricRequest,
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
