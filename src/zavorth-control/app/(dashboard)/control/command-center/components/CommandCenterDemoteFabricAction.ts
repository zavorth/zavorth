import type { DashboardIntelligenceFabricHealthSnapshot } from "../contracts";
import { buildCommandCenterRuntimeAuthHeaders } from "../../controlPageClient.utils";

export async function demoteCommandCenterIntelligenceFabric(input: {
  health: DashboardIntelligenceFabricHealthSnapshot;
  activeSessionId: string;
  reloadControlState: (sessionId: string) => Promise<void>;
}): Promise<void> {
  const { health, activeSessionId, reloadControlState } = input;
  const response = await fetch("/api/web/agent-runs/demote-fabric", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...buildCommandCenterRuntimeAuthHeaders(),
    },
    body: JSON.stringify({
      sessionId: activeSessionId,
      status: health.status,
      recommendation: health.recommendation,
      rollbackInstruction: health.rollback.instruction,
      confirmOwnerControlledDemote: true,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || "Falha ao aplicar demote controlado do Fabric.");
  }

  await reloadControlState(activeSessionId);
}
