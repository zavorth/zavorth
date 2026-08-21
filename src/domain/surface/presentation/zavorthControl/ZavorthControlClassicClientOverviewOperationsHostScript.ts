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
      node.innerHTML = '<div class="muted">Could not load operational health.</div>';
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

    const dockerBadgeClass = docker.canRun ? 'badge-allowed' : docker.required ? 'badge-blocked' : 'badge-warning';
    const dockerBadgeLabel = docker.canRun ? 'ready' : docker.required ? 'blocked' : 'degradado';
    const securityBadgeClass = security.needsAttention ? 'badge-warning' : 'badge-allowed';
    const securityBadgeLabel = security.needsAttention ? 'attention' : 'ok';
    const publishPublishedAt = publish.publishedAt
      ? new Date(publish.publishedAt).toLocaleString()
      : 'No publish registered';
    const publishSummary = publish.available ? '<small>' +
        escapeHtml(publishPublishedAt) +
        ' | ' +
        escapeHtml(formatRelativeTime(publish.publishedAt)) +
        '</small>'
      : '<small>Run remote:publish to register the latest deploy.</small>';
    const maintenanceSummary = maintenance.available ? 'Last run ' +
        formatRelativeTime(maintenance.finishedAt || maintenance.startedAt) +
        ' | ' +
        String(maintenance.completedSteps || 0) +
        '/' +
        String(maintenance.stepCount || 0) +
        ' steps'
      : 'No maintenance consolidada registrada.';
    const maintenanceAutomationSummary = maintenanceAutomation.enabled ? 'Active | next window ' +
        escapeHtml(formatRelativeTime(maintenanceAutomation.nextPlannedAt)) +
        ' | last trigger ' +
        escapeHtml(formatRelativeTime(maintenanceAutomation.lastTriggeredAt))
      : 'Desactiveda on this host.';
    const maintenanceAutomationBadgeClass = maintenanceAutomation.enabled
      ? maintenanceAutomation.lastTriggerSource === 'priority'
        ? 'badge-warning'
        : 'badge-allowed'
      : 'badge-warning';
    const maintenanceAutomationBadgeLabel = maintenanceAutomation.enabled
      ? maintenanceAutomation.lastTriggerSource === 'priority'
        ? 'priorizada'
        : 'active'
      : 'off';
    const maintenanceAutomationPrioritySummary =
      maintenanceAutomation.lastTriggerSource === 'priority'
        ? '<small>Priority: ' +
          escapeHtml(String(maintenanceAutomation.lastPriorityReason || 'early operational revalidation.')) +
          '</small>'
        : '';
    const nodeMeshSmokeBadgeClass =
      nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale ? 'badge-allowed'
        : nodeMeshSmoke.status === 'failed'
          ? 'badge-blocked'
          : 'badge-warning';
    const nodeMeshSmokeBadgeLabel =
      nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale ? 'validated'
        : nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale ? 'vencido'
          : nodeMeshSmoke.status === 'failed'
            ? 'failed'
            : nodeMeshSmoke.status === 'running'
              ? 'running'
              : 'pending';
    const nodeMeshSmokeSummary = nodeMeshSmoke.summary
      ? escapeHtml(nodeMeshSmoke.summary)
      : nodeMeshSmoke.status === 'passed' && !nodeMeshSmoke.stale ? 'Real smoke completed successfully.'
        : nodeMeshSmoke.status === 'passed' && nodeMeshSmoke.stale ? 'Last real smoke expired and needs renewal.'
          : nodeMeshSmoke.status === 'failed'
            ? 'Last real smoke failed.'
            : 'No recent real smoke yet.';
    const channelProviderDoctorBadgeClass =
      channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale ? 'badge-allowed'
        : channelProviderDoctor.status === 'failed'
          ? 'badge-blocked'
          : 'badge-warning';
    const channelProviderDoctorBadgeLabel =
      channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale ? 'validated'
        : channelProviderDoctor.status === 'passed' && channelProviderDoctor.stale ? 'vencido'
          : channelProviderDoctor.status === 'failed'
            ? 'failed'
            : channelProviderDoctor.status === 'skipped'
              ? 'skipped'
              : 'pending';
    const channelProviderDoctorSummary = channelProviderDoctor.summary
      ? escapeHtml(channelProviderDoctor.summary)
      : channelProviderDoctor.status === 'passed' && !channelProviderDoctor.stale ? 'Native channel doctor validated configured providers.'
        : channelProviderDoctor.status === 'passed' && channelProviderDoctor.stale ? 'Native channel doctor expired and needs renewal before expanding rollout.'
          : channelProviderDoctor.status === 'failed'
            ? 'Native channel doctor found pending items in Slack native or WhatsApp Cloud API.'
            : channelProviderDoctor.status === 'skipped'
              ? 'Native channel doctor was skipped because no real provider is configured.'
              : 'Native channel doctor has not run on this host yet.';
    const channelProviderDoctorItems = Array.isArray(channelProviderDoctor.items)
      ? channelProviderDoctor.items
          .map((item: ChannelProviderItem) => {
            const channelLabel =
              item.channelId === 'whatsapp'
                ? item.mode === 'cloud-api'
                  ? 'WhatsApp Cloud API'
                  : item.mode === 'baileys'
                    ? 'WhatsApp Baileys'
                    : 'WhatsApp'
                : item.mode === 'native'
                  ? 'Slack native'
                  : 'Slack';
            const statusLabel = item.status === 'passed' ? 'ok' : item.status === 'failed' ? 'failed' : 'skipped';
            return channelLabel + ': ' + statusLabel;
          })
          .join(' | ')
      : '';
    const remoteTransportDoctorBadgeClass =
      remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale ? 'badge-allowed'
        : remoteTransportDoctor.status === 'failed'
          ? 'badge-blocked'
          : 'badge-warning';
    const remoteTransportDoctorBadgeLabel =
      remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale ? 'validated'
        : remoteTransportDoctor.status === 'passed' && remoteTransportDoctor.stale ? 'vencido'
          : remoteTransportDoctor.status === 'failed'
            ? 'failed'
            : remoteTransportDoctor.status === 'running'
              ? 'running'
              : remoteTransportDoctor.status === 'skipped'
                ? 'skipped'
                : 'pending';
    const remoteTransportDoctorSummary = remoteTransportDoctor.summary
      ? escapeHtml(remoteTransportDoctor.summary)
      : remoteTransportDoctor.status === 'passed' && !remoteTransportDoctor.stale ? 'Remote transport doctor validated the configured flows.'
        : remoteTransportDoctor.status === 'passed' && remoteTransportDoctor.stale ? 'Remote transport doctor expired and must be renewed before trusting sidecars, gateways, and paired nodes.'
          : remoteTransportDoctor.status === 'failed'
            ? 'The remote transports doctor found pending items in the remote plan.'
            : remoteTransportDoctor.status === 'running'
              ? 'Remote transport doctor is validating right now.'
              : remoteTransportDoctor.status === 'skipped'
                ? 'The remote transports doctor was skipped on this host.'
                : 'The remote transports doctor has not been executed on this host yet.';
    const remoteTransportDoctorItems = Array.isArray(remoteTransportDoctor.items)
      ? remoteTransportDoctor.items
          .map((item: RemoteTransportItem) => {
            const transportLabel = item.transportId || item.id || 'transport';
            const statusLabel =
              item.status === 'passed'
                ? 'ok'
                : item.status === 'failed'
                  ? 'failed'
                  : item.status === 'running'
                    ? 'running'
                    : 'skipped';
            return transportLabel + ': ' + statusLabel;
          })
          .join(' | ')
      : '';
    const auditSummary = lastAudit.available
      ? (lastAudit.ok ? 'Audit ok' : 'Audit with alerts') + ' | ' + formatRelativeTime(lastAudit.generatedAt)
      : 'No audit registered';
    const auditTrailSummary = lastAudit.totalEvents ? 'Trail: ' +
        String(lastAudit.totalEvents) +
        ' event(s) | last ' +
        String(lastAudit.latestEventType || 'n/a') +
        ' | hash ' +
        String(lastAudit.latestChainHash || '').slice(0, 10)
      : 'Append-only trail still has no events.';
    const auditReplaySummary =
      Array.isArray(lastAudit.recentChain) && lastAudit.recentChain.length ? 'Replay: ' +
          lastAudit.recentChain
            .map(
              (entry: AuditChainEntry) => String(entry.eventType || 'event') + ' -> ' + String(entry.taskId || 'task'),
            )
            .join(' | ')
        : 'Recent replay unavailable.';
    const preflightSummary = lastPreflight.available
      ? (lastPreflight.ok ? 'Preflight ok' : 'Preflight with blocks') +
        ' | ' +
        formatRelativeTime(lastPreflight.generatedAt)
      : 'No preflight registered';
    const publishHistoryItems = publishHistory.length
      ? publishHistory
          .map(
            (entry: PublishHistoryEntry) =>
              '<div class="sidecar-card" style="padding:14px;">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
              '<strong>' +
              escapeHtml(String(entry.commit || 'n/a').slice(0, 8)) +
              ' / ' +
              escapeHtml(entry.branch || 'n/a') +
              '</strong>' +
              '<span class="badge ' +
              (entry.sourceArchiveId ? 'badge-warning' : 'badge-allowed') +
              '">' +
              escapeHtml(entry.sourceArchiveId ? 'rollback' : 'publish') +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.archiveId || 'without snapshot') +
              ' | ' +
              escapeHtml(formatRelativeTime(entry.publishedAt)) +
              '</small>' +
              '<small>' +
              (entry.docsUrl ? '<a class="sidecar-link" href="' + escapeHtml(entry.docsUrl) + '" target="_blank">Docs</a>'
                : 'Docs unavailable') +
              ' | ' +
              (entry.remoteConsoleUrl ? '<a class="sidecar-link" href="' +
                  escapeHtml(entry.remoteConsoleUrl) +
                  '" target="_blank">Console</a>'
                : 'Console unavailable') +
              '</small>' +
              (entry.sourceArchiveId ? '<small>Source: ' + escapeHtml(entry.sourceArchiveId) + '</small>' : '') +
              '</div>',
          )
          .join('')
      : '<div class="muted">No publish history yet.</div>';
    const errorItems = errors.length
      ? errors
          .map(
            (entry: ErrorEntry) =>
              '<div class="sidecar-card" style="padding:14px;">' +
              '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">' +
              '<strong>' +
              escapeHtml((entry.level || '').toUpperCase()) +
              ' / ' +
              escapeHtml(entry.category || 'system') +
              '</strong>' +
              '<span class="badge ' +
              (entry.level === 'error' || entry.level === 'security' ? 'badge-blocked' : 'badge-warning') +
              '">' +
              escapeHtml(formatRelativeTime(entry.timestamp)) +
              '</span>' +
              '</div>' +
              '<small>' +
              escapeHtml(entry.message || 'No message.') +
              '</small>' +
              '</div>',
          )
          .join('')
      : '<div class="muted">No relevant recent errors or alerts.</div>';

    node.innerHTML =
      '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">' +
      '<div><strong>Operational health</strong><div class="muted" style="margin-top:6px;">Docker, publish, security, disk, and recent runtime signals.</div></div>' +
      '<a class="sidecar-link" href="/api/operations/health" target="_blank">/api/operations/health</a>' +
      '</div>' +
      '<div class="sidecar-links">' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Docker sandbox</strong><span class="badge ' +
      dockerBadgeClass +
      '">' +
      escapeHtml(dockerBadgeLabel) +
      '</span></div>' +
      '<small>' +
      escapeHtml(docker.detail || 'No detail.') +
      '</small>' +
      '<small>JS: ' +
      escapeHtml((docker.languages && docker.languages.javascript && docker.languages.javascript.image) || 'n/a') +
      '</small>' +
      '<small>Python: ' +
      escapeHtml((docker.languages && docker.languages.python && docker.languages.python.image) || 'n/a') +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Latest publish</strong><span class="badge ' +
      (publish.available ? 'badge-allowed' : 'badge-warning') +
      '">' +
      (publish.available ? 'registrado' : 'pending') +
      '</span></div>' +
      publishSummary +
      '<small>' +
      (publish.docsUrl ? '<a class="sidecar-link" href="' + escapeHtml(publish.docsUrl) + '" target="_blank">Docs</a>'
        : 'Docs unavailable') +
      ' | ' +
      (publish.remoteConsoleUrl ? '<a class="sidecar-link" href="' +
          escapeHtml(publish.remoteConsoleUrl) +
          '" target="_blank">Remote console</a>'
        : 'Console unavailable') +
      '</small>' +
      '<small>Branch: ' +
      escapeHtml(publish.branch || 'n/a') +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>maintenance</strong><span class="badge ' +
      (maintenance.available && !maintenance.dryRun ? 'badge-allowed' : 'badge-warning') +
      '">' +
      escapeHtml(maintenance.available ? (maintenance.dryRun ? 'preview' : 'registered') : 'pending') +
      '</span></div>' +
      '<small>' +
      escapeHtml(maintenanceSummary) +
      '</small>' +
      '<small>Soak: ' +
      (maintenance.withSoak ? 'yes' : 'no') +
      ' | Publish: ' +
      (maintenance.withPublish ? 'yes' : 'no') +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Recurring automation</strong><span class="badge ' +
      maintenanceAutomationBadgeClass +
      '">' +
      escapeHtml(maintenanceAutomationBadgeLabel) +
      '</span></div>' +
      '<small>' +
      maintenanceAutomationSummary +
      '</small>' +
      maintenanceAutomationPrioritySummary +
      '<small>Report: ' +
      escapeHtml(formatRelativeTime(maintenanceAutomation.lastReportFinishedAt)) +
      ' | Steps: ' +
      escapeHtml(String(maintenanceAutomation.lastReportStepCount || 0)) +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Node Mesh smoke</strong><span class="badge ' +
      nodeMeshSmokeBadgeClass +
      '">' +
      escapeHtml(nodeMeshSmokeBadgeLabel) +
      '</span></div>' +
      '<small>' +
      nodeMeshSmokeSummary +
      '</small>' +
      '<small>Last check: ' +
      escapeHtml(formatRelativeTime(nodeMeshSmoke.checkedAt)) +
      ' | Invoke: ' +
      escapeHtml(String(nodeMeshSmoke.recentCapabilityId || 'n/a')) +
      '</small>' +
      '<small>Command: ' +
      escapeHtml(String(nodeMeshSmoke.command || 'npm run test:nodes:smoke')) +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Native channel doctor</strong><span class="badge ' +
      channelProviderDoctorBadgeClass +
      '">' +
      escapeHtml(channelProviderDoctorBadgeLabel) +
      '</span></div>' +
      '<small>' +
      channelProviderDoctorSummary +
      '</small>' +
      '<small>Last check: ' +
      escapeHtml(formatRelativeTime(channelProviderDoctor.checkedAt)) +
      ' | Providers: ' +
      escapeHtml(channelProviderDoctorItems || 'n/a') +
      '</small>' +
      '<small>Command: ' +
      escapeHtml(String(channelProviderDoctor.command || 'npm run test:channels:smoke')) +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Doctor dos remote transports</strong><span class="badge ' +
      remoteTransportDoctorBadgeClass +
      '">' +
      escapeHtml(remoteTransportDoctorBadgeLabel) +
      '</span></div>' +
      '<small>' +
      remoteTransportDoctorSummary +
      '</small>' +
      '<small>Last check: ' +
      escapeHtml(formatRelativeTime(remoteTransportDoctor.checkedAt)) +
      ' | Flows: ' +
      escapeHtml(remoteTransportDoctorItems || 'n/a') +
      '</small>' +
      '<small>Command: ' +
      escapeHtml(String(remoteTransportDoctor.command || 'npm run test:transports:smoke')) +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Operational safety</strong><span class="badge ' +
      securityBadgeClass +
      '">' +
      escapeHtml(securityBadgeLabel) +
      '</span></div>' +
      '<small>Web: ' +
      escapeHtml(zavorthControlAuth.source || 'missing') +
      ' | Mailbox: ' +
      escapeHtml(mailboxSecret.source || 'missing') +
      ' | DB: ' +
      escapeHtml(dbEncryption.source || 'missing') +
      '</small>' +
      '<small>' +
      escapeHtml(zavorthControlAuth.note || 'No authentication detail.') +
      '</small>' +
      '<small>' +
      escapeHtml(auditSummary) +
      ' | ' +
      escapeHtml(preflightSummary) +
      '</small>' +
      '<small>' +
      escapeHtml(auditTrailSummary) +
      '</small>' +
      '<small>' +
      escapeHtml(auditReplaySummary) +
      '</small>' +
      '<small>Host auth: ' +
      (hostIdentity.exists ? 'ok' : 'missing') +
      '</small>' +
      '</div>' +
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>Espaco em disco</strong><span class="badge ' +
      ((storage.freePercent || 0) >= 20
        ? 'badge-allowed'
        : (storage.freePercent || 0) >= 10
          ? 'badge-warning'
          : 'badge-blocked') +
      '">' +
      escapeHtml(String(storage.freePercent || 0)) +
      '% livre</span></div>' +
      '<small>' +
      escapeHtml(formatBytes(storage.freeBytes)) +
      ' livres de ' +
      escapeHtml(formatBytes(storage.totalBytes)) +
      '</small>' +
      '<small>' +
      hotspots.map((spot: StorageHotspot) => escapeHtml(spot.label + ': ' + formatBytes(spot.bytes))).join(' | ') +
      '</small>' +
      '</div>' +
      '</div>' +
      '<div style="margin-top:16px; display:grid; gap:12px;">' +
      '<strong>Historico recente de publish</strong>' +
      publishHistoryItems +
      '</div>' +
      '<div style="margin-top:16px; display:grid; gap:12px;">' +
      '<strong>Latest relevant errors</strong>' +
      errorItems +
      '</div>';
  }

  function renderSidecars(sidecars: SidecarsData) {
    const node = document.getElementById('sidecar-links');
    if (!node) return;

    const cards: SidecarData[] = [sidecars.AIGateway, sidecars.ZavorthTerminal].filter(Boolean) as SidecarData[];
    if (!cards.length) {
      node.innerHTML = '<div class="muted">No monitored sidecars.</div>';
      return;
    }

    node.innerHTML =
      '<div style="display:flex; justify-content:space-between; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap;">' +
      '<div><strong>Attached sidecars</strong><div class="muted" style="margin-top:6px;">Quick shortcut to the AIGateway gateway and ZavorthBridge remote.</div></div>' +
      '<a class="sidecar-link" href="/api/sidecars" target="_blank">/api/sidecars</a>' +
      '</div>' +
      '<div class="sidecar-links">' +
      cards.map(renderSidecarCard).join('') +
      '</div>';
  }

  function renderSidecarCard(sidecar: SidecarData): string {
    const badgeClass = !sidecar.enabled ? 'badge-warning'
      : sidecar.ready ? 'badge-allowed'
        : sidecar.running ? 'badge-warning'
          : 'badge-blocked';
    const badgeLabel = !sidecar.enabled ? 'disabled'
      : sidecar.ready ? 'ready'
        : sidecar.running ? 'starting'
          : 'offline';
    const primaryUrl = sidecar.localUrl || sidecar.baseUrl || '';
    const urlBlock = primaryUrl ? '<a class="sidecar-link" href="' +
        escapeHtml(primaryUrl) +
        '" target="_blank">' +
        escapeHtml(primaryUrl) +
        '</a>'
      : '<span class="muted">No URL registered.</span>';
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

    return (
      '<div class="sidecar-card">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center;"><strong>' +
      escapeHtml(sidecar.name) +
      '</strong><span class="badge ' +
      badgeClass +
      '">' +
      escapeHtml(badgeLabel) +
      '</span></div>' +
      '<div>' +
      urlBlock +
      '</div>' +
      '<small>' +
      (notes.length ? notes.join(' | ') : 'No additional notes.') +
      '</small>' +
      '</div>'
    );
  }
}

export function getZavorthControlClassicClientOverviewOperationsHostScript(): string {
  return extractFunctionBody(zavorthControlClassicClientOverviewOperationsHost);
}
