"use client";

import { useMemo, useState } from "react";

import type {
  RemoteMeshNotebookApprovalUxCard,
  RemoteMeshNotebookApprovalUxSnapshot,
} from "../../../../../../contracts/RemoteMeshNotebookApprovalUxContract.js";
import type {
  RemoteMeshNotebookMcpProxyResult,
} from "../../../../../../contracts/RemoteMeshNotebookMcpProxyContract.js";
import {
  CommandCenterBadge,
  CommandCenterButton,
  CommandCenterCard,
} from "./CommandCenterPrimitives";

type RemoteMeshApplyState = {
  status: "idle" | "applying" | "applied" | "failed";
  message: string | null;
  receipt: RemoteMeshNotebookMcpProxyResult["receipt"] | null;
};

type CommandCenterRemoteMeshApprovalPanelProps = {
  snapshot: RemoteMeshNotebookApprovalUxSnapshot | null;
  previewMode?: boolean;
};

export function CommandCenterRemoteMeshApprovalPanel({
  snapshot,
  previewMode = false,
}: CommandCenterRemoteMeshApprovalPanelProps) {
  const cards = useMemo(
    () => snapshot?.cards.filter((card) => card.surface === "command-center") ?? [],
    [snapshot],
  );
  const [stateByApprovalId, setStateByApprovalId] = useState<Record<string, RemoteMeshApplyState>>({});

  if (cards.length === 0) {
    return null;
  }

  const approvalCount = cards.filter((card) => card.state === "approval-required").length;
  const receiptCount = cards.length - approvalCount;

  return (
    <CommandCenterCard
      label="Remote Mesh"
      title={`${approvalCount} MCP approval${approvalCount === 1 ? "" : "s"}`}
      className="bcc-remote-mesh-card"
    >
      <div className="bcc-list">
        {cards.slice(0, 4).map((card) => {
          const approvalId = card.approval?.approvalId ?? card.receipt?.receiptId ?? `${card.sourceToolName}:${card.targetLabel}`;
          const applyState = stateByApprovalId[approvalId] ?? {
            status: "idle",
            message: null,
            receipt: null,
          };

          return (
            <RemoteMeshApprovalItem
              key={approvalId}
              card={card}
              applyState={applyState}
              previewMode={previewMode}
              onApply={async () => {
                if (!card.approval) {
                  return;
                }
                setStateByApprovalId((current) => ({
                  ...current,
                  [approvalId]: {
                    status: "applying",
                    message: "Chamando MCP real do notebook...",
                    receipt: null,
                  },
                }));
                const result = await applyRemoteMeshApproval(card).catch((error) => buildClientFailureResult(error));
                setStateByApprovalId((current) => ({
                  ...current,
                  [approvalId]: {
                    status: result.ok ? "applied" : "failed",
                    message: result.ok
                      ? summarizeRemoteMeshApplyResult(result)
                      : result.error ?? result.jsonRpcError?.message ?? "Falha ao aplicar approval no notebook MCP.",
                    receipt: result.receipt,
                  },
                }));
              }}
            />
          );
        })}
      </div>
      <p className="bcc-remote-mesh-card__footnote">
        {receiptCount > 0
          ? `${receiptCount} receipt${receiptCount === 1 ? "" : "s"} ja registrado${receiptCount === 1 ? "" : "s"}.`
          : "O clique passa pelo proxy server-side do Zavorth; token e endpoint nao saem para o navegador."}
      </p>
    </CommandCenterCard>
  );
}

function RemoteMeshApprovalItem({
  card,
  applyState,
  previewMode,
  onApply,
}: {
  card: RemoteMeshNotebookApprovalUxCard;
  applyState: RemoteMeshApplyState;
  previewMode: boolean;
  onApply: () => Promise<void>;
}) {
  const canApply = Boolean(card.approval)
    && !previewMode
    && applyState.status !== "applying"
    && applyState.status !== "applied";

  return (
    <div className="bcc-list-item bcc-remote-mesh-approval-row" data-status={applyState.status}>
      <div className="bcc-remote-mesh-approval-row__header">
        <span className="bcc-list-item__title">{card.title}</span>
        <CommandCenterBadge tone={card.riskLabel === "medium" ? "warn" : "info"}>
          {card.commandCenter.badge}
        </CommandCenterBadge>
      </div>
      <span className="bcc-list-item__meta">{card.body}</span>
      <div className="bcc-remote-mesh-approval-row__target">
        <span>{card.targetKind}</span>
        <strong>{card.targetLabel}</strong>
      </div>
      {card.approval ? (
        <div className="bcc-action-row">
          <CommandCenterButton
            type="button"
            variant="primary"
            disabled={!canApply}
            onClick={() => {
              void onApply();
            }}
          >
            {applyState.status === "applying"
              ? "Aplicando..."
              : applyState.status === "applied"
                ? "Aplicado"
                : card.commandCenter.primaryActionLabel ?? "Aplicar no MCP"}
          </CommandCenterButton>
          <CommandCenterButton type="button" disabled>
            {previewMode ? "Preview visual" : "Rejeitar"}
          </CommandCenterButton>
        </div>
      ) : null}
      {card.receipt ? (
        <div className="bcc-remote-mesh-receipt">
          <strong>{card.receipt.summary}</strong>
          {card.receipt.contentPreview ? <pre>{card.receipt.contentPreview}</pre> : null}
        </div>
      ) : null}
      {applyState.message ? (
        <div className="bcc-remote-mesh-apply-result" data-status={applyState.status}>
          <span>{applyState.message}</span>
          {applyState.receipt?.structuredContent ? (
            <small>{summarizeStructuredReceipt(applyState.receipt.structuredContent)}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function buildClientFailureResult(error: unknown): RemoteMeshNotebookMcpProxyResult {
  return {
    generatedAt: new Date().toISOString(),
    contractVersion: "2026-05-05.remote-mesh-command-center-real-mcp-proxy",
    ok: false,
    status: "failed",
    toolName: null,
    httpStatus: null,
    endpointLabel: null,
    error: error instanceof Error ? error.message : "Falha local ao chamar proxy MCP.",
    jsonRpcError: null,
    receipt: null,
    safety: {
      browserReceivedToken: false,
      endpointAcceptedFromBrowser: false,
      applyToolAllowlisted: false,
      liveNetworkCallPerformed: false,
      rawCommandSerialized: false,
      secretValuesSerialized: false,
    },
  };
}

async function applyRemoteMeshApproval(
  card: RemoteMeshNotebookApprovalUxCard,
): Promise<RemoteMeshNotebookMcpProxyResult> {
  if (!card.approval) {
    return {
      generatedAt: new Date().toISOString(),
      contractVersion: "2026-05-05.remote-mesh-command-center-real-mcp-proxy",
      ok: false,
      status: "blocked",
      toolName: null,
      httpStatus: null,
      endpointLabel: null,
      error: "Remote Mesh card has no approval payload.",
      jsonRpcError: null,
      receipt: null,
      safety: {
        browserReceivedToken: false,
        endpointAcceptedFromBrowser: false,
        applyToolAllowlisted: false,
        liveNetworkCallPerformed: false,
        rawCommandSerialized: false,
        secretValuesSerialized: false,
      },
    };
  }

  const response = await fetch("/api/remote-mesh/notebook/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolName: card.approval.applyToolName,
      arguments: card.approval.applyArguments,
    }),
  });
  return await response.json() as RemoteMeshNotebookMcpProxyResult;
}

function summarizeRemoteMeshApplyResult(result: RemoteMeshNotebookMcpProxyResult): string {
  const receipt = result.receipt?.structuredContent;
  if (!receipt) {
    return "Approval aplicado pelo MCP do notebook.";
  }
  if (typeof receipt.receiptId === "string") {
    return `Receipt ${receipt.receiptId} recebido do notebook MCP.`;
  }
  return "Notebook MCP retornou resultado executado.";
}

function summarizeStructuredReceipt(receipt: Record<string, unknown>): string {
  const parts = [
    typeof receipt.toolName === "string" ? receipt.toolName : "",
    typeof receipt.status === "string" ? receipt.status : "",
    typeof receipt.container === "string" ? receipt.container : "",
    typeof receipt.project === "string" && typeof receipt.relativePath === "string"
      ? `${receipt.project}/${receipt.relativePath}`
      : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" - ") : "Receipt estruturado recebido.";
}
