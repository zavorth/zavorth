import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;

interface OverviewNarrative {
  headline?: string;
  operatorSummary?: string;
  nextAction?: string;
}

interface OverviewSummary {
  posture?: string;
  readyChannels?: number;
  onlineNodes?: number;
  lifecycleEvents?: number;
  lifecycleAttention?: number;
  tenants?: number;
  pendingOnboarding?: number;
  pendingApprovals?: number;
  highRiskCapabilities?: number;
  integrations?: number;
  platformEntries?: number;
  scorecards?: number;
  releaseReady?: boolean;
  rolloutGateStatus?: string;
  families?: number;
  healthyFamilies?: number;
  attentionFamilies?: number;
  criticalFamilies?: number;
  operationalPosture?: string;
  trustPosture?: string;
  productPosture?: string;
}

interface OverviewCard {
  label?: string;
  id?: string;
  posture?: string;
  summary?: string;
}

interface OverviewAction {
  label?: string;
  id?: string;
  reason?: string;
  command?: string;
}

interface OverviewData {
  error?: boolean;
  available?: boolean;
  reason?: string;
  summary?: OverviewSummary;
  narrative?: OverviewNarrative;
  cards?: OverviewCard[];
  actions?: OverviewAction[];
}

interface ReplayRecommendedEntry {
  label?: string;
  reason?: string;
}

interface ReplayTimelineStep {
  label?: string;
  detail?: string;
  happenedAt?: string;
}

interface ReplayArtifact {
  label?: string;
  summary?: string;
  path?: string;
}

interface ReplayStats {
  tasks?: number;
  workflowRuns?: number;
  pendingPermissions?: number;
  artifacts?: number;
}

interface ReplayData {
  error?: boolean;
  available?: boolean;
  reason?: string;
  dominantSurface?: string;
  headline?: string;
  operatorSummary?: string;
  recommendedEntry?: ReplayRecommendedEntry;
  timeline?: ReplayTimelineStep[];
  recentArtifacts?: ReplayArtifact[];
  stats?: ReplayStats;
}

interface LifecycleSummary {
  recent?: number;
  runs?: number;
  approvals?: number;
  artifacts?: number;
  approvalRequired?: number;
  blocked?: number;
  failed?: number;
}

interface LifecycleNarrative {
  headline?: string;
  operatorSummary?: string;
}

interface LifecycleEvent {
  kind?: string;
  status?: string;
  summary?: string;
  id?: string;
  runId?: string;
}

interface LifecycleByRun {
  runId?: string;
  total?: number;
  approvals?: number;
  artifacts?: number;
}

interface LifecycleData {
  error?: boolean;
  available?: boolean;
  reason?: string;
  summary?: LifecycleSummary;
  narrative?: LifecycleNarrative;
  latest?: LifecycleEvent[];
  byRun?: LifecycleByRun[];
}

interface HandoffSurface {
  label?: string;
  source?: string;
  activity?: string;
  linked?: boolean;
}

interface HandoffCarryForward {
  label?: string;
  detail?: string;
}

interface HandoffCanonicalTarget {
  label?: string;
}

interface HandoffCheckpoints {
  tasks?: number;
  workflowRuns?: number;
  linkedSurfaces?: number;
}

interface HandoffData {
  error?: boolean;
  available?: boolean;
  reason?: string;
  status?: string;
  headline?: string;
  operatorSummary?: string;
  handoffPrompt?: string;
  handoffCommand?: string;
  canonicalTarget?: HandoffCanonicalTarget;
  checkpoints?: HandoffCheckpoints;
  surfaces?: HandoffSurface[];
  carryForward?: HandoffCarryForward[];
}

function zavorthControlClassicClientOverviewSummaryReplay() {
  function renderOverviewBlock(
    nodeId: string,
    title: string,
    endpoint: string,
    overview: OverviewData | null | undefined,
    metricCards: string,
    detailHtml: string,
  ): void {
    const node = document.getElementById(nodeId);
    if (!node) return;
    if (!overview || overview.error || overview.available === false) {
      const reason = overview && overview.reason ? escapeHtml(overview.reason) : title + ' unavailable.';
      node.innerHTML = '<div class="muted">' + reason + '</div>';
      return;
    }

    const cards: OverviewCard[] = Array.isArray(overview.cards) ? overview.cards : [];
    const actions: OverviewAction[] = Array.isArray(overview.actions) ? overview.actions : [];
    const cardItems = cards.length
      ? cards
          .slice(0, 6)
          .map(
            (entry: OverviewCard) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Plane') +
              '</strong> ' +
              '<span class="badge badge-info">' +
              escapeHtml(entry.posture || 'attention') +
              '</span> ' +
              escapeHtml(entry.summary || 'No additional summary.') +
              '</li>',
          )
          .join('')
      : '<li>No aggregated plane yet.</li>';
    const actionItems = actions.length
      ? actions
          .slice(0, 6)
          .map(
            (entry: OverviewAction) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.id || 'Action') +
              '</strong> ' +
              escapeHtml(entry.reason || 'No additional reason.') +
              (entry.command ? '<div class="cockpit-command">' + escapeHtml(entry.command) + '</div>' : '') +
              '</li>',
          )
          .join('')
      : '<li>No acao sugerida agora.</li>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>' +
      escapeHtml(title) +
      '</strong>' +
      '<span class="badge badge-info">' +
      escapeHtml(overview.summary?.posture || 'attention') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(overview.narrative?.headline || title) +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="' +
      escapeHtml(endpoint) +
      '" target="_blank">' +
      escapeHtml(endpoint) +
      '</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      metricCards +
      '</div>' +
      '<div class="sidecar-card"><strong>Operator summary</strong><small>' +
      escapeHtml(overview.narrative?.operatorSummary || 'No additional summary.') +
      '</small></div>' +
      detailHtml +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Planes agregados</strong><ul class="cockpit-list">' +
      cardItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Acoes sugeridas</strong><ul class="cockpit-list">' +
      actionItems +
      '</ul></div>' +
      '</div>' +
      '</div>';
  }

  function renderOperationsOverview(overview: OverviewData): void {
    const summary: OverviewSummary = overview && overview.summary ? overview.summary : {};
    renderOverviewBlock(
      'operations-overview',
      'Operational Overview',
      '/api/operations/overview',
      overview,
      '<div class="cockpit-mini-card"><strong>Canais</strong><div>' +
        escapeHtml(String(summary.readyChannels || 0)) +
        '</div><small>Prontos no runtime</small></div>' +
        '<div class="cockpit-mini-card"><strong>Nodes</strong><div>' +
        escapeHtml(String(summary.onlineNodes || 0)) +
        '</div><small>Online agora</small></div>' +
        '<div class="cockpit-mini-card"><strong>Lifecycle</strong><div>' +
        escapeHtml(String(summary.lifecycleEvents || 0)) +
        '</div><small>Eventos correlacionados</small></div>' +
        '<div class="cockpit-mini-card"><strong>Atencao</strong><div>' +
        escapeHtml(String(summary.lifecycleAttention || 0)) +
        '</div><small>Sinais no replay/learning</small></div>',
      '<div class="sidecar-card"><strong>Next step</strong><div class="cockpit-command">' +
        escapeHtml(overview?.narrative?.nextAction || 'Revisar runtime, stability e replay.') +
        '</div></div>',
    );
  }

  function renderOperationsTrustOverview(overview: OverviewData): void {
    const summary: OverviewSummary = overview && overview.summary ? overview.summary : {};
    renderOverviewBlock(
      'operations-trust-overview',
      'Trust Overview',
      '/api/operations/trust-overview',
      overview,
      '<div class="cockpit-mini-card"><strong>Tenants</strong><div>' +
        escapeHtml(String(summary.tenants || 0)) +
        '</div><small>Observados no boundary</small></div>' +
        '<div class="cockpit-mini-card"><strong>Onboarding</strong><div>' +
        escapeHtml(String(summary.pendingOnboarding || 0)) +
        '</div><small>Pendentes</small></div>' +
        '<div class="cockpit-mini-card"><strong>Approvals</strong><div>' +
        escapeHtml(String(summary.pendingApprovals || 0)) +
        '</div><small>Em aberto</small></div>' +
        '<div class="cockpit-mini-card"><strong>Risco</strong><div>' +
        escapeHtml(String(summary.highRiskCapabilities || 0)) +
        '</div><small>Capabilities sensiveis</small></div>',
      '<div class="sidecar-card"><strong>Next step</strong><div class="cockpit-command">' +
        escapeHtml(overview?.narrative?.nextAction || 'Revisar trust, governance e tenants.') +
        '</div></div>',
    );
  }

  function renderOperationsProductOverview(overview: OverviewData): void {
    const summary: OverviewSummary = overview && overview.summary ? overview.summary : {};
    renderOverviewBlock(
      'operations-product-overview',
      'Product Overview',
      '/api/operations/product-overview',
      overview,
      '<div class="cockpit-mini-card"><strong>Integrations</strong><div>' +
        escapeHtml(String(summary.integrations || 0)) +
        '</div><small>Hub consolidado</small></div>' +
        '<div class="cockpit-mini-card"><strong>Platform</strong><div>' +
        escapeHtml(String(summary.platformEntries || 0)) +
        '</div><small>Entradas disponiveis</small></div>' +
        '<div class="cockpit-mini-card"><strong>Evals</strong><div>' +
        escapeHtml(String(summary.scorecards || 0)) +
        '</div><small>Scorecards ativos</small></div>' +
        '<div class="cockpit-mini-card"><strong>Rollout</strong><div>' +
        escapeHtml(summary.releaseReady ? 'ready' : 'pending') +
        '</div><small>Gate ' +
        escapeHtml(summary.rolloutGateStatus || 'unknown') +
        '</small></div>',
      '<div class="sidecar-card"><strong>Next step</strong><div class="cockpit-command">' +
        escapeHtml(overview?.narrative?.nextAction || 'Revisar hub, ecosystem, evals e rollout.') +
        '</div></div>',
    );
  }

  function renderOperationsControlPlaneCatalog(catalog: OverviewData): void {
    const summary: OverviewSummary = catalog && catalog.summary ? catalog.summary : {};
    renderOverviewBlock(
      'operations-control-plane-catalog',
      'Control Plane Catalog',
      '/api/operations/control-plane-catalog',
      catalog,
      '<div class="cockpit-mini-card"><strong>Families</strong><div>' +
        escapeHtml(String(summary.families || 0)) +
        '</div><small>Operational, Trust, Product</small></div>' +
        '<div class="cockpit-mini-card"><strong>Healthy</strong><div>' +
        escapeHtml(String(summary.healthyFamilies || 0)) +
        '</div><small>Stable families</small></div>' +
        '<div class="cockpit-mini-card"><strong>Attention</strong><div>' +
        escapeHtml(String(summary.attentionFamilies || 0)) +
        '</div><small>Families under observation</small></div>' +
        '<div class="cockpit-mini-card"><strong>Critical</strong><div>' +
        escapeHtml(String(summary.criticalFamilies || 0)) +
        '</div><small>Critical families</small></div>',
      '<div class="sidecar-card"><strong>Posturas canonicas</strong><small>Operational: ' +
        escapeHtml(summary.operationalPosture || 'attention') +
        ' | Trust: ' +
        escapeHtml(summary.trustPosture || 'attention') +
        ' | Product: ' +
        escapeHtml(summary.productPosture || 'attention') +
        '</small><div class="cockpit-command">' +
        escapeHtml(
          catalog?.narrative?.nextAction || 'Usar overviews canonical como fronteira de leitura dos control planes.',
        ) +
        '</div></div>',
    );
  }

  function renderOperationsReplay(replay: ReplayData): void {
    const node = document.getElementById('operations-replay');
    if (!node) return;
    if (!replay || replay.error || replay.available === false) {
      const reason = replay && replay.reason ? escapeHtml(replay.reason) : 'Operational replay unavailable.';
      node.innerHTML = '<div class="muted">' + reason + '</div>';
      return;
    }

    const recommended: ReplayRecommendedEntry = replay.recommendedEntry || {};
    const timeline: ReplayTimelineStep[] = Array.isArray(replay.timeline) ? replay.timeline : [];
    const recentArtifacts: ReplayArtifact[] = Array.isArray(replay.recentArtifacts) ? replay.recentArtifacts : [];
    const timelineItems = timeline.length
      ? timeline
          .map(
            (step: ReplayTimelineStep) =>
              '<li><strong>' +
              escapeHtml(step.label || 'Passo') +
              '</strong> ' +
              escapeHtml(step.detail || 'No additional detail.') +
              (step.happenedAt
                ? ' <small>(' + escapeHtml(formatRelativeTime(step.happenedAt) || 'agora') + ')</small>'
                : '') +
              '</li>',
          )
          .join('')
      : '<li>No relevant replay steps yet.</li>';
    const artifactItems = recentArtifacts.length
      ? recentArtifacts
          .map(
            (artifact: ReplayArtifact) =>
              '<li><strong>' +
              escapeHtml(artifact.label || 'Entrega') +
              '</strong> ' +
              escapeHtml(artifact.summary || artifact.path || 'No additional summary.') +
              '</li>',
          )
          .join('')
      : '<li>No entrega recente consolidada.</li>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Operational replay</strong>' +
      '<span class="badge badge-info">' +
      escapeHtml(replay.dominantSurface || 'misto') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(replay.headline || 'Replay ready') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/replay" target="_blank">/api/operations/replay</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Tarefas</strong><div>' +
      escapeHtml(String(replay.stats?.tasks || 0)) +
      '</div><small>Entradas recentes no replay</small></div>' +
      '<div class="cockpit-mini-card"><strong>Workflows</strong><div>' +
      escapeHtml(String(replay.stats?.workflowRuns || 0)) +
      '</div><small>Fluxos compostos visiveis</small></div>' +
      '<div class="cockpit-mini-card"><strong>Permissoes</strong><div>' +
      escapeHtml(String(replay.stats?.pendingPermissions || 0)) +
      '</div><small>Confirmacoes em aberto</small></div>' +
      '<div class="cockpit-mini-card"><strong>Deliverables</strong><div>' +
      escapeHtml(String(replay.stats?.artifacts || 0)) +
      '</div><small>Reusable artifacts</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Operator summary</strong><small>' +
      escapeHtml(replay.operatorSummary || 'No additional summary.') +
      '</small></div>' +
      '<div class="sidecar-card"><strong>Melhor ponto de entrada</strong><ul class="cockpit-list"><li><strong>' +
      escapeHtml(recommended.label || 'Abrir contexto') +
      '</strong> ' +
      escapeHtml(recommended.reason || 'No additional recommendation.') +
      '</li></ul></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Linha do tempo</strong><ul class="cockpit-list">' +
      timelineItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Entregas recentes</strong><ul class="cockpit-list">' +
      artifactItems +
      '</ul></div>' +
      '</div>' +
      '</div>';
  }

  function renderOperationsLifecycle(lifecycle: LifecycleData): void {
    const node = document.getElementById('operations-lifecycle');
    if (!node) return;
    if (!lifecycle || lifecycle.error || lifecycle.available === false) {
      const reason = lifecycle && lifecycle.reason ? escapeHtml(lifecycle.reason) : 'Execution lifecycle unavailable.';
      node.innerHTML = '<div class="muted">' + reason + '</div>';
      return;
    }

    const summary: LifecycleSummary = lifecycle.summary || {};
    const latest: LifecycleEvent[] = Array.isArray(lifecycle.latest) ? lifecycle.latest : [];
    const byRun: LifecycleByRun[] = Array.isArray(lifecycle.byRun) ? lifecycle.byRun : [];
    const latestItems = latest.length
      ? latest
          .slice(0, 6)
          .map(
            (entry: LifecycleEvent) =>
              '<li><strong>' +
              escapeHtml(entry.kind || 'execution') +
              '</strong> ' +
              '<span class="badge badge-info">' +
              escapeHtml(entry.status || 'linked') +
              '</span> ' +
              escapeHtml(entry.summary || entry.id || 'Evento de lifecycle.') +
              '<small> runId=' +
              escapeHtml(entry.runId || 'n/a') +
              '</small>' +
              '</li>',
          )
          .join('')
      : '<li>No recent canonical events.</li>';
    const runItems = byRun.length
      ? byRun
          .slice(0, 5)
          .map(
            (entry: LifecycleByRun) =>
              '<li><strong>' +
              escapeHtml(entry.runId || 'run') +
              '</strong> - ' +
              escapeHtml(String(entry.total || 0)) +
              ' event(s), ' +
              escapeHtml(String(entry.approvals || 0)) +
              ' approval(s), ' +
              escapeHtml(String(entry.artifacts || 0)) +
              ' artifact(s)' +
              '</li>',
          )
          .join('')
      : '<li>No grouped runs yet.</li>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Execution lifecycle</strong>' +
      '<span class="badge badge-info">' +
      escapeHtml(String(summary.recent || 0)) +
      ' event(s)</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(lifecycle.narrative?.headline || 'Lifecycle canonico ready') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/lifecycle" target="_blank">/api/operations/lifecycle</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Runs</strong><div>' +
      escapeHtml(String(summary.runs || 0)) +
      '</div><small>Run IDs correlacionados</small></div>' +
      '<div class="cockpit-mini-card"><strong>Approvals</strong><div>' +
      escapeHtml(String(summary.approvals || 0)) +
      '</div><small>Gates rastreados</small></div>' +
      '<div class="cockpit-mini-card"><strong>Artifacts</strong><div>' +
      escapeHtml(String(summary.artifacts || 0)) +
      '</div><small>Saidas ligadas ao run</small></div>' +
      '<div class="cockpit-mini-card"><strong>Atencao</strong><div>' +
      escapeHtml(String((summary.approvalRequired || 0) + (summary.blocked || 0) + (summary.failed || 0))) +
      '</div><small>Approval, blocked ou failed</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Operator summary</strong><small>' +
      escapeHtml(lifecycle.narrative?.operatorSummary || 'No additional summary.') +
      '</small></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Eventos recentes</strong><ul class="cockpit-list">' +
      latestItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Runs agrupados</strong><ul class="cockpit-list">' +
      runItems +
      '</ul></div>' +
      '</div>' +
      '</div>';
  }

  function renderOperationsHandoff(handoff: HandoffData): void {
    const node = document.getElementById('operations-handoff');
    if (!node) return;
    if (!handoff || handoff.error || handoff.available === false) {
      const reason = handoff && handoff.reason ? escapeHtml(handoff.reason) : 'Session handoff unavailable.';
      node.innerHTML = '<div class="muted">' + reason + '</div>';
      return;
    }

    const surfaces: HandoffSurface[] = Array.isArray(handoff.surfaces) ? handoff.surfaces : [];
    const carryForward: HandoffCarryForward[] = Array.isArray(handoff.carryForward) ? handoff.carryForward : [];
    const surfaceItems = surfaces.length
      ? surfaces
          .map(
            (entry: HandoffSurface) =>
              '<li><strong>' +
              escapeHtml(entry.label || entry.source || 'Superficie') +
              '</strong> ' +
              escapeHtml(entry.activity || 'No recent activity.') +
              (entry.linked ? ' <small>(ligada)</small>' : '') +
              '</li>',
          )
          .join('')
      : '<li>No superficie adicional ligada ainda.</li>';
    const carryItems = carryForward.length
      ? carryForward
          .map(
            (entry: HandoffCarryForward) =>
              '<li><strong>' +
              escapeHtml(entry.label || 'Contexto') +
              '</strong> ' +
              escapeHtml(entry.detail || 'No additional detail.') +
              '</li>',
          )
          .join('')
      : '<li>No extra context to load.</li>';

    node.innerHTML =
      '<div class="cockpit-status">' +
      '<div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
      '<strong>Handoff de session</strong>' +
      '<span class="badge ' +
      (handoff.status === 'resume-required'
        ? 'badge-warning'
        : handoff.status === 'aligned'
          ? 'badge-allowed'
          : 'badge-info') +
      '">' +
      escapeHtml(handoff.status || 'fresh') +
      '</span>' +
      '</div>' +
      '<div class="cockpit-headline">' +
      escapeHtml(handoff.headline || 'Handoff ready') +
      '</div>' +
      '</div>' +
      '<a class="sidecar-link" href="/api/operations/handoff" target="_blank">/api/operations/handoff</a>' +
      '</div>' +
      '<div class="cockpit-grid">' +
      '<div class="cockpit-stack">' +
      '<div class="cockpit-mini-grid">' +
      '<div class="cockpit-mini-card"><strong>Destino</strong><div>' +
      escapeHtml(handoff.canonicalTarget?.label || 'novthe session') +
      '</div><small>Contexto principal</small></div>' +
      '<div class="cockpit-mini-card"><strong>Tarefas</strong><div>' +
      escapeHtml(String(handoff.checkpoints?.tasks || 0)) +
      '</div><small>Itens nthe session compartilhada</small></div>' +
      '<div class="cockpit-mini-card"><strong>Workflows</strong><div>' +
      escapeHtml(String(handoff.checkpoints?.workflowRuns || 0)) +
      '</div><small>Fluxos compostos visiveis</small></div>' +
      '<div class="cockpit-mini-card"><strong>Superficies</strong><div>' +
      escapeHtml(String(handoff.checkpoints?.linkedSurfaces || 0)) +
      '</div><small>Ambientes ligados ao mesmo principal</small></div>' +
      '</div>' +
      '<div class="sidecar-card"><strong>Operator summary</strong><small>' +
      escapeHtml(handoff.operatorSummary || 'No additional summary.') +
      '</small></div>' +
      '<div class="sidecar-card"><strong>Resume prompt</strong><div class="cockpit-command">' +
      escapeHtml(handoff.handoffPrompt || handoff.handoffCommand || 'No prompt ready.') +
      '</div></div>' +
      '</div>' +
      '<div class="cockpit-stack">' +
      '<div class="sidecar-card"><strong>Superficies ligadas</strong><ul class="cockpit-list">' +
      surfaceItems +
      '</ul></div>' +
      '<div class="sidecar-card"><strong>Carregar junto</strong><ul class="cockpit-list">' +
      carryItems +
      '</ul></div>' +
      '</div>' +
      '</div>';
  }
}

export function getZavorthControlClassicClientOverviewSummaryReplayScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewSummaryReplay);
}
