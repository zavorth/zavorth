import type { ReactNode } from "react";
import type { ControlPageClientModel } from "../../controlPageClient.types";
import type {
  DashboardCommandCenterViewModel,
  DashboardNavigationSector,
} from "../contracts";
import { CommandCenterBadge } from "./CommandCenterPrimitives";

type CommandCenterSectorFrameProps = {
  sector: DashboardNavigationSector | undefined;
  sectorId: DashboardNavigationSector["id"];
  viewModel: DashboardCommandCenterViewModel;
  model: ControlPageClientModel;
  onNavigate: (sectorId: DashboardNavigationSector["id"]) => void;
  children: ReactNode;
};

export function CommandCenterSectorFrame({
  sector,
  sectorId,
  viewModel,
  model,
  onNavigate,
  children,
}: CommandCenterSectorFrameProps) {
  const title = sector?.title ?? "Painel";
  const subtitle = commandCenterSectorSubtitle(sectorId);
  const pendingApprovals = viewModel.approvals.filter((approval) => approval.status === "pending").length;
  const receiptCount = viewModel.runObservatory.receipts?.length ?? viewModel.counts.artifacts;

  return (
    <div className="bcc-sector-surface" data-sector={sectorId}>
      <header className="bcc-sector-header">
        <div>
          <p className="bcc-sector-header__eyebrow">{sector?.label ?? "Zavorth"}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="bcc-sector-header__actions">
          <CommandCenterBadge tone={viewModel.runtime.status === "ready" ? "ok" : "warn"}>
            {viewModel.runtime.currentProviderLabel}
          </CommandCenterBadge>
          <CommandCenterBadge tone={pendingApprovals > 0 ? "warn" : "ok"}>
            {pendingApprovals} approval
          </CommandCenterBadge>
          <CommandCenterBadge>
            {receiptCount} receipt
          </CommandCenterBadge>
        </div>
      </header>

      <div className="bcc-sector-quickbar" aria-label="Acoes rapidas da secao">
        <button type="button" onClick={() => onNavigate("terminal")}>Abrir chat</button>
        <button type="button" onClick={() => onNavigate("overview")}>Visao geral</button>
        <button type="button" onClick={() => onNavigate("config")}>Config</button>
        <button type="button" onClick={() => void model.loadControlState(model.activeSessionId)}>Atualizar</button>
      </div>

      <div className="bcc-sector-content">
        {children}
      </div>
    </div>
  );
}

function commandCenterSectorSubtitle(sectorId: DashboardNavigationSector["id"]): string {
  const copy: Record<DashboardNavigationSector["id"], string> = {
    terminal: "Converse em linguagem natural e aprove apenas quando houver risco real.",
    overview: "Resumo operacional com prontidao, trabalho atual e sinais importantes.",
    workspace: "Arquivos, processos e estado do workspace sem misturar com conversa.",
    gateway: "Rotas, provider, status de conexao e diagnostico do gateway.",
    "sales-os": "Superficie comercial e operacional quando o modo de negocio estiver ativo.",
    channels: "Canais conectados, configuraveis e continuidade entre superficies.",
    instances: "Clientes, consumers e instancias conectadas ao runtime local.",
    sessions: "Historico navegavel das conversas e runs recentes.",
    agents: "Agentes, workers e delegacoes governadas.",
    skills: "Skills, capabilities, quarentena e uso seguro de ferramentas.",
    nodes: "Rede de companions e nos externos autorizados.",
    dreams: "Memoria, artifacts reutilizaveis e sinais do Mnemos.",
    usage: "Uso real, consumo, provider ativo e sinais de custo.",
    config: "Preferencias, provider mesh, seguranca e readiness de produto.",
    docs: "Documentacao operacional curta, sem planos antigos no caminho principal.",
    cron: "Rotinas agendadas e automacoes governadas.",
  };

  return copy[sectorId] ?? "Painel operacional do Zavorth.";
}
