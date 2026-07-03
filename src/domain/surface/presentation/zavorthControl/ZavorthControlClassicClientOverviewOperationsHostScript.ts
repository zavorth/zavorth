import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';

declare function escapeHtml(value: unknown): string;
declare function formatRelativeTime(value: unknown): string;
declare function formatBytes(value: unknown): string;

interface DockerLanguages {
  javascript?: { image?: string };
  python?: { image?: string };
}

interface DockerStatus {
  canRun?: boolean;
  required?: boolean;
  detail?: string;
  languages?: DockerLanguages;
}

interface StorageHotspot {
  label?: string;
  bytes?: number;
}

interface StorageStatus {
  freePercent?: number;
  freeBytes?: number;
  totalBytes?: number;
  hotspots?: StorageHotspot[];
}

interface PublishHistoryEntry {
  commit?: string;
  branch?: string;
  sourceArchiveId?: string;
  archiveId?: string;
  publishedAt?: string;
  docsUrl?: string;
  remoteConsoleUrl?: string;
}

interface PublishStatus {
  available?: boolean;
  publishedAt?: string;
  docsUrl?: string;
  remoteConsoleUrl?: string;
  branch?: string;
  history?: PublishHistoryEntry[];
}

interface MaintenanceStatus {
  available?: boolean;
  dryRun?: boolean;
  finishedAt?: string;
  startedAt?: string;
  completedSteps?: number;
  stepCount?: number;
  withSoak?: boolean;
  withPublish?: boolean;
}

interface MaintenanceAutomationStatus {
  enabled?: boolean;
  nextPlannedAt?: string;
  lastTriggeredAt?: string;
  lastTriggerSource?: string;
  lastPriorityReason?: string;
  lastReportFinishedAt?: string;
  lastReportStepCount?: number;
}

interface NodeMeshSmokeStatus {
  status?: string;
  stale?: boolean;
  summary?: string;
  checkedAt?: string;
  recentCapabilityId?: string;
  command?: string;
}

interface ChannelProviderItem {
  channelId?: string;
  mode?: string;
  status?: string;
}

interface ChannelProviderDoctorStatus {
  status?: string;
  stale?: boolean;
  summary?: string;
  checkedAt?: string;
  command?: string;
  items?: ChannelProviderItem[];
}

interface RemoteTransportItem {
  transportId?: string;
  id?: string;
  status?: string;
}

interface RemoteTransportDoctorStatus {
  status?: string;
  stale?: boolean;
  summary?: string;
  checkedAt?: string;
  command?: string;
  items?: RemoteTransportItem[];
}

interface AuditChainEntry {
  eventType?: string;
  taskId?: string;
}

interface SecurityAudit {
  available?: boolean;
  ok?: boolean;
  generatedAt?: string;
  totalEvents?: number;
  latestEventType?: string;
  latestChainHash?: string;
  recentChain?: AuditChainEntry[];
}

interface SecurityPreflight {
  available?: boolean;
  ok?: boolean;
  generatedAt?: string;
}

interface SecurityAuthSource {
  source?: string;
  note?: string;
}

interface HostIdentityStatus {
  exists?: boolean;
}

interface SecurityStatus {
  needsAttention?: boolean;
  zavorthControlAuth?: SecurityAuthSource;
  mailboxSecret?: SecurityAuthSource;
  dbEncryption?: SecurityAuthSource;
  hostIdentity?: HostIdentityStatus;
  lastAudit?: SecurityAudit;
  lastPreflight?: SecurityPreflight;
}

interface ErrorEntry {
  level?: string;
  category?: string;
  message?: string;
  timestamp?: string;
}

interface OperationsErrors {
  recent?: ErrorEntry[];
}

interface OperationsHealthData {
  error?: string;
  docker?: DockerStatus;
  storage?: StorageStatus;
  publish?: PublishStatus;
  maintenance?: MaintenanceStatus;
  maintenanceAutomation?: MaintenanceAutomationStatus;
  nodeMeshSmoke?: NodeMeshSmokeStatus;
  channelProviderDoctor?: ChannelProviderDoctorStatus;
  remoteTransportDoctor?: RemoteTransportDoctorStatus;
  security?: SecurityStatus;
  errors?: OperationsErrors;
}

interface SidecarData {
  name?: string;
  enabled?: boolean;
  ready?: boolean;
  running?: boolean;
  localUrl?: string;
  baseUrl?: string;
  pid?: string;
  message?: string;
}

interface SidecarsData {
  AIGateway?: SidecarData;
  ZavorthTerminal?: SidecarData;
}

function zavorthControlClassicClientOverviewOperationsHost() {
    function renderOperationsHealth(operations: OperationsHealthData) {
      const node = document.getElementById('operations-health');
      if (!node) return;
      if (!operations || operations.error) {
        node.innerHTML = '<div class="muted">Nao foi possivel carregar saude operacional.</div>';
        return;
      }

      const docker: DockerStatus = operations.docker || {};
      const storage: StorageStatus = operations.storage || {};
      const publish: PublishStatus = operations.publish || {};
      const maintenance: MaintenanceStatus = operations.maintenance || {};
      const maintenanceAutomation: MaintenanceAutomationStatus = operations.maintenanceAutomation || {};
      const nodeMeshSmoke: NodeMeshSmokeStatus = operations.nodeMeshSmoke || {};
      const channelProviderDoctor: ChannelProviderDoctorStatus = operations.channelProviderDoctor || {};
      const remoteTransportDoctor: RemoteTransportDoctorStatus = operations.remoteTransportDoctor || {};
      const security: SecurityStatus = operations.security || {};
      const zavorthControlAuth: SecurityAuthSource = security.zavorthControlAuth || {};
      const mailboxSecret: SecurityAuthSource = security.mailboxSecret || {};
      const dbEncryption: SecurityAuthSource = security.dbEncryption || {};
      const hostIdentity: HostIdentityStatus = security.hostIdentity || {};
      const lastAudit: SecurityAudit = security.lastAudit || {};
      const lastPreflight: SecurityPreflight = security.lastPreflight || {};
      const errors: ErrorEntry[] = (operations.errors && operations.errors.recent) || [];
      const hotspots: StorageHotspot[] = storage.hotspots || [];
      const publishHistory: PublishHistoryEntry[] = publish.history || [];

      const dockerBadgeClass = docker.canRun ? 'badge-allowed' : (docker.required ? 'badge-blocked' : 'badge-warning');
      const dockerBadgeLabel = docker.canRun ? 'pronto' : (docker.required ? 'bloqueado' : 'degradado');
      const securityBadgeClass = security.needsAttention ? 'badge-warning' : 'badge-allowed';
      const securityBadgeLabel = security.needsAttention ? 'atencao' : 'ok';
      const publishPublishedAt = publish.publishedAt ? new Date(publish.publishedAt).toLocaleString() : 'Sem publish registrado';
      const publishSummary = publish.available
        ? '<small>' + escapeHtml(publishPublishedAt) + ' | ' + escapeHtml(formatRelativeTime(publish.publishedAt)) + '</small>'
        : '<small>Execute remote:publish para registrar o ultimo deploy.</small>';
      const maintenanceSummary = maintenance.available
        ? 'Ultima execucao ' + formatRelativeTime(maintenance.finishedAt || maintenance.startedAt) + ' | ' + String(maintenance.completedSteps || 0) + '/' + String(maintenance.stepCount || 0) + ' etapas'
        : 'Nenhuma manutencao consolidada registrada.';
      const maintenanceAutomationSummary = maintenanceAutomation.enabled
        ? 'Ativa | proxima janela ' + escapeHtml(formatRelativeTime(maintenanceAutomation.nextPlannedAt)) + ' | ultimo disparo ' + escapeHtml(formatRelativeTime(maintenanceAutomation.lastTriggeredAt))
        : 'Desativada neste host.';
      const maintenanceAutomationBadgeClass = maintenanceAutomation.enabled
        ? (maintenanceAutomation.lastTriggerSource === 'priority' ? 'badge-warning' : 'badge-allowed')
        : 'badge-warning';
      const maintenanceAutomationBadgeLabel = maintenanceAutomation.enabled
        ? (maintenanceAutomation.lastTriggerSource === 'priority' ? 'priorizada' : 'ativa')
        : 'off';
      const maintenanceAutomationPrioritySummary = maintenanceAutomation.lastTriggerSource === 'priority'
        ? '<small>Prioridade: ' + escapeHtml(String(maintenanceAutomation.lastPriorityReason || 'revalidacao operacional antecipada.')) + '</small>'
        : '';
      const nodeMeshSmokeBadgeClass = nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale
        ? 'badge-allowed'
        : (nodeMeshSmoke.status === 'failed' ? 'badge-blocked' : 'badge-warning');
      const nodeMeshSmokeBadgeLabel = nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale
        ? 'validado'
        : (nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale
          ? 'vencido'
          : (nodeMeshSmoke.status === 'failed' ? 'falhou' : (nodeMeshSmoke.status === 'running' ? 'rodando' : 'pendente')));
      const nodeMeshSmokeSummary = nodeMeshSmoke.summary
        ? escapeHtml(nodeMeshSmoke.summary)
        : (nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale
          ? 'Smoke real concluido com sucesso.'
          : (nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale
            ? 'Ultimo smoke real venceu e precisa ser renovado.'
            : (nodeMeshSmoke.status === 'failed'
              ? 'Ultimo smoke real falhou.'
              : 'Ainda sem smoke real recente.')));
      const channelProviderDoctorBadgeClass = channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale
        ? 'badge-allowed'
        : (channelProviderDoctor.status === 'failed' ? 'badge-blocked' : 'badge-warning');
      const channelProviderDoctorBadgeLabel = channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale
        ? 'validado'
        : (channelProviderDoctor.status === 'passed' && channelProviderDoctor.stale
          ? 'vencido'
          : (channelProviderDoctor.status === 'failed'
            ? 'falhou'
            : (channelProviderDoctor.status === 'skipped' ? 'pulado' : 'pendente')));
      const channelProviderDoctorSummary = channelProviderDoctor.summary
        ? escapeHtml(channelProviderDoctor.summary)
        : (channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale
          ? 'Doctor dos canais nativos validou os providers configurados.'
          : (channelProviderDoctor.status === 'passed' && channelProviderDoctor.stale
            ? 'Doctor dos canais nativos venceu e precisa ser renovado antes de ampliar o rollout.'
            : (channelProviderDoctor.status === 'failed'
              ? 'Doctor dos canais nativos encontrou pendencias em Slack native ou WhatsApp Cloud API.'
              : (channelProviderDoctor.status === 'skipped'
                ? 'Doctor dos canais nativos foi pulado porque nenhum provider real esta configurado.'
                : 'Doctor dos canais nativos ainda nao foi executado neste host.'))));
      const channelProviderDoctorItems = Array.isArray(channelProviderDoctor.items)
        ? channelProviderDoctor.items
          .map((item: ChannelProviderItem) => {
            const channelLabel = item.channelId === 'whatsapp'
              ? (item.mode === 'cloud-api' ? 'WhatsApp Cloud API' : (item.mode === 'baileys' ? 'WhatsApp Baileys' : 'WhatsApp'))
              : (item.mode === 'native' ? 'Slack native' : 'Slack');
            const statusLabel = item.status === 'passed'
              ? 'ok'
              : (item.status === 'failed' ? 'falhou' : 'pulado');
            return channelLabel + ': ' + statusLabel;
          })
          .join(' | ')
        : '';
      const remoteTransportDoctorBadgeClass = remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale
        ? 'badge-allowed'
        : (remoteTransportDoctor.status === 'failed' ? 'badge-blocked' : 'badge-warning');
      const remoteTransportDoctorBadgeLabel = remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale
        ? 'validado'
        : (remoteTransportDoctor.status === 'passed' && remoteTransportDoctor.stale
          ? 'vencido'
          : (remoteTransportDoctor.status === 'failed'
            ? 'falhou'
            : (remoteTransportDoctor.status === 'running'
              ? 'rodando'
              : (remoteTransportDoctor.status === 'skipped' ? 'pulado' : 'pendente'))));
      const remoteTransportDoctorSummary = remoteTransportDoctor.summary
        ? escapeHtml(remoteTransportDoctor.summary)
        : (remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale
          ? 'Doctor dos transportes remotos validou os fluxos configurados.'
          : (remoteTransportDoctor.status === 'passed' && remoteTransportDoctor.stale
            ? 'Doctor dos transportes remotos venceu e precisa ser renovado antes de confiar em sidecars, gateways e nodes pareados.'
            : (remoteTransportDoctor.status === 'failed'
              ? 'Doctor dos transportes remotos encontrou pendencias no plano remoto.'
              : (remoteTransportDoctor.status === 'running'
                ? 'Doctor dos transportes remotos em validacao neste momento.'
                : (remoteTransportDoctor.status === 'skipped'
                  ? 'Doctor dos transportes remotos foi pulado neste host.'
                  : 'Doctor dos transportes remotos ainda nao foi executado neste host.')))));
      const remoteTransportDoctorItems = Array.isArray(remoteTransportDoctor.items)
        ? remoteTransportDoctor.items
          .map((item: RemoteTransportItem) => {
            const transportLabel = item.transportId || item.id || 'transporte';
            const statusLabel = item.status === 'passed'
              ? 'ok'
              : (item.status === 'failed'
                ? 'falhou'
                : (item.status === 'running' ? 'rodando' : 'pulado'));
            return transportLabel + ': ' + statusLabel;
          })
          .join(' | ')
        : '';
      const auditSummary = lastAudit.available
        ? (lastAudit.ok ? 'Auditoria ok' : 'Auditoria com alertas') + ' | ' + formatRelativeTime(lastAudit.generatedAt)
        : 'Sem auditoria registrada';
      const auditTrailSummary = lastAudit.totalEvents
        ? 'Trilha: ' + String(lastAudit.totalEvents) + ' evento(s) | ultimo ' + String(lastAudit.latestEventType || 'n/d') + ' | hash ' + String(lastAudit.latestChainHash || '').slice(0, 10)
        : 'Trilha append-only ainda sem eventos.';
      const auditReplaySummary = Array.isArray(lastAudit.recentChain) && lastAudit.recentChain.length
        ? 'Replay: ' + lastAudit.recentChain
          .map((entry: AuditChainEntry) => String(entry.eventType || 'evento') + ' -> ' + String(entry.taskId || 'task'))
          .join(' | ')
        : 'Replay recente indisponivel.';
      const preflightSummary = lastPreflight.available
        ? (lastPreflight.ok ? 'Preflight ok' : 'Preflight com bloqueios') + ' | ' + formatRelativeTime(lastPreflight.generatedAt)
        : 'Sem preflight registrado';
      const publishHistoryItems = publishHistory.length
        ? publishHistory.map((entry: PublishHistoryEntry) =>
            '<div class="sidecar-card" style="padding:14px;">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">'
            + '<strong>' + escapeHtml(String(entry.commit || 'n/d').slice(0, 8)) + ' / ' + escapeHtml(entry.branch || 'n/d') + '</strong>'
            + '<span class="badge ' + (entry.sourceArchiveId ? 'badge-warning' : 'badge-allowed') + '">' + escapeHtml(entry.sourceArchiveId ? 'rollback' : 'publish') + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(entry.archiveId || 'sem snapshot') + ' | ' + escapeHtml(formatRelativeTime(entry.publishedAt)) + '</small>'
            + '<small>' + (entry.docsUrl ? '<a class="sidecar-link" href="' + escapeHtml(entry.docsUrl) + '" target="_blank">Docs</a>' : 'Docs indisponivel') + ' | ' + (entry.remoteConsoleUrl ? '<a class="sidecar-link" href="' + escapeHtml(entry.remoteConsoleUrl) + '" target="_blank">Console</a>' : 'Console indisponivel') + '</small>'
            + (entry.sourceArchiveId ? '<small>Origem: ' + escapeHtml(entry.sourceArchiveId) + '</small>' : '')
            + '</div>'
          ).join('')
        : '<div class="muted">Sem historico de publish ainda.</div>';
      const errorItems = errors.length
        ? errors.map((entry: ErrorEntry) =>
            '<div class="sidecar-card" style="padding:14px;">'
            + '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">'
            + '<strong>' + escapeHtml((entry.level || '').toUpperCase()) + ' / ' + escapeHtml(entry.category || 'system') + '</strong>'
            + '<span class="badge ' + ((entry.level === 'error' || entry.level === 'security') ? 'badge-blocked' : 'badge-warning') + '">' + escapeHtml(formatRelativeTime(entry.timestamp)) + '</span>'
            + '</div>'
            + '<small>' + escapeHtml(entry.message || 'Sem mensagem.') + '</small>'
            + '</div>'
          ).join('')
        : '<div class="muted">Sem erros ou alertas recentes relevantes.</div>';

      node.innerHTML =
        '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">'
        + '<div><strong>Saude operacional</strong><div class="muted" style="margin-top:6px;">Docker, publish, seguranca, disco e sinais recentes do runtime.</div></div>'
        + '<a class="sidecar-link" href="/api/operations/health" target="_blank">/api/operations/health</a>'
        + '</div>'
        + '<div class="sidecar-links">'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Docker sandbox</strong><span class="badge ' + dockerBadgeClass + '">' + escapeHtml(dockerBadgeLabel) + '</span></div>'
        + '<small>' + escapeHtml(docker.detail || 'Sem detalhe.') + '</small>'
        + '<small>JS: ' + escapeHtml((docker.languages && docker.languages.javascript && docker.languages.javascript.image) || 'n/d') + '</small>'
        + '<small>Python: ' + escapeHtml((docker.languages && docker.languages.python && docker.languages.python.image) || 'n/d') + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Ultimo publish</strong><span class="badge ' + (publish.available ? 'badge-allowed' : 'badge-warning') + '">' + (publish.available ? 'registrado' : 'pendente') + '</span></div>'
        + publishSummary
        + '<small>' + (publish.docsUrl ? '<a class="sidecar-link" href="' + escapeHtml(publish.docsUrl) + '" target="_blank">Docs</a>' : 'Docs indisponivel') + ' | ' + (publish.remoteConsoleUrl ? '<a class="sidecar-link" href="' + escapeHtml(publish.remoteConsoleUrl) + '" target="_blank">Console remoto</a>' : 'Console indisponivel') + '</small>'
        + '<small>Branch: ' + escapeHtml(publish.branch || 'n/d') + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Manutencao</strong><span class="badge ' + (maintenance.available && !maintenance.dryRun ? 'badge-allowed' : 'badge-warning') + '">' + escapeHtml(maintenance.available ? (maintenance.dryRun ? 'simulada' : 'registrada') : 'pendente') + '</span></div>'
        + '<small>' + escapeHtml(maintenanceSummary) + '</small>'
        + '<small>Soak: ' + (maintenance.withSoak ? 'sim' : 'nao') + ' | Publish: ' + (maintenance.withPublish ? 'sim' : 'nao') + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Automacao recorrente</strong><span class="badge ' + maintenanceAutomationBadgeClass + '">' + escapeHtml(maintenanceAutomationBadgeLabel) + '</span></div>'
        + '<small>' + maintenanceAutomationSummary + '</small>'
        + maintenanceAutomationPrioritySummary
        + '<small>Relatorio: ' + escapeHtml(formatRelativeTime(maintenanceAutomation.lastReportFinishedAt)) + ' | Steps: ' + escapeHtml(String(maintenanceAutomation.lastReportStepCount || 0)) + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Node Mesh smoke</strong><span class="badge ' + nodeMeshSmokeBadgeClass + '">' + escapeHtml(nodeMeshSmokeBadgeLabel) + '</span></div>'
        + '<small>' + nodeMeshSmokeSummary + '</small>'
        + '<small>Ultima checagem: ' + escapeHtml(formatRelativeTime(nodeMeshSmoke.checkedAt)) + ' | Invoke: ' + escapeHtml(String(nodeMeshSmoke.recentCapabilityId || 'n/d')) + '</small>'
        + '<small>Comando: ' + escapeHtml(String(nodeMeshSmoke.command || 'npm run test:nodes:smoke')) + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Doctor dos canais nativos</strong><span class="badge ' + channelProviderDoctorBadgeClass + '">' + escapeHtml(channelProviderDoctorBadgeLabel) + '</span></div>'
        + '<small>' + channelProviderDoctorSummary + '</small>'
        + '<small>Ultima checagem: ' + escapeHtml(formatRelativeTime(channelProviderDoctor.checkedAt)) + ' | Providers: ' + escapeHtml(channelProviderDoctorItems || 'n/d') + '</small>'
        + '<small>Comando: ' + escapeHtml(String(channelProviderDoctor.command || 'npm run test:channels:smoke')) + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Doctor dos transportes remotos</strong><span class="badge ' + remoteTransportDoctorBadgeClass + '">' + escapeHtml(remoteTransportDoctorBadgeLabel) + '</span></div>'
        + '<small>' + remoteTransportDoctorSummary + '</small>'
        + '<small>Ultima checagem: ' + escapeHtml(formatRelativeTime(remoteTransportDoctor.checkedAt)) + ' | Fluxos: ' + escapeHtml(remoteTransportDoctorItems || 'n/d') + '</small>'
        + '<small>Comando: ' + escapeHtml(String(remoteTransportDoctor.command || 'npm run test:transports:smoke')) + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Seguranca operacional</strong><span class="badge ' + securityBadgeClass + '">' + escapeHtml(securityBadgeLabel) + '</span></div>'
        + '<small>Web: ' + escapeHtml((zavorthControlAuth.source || 'missing')) + ' | Mailbox: ' + escapeHtml((mailboxSecret.source || 'missing')) + ' | DB: ' + escapeHtml((dbEncryption.source || 'missing')) + '</small>'
        + '<small>' + escapeHtml(zavorthControlAuth.note || 'Sem detalhe de autenticacao.') + '</small>'
        + '<small>' + escapeHtml(auditSummary) + ' | ' + escapeHtml(preflightSummary) + '</small>'
        + '<small>' + escapeHtml(auditTrailSummary) + '</small>'
        + '<small>' + escapeHtml(auditReplaySummary) + '</small>'
        + '<small>Host auth: ' + (hostIdentity.exists ? 'ok' : 'ausente') + '</small>'
        + '</div>'
        + '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Espaco em disco</strong><span class="badge ' + ((storage.freePercent || 0) >= 20 ? 'badge-allowed' : ((storage.freePercent || 0) >= 10 ? 'badge-warning' : 'badge-blocked')) + '">' + escapeHtml(String(storage.freePercent || 0)) + '% livre</span></div>'
        + '<small>' + escapeHtml(formatBytes(storage.freeBytes)) + ' livres de ' + escapeHtml(formatBytes(storage.totalBytes)) + '</small>'
        + '<small>' + hotspots.map((spot: StorageHotspot) => escapeHtml(spot.label + ': ' + formatBytes(spot.bytes))).join(' | ') + '</small>'
        + '</div>'
        + '</div>'
        + '<div style="margin-top:16px; display:grid; gap:12px;">'
        + '<strong>Historico recente de publish</strong>'
        + publishHistoryItems
        + '</div>'
        + '<div style="margin-top:16px; display:grid; gap:12px;">'
        + '<strong>Ultimos erros relevantes</strong>'
        + errorItems
        + '</div>';
    }

    function renderSidecars(sidecars: SidecarsData) {
      const node = document.getElementById('sidecar-links');
      if (!node) return;

      const cards: SidecarData[] = [sidecars.AIGateway, sidecars.ZavorthTerminal].filter(Boolean) as SidecarData[];
      if (!cards.length) {
        node.innerHTML = '<div class="muted">Nenhum sidecar monitorado.</div>';
        return;
      }

      node.innerHTML = '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">'
        + '<div><strong>Sidecars acoplados</strong><div class="muted" style="margin-top:6px;">Atalho rapido para o gateway AIGateway e o remoto do ZavorthBridge.</div></div>'
        + '<a class="sidecar-link" href="/api/sidecars" target="_blank">/api/sidecars</a>'
        + '</div>'
        + '<div class="sidecar-links">'
        + cards.map(renderSidecarCard).join('')
        + '</div>';
    }

    function renderSidecarCard(sidecar: SidecarData): string {
      const badgeClass = !sidecar.enabled ? 'badge-warning' : (sidecar.ready ? 'badge-allowed' : (sidecar.running ? 'badge-warning' : 'badge-blocked'));
      const badgeLabel = !sidecar.enabled ? 'desativado' : (sidecar.ready ? 'pronto' : (sidecar.running ? 'subindo' : 'offline'));
      const primaryUrl = sidecar.localUrl || sidecar.baseUrl || '';
      const urlBlock = primaryUrl
        ? '<a class="sidecar-link" href="' + escapeHtml(primaryUrl) + '" target="_blank">' + escapeHtml(primaryUrl) + '</a>'
        : '<span class="muted">Sem URL registrada.</span>';
      const notes: string[] = [];
      if (sidecar.baseUrl && sidecar.localUrl && sidecar.baseUrl !== sidecar.localUrl) {
        notes.push('Host: ' + escapeHtml(sidecar.baseUrl));
      }
      if (sidecar.pid) {
        notes.push('PID ' + escapeHtml(sidecar.pid));
      }
      if (sidecar.message) {
        notes.push(escapeHtml(sidecar.message));
      }

      return '<div class="sidecar-card">'
        + '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>' + escapeHtml(sidecar.name) + '</strong><span class="badge ' + badgeClass + '">' + escapeHtml(badgeLabel) + '</span></div>'
        + '<div>' + urlBlock + '</div>'
        + '<small>' + (notes.length ? notes.join(' | ') : 'Sem observacoes adicionais.') + '</small>'
        + '</div>';
    }
}

export function getZavorthControlClassicClientOverviewOperationsHostScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewOperationsHost);
}
