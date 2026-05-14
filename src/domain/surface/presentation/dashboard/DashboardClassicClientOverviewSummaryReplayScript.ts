// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientOverviewSummaryReplay() {
    function renderOverviewBlock(nodeId, title, endpoint, overview, metricCards, detailHtml) {
      const node = document.getElementById(nodeId);
      if (!node) return;
      if (!overview || overview.error || overview.available === false) {
        const reason = overview && overview.reason
          ? escapeHtml(overview.reason)
          : title + ' indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const cards = Array.isArray(overview.cards) ? overview.cards : [];
      const actions = Array.isArray(overview.actions) ? overview.actions : [];
      const cardItems = cards.length
        ? cards.slice(0, 6).map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || entry.id || 'Plane') + '</strong> '
            + '<span class="badge badge-info">' + escapeHtml(entry.posture || 'attention') + '</span> '
            + escapeHtml(entry.summary || 'Sem resumo adicional.')
            + '</li>'
          ).join('')
        : '<li>Nenhum plane agregado ainda.</li>';
      const actionItems = actions.length
        ? actions.slice(0, 6).map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || entry.id || 'Acao') + '</strong> Ãƒâ€šÃ‚Â· '
            + escapeHtml(entry.reason || 'Sem motivo adicional.')
            + (entry.command ? '<div class="cockpit-command">' + escapeHtml(entry.command) + '</div>' : '')
            + '</li>'
          ).join('')
        : '<li>Nenhuma acao sugerida agora.</li>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>' + escapeHtml(title) + '</strong>'
        + '<span class="badge badge-info">' + escapeHtml(overview.summary?.posture || 'attention') + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(overview.narrative?.headline || title) + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="' + escapeHtml(endpoint) + '" target="_blank">' + escapeHtml(endpoint) + '</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">' + metricCards + '</div>'
        + '<div class="sidecar-card"><strong>Resumo do operador</strong><small>' + escapeHtml(overview.narrative?.operatorSummary || 'Sem resumo adicional.') + '</small></div>'
        + detailHtml
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Planes agregados</strong><ul class="cockpit-list">' + cardItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Acoes sugeridas</strong><ul class="cockpit-list">' + actionItems + '</ul></div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsOverview(overview) {
      const summary = overview && overview.summary ? overview.summary : {};
      renderOverviewBlock(
        'operations-overview',
        'Operational Overview',
        '/api/operations/overview',
        overview,
        '<div class="cockpit-mini-card"><strong>Canais</strong><div>' + escapeHtml(String(summary.readyChannels || 0)) + '</div><small>Prontos no runtime</small></div>'
        + '<div class="cockpit-mini-card"><strong>Nodes</strong><div>' + escapeHtml(String(summary.onlineNodes || 0)) + '</div><small>Online agora</small></div>'
        + '<div class="cockpit-mini-card"><strong>Lifecycle</strong><div>' + escapeHtml(String(summary.lifecycleEvents || 0)) + '</div><small>Eventos correlacionados</small></div>'
        + '<div class="cockpit-mini-card"><strong>Atencao</strong><div>' + escapeHtml(String(summary.lifecycleAttention || 0)) + '</div><small>Sinais no replay/learning</small></div>',
        '<div class="sidecar-card"><strong>Proximo passo</strong><div class="cockpit-command">' + escapeHtml(overview?.narrative?.nextAction || 'Revisar runtime, stability e replay.') + '</div></div>',
      );
    }

    function renderOperationsTrustOverview(overview) {
      const summary = overview && overview.summary ? overview.summary : {};
      renderOverviewBlock(
        'operations-trust-overview',
        'Trust Overview',
        '/api/operations/trust-overview',
        overview,
        '<div class="cockpit-mini-card"><strong>Tenants</strong><div>' + escapeHtml(String(summary.tenants || 0)) + '</div><small>Observados no boundary</small></div>'
        + '<div class="cockpit-mini-card"><strong>Onboarding</strong><div>' + escapeHtml(String(summary.pendingOnboarding || 0)) + '</div><small>Pendentes</small></div>'
        + '<div class="cockpit-mini-card"><strong>Approvals</strong><div>' + escapeHtml(String(summary.pendingApprovals || 0)) + '</div><small>Em aberto</small></div>'
        + '<div class="cockpit-mini-card"><strong>Risco</strong><div>' + escapeHtml(String(summary.highRiskCapabilities || 0)) + '</div><small>Capabilities sensiveis</small></div>',
        '<div class="sidecar-card"><strong>Proximo passo</strong><div class="cockpit-command">' + escapeHtml(overview?.narrative?.nextAction || 'Revisar trust, governance e tenants.') + '</div></div>',
      );
    }

    function renderOperationsProductOverview(overview) {
      const summary = overview && overview.summary ? overview.summary : {};
      renderOverviewBlock(
        'operations-product-overview',
        'Product Overview',
        '/api/operations/product-overview',
        overview,
        '<div class="cockpit-mini-card"><strong>Integrations</strong><div>' + escapeHtml(String(summary.integrations || 0)) + '</div><small>Hub consolidado</small></div>'
        + '<div class="cockpit-mini-card"><strong>Platform</strong><div>' + escapeHtml(String(summary.platformEntries || 0)) + '</div><small>Entradas disponiveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Evals</strong><div>' + escapeHtml(String(summary.scorecards || 0)) + '</div><small>Scorecards ativos</small></div>'
        + '<div class="cockpit-mini-card"><strong>Rollout</strong><div>' + escapeHtml(summary.releaseReady ? 'ready' : 'pending') + '</div><small>Gate ' + escapeHtml(summary.rolloutGateStatus || 'unknown') + '</small></div>',
        '<div class="sidecar-card"><strong>Proximo passo</strong><div class="cockpit-command">' + escapeHtml(overview?.narrative?.nextAction || 'Revisar hub, ecosystem, evals e rollout.') + '</div></div>',
      );
    }

    function renderOperationsControlPlaneCatalog(catalog) {
      const summary = catalog && catalog.summary ? catalog.summary : {};
      renderOverviewBlock(
        'operations-control-plane-catalog',
        'Control Plane Catalog',
        '/api/operations/control-plane-catalog',
        catalog,
        '<div class="cockpit-mini-card"><strong>Families</strong><div>' + escapeHtml(String(summary.families || 0)) + '</div><small>Operational, Trust, Product</small></div>'
        + '<div class="cockpit-mini-card"><strong>Healthy</strong><div>' + escapeHtml(String(summary.healthyFamilies || 0)) + '</div><small>Familias estaveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Attention</strong><div>' + escapeHtml(String(summary.attentionFamilies || 0)) + '</div><small>Familias em observacao</small></div>'
        + '<div class="cockpit-mini-card"><strong>Critical</strong><div>' + escapeHtml(String(summary.criticalFamilies || 0)) + '</div><small>Familias criticas</small></div>',
        '<div class="sidecar-card"><strong>Posturas canonicas</strong><small>Operational: ' + escapeHtml(summary.operationalPosture || 'attention')
        + ' | Trust: ' + escapeHtml(summary.trustPosture || 'attention')
        + ' | Product: ' + escapeHtml(summary.productPosture || 'attention')
        + '</small><div class="cockpit-command">' + escapeHtml(catalog?.narrative?.nextAction || 'Usar overviews canonicos como fronteira de leitura dos control planes.') + '</div></div>',
      );
    }

    function renderOperationsReplay(replay) {
      const node = document.getElementById('operations-replay');
      if (!node) return;
      if (!replay || replay.error || replay.available === false) {
        const reason = replay && replay.reason
          ? escapeHtml(replay.reason)
          : 'Replay operacional indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const recommended = replay.recommendedEntry || {};
      const timeline = Array.isArray(replay.timeline) ? replay.timeline : [];
      const recentArtifacts = Array.isArray(replay.recentArtifacts) ? replay.recentArtifacts : [];
      const timelineItems = timeline.length
        ? timeline.map((step) =>
            '<li><strong>' + escapeHtml(step.label || 'Passo') + '</strong> Ã‚Â· '
            + escapeHtml(step.detail || 'Sem detalhe adicional.')
            + (step.happenedAt ? ' <small>(' + escapeHtml(formatRelativeTime(step.happenedAt) || 'agora') + ')</small>' : '')
            + '</li>'
          ).join('')
        : '<li>Nenhum passo relevante no replay ainda.</li>';
      const artifactItems = recentArtifacts.length
        ? recentArtifacts.map((artifact) =>
            '<li><strong>' + escapeHtml(artifact.label || 'Entrega') + '</strong> Ã‚Â· '
            + escapeHtml(artifact.summary || artifact.path || 'Sem resumo adicional.')
            + '</li>'
          ).join('')
        : '<li>Nenhuma entrega recente consolidada.</li>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Replay operacional</strong>'
        + '<span class="badge badge-info">' + escapeHtml(replay.dominantSurface || 'misto') + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(replay.headline || 'Replay pronto') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/replay" target="_blank">/api/operations/replay</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Tarefas</strong><div>' + escapeHtml(String(replay.stats?.tasks || 0)) + '</div><small>Entradas recentes no replay</small></div>'
        + '<div class="cockpit-mini-card"><strong>Workflows</strong><div>' + escapeHtml(String(replay.stats?.workflowRuns || 0)) + '</div><small>Fluxos compostos visiveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Permissoes</strong><div>' + escapeHtml(String(replay.stats?.pendingPermissions || 0)) + '</div><small>Confirmacoes em aberto</small></div>'
        + '<div class="cockpit-mini-card"><strong>Entregas</strong><div>' + escapeHtml(String(replay.stats?.artifacts || 0)) + '</div><small>Artefatos reutilizaveis</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Resumo do operador</strong><small>' + escapeHtml(replay.operatorSummary || 'Sem resumo adicional.') + '</small></div>'
        + '<div class="sidecar-card"><strong>Melhor ponto de entrada</strong><ul class="cockpit-list"><li><strong>'
        + escapeHtml(recommended.label || 'Abrir contexto')
        + '</strong> Ã‚Â· '
        + escapeHtml(recommended.reason || 'Sem recomendacao adicional.')
        + '</li></ul></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Linha do tempo</strong><ul class="cockpit-list">' + timelineItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Entregas recentes</strong><ul class="cockpit-list">' + artifactItems + '</ul></div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsLifecycle(lifecycle) {
      const node = document.getElementById('operations-lifecycle');
      if (!node) return;
      if (!lifecycle || lifecycle.error || lifecycle.available === false) {
        const reason = lifecycle && lifecycle.reason
          ? escapeHtml(lifecycle.reason)
          : 'Lifecycle de execucao indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const summary = lifecycle.summary || {};
      const latest = Array.isArray(lifecycle.latest) ? lifecycle.latest : [];
      const byRun = Array.isArray(lifecycle.byRun) ? lifecycle.byRun : [];
      const latestItems = latest.length
        ? latest.slice(0, 6).map((entry) =>
            '<li><strong>' + escapeHtml(entry.kind || 'execution') + '</strong> '
            + '<span class="badge badge-info">' + escapeHtml(entry.status || 'linked') + '</span> '
            + escapeHtml(entry.summary || entry.id || 'Evento de lifecycle.')
            + '<small> runId=' + escapeHtml(entry.runId || 'n/d') + '</small>'
            + '</li>'
          ).join('')
        : '<li>Nenhum evento canonico recente.</li>';
      const runItems = byRun.length
        ? byRun.slice(0, 5).map((entry) =>
            '<li><strong>' + escapeHtml(entry.runId || 'run') + '</strong> - '
            + escapeHtml(String(entry.total || 0)) + ' evento(s), '
            + escapeHtml(String(entry.approvals || 0)) + ' approval(s), '
            + escapeHtml(String(entry.artifacts || 0)) + ' artifact(s)'
            + '</li>'
          ).join('')
        : '<li>Nenhum run agrupado ainda.</li>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Execution lifecycle</strong>'
        + '<span class="badge badge-info">' + escapeHtml(String(summary.recent || 0)) + ' evento(s)</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(lifecycle.narrative?.headline || 'Lifecycle canonico pronto') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/lifecycle" target="_blank">/api/operations/lifecycle</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Runs</strong><div>' + escapeHtml(String(summary.runs || 0)) + '</div><small>Run IDs correlacionados</small></div>'
        + '<div class="cockpit-mini-card"><strong>Approvals</strong><div>' + escapeHtml(String(summary.approvals || 0)) + '</div><small>Gates rastreados</small></div>'
        + '<div class="cockpit-mini-card"><strong>Artifacts</strong><div>' + escapeHtml(String(summary.artifacts || 0)) + '</div><small>Saidas ligadas ao run</small></div>'
        + '<div class="cockpit-mini-card"><strong>Atencao</strong><div>' + escapeHtml(String((summary.approvalRequired || 0) + (summary.blocked || 0) + (summary.failed || 0))) + '</div><small>Approval, blocked ou failed</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Resumo do operador</strong><small>' + escapeHtml(lifecycle.narrative?.operatorSummary || 'Sem resumo adicional.') + '</small></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Eventos recentes</strong><ul class="cockpit-list">' + latestItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Runs agrupados</strong><ul class="cockpit-list">' + runItems + '</ul></div>'
        + '</div>'
        + '</div>';
    }

    function renderOperationsHandoff(handoff) {
      const node = document.getElementById('operations-handoff');
      if (!node) return;
      if (!handoff || handoff.error || handoff.available === false) {
        const reason = handoff && handoff.reason
          ? escapeHtml(handoff.reason)
          : 'Handoff de sessao indisponivel.';
        node.innerHTML = '<div class="muted">' + reason + '</div>';
        return;
      }

      const surfaces = Array.isArray(handoff.surfaces) ? handoff.surfaces : [];
      const carryForward = Array.isArray(handoff.carryForward) ? handoff.carryForward : [];
      const surfaceItems = surfaces.length
        ? surfaces.map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || entry.source || 'Superficie') + '</strong> Ã‚Â· '
            + escapeHtml(entry.activity || 'Sem atividade recente.')
            + (entry.linked ? ' <small>(ligada)</small>' : '')
            + '</li>'
          ).join('')
        : '<li>Nenhuma superficie adicional ligada ainda.</li>';
      const carryItems = carryForward.length
        ? carryForward.map((entry) =>
            '<li><strong>' + escapeHtml(entry.label || 'Contexto') + '</strong> Ã‚Â· '
            + escapeHtml(entry.detail || 'Sem detalhe adicional.')
            + '</li>'
          ).join('')
        : '<li>Nenhum contexto extra para carregar.</li>';

      node.innerHTML =
        '<div class="cockpit-status">'
        + '<div>'
        + '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
        + '<strong>Handoff de sessao</strong>'
        + '<span class="badge ' + (handoff.status === 'resume-required' ? 'badge-warning' : (handoff.status === 'aligned' ? 'badge-allowed' : 'badge-info')) + '">'
        + escapeHtml(handoff.status || 'fresh')
        + '</span>'
        + '</div>'
        + '<div class="cockpit-headline">' + escapeHtml(handoff.headline || 'Handoff pronto') + '</div>'
        + '</div>'
        + '<a class="sidecar-link" href="/api/operations/handoff" target="_blank">/api/operations/handoff</a>'
        + '</div>'
        + '<div class="cockpit-grid">'
        + '<div class="cockpit-stack">'
        + '<div class="cockpit-mini-grid">'
        + '<div class="cockpit-mini-card"><strong>Destino</strong><div>' + escapeHtml(handoff.canonicalTarget?.label || 'nova sessao') + '</div><small>Contexto principal</small></div>'
        + '<div class="cockpit-mini-card"><strong>Tarefas</strong><div>' + escapeHtml(String(handoff.checkpoints?.tasks || 0)) + '</div><small>Itens na sessao compartilhada</small></div>'
        + '<div class="cockpit-mini-card"><strong>Workflows</strong><div>' + escapeHtml(String(handoff.checkpoints?.workflowRuns || 0)) + '</div><small>Fluxos compostos visiveis</small></div>'
        + '<div class="cockpit-mini-card"><strong>Superficies</strong><div>' + escapeHtml(String(handoff.checkpoints?.linkedSurfaces || 0)) + '</div><small>Ambientes ligados ao mesmo principal</small></div>'
        + '</div>'
        + '<div class="sidecar-card"><strong>Resumo do operador</strong><small>' + escapeHtml(handoff.operatorSummary || 'Sem resumo adicional.') + '</small></div>'
        + '<div class="sidecar-card"><strong>Prompt de retomada</strong><div class="cockpit-command">' + escapeHtml(handoff.handoffPrompt || handoff.handoffCommand || 'Sem prompt pronto.') + '</div></div>'
        + '</div>'
        + '<div class="cockpit-stack">'
        + '<div class="sidecar-card"><strong>Superficies ligadas</strong><ul class="cockpit-list">' + surfaceItems + '</ul></div>'
        + '<div class="sidecar-card"><strong>Carregar junto</strong><ul class="cockpit-list">' + carryItems + '</ul></div>'
        + '</div>'
        + '</div>';
    }
}

export function getDashboardClassicClientOverviewSummaryReplayScript(): string {
  return extractFunctionBody(dashboardClassicClientOverviewSummaryReplay);
}

