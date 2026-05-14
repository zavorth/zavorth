import type { DashboardRunObservatoryDiffPreview } from "../contracts";
import { buildCommandCenterRuntimeAuthHeaders } from "../../controlPageClient.utils";

export async function applyCommandCenterDiffPreview(input: {
  preview: DashboardRunObservatoryDiffPreview;
  activeSessionId: string;
  reloadControlState: (sessionId: string) => Promise<void>;
}): Promise<void> {
  const { preview, activeSessionId, reloadControlState } = input;
  if (!preview.planId) {
    throw new Error("planId ausente nesta previa de alteracao.");
  }

  const response = await fetch("/api/web/agent-runs/apply-draft", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildCommandCenterRuntimeAuthHeaders(),
    },
    body: JSON.stringify({
      planId: preview.planId,
      runId: preview.runId,
      sessionId: preview.sessionId || activeSessionId,
      confirmOwnerControlledApply: true,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Falha ao aplicar rascunho.");
  }

  await reloadControlState(preview.sessionId || activeSessionId);
}
