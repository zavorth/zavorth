"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import type {
  DashboardCommandCenterViewModel,
  DashboardNavigationSector,
} from "../contracts";
import {
  CommandCenterBadge,
  CommandCenterButton,
  CommandCenterCard,
} from "./CommandCenterPrimitives";

type CommandCenterOnboardingPanelProps = {
  model: ControlPageClientModel;
  viewModel: DashboardCommandCenterViewModel;
  onDraftCommand: (command: string) => void;
  onNavigate: (sectorId: DashboardNavigationSector["id"]) => void;
};

type OnboardingStep = {
  id: string;
  label: string;
  value: string;
  ready: boolean;
  actionLabel: string;
  action: () => void;
};

const AUTH_STORAGE_KEY = "zavorth.webAuthToken";

export function CommandCenterOnboardingPanel({
  model,
  viewModel,
  onDraftCommand,
  onNavigate,
}: CommandCenterOnboardingPanelProps) {
  const [token, setToken] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null);
  const locked = isAccessLocked(model);
  const steps = useMemo(
    () => buildFirstRunSteps({ model, viewModel, onDraftCommand, onNavigate }),
    [model, viewModel, onDraftCommand, onNavigate],
  );
  const readySteps = steps.filter((step) => step.ready).length;

  const handleUnlock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setUnlockMessage("Cole o token local antes de desbloquear.");
      return;
    }

    setUnlocking(true);
    setUnlockMessage("Validando token local...");
    try {
      const response = await fetch("/api/auth/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: normalizedToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        const recovery = asText(payload?.recovery?.primaryCommand, "zavorth open");
        throw new Error(`${asText(payload?.error, "Token invalido ou antigo.")} Abra uma nova aba com ${recovery}.`);
      }
      window.sessionStorage.setItem(AUTH_STORAGE_KEY, normalizedToken);
      setToken("");
      setUnlockMessage("Runtime desbloqueado nesta aba.");
      await model.loadControlState(model.activeSessionId || null);
    } catch (error: any) {
      setUnlockMessage(error?.message || "Nao consegui validar o token local.");
    } finally {
      setUnlocking(false);
    }
  };

  if (locked) {
    return (
      <CommandCenterCard label="Acesso" title="Runtime protegido">
        <div className="bcc-access-card" data-state="protected">
          <div className="bcc-access-card__header">
            <CommandCenterBadge tone="warn">token necessario</CommandCenterBadge>
            <span>Local-first</span>
          </div>
          <p className="bcc-access-card__copy">
            O Command Center abriu, mas os dados reais do runtime exigem o token local desta instalacao.
          </p>
          <form className="bcc-token-form" onSubmit={handleUnlock}>
            <label className="bcc-token-field">
              <span>Token local</span>
              <input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Cole o token do Zavorth"
                autoComplete="off"
              />
            </label>
            <CommandCenterButton type="submit" variant="primary" disabled={unlocking}>
              {unlocking ? "Validando" : "Desbloquear"}
            </CommandCenterButton>
          </form>
          <div className="bcc-access-commands" aria-label="Comandos de recuperacao do Command Center">
            <code>zavorth open</code>
            <code>zavorth doctor</code>
            <code>zavorth ready</code>
          </div>
          {unlockMessage ? (
            <p className="bcc-access-card__feedback" data-tone={unlockMessage.includes("desbloqueado") ? "ok" : "warn"}>
              {unlockMessage}
            </p>
          ) : (
            <p className="bcc-access-card__feedback">
              O token fica somente no sessionStorage desta aba.
            </p>
          )}
        </div>
      </CommandCenterCard>
    );
  }

  return (
    <CommandCenterCard label="Primeiro uso" title={`${readySteps}/${steps.length} prontos`}>
      <div className="bcc-onboarding-panel">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className="bcc-onboarding-step"
            data-state={step.ready ? "ready" : "pending"}
            onClick={step.action}
          >
            <span className="bcc-onboarding-step__label">{step.label}</span>
            <strong>{step.value}</strong>
            <small>{step.actionLabel}</small>
          </button>
        ))}
      </div>
    </CommandCenterCard>
  );
}

function isAccessLocked(model: ControlPageClientModel): boolean {
  const error = asText(model.error).toLowerCase();
  return Boolean(
    error
      && (
        error.includes("unauthorized")
        || error.includes("token")
        || error.includes("401")
        || error.includes("autoriz")
      ),
  );
}

function buildFirstRunSteps({
  model,
  viewModel,
  onDraftCommand,
  onNavigate,
}: CommandCenterOnboardingPanelProps): OnboardingStep[] {
  const providerLabel = asText(
    viewModel.modelProfile.modelLabel,
    viewModel.runtime.currentModelLabel || "provider pendente",
  );
  const workspaceRoot = asText(
    model.developerWorkspace?.projectRoot
      || model.developerWorkspace?.project?.root
      || model.developerWorkspace?.manifestPath,
  );
  const toolsReady = viewModel.toolExposure.tools.length > 0 || viewModel.counts.capabilities > 0;
  const firstRunDone = Boolean(
    viewModel.agentRun
      || viewModel.messages.length > 0
      || viewModel.counts.tasks > 0,
  );

  return [
    {
      id: "provider",
      label: "Provider",
      value: providerLabel,
      ready: viewModel.modelProfile.ready !== false && providerLabel !== "provider pendente",
      actionLabel: "abrir gateway",
      action: () => onNavigate("gateway"),
    },
    {
      id: "channel",
      label: "Canal",
      value: "Web Chat",
      ready: true,
      actionLabel: "abrir chat",
      action: () => onNavigate("terminal"),
    },
    {
      id: "workspace",
      label: "Workspace",
      value: workspaceRoot ? workspaceRoot.split(/[\\/]/u).filter(Boolean).pop() || workspaceRoot : "nao definido",
      ready: Boolean(workspaceRoot),
      actionLabel: "revisar workspace",
      action: () => onNavigate("workspace"),
    },
    {
      id: "safe-tools",
      label: "Safe tools",
      value: toolsReady ? `${viewModel.toolExposure.tools.length || viewModel.counts.capabilities} expostas` : "aguardando",
      ready: toolsReady,
      actionLabel: "ver skills/tools",
      action: () => onNavigate("skills"),
    },
    {
      id: "first-run",
      label: "First run",
      value: firstRunDone ? "feito" : "pronto para começar",
      ready: firstRunDone,
      actionLabel: firstRunDone ? "abrir timeline" : "preparar prompt",
      action: () => {
        onDraftCommand("Resuma esta pasta e diga o que posso fazer aqui.");
      },
    },
  ];
}
