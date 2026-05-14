import { useEffect, useState } from "react";
import type {
  DashboardNexusWorkbenchAction,
  DashboardNexusWorkbenchPendingApproval,
} from "../contracts";

type NexusWorkbenchPayload = Record<string, unknown> | null;

export type CommandCenterNexusWorkbenchController = {
  snapshot: NexusWorkbenchPayload;
  busyActionId: string | null;
  message: string | null;
  refresh: () => Promise<void>;
  resolveApproval: (
    approval: DashboardNexusWorkbenchPendingApproval,
    approved: boolean,
  ) => Promise<void>;
  runAction: (action: DashboardNexusWorkbenchAction) => Promise<void>;
  inspectCapabilities: () => Promise<void>;
};

export function useCommandCenterNexusWorkbench(input: {
  activeSessionId?: string | null;
  wsStatus?: string;
  reloadControlState?: (preferredSessionId?: string | null) => Promise<void>;
}): CommandCenterNexusWorkbenchController {
  const [nexusWorkbench, setNexusWorkbench] = useState<NexusWorkbenchPayload>(null);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    const controller = new AbortController();
    try {
      await loadNexusWorkbench(controller.signal, setNexusWorkbench);
    } finally {
      controller.abort();
    }
  };

  const reloadAfterMutation = async () => {
    await refresh();
    if (input.reloadControlState) {
      await input.reloadControlState(input.activeSessionId || null);
    }
  };

  const resolveApproval = async (
    approval: DashboardNexusWorkbenchPendingApproval,
    approved: boolean,
  ) => {
    setBusyActionId(`${approval.id}:${approved ? "approve" : "reject"}`);
    setMessage(null);
    try {
      const response = await fetch(approval.resolveRoute || "/api/v2/nexus/permissions/resolve", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: approval.id,
          approved,
          sessionId: input.activeSessionId || undefined,
          surface: "command-center",
          requestedBy: "command-center",
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, `Falha ao ${approved ? "aprovar" : "negar"} confirmacao.`));
      }
      setMessage(approved
        ? `Confirmacao ${approval.id} aprovada.`
        : `Confirmacao ${approval.id} negada.`);
      await reloadAfterMutation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao resolver confirmacao.");
    } finally {
      setBusyActionId(null);
    }
  };

  const inspectCapabilities = async () => {
    setBusyActionId("capability-readiness");
    setMessage(null);
    try {
      const response = await fetch("/api/v2/nexus/capabilities", {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Readiness de capacidades indisponivel."));
      }
      const record = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload as Record<string, unknown>
        : {};
      const tools = Array.isArray(record.tools) ? record.tools.length : 0;
      const maturity = Array.isArray(record.maturity) ? record.maturity.length : 0;
      setMessage(`Readiness carregado: ${tools} ferramenta(s), ${maturity} linha(s) de maturidade.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao abrir readiness de capacidades.");
    } finally {
      setBusyActionId(null);
    }
  };

  const runAction = async (action: DashboardNexusWorkbenchAction) => {
    if (action.kind === "capability_readiness" || action.route.endsWith("/capabilities")) {
      await inspectCapabilities();
      return;
    }

    if (action.kind !== "safe_execution" || action.method.toUpperCase() !== "POST") {
      setMessage(`${action.label} precisa de uma acao especifica no painel.`);
      return;
    }

    setBusyActionId(action.id);
    setMessage(null);
    try {
      const response = await fetch(action.route || "/api/v2/nexus/execute", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: action.prompt || "Mostre um status operacional resumido do Zavorth sem alterar arquivos.",
          category: "INTERNAL",
          sessionId: input.activeSessionId || undefined,
          surface: "command-center",
          requestedBy: "command-center",
          metadata: {
            commandCenterActionId: action.id,
            safeWorkbenchAction: true,
          },
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Execucao segura nao foi aceita."));
      }
      setMessage(`${action.label} solicitada com seguranca.`);
      await reloadAfterMutation();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao disparar execucao segura.");
    } finally {
      setBusyActionId(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      try {
        await loadNexusWorkbench(controller.signal, (payload) => {
          if (active) {
            setNexusWorkbench(payload);
          }
        });
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }
        setNexusWorkbench({
          ok: false,
          headline: error instanceof Error ? error.message : "Nexus Workbench indisponivel agora.",
          generatedAt: new Date().toISOString(),
          runtime: {
            primary: "unknown",
            agentGatewayAvailable: false,
            echoFallbackAvailable: false,
          },
          receipts: ["nexus-workbench-fetch-failed"],
        });
      }
    };

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [input.activeSessionId, input.wsStatus]);

  return {
    snapshot: nexusWorkbench,
    busyActionId,
    message,
    refresh,
    resolveApproval,
    runAction,
    inspectCapabilities,
  };
}

async function loadNexusWorkbench(
  signal: AbortSignal,
  setSnapshot: (payload: NexusWorkbenchPayload) => void,
): Promise<void> {
  const response = await fetch("/api/v2/nexus/workbench", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Nexus Workbench indisponivel (${response.status}).`);
  }
  const payload = await response.json();
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    setSnapshot(payload as Record<string, unknown>);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function readErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const error = (payload as Record<string, unknown>).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }
  return fallback;
}
