#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDashboardCommandCenterFixturePreviewViewModel,
  listDashboardCommandCenterFixturePreviewOptions,
  resolveDashboardCommandCenterFixturePreviewId,
} from "../src/ai-gateway/app/(dashboard)/control/command-center/preview/commandCenterFixturePreview";
import type { DashboardCommandCenterViewModel } from "../src/ai-gateway/app/(dashboard)/control/command-center/contracts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(rootDir, ".tmp", "command-center-browser-preview");

type CliOptions = {
  fixture: string;
  outDir: string;
};

type BrowserPreviewFixturePayload = {
  option: ReturnType<typeof listDashboardCommandCenterFixturePreviewOptions>[number];
  viewModel: DashboardCommandCenterViewModel;
};

function readCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const fixtureArg = args.find((arg) => arg.startsWith("--fixture="));
  const outArg = args.find((arg) => arg.startsWith("--out="));

  return {
    fixture: String(fixtureArg?.split("=").slice(1).join("=") || "safe-run").trim(),
    outDir: path.resolve(rootDir, String(outArg?.split("=").slice(1).join("=") || defaultOutDir).trim()),
  };
}

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildPreviewHtml(defaultFixtureId: string): string {
  const css = fs.readFileSync(
    path.join(rootDir, "src/ai-gateway/app/(dashboard)/control/command-center/styles/commandCenter.css"),
    "utf8",
  );
  const options = listDashboardCommandCenterFixturePreviewOptions();
  const fixtures: Record<string, BrowserPreviewFixturePayload> = Object.fromEntries(
    options.map((option) => [
      option.id,
      {
        option,
        viewModel: buildDashboardCommandCenterFixturePreviewViewModel(option.id),
      },
    ]),
  ) as Record<string, BrowserPreviewFixturePayload>;

  return `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zavorth Command Center Preview</title>
  <style>
    body { margin: 0; background: #060809; }
    button, select, textarea { font: inherit; }
    .bcc-browser-preview-hidden { display: none !important; }
    ${css}
  </style>
</head>
<body>
  <div id="command-center-preview-root"></div>
  <script>
    const DEFAULT_FIXTURE_ID = ${escapeScriptJson(defaultFixtureId)};
    const FIXTURES = ${escapeScriptJson(fixtures)};
    const FIXTURE_IDS = Object.keys(FIXTURES);
    const LIVE_FIXTURE_ID = "live";
    const LIVE_OPTION = {
      id: LIVE_FIXTURE_ID,
      label: "Runtime ao vivo",
      description: "Snapshot real do Zavorth Agent Gateway servido pelo /control."
    };
    const AUTH_STORAGE_KEY = "zavorth.commandCenter.webToken";

    const readAuthTokenFromUrl = () => {
      const url = new URL(window.location.href);
      const token = String(url.searchParams.get("token") || "").trim();
      if (!token) return "";
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, token);
        url.searchParams.delete("token");
        history.replaceState(null, "", url);
      } catch {}
      return token;
    };

    const readAuthToken = () => {
      const fromUrl = readAuthTokenFromUrl();
      if (fromUrl) return fromUrl;
      try {
        return String(sessionStorage.getItem(AUTH_STORAGE_KEY) || "").trim();
      } catch {
        return "";
      }
    };

    const writeAuthToken = (token) => {
      try {
        sessionStorage.setItem(AUTH_STORAGE_KEY, String(token || "").trim());
      } catch {}
    };

    const clearAuthToken = () => {
      try {
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } catch {}
    };

    const buildAuthHeaders = () => {
      const token = readAuthToken();
      return token ? { "X-Zavorth-Token": token } : {};
    };

    const normalizeCommandCenterCopy = (value) => {
      let text = String(value ?? "");
      const replacements = [
        ["pronto", "ready"],
        ["atenÃƒÂ§ÃƒÂ£o", "attention"],
        ["atenÃ§Ã£o", "attention"],
        ["bloqueado", "blocked"],
        ["aguardando approval", "waiting approval"],
        ["concluido", "completed"],
        ["concluÃ­do", "completed"],
        ["pensando", "thinking"],
        ["rodando", "running"],
        ["na fila", "queued"],
        ["falhou", "failed"],
        ["cancelado", "cancelled"],
        ["Approval pendente", "Pending approval"],
        ["Aprovacao pendente", "Pending approval"],
        ["AprovaÃ§Ã£o pendente", "Pending approval"],
        ["Acao sensivel aguardando confirmacao.", "Sensitive action waiting for confirmation."],
        ["AÃ§Ã£o sensÃ­vel aguardando confirmaÃ§Ã£o.", "Sensitive action waiting for confirmation."],
        ["Existe job aprovado aguardando worker/executor.", "An approved job is waiting for a worker/executor."],
        ["Run atual", "Current run"],
        ["Run recebida pelo runtime universal.", "Run received by the universal runtime."],
        ["Run registrada no runtime universal.", "Run registered in the universal runtime."],
        ["Gateway sem run ativo.", "Gateway has no active run."],
        ["Gateway indisponivel neste processo.", "Gateway is unavailable in this process."],
        ["Gateway indisponÃ­vel neste processo.", "Gateway is unavailable in this process."],
        ["job(s) duravel(is) no snapshot.", "durable job(s) in the snapshot."],
        ["Snapshot real do runtime universal.", "Real universal runtime snapshot."],
        ["Sem gateway real acoplado a este processo.", "No real gateway is attached to this process."],
        ["Operador", "Operator"],
        ["Zavorth pronto no runtime universal.", "Zavorth is ready in the universal runtime."],
        ["Zavorth precisa de atencao antes de continuar.", "Zavorth needs attention before continuing."],
        ["Command Center carregou, mas o gateway real ainda nao respondeu.", "Command Center loaded, but the real gateway has not responded yet."],
        ["Nenhuma execucao ativa expondo ferramentas agora.", "No active execution is exposing tools right now."],
        ["Nenhuma execuÃ§Ã£o ativa expondo ferramentas agora.", "No active execution is exposing tools right now."],
        ["Budget ainda nao acoplado ao snapshot ao vivo.", "Budget is not attached to the live snapshot yet."],
        ["Replay da execucao", "Execution replay"],
        ["Eventos desta execucao podem ser revisitados.", "Events from this execution can be reviewed."],
        ["Nenhum replay real foi produzido ainda.", "No real replay has been produced yet."],
        ["Resposta atual no painel web /control.", "Current response in the /control web panel."],
        ["Runtime universal sem bloqueios relevantes.", "Universal runtime has no relevant blockers."],
        ["Runtime universal precisa de atencao.", "Universal runtime needs attention."],
        ["Release status ainda nao acoplado ao live snapshot.", "Release status is not attached to the live snapshot yet."],
        ["Identidade padrao do Command Center ao vivo.", "Default live Command Center identity."],
        ["Conversa", "Conversation"],
        ["Sessoes", "Sessions"],
        ["SessÃµes", "Sessions"],
        ["Historico", "History"],
        ["HistÃ³rico", "History"],
        ["Ferramentas", "Tools"],
        ["Configuracao", "Config"],
        ["ConfiguraÃ§Ã£o", "Config"],
        ["Sessao", "Session"],
        ["SessÃ£o", "Session"],
        ["Pedido recebido", "Request received"],
        ["Run registrada.", "Run registered."],
        ["Abrir doctor", "Open doctor"],
        ["Ver diagnostico operacional.", "View operational diagnostics."],
        ["Revisar approvals", "Review approvals"],
        ["Ver acoes sensiveis pendentes.", "View pending sensitive actions."],
        ["Command Center pronto", "Command Center ready"],
        ["Quando voce pedir algo ao Zavorth, a run aparece aqui.", "When you ask Zavorth to do something, the run appears here."],
        ["Run seguro", "Safe run"],
        ["Uma execucao comum, sem approval, com ferramenta segura e resposta final.", "A common execution, no approval, with a safe tool and final response."],
        ["Uma execuÃ§Ã£o comum, sem approval, com ferramenta segura e resposta final.", "A common execution, no approval, with a safe tool and final response."],
        ["Revise o README e me diga o estado atual.", "Review the README and tell me the current state."],
        ["Revisar o README e resumir o estado atual", "Review the README and summarize the current state"],
        ["Resumo preparado sem tocar ferramentas sensiveis.", "Summary prepared without touching sensitive tools."],
        ["Resumo preparado sem tocar ferramentas sensÃ­veis.", "Summary prepared without touching sensitive tools."],
        ["O README esta alinhado com a entrada Command Center e a jornada inicial.", "The README is aligned with the Command Center entry point and the first-run journey."],
        ["O README estÃ¡ alinhado com a entrada Command Center e a jornada inicial.", "The README is aligned with the Command Center entry point and the first-run journey."],
        ["Resumo final preparado a partir de leitura segura do workspace.", "Final summary prepared from safe workspace reading."],
        ["A resposta usa somente o resultado de leitura ja governada.", "The answer uses only the result of governed read-only access."],
        ["A resposta usa somente o resultado de leitura jÃ¡ governada.", "The answer uses only the result of governed read-only access."],
        ["Identifiquei que o pedido e leitura segura e nao precisa de approval.", "I identified that the request is safe read-only work and does not need approval."],
        ["Identifiquei que o pedido Ã© leitura segura e nÃ£o precisa de approval.", "I identified that the request is safe read-only work and does not need approval."],
        ["Usei o perfil de workspace-read para consultar contexto sem mutacao.", "Used the workspace-read profile to read context without mutation."],
        ["Usei o perfil de workspace-read para consultar contexto sem mutaÃ§Ã£o.", "Used the workspace-read profile to read context without mutation."],
        ["Selecionado para consultar contexto de workspace sem mutacao.", "Selected to read workspace context without mutation."],
        ["Selecionado para consultar contexto de workspace sem mutaÃ§Ã£o.", "Selected to read workspace context without mutation."],
        ["README.md foi consultado em modo leitura.", "README.md was read in read-only mode."],
        ["README.md consultado em modo leitura.", "README.md read in read-only mode."],
        ["Leitura permitida pelo perfil seguro de workspace.", "Read allowed by the safe workspace profile."],
        ["A leitura ficou registrada na timeline do run.", "The read was recorded in the run timeline."],
        ["Selecionado porque o run precisa operar dentro do escopo de workspace.", "Selected because the run needs to operate within the workspace scope."],
        ["Uso baixo para a sessao.", "Low session usage."],
        ["Uso baixo para a sessÃ£o.", "Low session usage."],
        ["corrija este erro", "fix this error"],
        ["compare esta pasta", "compare this folder"],
        ["gere um relatorio", "generate a report"],
        ["Fonte real", "Real source"],
        ["Preview de contrato", "Contract preview"],
        ["Cenario visual", "Visual scenario"],
        ["Acesso protegido", "Protected access"],
        ["Desbloquear runtime real", "Unlock real runtime"],
        ["O cockpit ja esta carregado. Para mostrar runs, approvals e historico reais, informe o token local do Zavorth nesta sessao.", "The cockpit is loaded. To show real runs, approvals and history, enter the local Zavorth token for this session."],
        ["Token local do Zavorth", "Local Zavorth token"],
        ["O token fica apenas no sessionStorage desta aba.", "The token stays only in this tab sessionStorage."],
        ["Desbloquear", "Unlock"],
        ["Runtime protegido", "Protected runtime"],
        ["token necessario", "token required"],
        ["O Command Center abriu, mas os dados reais do runtime exigem o token local desta instalacao.", "Command Center opened, but real runtime data requires the local token for this installation."],
        ["provider pendente", "provider pending"],
        ["abrir gateway", "open gateway"],
        ["Canal", "Channel"],
        ["abrir chat", "open chat"],
        ["sessao pronta", "session ready"],
        ["nao definido", "not set"],
        ["revisar workspace", "review workspace"],
        ["expostas", "exposed"],
        ["aguardando", "waiting"],
        ["ver skills/tools", "view skills/tools"],
        ["feito", "done"],
        ["pronto para comecar", "ready to start"],
        ["abrir timeline", "open timeline"],
        ["preparar prompt", "prepare prompt"],
        ["Primeiro uso", "First run"],
        ["prontos", "ready"],
        ["Decisao necessaria", "Decision needed"],
        ["Fila limpa", "Queue clear"],
        ["Revise antes de liberar", "Review before release"],
        ["Sem acoes sensiveis", "No sensitive actions"],
        ["Mutacao, rede sensivel e impacto externo continuam bloqueados ate sua decisao.", "Mutation, sensitive network and external impact stay blocked until your decision."],
        ["Quando algo precisar de permissao, aparece aqui com risco, escopo e motivo.", "When something needs permission, it appears here with risk, scope and reason."],
        ["Aguardando sua decisao", "Waiting for your decision"],
        ["Acesso", "Access"],
        ["Preview exigido", "Preview required"],
        ["Permitir", "Allow"],
        ["Negar", "Deny"],
        ["Sem approvals aguardando voce agora.", "No approvals waiting for you right now."],
        ["Sem approvals waiting voce agora.", "No approvals waiting for you right now."],
        ["Sem approvals waiting vocÃª agora.", "No approvals waiting for you right now."],
        ["pendente", "pending"],
        ["Sem cockpit live", "No live cockpit"],
        ["Provider Cockpit aparece quando o runtime publica a matriz live de providers.", "Provider Cockpit appears when the runtime publishes the live provider matrix."],
        ["Preparar cockpit", "Prepare cockpit"],
        ["Nenhum provider na matriz atual.", "No provider in the current matrix."],
        ["Matriz live:", "Live matrix:"],
        ["falha", "failed"],
        ["Render seguro: sem chamadas de rede no dashboard.", "Safe render: no dashboard network calls."],
        ["Verifique policy de render.", "Check render policy."],
        ["Revisar approval", "Review approval"],
        ["AÃ§Ã£o sensÃ­vel aguardando vocÃª.", "Sensitive action waiting for you."],
        ["Resolver bloqueio operacional.", "Resolve operational blocker."],
        ["Revisar artifact", "Review artifact"],
        ["Entrega pronta para revisÃ£o.", "Artifact ready for review."],
        ["Ver status", "View status"],
        ["Runtime sem bloqueio crÃ­tico.", "Runtime has no critical blocker."],
        ["Missao atual", "Current mission"],
        ["MissÃ£o atual", "Current mission"],
        ["ferramentas:", "tools:"],
        ["sem bloqueio", "no blocker"],
        ["entregas prontas", "artifacts ready"],
        ["sem artifact", "no artifact"],
        ["Sem eventos recentes no runtime.", "No recent runtime events."],
        ["Nenhum check detalhado foi retornado.", "No detailed check was returned."],
        ["Nenhuma ferramenta exposta neste snapshot.", "No tool exposed in this snapshot."],
        ["Sem run ativa", "No active run"],
        ["limpo", "clean"],
        ["nenhum", "none"],
        ["sem decisao", "no decision"],
        ["sem decisÃ£o", "no decision"],
        ["Somente leitura de workspace.", "Workspace read-only."],
        ["Ler arquivo", "Read file"],
        ["Budget do run calculado", "Run budget calculated"],
        ["Channel local estavel para desenvolvimento.", "Stable local channel for development."],
        ["Channel local estÃ¡vel para desenvolvimento.", "Stable local channel for development."],
        ["Gateway aceitando eventos do Command Center.", "Gateway accepting Command Center events."],
        ["Nenhuma aÃ§Ã£o sensÃ­vel waiting confirmaÃ§Ã£o.", "No sensitive action waiting for confirmation."],
        ["Nenhuma acao sensivel waiting confirmacao.", "No sensitive action waiting for confirmation."],
        ["Eventos e artifacts desta execucao podem ser revisitados.", "Events and artifacts from this execution can be reviewed."],
        ["Eventos e artifacts desta execuÃ§Ã£o podem ser revisitados.", "Events and artifacts from this execution can be reviewed."],
        ["As entregas aparecem aqui quando ficarem prontas.", "Artifacts appear here when ready."],
        ["Linha do tempo", "Timeline"],
        ["A decisao automatica aparece quando o runtime escolhe subagentes.", "The automatic decision appears when the runtime chooses subagents."],
        ["Selecionado pela policy.", "Selected by policy."],
        ["Nenhum role selecionado nesta decisao.", "No role selected in this decision."],
        ["Sinais", "Signals"],
        ["gatilhos:", "triggers:"],
        ["riscos:", "risks:"],
        ["sem CoT bruto", "no raw CoT"],
        ["mutacao exige approval", "mutation requires approval"],
        ["Decisao automatica registrada.", "Automatic decision recorded."],
        ["sim", "yes"],
        ["nao", "no"],
        ["Proximo passo:", "Next step:"],
        ["Acompanhar workers e receipts.", "Track workers and receipts."],
        ["Auto Subagents aparece quando o loop principal decide delegar leitura, pesquisa ou revisao para workers governados.", "Auto Subagents appears when the main loop delegates reading, research or review to governed workers."],
        ["Notebook MCP approval aguardando apply.", "Notebook MCP approval waiting for apply."],
        ["Aplicar no MCP", "Apply to MCP"],
        ["No /control real, este botao chama o proxy server-side e nao expoe token no navegador.", "In real /control, this button calls the server-side proxy and does not expose tokens in the browser."],
        ["Capacidade selecionada pelo runtime.", "Capability selected by the runtime."],
        ["Evento operacional registrado.", "Operational event recorded."],
        ["Approval aguardando voce", "Approval waiting for you"],
        ["Atividade do Command Center", "Command Center activity"],
        ["Trace seguro", "Safe trace"],
        ["eventos seguros", "safe events"],
        ["Ola,", "Hello,"],
        ["Voce", "You"],
        ["Trace desta mensagem", "Message trace"],
        ["Carregando snapshot do Zavorth...", "Loading Zavorth snapshot..."],
        ["Conectando ao runtime ao vivo", "Connecting to live runtime"],
        ["Snapshot ao vivo indisponivel.", "Live snapshot unavailable."],
        ["Fallback de fixture", "Fixture fallback"],
        ["O snapshot ao vivo falhou; exibindo fixture seguro.", "Live snapshot failed; showing a safe fixture."],
        ["Snapshot ao vivo protegido pelo gateway local.", "Live snapshot protected by the local gateway."],
        ["Preview local de fixture oficial.", "Local preview of the official fixture."],
        ["Nenhuma execuÃƒÂ§ÃƒÂ£o ativa agora.", "No active execution right now."],
        ["Nenhuma execuÃ§Ã£o ativa agora.", "No active execution right now."],
        ["Peca ao Zavorth", "Ask Zavorth"],
        ["PeÃ§a ao Zavorth", "Ask Zavorth"],
        ["Enviar", "Send"],
        ["Painel", "Panel"],
        ["Canais", "Channels"],
        ["Nodos", "Nodes"],
        ["Agentes", "Agents"],
        ["Rede", "Network"],
        ["Sonhos", "Dreams"],
        ["Uso", "Usage"],
        ["disponiveis", "available"],
        ["Ainda nao ha artifacts nesta sessao.", "There are no artifacts in this session yet."],
      ];
      for (const [from, to] of replacements) {
        text = text.split(from).join(to);
      }
      return text;
    };

    const escapeHtml = (value) => normalizeCommandCenterCopy(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

    const normalizeVisibleCommandCenterCopy = (root) => {
      if (!root || !document.createTreeWalker) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        const normalized = normalizeCommandCenterCopy(node.nodeValue);
        if (normalized !== node.nodeValue) node.nodeValue = normalized;
      }
      root.querySelectorAll?.("input[placeholder], textarea[placeholder], [aria-label], [title]").forEach((element) => {
        for (const attr of ["placeholder", "aria-label", "title"]) {
          const value = element.getAttribute(attr);
          if (value) element.setAttribute(attr, normalizeCommandCenterCopy(value));
        }
      });
    };

    const toneForRuntime = (status) => {
      if (status === "ready") return "ok";
      if (status === "degraded") return "warn";
      if (status === "blocked" || status === "offline") return "danger";
      return "info";
    };

    const humanRuntimeStatus = (status) => ({
      ready: "pronto",
      degraded: "atenÃ§Ã£o",
      blocked: "bloqueado",
      offline: "offline",
    })[status] || status || "unknown";

    const humanAgentStatus = (status) => ({
      waiting_approval: "aguardando approval",
      completed: "concluido",
      thinking: "pensando",
      running: "rodando",
      queued: "na fila",
      failed: "falhou",
      cancelled: "cancelado",
      idle: "idle",
    })[status] || status || "idle";

    const badge = (label, tone = "info") => '<span class="bcc-badge" data-tone="' + tone + '">' + escapeHtml(label) + '</span>';

    const fox = () => '<div class="bcc-mascot" aria-label="Mascote Zavorth"><svg class="bcc-mascot__svg" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false"><path class="bcc-mascot__ear" d="M14 24 9 7l18 10Z" /><path class="bcc-mascot__ear" d="m50 24 5-17-18 10Z" /><path class="bcc-mascot__face" d="M32 57c-13 0-23-10-23-23S19 11 32 11s23 10 23 23-10 23-23 23Z" /><path class="bcc-mascot__cheek" d="M15 38c5 12 14 16 17 16s12-4 17-16c-6 5-11 7-17 7s-11-2-17-7Z" /><path class="bcc-mascot__eye" d="M22 29c3-3 6-3 8 0" /><path class="bcc-mascot__eye" d="M42 29c-3-3-6-3-8 0" /><path class="bcc-mascot__snout" d="M27 38c2 4 8 4 10 0" /><circle class="bcc-mascot__nose" cx="32" cy="36" r="2.4" /></svg></div>';

    const metric = (label, value, detail, tone = "info") => '<article class="bcc-metric-card" data-tone="' + tone + '"><span class="bcc-metric-card__label">' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></article>';
    const stateCard = (label, value, detail, tone = "info") => '<article class="bcc-state-card" data-tone="' + tone + '"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) + '</strong><small>' + escapeHtml(detail) + '</small></article>';

    const formatDate = (value) => {
      const date = new Date(String(value || ""));
      if (!Number.isFinite(date.getTime())) return value || "agora";
      return date.toLocaleString("en-US", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    };

    const mapRuntimeStatus = (run) => {
      if (!run) return "ready";
      if (run.status === "failed" || run.status === "cancelled") return "blocked";
      if (run.status === "waiting_approval" || run.status === "queued") return "degraded";
      return "ready";
    };

    const mapEventKind = (kind) => {
      if (kind === "planning") return "thinking";
      if (kind === "memory" || kind === "input" || kind === "reply" || kind === "status") return "status";
      return kind || "status";
    };

    const mapLiveEvent = (event) => ({
      id: event.id,
      kind: mapEventKind(event.kind),
      title: event.title || "Evento do runtime",
      detail: event.detail || event.kind || "",
      status: event.status || "done"
    });

    const mapLiveApproval = (approval) => ({
      id: approval.id,
      runId: approval.runId,
      title: approval.title || "Approval pendente",
      reason: approval.reason || "Acao sensivel aguardando confirmacao.",
      risk: approval.risk || "attention",
      status: approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "pending",
      command: "approve " + approval.id,
      createdAt: formatDate(approval.createdAt)
    });

    const mapLiveArtifact = (artifact) => ({
      id: artifact.id,
      title: artifact.title || "Artifact",
      kind: artifact.kind || "file",
      createdAt: formatDate(artifact.createdAt),
      sessionId: artifact.sessionId,
      status: artifact.status || "ready"
    });

    const mapLiveTool = (tool) => ({
      id: tool.id,
      label: tool.label || tool.id,
      capabilityId: tool.capabilityId,
      risk: tool.risk || "unknown",
      requiresApproval: Boolean(tool.requiresApproval),
      description: tool.description || ""
    });

    const buildLiveViewModelFromSnapshot = (snapshot, live) => {
      const generatedAt = snapshot?.generatedAt || new Date().toISOString();
      const run = snapshot?.activeRun || null;
      const runs = Array.isArray(snapshot?.runs) ? snapshot.runs : [];
      const jobs = Array.isArray(snapshot?.workflowJobs) ? snapshot.workflowJobs : [];
      const runtimeStatus = live ? mapRuntimeStatus(run) : "degraded";
      const modelProfile = run?.modelProfile || {};
      const providerLabel = modelProfile.providerLabel || "provider nao informado";
      const modelLabel = modelProfile.modelLabel || "modelo nao informado";
      const events = Array.isArray(run?.events) ? run.events.map(mapLiveEvent) : [];
      const approvals = Array.isArray(run?.approvals) ? run.approvals.map(mapLiveApproval) : [];
      const artifacts = Array.isArray(run?.artifacts) ? run.artifacts.map(mapLiveArtifact) : [];
      const tools = Array.isArray(run?.toolExposure?.tools) ? run.toolExposure.tools.map(mapLiveTool) : [];
      const workflowWarnings = jobs.some((job) => job.status === "queued")
        ? [{ id: "workflow-queue", title: "Workflow queue", detail: "Existe job aprovado aguardando worker/executor.", severity: "warning", actionId: "runtime.status" }]
        : [];
      const blockers = [
        ...approvals.filter((approval) => approval.status === "pending").map((approval) => ({
          id: approval.id,
          title: "Approval pendente",
          detail: approval.reason,
          severity: "warning",
          actionId: "approvals.open"
        })),
        ...workflowWarnings
      ];
      const agentRun = run ? {
        id: run.id,
        title: run.title || "Run atual",
        status: run.status || "idle",
        sessionId: run.sessionId,
        startedAt: formatDate(run.createdAt),
        updatedAt: formatDate(run.updatedAt),
        summary: run.summary || "Run recebida pelo runtime universal.",
        providerLabel,
        modelLabel,
        events
      } : null;
      const healthChecks = [
        {
          id: "agent-gateway",
          label: "Zavorth Agent Gateway",
          status: runtimeStatus,
          detail: live ? (run ? "Run ativo: " + run.status + "." : "Gateway sem run ativo.") : "Gateway indisponivel neste processo.",
          actionId: runtimeStatus === "ready" ? undefined : "runtime.doctor"
        }
      ];
      if (jobs.length > 0) {
        healthChecks.push({
          id: "workflow-queue",
          label: "Workflow queue",
          status: jobs.some((job) => job.status === "failed") ? "blocked" : "degraded",
          detail: jobs.length + " job(s) duravel(is) no snapshot.",
          actionId: "runtime.status"
        });
      }

      return {
        contractVersion: "command-center-runtime-contract/v1",
        generatedAt,
        adapterSource: {
          kind: "universal-agent-runtime",
          label: live ? "Zavorth Agent Gateway" : "Command Center live fallback",
          version: "live-browser-adapter/v1",
          notes: live ? "Snapshot real do runtime universal." : "Sem gateway real acoplado a este processo."
        },
        runtime: {
          status: runtimeStatus,
          operatorLabel: "Operador",
          currentModelLabel: modelLabel,
          currentProviderLabel: providerLabel,
          activeSessionId: run?.sessionId,
          summary: live
            ? (runtimeStatus === "ready" ? "Zavorth pronto no runtime universal." : "Zavorth precisa de atencao antes de continuar.")
            : "Command Center carregou, mas o gateway real ainda nao respondeu.",
          blockers,
          wsStatus: "connected"
        },
        agentRun,
        tasks: runs.map((item) => ({
          id: item.id,
          title: item.title || "Run do runtime",
          status: item.status || "idle",
          summary: item.summary || "Run registrada no runtime universal.",
          runId: item.id,
          sessionId: item.sessionId,
          currentStep: item.status,
          updatedAt: formatDate(item.updatedAt)
        })),
        approvals,
        toolExposure: {
          mode: run?.toolExposure?.mode || "unknown",
          summary: run?.toolExposure?.summary || "Nenhuma execucao ativa expondo ferramentas agora.",
          tools
        },
        budget: { status: "unknown", summary: "Budget ainda nao acoplado ao snapshot ao vivo." },
        replay: {
          id: run ? run.id + ":replay" : "live-replay",
          runId: run?.id,
          title: "Replay da execucao",
          status: events.length > 0 || artifacts.length > 0 ? "available" : "none",
          summary: events.length > 0 || artifacts.length > 0 ? "Eventos desta execucao podem ser revisitados." : "Nenhum replay real foi produzido ainda.",
          eventCount: events.length,
          artifactCount: artifacts.length,
          updatedAt: formatDate(run?.updatedAt || generatedAt)
        },
        replyPorts: Array.isArray(run?.replyPorts) ? run.replyPorts : [{ id: "command-center", label: "Command Center", kind: "web", status: "available", primary: true, description: "Resposta atual no painel web /control." }],
        modelProfile: {
          providerLabel,
          modelLabel,
          routingPolicy: modelProfile.routingPolicy || "unknown",
          fallbackModelLabel: modelProfile.fallbackModelLabel,
          supportsTools: modelProfile.supportsTools,
          supportsVision: modelProfile.supportsVision,
          supportsStreaming: modelProfile.supportsStreaming
        },
        health: {
          status: runtimeStatus,
          summary: runtimeStatus === "ready" ? "Runtime universal sem bloqueios relevantes." : "Runtime universal precisa de atencao.",
          checks: healthChecks
        },
        releaseStatus: { status: "unknown", channel: "dev", summary: "Release status ainda nao acoplado ao live snapshot.", rollbackAvailable: false },
        integrations: [{ id: "agent-gateway", label: "Zavorth Agent Gateway", category: "runtime", status: live ? "connected" : "degraded", detail: snapshot?.source?.label || "runtime" }],
        identity: { agentName: "Zavorth", userName: "Operador", language: "en-US", tone: "operacional", initiative: "balanced", firstRunStatus: "unknown", summary: "Identidade padrao do Command Center ao vivo." },
        logs: events.map((event) => ({ id: event.id + ":log", level: event.status === "failed" ? "error" : "info", source: "agent." + event.kind, message: event.detail || event.title, createdAt: generatedAt, runId: run?.id })),
        sectors: [
          { id: "terminal", label: "Terminal", title: "Conversa", enabled: true },
          { id: "overview", label: "Overview", title: "Cockpit", enabled: true, badgeCount: blockers.length || undefined },
          { id: "sessions", label: "Sessoes", title: "Historico", enabled: true, badgeCount: runs.length || undefined },
          { id: "skills", label: "Skills", title: "Ferramentas", enabled: true, badgeCount: tools.length || undefined },
          { id: "nodes", label: "Nodes", title: "Node mesh", enabled: true },
          { id: "config", label: "Config", title: "Configuracao", enabled: true }
        ],
        sessions: runs.map((item) => ({ id: item.sessionId || item.id, title: item.title || "Sessao", updatedAt: formatDate(item.updatedAt), status: item.id === run?.id ? "active" : "idle", channelLabel: item.channel, messageCount: 2 })),
        messages: run ? [
          { id: run.id + ":input", role: "user", text: run.input || run.title || "Pedido recebido", createdAt: formatDate(run.createdAt), modelLabel },
          { id: run.id + ":summary", role: "assistant", text: run.summary || "Run registrada.", createdAt: formatDate(run.updatedAt), modelLabel, events }
        ] : [],
        events,
        artifacts,
        memorySignals: Array.isArray(run?.memorySignals) ? run.memorySignals : [],
        actions: [
          { id: "runtime.doctor", label: "Abrir doctor", description: "Ver diagnostico operacional.", group: "runtime" },
          { id: "approvals.open", label: "Revisar approvals", description: "Ver acoes sensiveis pendentes.", group: "approval" }
        ],
        counts: {
          tasks: runs.length,
          sessions: runs.length,
          approvals: approvals.length,
          artifacts: artifacts.length,
          capabilities: tools.length,
          integrations: 1,
          nodes: 0,
          blockers: blockers.length,
          logs: events.length
        },
        emptyState: {
          title: "Command Center pronto",
          subtitle: "Quando voce pedir algo ao Zavorth, a run aparece aqui.",
          suggestions: ["corrija este erro", "compare esta pasta", "gere um relatorio"]
        }
      };
    };

    const fetchLiveViewModel = async () => {
      const response = await fetch("/api/web/command-center", {
        headers: {
          Accept: "application/json",
          ...buildAuthHeaders()
        }
      });
      if (!response.ok) throw new Error("Live snapshot indisponivel: HTTP " + response.status);
      const payload = await response.json();
      const vm = buildLiveViewModelFromSnapshot(payload.snapshot, Boolean(payload.live));
      vm.authRequired = Boolean(payload.authRequired);
      return vm;
    };

    const renderFixturePreviewBar = (activeId, option) => {
      const liveOptionHtml = '<option value="' + LIVE_FIXTURE_ID + '"' + (activeId === LIVE_FIXTURE_ID ? " selected" : "") + '>' + escapeHtml(LIVE_OPTION.label) + '</option>';
      const optionHtml = liveOptionHtml + FIXTURE_IDS.map((id) => '<option value="' + id + '"' + (id === activeId ? " selected" : "") + '>' + escapeHtml(FIXTURES[id].option.label) + '</option>').join("");
      const label = activeId === LIVE_FIXTURE_ID ? "Fonte real" : "Preview de contrato";
      return '<section class="bcc-fixture-preview" data-active="true" aria-label="Preview de contrato do Command Center"><div><span class="bcc-fixture-preview__label">' + escapeHtml(label) + '</span><strong>' + escapeHtml(option.label) + '</strong><p>' + escapeHtml(option.description) + '</p></div><label class="bcc-fixture-preview__select"><span>Cenario visual</span><select id="fixture-select">' + optionHtml + '</select></label></section>';
    };

    const renderAuthUnlock = (vm) => {
      if (!vm.authRequired) return "";
      return '<section class="bcc-fixture-preview" data-active="true" aria-label="Desbloquear Command Center ao vivo"><div><span class="bcc-fixture-preview__label">Acesso protegido</span><strong>Desbloquear runtime real</strong><p>O cockpit ja esta carregado. Para mostrar runs, approvals e historico reais, informe o token local do Zavorth nesta sessao.</p></div><form id="command-center-auth-form" class="bcc-compose__input-frame" autocomplete="off"><input id="command-center-auth-token" type="password" inputmode="text" autocomplete="current-password" placeholder="Token local do Zavorth" style="width:100%;box-sizing:border-box;background:transparent;border:0;color:#edf8f6;outline:0;padding:12px 4px;font:inherit" /><div class="bcc-compose__footer"><span id="command-center-auth-message" class="bcc-empty-note">O token fica apenas no sessionStorage desta aba.</span><button class="bcc-button bcc-compose__send" data-variant="primary" type="submit">Desbloquear</button></div></form></section>';
    };

    const renderOnboardingPanel = (vm) => {
      if (vm.authRequired) {
        return '<section class="bcc-card"><p class="bcc-card__label">Acesso</p><h2 class="bcc-card__title">Runtime protegido</h2><div class="bcc-card__body"><div class="bcc-access-card" data-state="protected"><div class="bcc-access-card__header">' + badge("token necessario", "warn") + '<span>Local-first</span></div><p class="bcc-access-card__copy">O Command Center abriu, mas os dados reais do runtime exigem o token local desta instalacao.</p><div class="bcc-access-commands"><code>zavorth dashboard</code><code>zavorth dashboard repair</code><code>zavorth dashboard token</code></div><p class="bcc-access-card__feedback">O token fica somente no sessionStorage desta aba.</p></div></div></section>';
      }
      const workspaceReady = Boolean(vm.runtime.activeSessionId || vm.sessions.length);
      const toolsReady = vm.toolExposure.tools.length > 0 || vm.counts.capabilities > 0;
      const firstRunDone = Boolean(vm.agentRun || vm.messages.length || vm.counts.tasks > 0);
      const steps = [
        { label: "Provider", value: vm.modelProfile.modelLabel || vm.runtime.currentModelLabel || "provider pendente", ready: vm.modelProfile.ready !== false, action: "abrir gateway" },
        { label: "Canal", value: "Web Chat", ready: true, action: "abrir chat" },
        { label: "Workspace", value: workspaceReady ? (vm.runtime.activeSessionId || "sessao pronta") : "nao definido", ready: workspaceReady, action: "revisar workspace" },
        { label: "Safe tools", value: toolsReady ? String(vm.toolExposure.tools.length || vm.counts.capabilities) + " expostas" : "aguardando", ready: toolsReady, action: "ver skills/tools" },
        { label: "First run", value: firstRunDone ? "feito" : "pronto para comecar", ready: firstRunDone, action: firstRunDone ? "abrir timeline" : "preparar prompt" }
      ];
      const readyCount = steps.filter((step) => step.ready).length;
      const rows = steps.map((step) => '<button type="button" class="bcc-onboarding-step" data-state="' + (step.ready ? "ready" : "pending") + '"><span class="bcc-onboarding-step__label">' + escapeHtml(step.label) + '</span><strong>' + escapeHtml(step.value) + '</strong><small>' + escapeHtml(step.action) + '</small></button>').join("");
      return '<section class="bcc-card"><p class="bcc-card__label">Primeiro uso</p><h2 class="bcc-card__title">' + escapeHtml(readyCount + "/" + steps.length + " prontos") + '</h2><div class="bcc-card__body"><div class="bcc-onboarding-panel">' + rows + '</div></div></section>';
    };

    const renderApprovalsPanel = (vm) => {
      const approvals = vm.approvals || [];
      const highestRisk = approvals.some((approval) => approval.risk === "danger")
        ? "danger"
        : approvals.some((approval) => approval.risk === "attention")
          ? "attention"
          : "safe";
      const summary = '<div class="bcc-approval-summary" data-risk="' + escapeHtml(highestRisk) + '"><span>' + (approvals.length > 0 ? "Decisao necessaria" : "Fila limpa") + '</span><strong>' + (approvals.length > 0 ? "Revise antes de liberar" : "Sem acoes sensiveis") + '</strong><small>' + (approvals.length > 0 ? "Mutacao, rede sensivel e impacto externo continuam bloqueados ate sua decisao." : "Quando algo precisar de permissao, aparece aqui com risco, escopo e motivo.") + '</small></div>';
      const rows = approvals.slice(0, 4).map((approval) => '<div class="bcc-list-item bcc-approval-row" data-risk="' + escapeHtml(approval.risk || "attention") + '"><div class="bcc-approval-row__state"><span>Aguardando sua decisao</span><span>' + escapeHtml(approval.createdAt || "") + '</span></div><div class="bcc-approval-row__panel"><div class="bcc-approval-row__request"><span>Acesso</span><strong>' + escapeHtml(approval.title || "approval") + '</strong><em>' + escapeHtml(approval.risk || "attention") + '</em></div><span class="bcc-list-item__title">' + escapeHtml(approval.title || "Aprovacao pendente") + '</span><span class="bcc-list-item__meta">' + escapeHtml(approval.reason || "Revise antes de liberar.") + '</span><div class="bcc-approval-capability"><span>runtime</span><span>guarded</span><span>Preview exigido</span><span>scope: ' + escapeHtml(approval.scope || "session") + '</span></div></div><div class="bcc-action-row"><button class="bcc-button" data-variant="primary" type="button">Permitir</button><button class="bcc-button" type="button">Negar</button></div></div>').join("") || '<p class="bcc-empty-note">Sem approvals aguardando voce agora.</p>';
      return '<section class="bcc-card"><p class="bcc-card__label">Approvals</p><h2 class="bcc-card__title">' + escapeHtml(approvals.length + " pendente" + (approvals.length === 1 ? "" : "s")) + '</h2><div class="bcc-card__body">' + summary + '<div class="bcc-list">' + rows + '</div></div></section>';
    };

    const renderProviderCockpitPanel = (vm) => {
      const cockpit = vm.providerCockpit || null;
      if (!cockpit) {
        return '<section class="bcc-card" data-zavorth-provider-cockpit="empty"><p class="bcc-card__label">Providers</p><h2 class="bcc-card__title">Sem cockpit live</h2><div class="bcc-card__body"><p class="bcc-empty-note">Provider Cockpit aparece quando o runtime publica a matriz live de providers.</p><div class="bcc-action-row"><button class="bcc-button" type="button">Preparar cockpit</button></div></div></section>';
      }
      const cards = (cockpit.cards || []).slice(0, 4).map((card) => {
        const evidenceBits = [
          card.status || "unknown",
          "live " + (card.liveStatus || "not_run"),
          card.evidence?.modelCount !== null && card.evidence?.modelCount !== undefined ? card.evidence.modelCount + " modelos" : "",
          card.evidence?.durationMs !== null && card.evidence?.durationMs !== undefined ? card.evidence.durationMs + "ms" : "",
        ].filter(Boolean).join(" / ");
        return '<div class="bcc-list-item" data-zavorth-provider-id="' + escapeHtml(card.providerId || "") + '"><span class="bcc-list-item__title">' + escapeHtml(card.title || "Provider") + (card.model ? " - " + escapeHtml(card.model) : "") + '</span><span class="bcc-list-item__meta">' + escapeHtml(evidenceBits) + '</span></div>';
      }).join("") || '<p class="bcc-empty-note">Nenhum provider na matriz atual.</p>';
      const statusTone = cockpit.status === "ready" ? "ok" : cockpit.status === "blocked" ? "danger" : "warn";
      const commands = [
        cockpit.actions?.find((action) => action.kind === "read")?.command || "zavorth providers cockpit",
        (cockpit.cards || []).flatMap((card) => card.actions || []).find((action) => action.kind === "live_probe")?.command || "zavorth providers live --provider <id>",
      ];
      return '<section class="bcc-card" data-zavorth-provider-cockpit="ready"><p class="bcc-card__label">Providers</p><h2 class="bcc-card__title">' + escapeHtml(cockpit.summary.readyProviders + "/" + cockpit.summary.totalProviders + " prontos") + '</h2><div class="bcc-card__body"><div class="bcc-list"><div class="bcc-list-item"><span class="bcc-list-item__title">Matriz live: ' + escapeHtml(cockpit.summary.livePassed) + ' ok / ' + escapeHtml(cockpit.summary.liveFailed) + ' falha / ' + escapeHtml(cockpit.summary.liveBlocked) + ' bloqueado</span><span class="bcc-list-item__meta">' + escapeHtml(cockpit.safety?.normalRenderMakesNoNetworkCalls ? "Render seguro: sem chamadas de rede no dashboard." : "Verifique policy de render.") + '</span></div>' + cards + '</div><div class="bcc-run-card__meta">' + badge(cockpit.status, statusTone) + badge("auth " + cockpit.summary.missingAuth, cockpit.summary.missingAuth > 0 ? "warn" : "ok") + badge(cockpit.executionAuthority ? "execution" : "projection-only", cockpit.executionAuthority ? "danger" : "ok") + '</div><div class="bcc-action-row"><button class="bcc-button" type="button">' + escapeHtml(commands[0]) + '</button><button class="bcc-button" type="button">' + escapeHtml(commands[1]) + '</button></div></div></section>';
    };

    const injectPreviewOnboardingAndApprovals = (vm) => {
      const panels = document.querySelectorAll(".bcc-control-grid > .bcc-side-panel");
      panels[0]?.insertAdjacentHTML("afterbegin", renderOnboardingPanel(vm));
      panels[1]?.insertAdjacentHTML("afterbegin", renderApprovalsPanel(vm));
    };

    const renderMissionBrief = (vm) => {
      const run = vm.agentRun;
      const action = vm.approvals.length > 0
        ? { label: "Revisar approval", description: "AÃ§Ã£o sensÃ­vel aguardando vocÃª." }
        : vm.runtime.blockers.length > 0
          ? { label: "Abrir doctor", description: "Resolver bloqueio operacional." }
          : vm.artifacts.length > 0
            ? { label: "Revisar artifact", description: "Entrega pronta para revisÃ£o." }
            : { label: "Ver status", description: "Runtime sem bloqueio crÃ­tico." };

      return '<section class="bcc-mission-brief" data-status="' + escapeHtml(vm.runtime.status) + '"><div class="bcc-mission-brief__primary"><span class="bcc-card__label">Missao atual</span><h1>' + escapeHtml(run?.title || "Command Center pronto") + '</h1><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p><div class="bcc-mission-brief__badges">' + badge(humanRuntimeStatus(vm.runtime.status), toneForRuntime(vm.runtime.status)) + badge(vm.modelProfile.modelLabel) + badge("ferramentas: " + vm.toolExposure.mode, vm.toolExposure.mode === "restricted" ? "warn" : "info") + '</div></div><div class="bcc-mission-brief__metrics">' + metric("Run", run ? humanAgentStatus(run.status) : "idle", run?.updatedAt || vm.generatedAt, run?.status === "failed" ? "danger" : run?.status === "waiting_approval" ? "warn" : "ok") + metric("Approvals", String(vm.counts.approvals), vm.counts.approvals > 0 ? "aguardando voce" : "sem bloqueio", vm.counts.approvals > 0 ? "warn" : "ok") + metric("Artifacts", String(vm.counts.artifacts), vm.counts.artifacts > 0 ? "entregas prontas" : "sem artifact", vm.counts.artifacts > 0 ? "info" : "ok") + metric("Health", humanRuntimeStatus(vm.health.status), vm.health.summary, toneForRuntime(vm.health.status)) + '</div><button class="bcc-mission-brief__action" type="button"><span>' + escapeHtml(action.label) + '</span><small>' + escapeHtml(action.description) + '</small></button></section>';
    };

    let renderOverview = (vm) => {
      const run = vm.agentRun;
      const timeline = ((run?.events?.length ? run.events : vm.events) || []).slice(0, 6)
        .map((event) => '<div class="bcc-run-timeline__item" data-status="' + escapeHtml(event.status || "done") + '"><span>' + escapeHtml(event.title) + '</span><small>' + escapeHtml(event.detail || event.kind) + '</small></div>')
        .join("") || '<p class="bcc-empty-note">Sem eventos recentes no runtime.</p>';
      const health = vm.health.checks.slice(0, 5)
        .map((check) => '<div class="bcc-health-row" data-status="' + escapeHtml(check.status) + '"><span>' + escapeHtml(check.label) + '</span><small>' + escapeHtml(check.detail || humanRuntimeStatus(check.status)) + '</small></div>')
        .join("") || '<p class="bcc-empty-note">Nenhum check detalhado foi retornado.</p>';
      const tools = vm.toolExposure.tools.slice(0, 5)
        .map((tool) => '<span class="bcc-tool-chip" data-risk="' + escapeHtml(tool.risk) + '">' + escapeHtml(tool.label) + (tool.requiresApproval ? " Â· approval" : "") + '</span>')
        .join("") || '<p class="bcc-empty-note">Nenhuma ferramenta exposta neste snapshot.</p>';

      return '<div class="bcc-overview-stack"><section class="bcc-overview-hero" data-status="' + escapeHtml(vm.runtime.status) + '"><div><span class="bcc-card__label">Cockpit</span><h2>' + escapeHtml(run?.title || "Sem run ativa") + '</h2><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p></div><div class="bcc-overview-hero__rail">' + badge(humanRuntimeStatus(vm.runtime.status), toneForRuntime(vm.runtime.status)) + badge(vm.adapterSource.label) + '</div></section><div class="bcc-state-grid">' + stateCard("Approval", vm.counts.approvals > 0 ? vm.counts.approvals + " pendente" : "limpo", vm.approvals[0]?.reason || "Nenhuma aÃ§Ã£o sensÃ­vel aguardando confirmaÃ§Ã£o.", vm.counts.approvals > 0 ? "warn" : "ok") + stateCard("Artifact", vm.counts.artifacts > 0 ? vm.counts.artifacts + " pronto" : "nenhum", vm.artifacts[0]?.title || "As entregas aparecem aqui quando ficarem prontas.", vm.counts.artifacts > 0 ? "info" : "ok") + stateCard("Budget", vm.budget.status, vm.budget.summary, vm.budget.status === "exceeded" ? "danger" : vm.budget.status === "attention" ? "warn" : "ok") + stateCard("Replay", vm.replay.status, vm.replay.summary, vm.replay.status === "available" ? "info" : "ok") + '</div><div class="bcc-overview-columns"><section class="bcc-card"><p class="bcc-card__label">Linha do tempo</p><h2 class="bcc-card__title">' + escapeHtml(run ? humanAgentStatus(run.status) : "Idle") + '</h2><div class="bcc-card__body"><div class="bcc-run-timeline">' + timeline + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Doctor</p><h2 class="bcc-card__title">' + escapeHtml(humanRuntimeStatus(vm.health.status)) + '</h2><div class="bcc-card__body"><div class="bcc-health-list">' + health + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Ferramentas</p><h2 class="bcc-card__title">' + escapeHtml(vm.toolExposure.summary) + '</h2><div class="bcc-card__body"><div class="bcc-tool-chip-grid">' + tools + '</div></div></section><section class="bcc-card"><p class="bcc-card__label">Release</p><h2 class="bcc-card__title">' + escapeHtml(vm.releaseStatus.version || vm.releaseStatus.channel) + '</h2><div class="bcc-card__body"><p>' + escapeHtml(vm.releaseStatus.summary) + '</p></div></section></div></div>';
    };

    const renderOverviewBase = renderOverview;
    renderOverview = (vm) => {
      const html = renderOverviewBase(vm);
      const auto = vm.subagentAutoInvocation || null;
      const autoStatus = auto?.status === "auto-selected"
        ? "auto selecionado"
        : auto?.status === "approval-required"
          ? "aguarda approval"
          : auto?.status === "skipped"
            ? "ignorado"
            : "sem decisao";
      const autoTone = auto?.status === "approval-required" ? "warn" : auto?.status === "auto-selected" ? "info" : "ok";
      const autoState = stateCard(
        "Auto Subagents",
        autoStatus,
        auto
          ? String(auto.selectedBy || "runtime") + " - " + String((auto.roles || []).length) + " role(s) - " + String(Math.round(Number(auto.confidence || 0) * 100)) + "%"
          : "A decisao automatica aparece quando o runtime escolhe subagentes.",
        autoTone,
      );
      const autoRoles = (auto?.roles || []).slice(0, 4)
        .map((role) => '<div class="bcc-list-item"><span class="bcc-list-item__title">' + escapeHtml(role.roleId || "role") + ': ' + escapeHtml(role.label || "Subagent") + '</span><span class="bcc-list-item__meta">' + escapeHtml(role.whySelected || "Selecionado pela policy.") + '</span></div>')
        .join("") || '<p class="bcc-empty-note">Nenhum role selecionado nesta decisao.</p>';
      const autoSignals = auto
        ? '<div class="bcc-list-item"><span class="bcc-list-item__title">Sinais</span><span class="bcc-list-item__meta">gatilhos: ' + escapeHtml((auto.triggers || []).slice(0, 3).join(", ") || "n/d") + ' - riscos: ' + escapeHtml((auto.riskSignals || []).slice(0, 3).join(", ") || "nenhum") + '</span></div>'
        : "";
      const autoPolicy = auto
        ? '<div class="bcc-list-item"><span class="bcc-list-item__title">Policy</span><span class="bcc-list-item__meta">read-only: ' + escapeHtml(String(auto.safety?.readOnlyOnly !== false)) + ' - sem CoT bruto: ' + escapeHtml(String(auto.safety?.noRawChainOfThought !== false)) + ' - mutacao exige approval: ' + escapeHtml(String(auto.safety?.approvalsRequiredForMutation !== false)) + '</span></div>'
        : "";
      const autoCard = '<section class="bcc-card"><p class="bcc-card__label">Auto Subagents</p><h2 class="bcc-card__title">' + escapeHtml(autoStatus) + '</h2><div class="bcc-card__body">' + (auto ? '<div class="bcc-list"><div class="bcc-list-item" data-active="' + (auto.status === "auto-selected" ? "true" : "false") + '"><span class="bcc-list-item__title">' + escapeHtml(auto.selectedBy || "runtime") + ' / ' + escapeHtml(auto.mode || "unknown") + '</span><span class="bcc-list-item__meta">' + escapeHtml(auto.publicRationale || "Decisao automatica registrada.") + ' - live ' + escapeHtml(auto.live ? "sim" : "nao") + ' - confidence ' + escapeHtml(String(Math.round(Number(auto.confidence || 0) * 100))) + '%</span><span class="bcc-list-item__meta">Proximo passo: ' + escapeHtml(auto.nextSafeAction || "Acompanhar workers e receipts.") + '</span></div>' + autoRoles + autoSignals + autoPolicy + '</div>' : '<p>Auto Subagents aparece quando o loop principal decide delegar leitura, pesquisa ou revisao para workers governados.</p>') + '</div></section>';
      return html
        .replace('</div><div class="bcc-overview-columns">', autoState + '</div><div class="bcc-overview-columns">')
        .replace('<section class="bcc-card"><p class="bcc-card__label">Ferramentas</p>', autoCard + '<section class="bcc-card"><p class="bcc-card__label">Ferramentas</p>');
    };

    const renderRemoteMeshPanel = (vm) => {
      const cards = (vm.remoteMeshApprovalUx?.cards || []).filter((card) => card.surface === "command-center" && card.approval);
      if (!cards.length) return "";
      const rows = cards.slice(0, 4).map((card) => '<div class="bcc-list-item bcc-remote-mesh-approval-row"><div class="bcc-remote-mesh-approval-row__header"><span class="bcc-list-item__title">' + escapeHtml(card.title || "Remote Mesh approval") + '</span>' + badge(card.commandCenter?.badge || "Needs approval", "warn") + '</div><span class="bcc-list-item__meta">' + escapeHtml(card.body || "Notebook MCP approval aguardando apply.") + '</span><div class="bcc-remote-mesh-approval-row__target"><span>' + escapeHtml(card.targetKind || "notebook") + '</span><strong>' + escapeHtml(card.targetLabel || "Notebook MCP") + '</strong></div><div class="bcc-action-row"><button class="bcc-button" data-variant="primary" type="button">' + escapeHtml(card.commandCenter?.primaryActionLabel || "Aplicar no MCP") + '</button><button class="bcc-button" type="button" disabled>Preview visual</button></div></div>').join("");
      return '<section class="bcc-card bcc-remote-mesh-card"><p class="bcc-card__label">Remote Mesh</p><h2 class="bcc-card__title">' + escapeHtml(cards.length + " MCP approval" + (cards.length === 1 ? "" : "s")) + '</h2><div class="bcc-card__body"><div class="bcc-list">' + rows + '</div><p class="bcc-remote-mesh-card__footnote">No /control real, este botao chama o proxy server-side e nao expoe token no navegador.</p></div></section>';
    };

    const renderTrace = (label, trace, summary) => {
      const events = Array.isArray(trace?.events) ? trace.events : Array.isArray(trace) ? trace : [];
      if (!events.length) return "";
      const renderCapability = (capability) => {
        if (!capability) return "";
        const pills = [
          { tone: "kind", label: capability.kind },
          { tone: capability.risk, label: capability.risk },
          { tone: capability.requiresApproval ? "approval" : "direct", label: capability.requiresApproval ? "approval" : "direct" },
          { tone: capability.previewRequired ? "preview" : "no-preview", label: capability.previewRequired ? "preview" : "no preview" },
          { tone: "effect", label: capability.sideEffect },
        ].map((pill) => '<span class="bcc-agent-capability__pill" data-tone="' + escapeHtml(pill.tone || "kind") + '">' + escapeHtml(pill.label || "") + '</span>').join("");
        return '<div class="bcc-agent-capability" data-kind="' + escapeHtml(capability.kind || "runtime") + '" data-risk="' + escapeHtml(capability.risk || "unknown") + '"><div class="bcc-agent-capability__pills">' + pills + '</div><p class="bcc-agent-capability__reason">' + escapeHtml(capability.reason || "Capacidade selecionada pelo runtime.") + '</p><small class="bcc-agent-capability__scope">scope: ' + escapeHtml(capability.scope || "runtime") + '</small></div>';
      };
      const rows = events.slice(0, 8).map((event) => '<div class="bcc-agent-trace__step" data-kind="' + escapeHtml(event.kind || "status") + '" data-status="' + escapeHtml(event.status || "done") + '"><span class="bcc-agent-trace__dot" aria-hidden="true"></span><div class="bcc-agent-trace__copy"><div class="bcc-agent-trace__title"><span>' + escapeHtml(event.title || "Runtime update") + '</span>' + (event.chipLabel ? '<code>' + escapeHtml(event.chipLabel) + '</code>' : "") + '</div><p>' + escapeHtml(event.summary || "Evento operacional registrado.") + '</p>' + (event.target ? '<small>' + escapeHtml(event.target) + '</small>' : "") + renderCapability(event.capability) + '</div></div>').join("");
      return '<section class="bcc-agent-trace" aria-label="' + escapeHtml(label) + '"><div class="bcc-agent-trace__header"><span>' + escapeHtml(label) + '</span>' + (summary ? '<small>' + escapeHtml(summary) + '</small>' : "") + '</div><div class="bcc-agent-trace__steps">' + rows + '</div><p class="bcc-agent-trace__policy">Summaries only. Raw chain-of-thought stays private.</p></section>';
    };

    const renderActiveRunState = (vm) => {
      const run = vm.agentRun;
      const trace = run?.trace || vm.trace;
      const events = ((run?.events?.length ? run.events : vm.events) || []).slice(0, 5)
        .map((event) => '<div class="bcc-run-mini-timeline__item" data-status="' + escapeHtml(event.status || "done") + '"><span>' + escapeHtml(event.title) + '</span><small>' + escapeHtml(event.detail || event.kind) + '</small></div>')
        .join("");
      const label = vm.approvals.length > 0 ? "Approval aguardando voce" : "Run atual";
      const badges = [
        run ? humanAgentStatus(run.status) : vm.runtime.status,
        vm.modelProfile.modelLabel,
        vm.approvals.length > 0 ? vm.approvals.length + " approval" : "",
        vm.artifacts.length > 0 ? vm.artifacts.length + " artifact" : "",
      ].filter(Boolean).map((item) => '<span>' + escapeHtml(item) + '</span>').join("");

      return '<section class="bcc-active-run-state" data-status="' + escapeHtml(run?.status || "idle") + '"><div><span class="bcc-card__label">' + escapeHtml(label) + '</span><h2>' + escapeHtml(run?.title || "Atividade do Command Center") + '</h2><p>' + escapeHtml(run?.summary || vm.runtime.summary) + '</p></div><div class="bcc-active-run-state__badges">' + badges + '</div>' + renderTrace("Trace seguro", trace, trace?.summary ? trace.summary.eventCount + " eventos seguros" : "") + (events ? '<div class="bcc-run-mini-timeline">' + events + '</div>' : "") + '</section>';
    };

    const renderChat = (vm) => {
      if (vm.messages.length === 0) {
        if (vm.agentRun || vm.approvals.length > 0 || vm.artifacts.length > 0 || vm.events.length > 0) {
          return renderActiveRunState(vm);
        }
        return '<section class="bcc-hero">' + fox() + '<div><span class="bcc-hero__eyebrow">Ola, ' + escapeHtml(vm.runtime.operatorLabel) + '</span><h1 class="bcc-hero__title">' + escapeHtml(vm.emptyState.title) + '</h1><p class="bcc-hero__subtitle">' + escapeHtml(vm.emptyState.subtitle) + '</p></div><div class="bcc-suggestion-chips">' + vm.emptyState.suggestions.map((suggestion) => '<button class="bcc-button bcc-suggestion-chip" type="button"><span aria-hidden="true">ask</span>' + escapeHtml(suggestion) + '</button>').join("") + '</div></section>';
      }
      const messages = vm.messages.map((message) => '<article class="bcc-message" data-role="' + escapeHtml(message.role) + '"><div class="bcc-message__avatar" aria-hidden="true">' + escapeHtml(message.role === "assistant" ? "B" : message.role === "user" ? "U" : "S") + '</div><div class="bcc-message__content"><div class="bcc-message__meta"><span>' + escapeHtml(message.role === "assistant" ? "Zavorth" : message.role === "user" ? "Voce" : message.role) + '</span><span>' + escapeHtml(message.createdAt) + '</span>' + (message.modelLabel ? '<span>' + escapeHtml(message.modelLabel) + '</span>' : "") + '</div><div class="bcc-message__body">' + escapeHtml(message.text) + '</div>' + renderTrace("Trace desta mensagem", message.trace, "") + '</div></article>').join("");
      return messages + renderTrace("Agent trace", vm.trace, vm.trace?.summary ? vm.trace.summary.eventCount + " eventos seguros - " + vm.trace.summary.toolCount + " tool(s)" : "");
    };

    const renderLoading = (label) => {
      document.getElementById("command-center-preview-root").innerHTML = '<div class="bsk-command-center"><div class="bcc-shell"><main class="bcc-viewport"><section class="bcc-hero">' + fox() + '<div><span class="bcc-hero__eyebrow">Command Center</span><h1 class="bcc-hero__title">' + escapeHtml(label) + '</h1><p class="bcc-hero__subtitle">Carregando snapshot do Zavorth...</p></div></section></main></div></div>';
    };

    const resolveInitialRenderId = () => {
      const requested = new URLSearchParams(window.location.search).get("fixture");
      if (requested) return requested;
      return window.location.protocol === "file:" ? DEFAULT_FIXTURE_ID : LIVE_FIXTURE_ID;
    };

    const render = async (fixtureId) => {
      const wantsLive = fixtureId === LIVE_FIXTURE_ID || (!fixtureId && window.location.protocol !== "file:");
      let id = wantsLive ? LIVE_FIXTURE_ID : (FIXTURES[fixtureId] ? fixtureId : DEFAULT_FIXTURE_ID);
      let current = wantsLive ? { option: LIVE_OPTION, viewModel: null } : FIXTURES[id];
      let vm = current.viewModel;

      if (wantsLive) {
        renderLoading("Conectando ao runtime ao vivo");
        try {
          vm = await fetchLiveViewModel();
        } catch (error) {
          id = DEFAULT_FIXTURE_ID;
          current = FIXTURES[id];
          vm = {
            ...current.viewModel,
            logs: [
              {
                id: "live-snapshot-error",
                level: "warn",
                source: "command-center-live",
                message: String(error?.message || error || "Snapshot ao vivo indisponivel."),
                createdAt: new Date().toISOString()
              },
              ...current.viewModel.logs
            ],
            adapterSource: {
              ...current.viewModel.adapterSource,
              label: "Fallback de fixture",
              notes: "O snapshot ao vivo falhou; exibindo fixture seguro."
            }
          };
        }
      }
      const sectors = vm.sectors.filter((sector) => sector.enabled).map((sector) => '<button class="bcc-dock__node" type="button" data-active="' + (sector.id === "terminal" ? "true" : "false") + '"><span class="bcc-dock__glyph" aria-hidden="true">â€¢</span><span class="bcc-dock__label">' + escapeHtml(sector.label) + '</span>' + (sector.badgeCount ? '<span class="bcc-dock__count">' + escapeHtml(sector.badgeCount) + '</span>' : "") + '</button>').join("");
      const pathCurrent = id === LIVE_FIXTURE_ID ? "Live" : "Preview";
      const composeNote = id === LIVE_FIXTURE_ID ? "Snapshot ao vivo protegido pelo gateway local." : "Preview local de fixture oficial.";

      document.getElementById("command-center-preview-root").innerHTML = '<div class="bsk-command-center"><div class="bcc-shell"><header class="bcc-bridge"><div class="bcc-bridge__brand">' + fox().replace('class="bcc-mascot"', 'class="bcc-mascot" style="width:46px;height:46px;border-radius:16px"') + '<div><span class="bcc-bridge__eyebrow">Command Center</span><span class="bcc-bridge__title">Zavorth</span></div></div><div class="bcc-bridge__center"><span class="bcc-bridge__path">Zavorth</span><span class="bcc-bridge__path-sep">/</span><span class="bcc-bridge__path-current">' + escapeHtml(pathCurrent) + '</span></div><div class="bcc-bridge__right">' + badge(vm.runtime.currentModelLabel, toneForRuntime(vm.runtime.status)) + '<span class="bcc-runtime-pulse" data-status="' + escapeHtml(vm.runtime.status) + '">' + escapeHtml(humanRuntimeStatus(vm.runtime.status)) + '</span></div></header><main class="bcc-viewport">' + renderFixturePreviewBar(id, current.option) + renderAuthUnlock(vm) + renderMissionBrief(vm) + '<div class="bcc-control-grid"><aside class="bcc-side-panel"><section class="bcc-card"><p class="bcc-card__label">Run</p><h2 class="bcc-card__title">' + escapeHtml(vm.agentRun ? humanAgentStatus(vm.agentRun.status) : "idle") + '</h2><div class="bcc-card__body"><p>' + escapeHtml(vm.agentRun?.summary || "Nenhuma execuÃ§Ã£o ativa agora.") + '</p></div></section><section class="bcc-card"><p class="bcc-card__label">Doctor</p><h2 class="bcc-card__title">' + escapeHtml(humanRuntimeStatus(vm.health.status)) + '</h2><div class="bcc-card__body"><div class="bcc-health-list">' + vm.health.checks.slice(0, 4).map((check) => '<div class="bcc-health-row" data-status="' + escapeHtml(check.status) + '"><span>' + escapeHtml(check.label) + '</span><small>' + escapeHtml(check.detail || check.status) + '</small></div>').join("") + '</div></div></section></aside><section class="bcc-panel bcc-chat-panel"><div class="bcc-chat-feed">' + renderChat(vm) + renderOverview(vm) + '</div><form class="bcc-compose"><div class="bcc-compose__input-frame"><textarea placeholder="Peca ao Zavorth"></textarea><div class="bcc-compose__footer"><span class="bcc-empty-note">' + escapeHtml(composeNote) + '</span><button class="bcc-button bcc-compose__send" data-variant="primary" type="button">Enviar</button></div></div></form></section><aside class="bcc-side-panel">' + renderRemoteMeshPanel(vm) + renderProviderCockpitPanel(vm) + '<section class="bcc-artifact-pane"><p class="bcc-card__label">Artifacts</p><h2 class="bcc-card__title">' + escapeHtml(vm.counts.artifacts + " disponiveis") + '</h2><div class="bcc-card__body"><div class="bcc-list">' + (vm.artifacts.length ? vm.artifacts.map((artifact) => '<div class="bcc-list-item"><span class="bcc-list-item__title">' + escapeHtml(artifact.title) + '</span><span class="bcc-list-item__meta">' + escapeHtml(artifact.kind + " - " + artifact.status) + '</span></div>').join("") : '<p class="bcc-empty-note">Ainda nao ha artifacts nesta sessao.</p>') + '</div></div></section></aside></div></main><nav class="bcc-dock"><div class="bcc-dock__rail">' + sectors + '</div></nav></div></div>';

      injectPreviewOnboardingAndApprovals(vm);
      normalizeVisibleCommandCenterCopy(document.getElementById("command-center-preview-root"));

      const selector = document.getElementById("fixture-select");
      selector?.addEventListener("change", (event) => {
        const nextId = event.target.value;
        const url = new URL(window.location.href);
        if (nextId === LIVE_FIXTURE_ID) {
          url.searchParams.delete("fixture");
        } else {
          url.searchParams.set("fixture", nextId);
        }
        history.replaceState(null, "", url);
        render(nextId);
      });

      const authForm = document.getElementById("command-center-auth-form");
      authForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = document.getElementById("command-center-auth-token");
        const message = document.getElementById("command-center-auth-message");
        const token = String(input?.value || "").trim();
        if (!token) {
          if (message) message.textContent = "Informe o token local para desbloquear.";
          return;
        }
        if (message) message.textContent = "Validando token nesta aba...";
        try {
          const response = await fetch("/api/auth/validate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
          });
          if (!response.ok) {
            clearAuthToken();
            if (message) message.textContent = "Token recusado. Verifique e tente de novo.";
            return;
          }
          writeAuthToken(token);
          if (message) message.textContent = "Acesso liberado. Atualizando cockpit...";
          await render(LIVE_FIXTURE_ID);
        } catch {
          if (message) message.textContent = "Nao consegui validar agora. Tente novamente em instantes.";
        }
      });
    };

    render(resolveInitialRenderId());
  </script>
</body>
</html>`;
}

function main() {
  const options = readCliOptions();
  const selectedFixture = options.fixture === "all"
    ? "safe-run"
    : resolveDashboardCommandCenterFixturePreviewId(options.fixture) ?? "safe-run";

  fs.mkdirSync(options.outDir, { recursive: true });
  const htmlPath = path.join(options.outDir, "index.html");
  fs.writeFileSync(htmlPath, buildPreviewHtml(selectedFixture), "utf8");

  console.log(`[command-center-browser-preview] ${htmlPath}`);
  console.log(`[command-center-browser-preview] file://${htmlPath.replace(/\\/g, "/")}?fixture=${selectedFixture}`);
}

main();
