import type { ZavorthLayeredMemoryService } from '../services/ZavorthLayeredMemoryService.js';
import { CanonicalPublicApiService } from '../api/public/CanonicalPublicApiService.js';
import type { ZavorthCliFlags, ZavorthCliRuntime } from './ZavorthCliContract.js';
import type { RuntimeAccessReadinessReport } from '../runtime/access/RuntimeAccessReadinessService.js';
import type { RuntimeBootstrapReport } from '../runtime/access/RuntimeBootstrapService.js';
import type { RuntimeBootstrapRepairReport } from '../runtime/access/RuntimeBootstrapRepairService.js';
import type { ZavorthPlatformRegistrySnapshot, ZavorthPlatformRegistryStatusSummarySnapshot, ZavorthPlatformRegistrySummarySnapshot } from '../services/ZavorthPlatformRegistryService.js';
import type { ZavorthSessionPlaneSnapshot, ZavorthSessionPlaneStatusSummarySnapshot } from '../services/ZavorthSessionPlaneService.js';
import type { OperationsCockpitSnapshot } from '../services/OperationsCockpitService.js';
import type { OperationsActionExecution, OperationsActionService } from '../services/OperationsActionService.js';
import type { OperatorBriefSnapshot } from '../observability/OperatorBriefService.js';
import type { OpsQualityDTO } from '../contracts/public/rest/platform-ops-dto.js';
import type { SupervisedReloadRequestResult } from '../services/SupervisedRuntimeService.js';
import type { AutoRepairRunResult } from '../services/AutoRepairService.js';
import { formatCliValue, formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen } from './ZavorthCliVisualSystem.js';

type CliNodeMeshDoctorSnapshot = {
  checkedAt: string;
  status: string;
  summary: string | null;
  command: string;
  file: string | null;
  stale: boolean;
  nodeId: string | null;
  finalNodeStatus: string | null;
  recentCapabilityId: string | null;
  error: string | null;
  nextStep: {
    id: string;
    title: string;
  } | null;
};

type CliProviderModelSnapshot = {
  providerLabel: string;
  modelLabel: string;
  readiness: string;
  ready: boolean;
  source: string;
  explanation: string[];
} | null;

type CliOperationsDoctorSnapshot = {
  checkedAt: string;
  summary: string;
  local: {
    ready: boolean;
    appUrl: string | null;
    issues: string[];
  };
  remote: {
    ready: boolean;
    appUrl: string | null;
    issues: string[];
  };
  nodeMesh: CliNodeMeshDoctorSnapshot;
  channelProviders: {
    status: string;
    summary: string | null;
    stale: boolean;
    command: string;
    validated: number;
    total: number;
  };
  remoteTransports: {
    status: string;
    summary: string | null;
    stale: boolean;
    command: string;
    healthy: number;
    total: number;
    recommendedAction: string | null;
  };
  providers: CliProviderModelSnapshot;
  sessions: {
    total: number;
    historyItems: number;
    pendingPermissions: number;
    sendReady: boolean;
    spawnReady: boolean;
  } | null;
  nodeFleet: {
    total: number;
    paired: number;
    online: number;
    queued: number;
    staleQueued: number;
  } | null;
  integrations: {
    plugins: number;
    skills: number;
    mcps: number;
    collections: number;
    recipes: number;
    syncSummary: string | null;
  } | null;
  recommendations: string[];
  nextSteps: Array<{
    id?: string;
    title: string;
    description?: string | null;
    blocking?: boolean;
    command?: string | null;
  }>;
};

function formatLayeredMemoryMetrics(
  metrics: Awaited<ReturnType<ZavorthLayeredMemoryService['readMetrics']>>,
): string {
  return renderCliScreen({
    eyebrow: 'Memoria',
    eyebrowTone: metrics.summary.pressure === 'critical' ? 'danger' : metrics.summary.pressure === 'elevated' ? 'warning' : 'info',
    title: 'Metricas da memoria',
    summary: 'Panorama de pressao e distribuicao da layered memory.',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- entradas: ${formatCount(metrics.summary.totalEntries, 'entrada', 'entradas')} | episodica ${metrics.summary.episodic} | semantica ${metrics.summary.semantic} | procedural ${metrics.summary.procedural}`,
          `- uso medio do budget: ${metrics.summary.averageBudgetUsage} | pressao: ${metrics.summary.pressure}`,
          `- procedimentos: ${formatCount(metrics.procedures.total, 'total', 'total')} | ${metrics.procedures.trustedLocal} trusted local | ${metrics.procedures.learnedDraft} draft`,
        ],
        tone: metrics.summary.pressure === 'critical' ? 'danger' : metrics.summary.pressure === 'elevated' ? 'warning' : 'info',
      },
      {
        title: 'Faca agora',
        lines: ['- zavorth memory status', '- zavorth memory procedures'],
        tone: 'brand',
      },
    ],
  });
}

function readCliCockpitSnapshot(
  runtime: ZavorthCliRuntime,
  live: boolean,
): OperationsCockpitSnapshot | null {
  const service = runtime.operationsCockpitService;
  if (!service) {
    return null;
  }

  if (live && typeof service.readSnapshotLive === 'function') {
    return service.readSnapshotLive();
  }
  if (typeof service.readSnapshotFast === 'function') {
    return service.readSnapshotFast();
  }
  return service.readSnapshot();
}

function readCliBriefSnapshot(
  runtime: ZavorthCliRuntime,
  live: boolean,
  cockpit: OperationsCockpitSnapshot | null = null,
): OperatorBriefSnapshot | null {
  const service = runtime.operatorBriefService;
  if (!service) {
    return null;
  }

  if (cockpit && typeof service.readSnapshotFromCockpit === 'function') {
    return service.readSnapshotFromCockpit(cockpit);
  }
  if (live && typeof service.readSnapshotLive === 'function') {
    return service.readSnapshotLive();
  }
  if (typeof service.readSnapshotFast === 'function') {
    return service.readSnapshotFast();
  }
  return service.readSnapshot();
}

function buildCliNodeMeshDoctorSnapshot(report: RuntimeAccessReadinessReport): CliNodeMeshDoctorSnapshot {
  const nextStep = report.nextSteps.find((step) => step.id === 'validate-node-mesh-smoke') || null;
  return {
    checkedAt: report.checkedAt,
    status: report.runtime.nodeMeshSmoke.status,
    summary: report.runtime.nodeMeshSmoke.summary,
    command: report.runtime.nodeMeshSmoke.command,
    file: report.runtime.nodeMeshSmoke.file,
    stale: report.runtime.nodeMeshSmoke.stale,
    nodeId: report.runtime.nodeMeshSmoke.nodeId,
    finalNodeStatus: report.runtime.nodeMeshSmoke.finalNodeStatus,
    recentCapabilityId: report.runtime.nodeMeshSmoke.recentCapabilityId,
    error: report.runtime.nodeMeshSmoke.error,
    nextStep,
  };
}

function buildCliProviderModelSnapshot(report: RuntimeAccessReadinessReport): CliProviderModelSnapshot {
  const providers = report.runtime.providers;
  const selected = providers?.modelPicker?.selected || null;
  if (selected) {
    return {
      providerLabel: selected.providerLabel,
      modelLabel: selected.modelLabel,
      readiness: selected.readiness,
      ready: selected.ready,
      source: selected.source,
      explanation: [...selected.explanation],
    };
  }

  if (!providers?.activeProviderName && !providers?.activeModelName) {
    return null;
  }

  const ready = providers.readyProviders?.includes(providers.activeProviderName) === true;
  return {
    providerLabel: providers.activeProviderName || 'provider atual',
    modelLabel: providers.activeModelName || 'modelo atual',
    readiness: ready ? 'ready' : 'needs_config',
    ready,
    source: 'provider-snapshot',
    explanation: [`Provider readiness selecionou ${providers.activeProviderName}/${providers.activeModelName}.`],
  };
}

async function buildCliOperationsDoctorSnapshot(
  report: RuntimeAccessReadinessReport,
  runtime: ZavorthCliRuntime,
  flags: Pick<ZavorthCliFlags, 'userId' | 'platform'>,
): Promise<CliOperationsDoctorSnapshot> {
  const channelItems = report.runtime.channelProviderDoctor.items || [];
  const remoteItems = report.runtime.remoteTransportDoctor.items || [];
  const sessionSnapshot = runtime.sessionPlaneService
    ? await runtime.sessionPlaneService.buildSnapshot({
        userId: flags.userId,
        platform: flags.platform,
        chatId: null,
        sessionId: null,
        sourceUserId: null,
      })
    : null;
  const nodeSnapshot = runtime.nodeMeshService
    ? runtime.nodeMeshService.buildSnapshot()
    : null;
  const platform:
    | ZavorthPlatformRegistryStatusSummarySnapshot
    | ZavorthPlatformRegistrySummarySnapshot
    | ZavorthPlatformRegistrySnapshot
    | null = runtime.platformRegistryService
    ? ('buildFastStatusSummarySnapshot' in runtime.platformRegistryService
      && typeof (runtime.platformRegistryService as any).buildFastStatusSummarySnapshot === 'function'
        ? (runtime.platformRegistryService as any).buildFastStatusSummarySnapshot()
        : 'buildStatusSummarySnapshot' in runtime.platformRegistryService
      && typeof runtime.platformRegistryService.buildStatusSummarySnapshot === 'function'
        ? runtime.platformRegistryService.buildStatusSummarySnapshot()
        : 'buildSummarySnapshot' in runtime.platformRegistryService
          && typeof runtime.platformRegistryService.buildSummarySnapshot === 'function'
          ? runtime.platformRegistryService.buildSummarySnapshot()
          : runtime.platformRegistryService.buildSnapshot({}))
    : null;
  return {
    checkedAt: report.checkedAt,
    summary: report.summary,
    local: {
      ready: report.local.ready,
      appUrl: report.local.appUrl || null,
      issues: report.local.issues || [],
    },
    remote: {
      ready: report.remote.ready,
      appUrl: report.remote.appUrl || null,
      issues: report.remote.issues || [],
    },
    nodeMesh: buildCliNodeMeshDoctorSnapshot(report),
    channelProviders: {
      status: report.runtime.channelProviderDoctor.status,
      summary: report.runtime.channelProviderDoctor.summary,
      stale: report.runtime.channelProviderDoctor.stale,
      command: report.runtime.channelProviderDoctor.command,
      validated: channelItems.filter((entry) => entry.status === 'passed').length,
      total: channelItems.length,
    },
    remoteTransports: {
      status: report.runtime.remoteTransportDoctor.status,
      summary: report.runtime.remoteTransportDoctor.summary,
      stale: report.runtime.remoteTransportDoctor.stale,
      command: report.runtime.remoteTransportDoctor.command,
      healthy: remoteItems.filter((entry) => entry.status === 'passed').length,
      total: remoteItems.length,
      recommendedAction: report.runtime.remoteTransportDoctor.recommendedAction,
    },
    providers: buildCliProviderModelSnapshot(report),
    sessions: sessionSnapshot
      ? {
          total: sessionSnapshot.summary.sessions,
          historyItems: sessionSnapshot.summary.historyItems,
          pendingPermissions: Number((sessionSnapshot.summary as any).pendingPermissions || 0),
          sendReady: sessionSnapshot.summary.sendReady,
          spawnReady: sessionSnapshot.summary.spawnReady,
        }
      : null,
    nodeFleet: nodeSnapshot
      ? {
          total: nodeSnapshot.summary.total,
          paired: nodeSnapshot.summary.paired,
          online: nodeSnapshot.summary.online,
          queued: nodeSnapshot.summary.queued,
          staleQueued: Number(nodeSnapshot.summary.staleQueued || 0),
        }
      : null,
    integrations: platform
      ? {
          plugins: platform.summary.plugins,
          skills: platform.summary.skills,
          mcps: platform.summary.mcps,
          collections: Number(platform.summary.collections || 0),
          recipes: Number(platform.summary.recipes || 0),
          syncSummary: platform.catalogSync?.summary || null,
        }
      : null,
    recommendations: report.recommendations || [],
    nextSteps: report.nextSteps || [],
  };
}

function formatNodeMeshDoctorSnapshot(snapshot: CliNodeMeshDoctorSnapshot): string {
  return renderCliScreen({
    eyebrow: 'Nodes',
    eyebrowTone: snapshot.status === 'passed' ? 'success' : 'warning',
    title: 'Doctor do Node Mesh',
    summary: formatCliValue(snapshot.summary, 'Sem relatorio persistido ainda.'),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${snapshot.status}`,
          `- node: ${formatCliValue(snapshot.nodeId)}`,
          `- status final: ${formatCliValue(snapshot.finalNodeStatus)}`,
          `- capability recente: ${formatCliValue(snapshot.recentCapabilityId)}`,
          `- stale: ${snapshot.stale ? 'sim' : 'nao'}`,
          `- comando: ${snapshot.command}`,
        ],
        tone: snapshot.status === 'passed' ? 'success' : 'warning',
      },
      {
        title: 'Faca agora',
        lines: [
          snapshot.nextStep ? `- ${sanitizeHumanCliText(snapshot.nextStep.title)}` : null,
          snapshot.error ? `- erro: ${snapshot.error}` : null,
        ].filter(Boolean) as string[],
        tone: snapshot.error ? 'danger' : 'brand',
      },
    ],
  });
}

function appendUniqueDoctorLines(lines: string[], candidates: Array<string | null | undefined>, limit = 3): string[] {
  const seen = new Set(lines.map((line) => line.trim().toLowerCase()));
  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    lines.push(normalized);
    seen.add(key);
    if (lines.length >= limit) {
      break;
    }
  }
  return lines;
}

function compactRuntimeLine(value: string | null | undefined, maxLength = 150): string {
  const sanitized = sanitizeHumanCliText(value || '')
    .replace(/^Zavorth precisa de acao do operador agora\.?$/i, 'O Zavorth precisa da sua atencao agora.')
    .replace(/^Espaco livre:\s*([^|]+)\|\s*publish\s*(.+)$/i, 'Disco livre: $1 | ultima publicacao: $2')
    .replace(/(\d+)\s+alerta\(s\)/gi, (_match, count) => `${count} ${Number(count) === 1 ? 'alerta' : 'alertas'}`)
    .replace(/^Doctor dos canais nativos venceu\b.*validate-channel-providers\b.*$/i, 'Os canais de conversa pedem nova validacao; rode zavorth doctor antes de ampliar o rollout.')
    .replace(/^Doctor dos transportes remotos venceu\b.*validate-remote-transports\b.*$/i, 'As conexoes remotas pedem nova validacao; rode zavorth doctor antes de ampliar o rollout.')
    .replace(/^Nenhum transporte remoto elegivel para doctor neste (?:Zavorth|runtime)\.?$/i, 'A conexao remota ainda nao tem um caminho pronto para validar.')
    .replace(/^Postura de seguranca precisa de atencao\.?$/i, 'A seguranca basica precisa de atencao.')
    .replace(/^(\d+)\/(\d+) sidecars habilitados estao prontos\.?$/i, 'componentes locais: $1 de $2 prontos.')
    .replace(/^Existe sidecars? habilitado fora do estado pronto\b.*$/i, 'Alguns componentes locais ainda pedem reconciliacao segura.')
    .replace(/^Cockpit degradado:/i, 'Operacao degradada:')
    .replace(/^Cockpit saudavel:/i, 'Operacao saudavel:')
    .replace(/\bruntime\b/gi, 'Zavorth')
    .replace(/\bsidecars?\b/gi, 'componentes locais')
    .replace(/^Existe componentes locais habilitado fora do estado pronto\b.*$/i, 'Alguns componentes locais ainda pedem reconciliacao segura.')
    .replace(/\s+/g, ' ')
    .trim();
  if (!sanitized || sanitized.length <= maxLength) {
    return sanitized;
  }

  const sentenceMatch = sanitized.match(/^(.+?[.!?])\s+/);
  const firstSentence = sentenceMatch?.[1]?.trim();
  if (firstSentence && firstSentence.length >= 32 && firstSentence.length <= maxLength) {
    return firstSentence;
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function formatRuntimeDisplayCommand(command: string | null | undefined): string {
  const sanitized = sanitizeHumanCliText(command || '').trim();
  if (!sanitized) {
    return 'zavorth status';
  }

  if (/^zavorth ops run recover-sidecars$/i.test(sanitized)) {
    return 'zavorth go';
  }
  if (/^zavorth ops run validate-(node-mesh-smoke|channel-providers|remote-transports)$/i.test(sanitized)) {
    return 'zavorth doctor';
  }
  if (/^zavorth ops run security-preflight$/i.test(sanitized)) {
    return 'zavorth doctor';
  }

  return sanitized;
}

function formatRuntimeStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'healthy' || normalized === 'ready') {
    return 'pronto';
  }
  if (normalized === 'attention' || normalized === 'watch') {
    return 'pedindo atencao';
  }
  if (normalized === 'degraded') {
    return 'degradado';
  }
  if (normalized === 'critical' || normalized === 'blocked') {
    return 'critico';
  }
  return normalized || 'nao informado';
}

function formatRuntimeMemoryLabel(memoryLabel: string | null | undefined): string {
  const normalized = sanitizeHumanCliText(memoryLabel || '')
    .replace(/\s*RSS\b/i, ' em uso')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || 'nao informada';
}

function formatDoctorFreshness(stale: boolean): string {
  return stale ? ' (ultima validacao antiga)' : '';
}

function normalizeDoctorSummary(summary: string): string {
  const sanitized = sanitizeHumanCliText(summary).trim();
  if (!sanitized) {
    return 'O Zavorth encontrou pontos que ainda pedem sua atencao.';
  }

  if (sanitized.includes(':')) {
    const [headline] = sanitized.split(':');
    const trimmedHeadline = headline.trim();
    if (trimmedHeadline) {
      return /[.!?]$/.test(trimmedHeadline) ? trimmedHeadline : `${trimmedHeadline}.`;
    }
  }

  return sanitized;
}

function normalizeDoctorIssue(issue: string): string {
  const normalized = sanitizeHumanCliText(issue).trim();
  if (!normalized) {
    return normalized;
  }

  if (/host supervisor nao esta ativo/i.test(normalized)) {
    return 'O servico principal do Zavorth ainda nao subiu.';
  }

  if (/worker principal do Zavorth nao esta ativo/i.test(normalized)) {
    return 'O processo de trabalho do Zavorth ainda nao subiu.';
  }

  if (/host atual ainda nao foi autorizado|host nao foi autorizado|host atual nao foi autorizado/i.test(normalized)) {
    return 'Este computador ainda nao foi liberado para o Zavorth fazer mudancas locais.';
  }

  if (/nenhum provider conversacional esta pronto/i.test(normalized)) {
    return 'Nenhuma integracao de conversa esta pronta agora.';
  }

  return normalized;
}

function hasDoctorTrustGap(snapshot: CliOperationsDoctorSnapshot): boolean {
  const issueText = [...snapshot.local.issues, ...snapshot.remote.issues]
    .map((issue) => String(issue || ''))
    .join(' | ')
    .toLowerCase();

  return issueText.includes('autoriz') || issueText.includes('trust')
    || snapshot.nextSteps.some((step) => String(step.id || '').trim().toLowerCase() === 'trust-host');
}

function buildDoctorCurrentStateLines(snapshot: CliOperationsDoctorSnapshot): string[] {
  return [
    formatDoctorLocalStateLine(snapshot),
    formatDoctorRemoteStateLine(snapshot),
    formatDoctorModelStateLine(snapshot),
    formatDoctorConversationStateLine(snapshot),
    formatDoctorRemoteTransportStateLine(snapshot),
  ].filter(Boolean) as string[];
}

function formatDoctorLocalStateLine(snapshot: CliOperationsDoctorSnapshot): string {
  return snapshot.local.ready
    ? '- A entrada local ja esta pronta.'
    : '- A entrada local ainda nao esta pronta.';
}

function formatDoctorRemoteStateLine(snapshot: CliOperationsDoctorSnapshot): string {
  if (snapshot.remote.ready) {
    return '- O acesso remoto ja esta pronto.';
  }

  if (snapshot.remote.appUrl || snapshot.remoteTransports.total > 0) {
    return '- O acesso remoto esta parcialmente preparado.';
  }

  return '- O acesso remoto ainda nao esta pronto.';
}

function formatDoctorModelStateLine(snapshot: CliOperationsDoctorSnapshot): string | null {
  if (!snapshot.providers) {
    return null;
  }

  const provider = sanitizeHumanCliText(snapshot.providers.providerLabel);
  const model = sanitizeHumanCliText(snapshot.providers.modelLabel);
  const label = `${provider}/${model}`;
  if (snapshot.providers.ready) {
    return `- Modelo atual: ${label} pronto.`;
  }
  return `- Modelo atual: ${label} pede ${snapshot.providers.readiness}.`;
}

function formatDoctorConversationStateLine(snapshot: CliOperationsDoctorSnapshot): string {
  const freshness = formatDoctorFreshness(snapshot.channelProviders.stale);
  if (snapshot.channelProviders.total <= 0) {
    return `- Nenhum canal de conversa foi preparado ainda${freshness}.`;
  }

  if (snapshot.channelProviders.validated === snapshot.channelProviders.total) {
    return `- Os canais de conversa principais ja estao prontos${freshness}.`;
  }

  if (snapshot.channelProviders.validated > 0) {
    return `- Parte dos canais de conversa ja esta pronta${freshness}.`;
  }

  return `- Os canais de conversa ainda nao estao prontos${freshness}.`;
}

function formatDoctorRemoteTransportStateLine(snapshot: CliOperationsDoctorSnapshot): string {
  const freshness = formatDoctorFreshness(snapshot.remoteTransports.stale);
  if (snapshot.remoteTransports.total <= 0) {
    return `- Nenhuma conexao remota foi preparada ainda${freshness}.`;
  }

  if (snapshot.remoteTransports.healthy === snapshot.remoteTransports.total) {
    return `- As conexoes remotas principais ja estao prontas${freshness}.`;
  }

  if (snapshot.remoteTransports.healthy > 0) {
    return `- Parte das conexoes remotas ja esta pronta${freshness}.`;
  }

  return `- As conexoes remotas ainda nao estao prontas${freshness}.`;
}

function buildDoctorBlockerLines(snapshot: CliOperationsDoctorSnapshot): string[] {
  const blockers: string[] = [];
  appendUniqueDoctorLines(blockers, snapshot.local.issues.map((issue) => `- ${normalizeDoctorIssue(issue)}`), 4);
  appendUniqueDoctorLines(blockers, snapshot.remote.issues.map((issue) => `- ${normalizeDoctorIssue(issue)}`), 4);
  appendUniqueDoctorLines(
    blockers,
    snapshot.nextSteps
      .filter((step) => step.blocking)
      .map((step) => `- ${sanitizeHumanCliText(step.title)}`),
    4,
  );
  return blockers.length > 0 ? blockers.slice(0, 3) : ['* Sem bloqueios imediatos.'];
}

function mapDoctorStepToCanonicalCommand(stepId: string | null | undefined): string | null {
  switch (String(stepId || '').trim().toLowerCase()) {
    case 'start-supervised-host':
    case 'recover-web-surface':
    case 'recover-worker':
      return 'zavorth go';
    case 'trust-host':
      return null;
    case 'configure-primary-provider':
    case 'align-provider-default':
    case 'finish-tenant-onboarding':
    case 'configure-public-base-url':
    case 'secure-public-url':
    case 'configure-web-token':
      return 'zavorth setup';
    case 'connect-remote-frontend':
      return 'zavorth chat';
    default:
      return null;
  }
}

function inferDoctorActionFromIssues(snapshot: CliOperationsDoctorSnapshot): Array<string | null> {
  const issueText = [...snapshot.local.issues, ...snapshot.remote.issues].join(' | ').toLowerCase();
  const commands: Array<string | null> = [];
  if (/host supervisor|worker principal|supervisionado|prontidao web|surface|superficie web/.test(issueText)) {
    commands.push('zavorth go');
  }
  if (/token|provider|configur|onboarding|https/.test(issueText)) {
    commands.push('zavorth setup');
  }
  return commands;
}

function buildDoctorActionLines(snapshot: CliOperationsDoctorSnapshot): string[] {
  const actions: string[] = [];
  const addAction = (command: string | null | undefined) => {
    appendUniqueDoctorLines(actions, command ? [`- ${command}`] : [], 4);
  };

  snapshot.nextSteps
    .filter((step) => step.blocking)
    .forEach((step) => addAction(mapDoctorStepToCanonicalCommand(step.id)));
  snapshot.nextSteps.forEach((step) => addAction(mapDoctorStepToCanonicalCommand(step.id)));

  if (!snapshot.local.ready) {
    addAction('zavorth go');
  }

  inferDoctorActionFromIssues(snapshot).forEach((command) => addAction(command));

  if (
    snapshot.nextSteps.some((step) => [
      'configure-primary-provider',
      'align-provider-default',
      'finish-tenant-onboarding',
      'configure-public-base-url',
      'secure-public-url',
      'configure-web-token',
    ].includes(String(step.id || '').trim().toLowerCase()))
  ) {
    addAction('zavorth setup');
  }

  if (actions.length === 0) {
    if (snapshot.local.ready && snapshot.remote.ready) {
      addAction('zavorth chat');
      addAction('zavorth status');
    } else if (snapshot.local.ready) {
      addAction('zavorth status');
    } else {
      addAction('zavorth go');
    }
  } else if (actions.length === 1 && snapshot.local.ready) {
    addAction('zavorth status');
  }

  if (hasDoctorTrustGap(snapshot)) {
    appendUniqueDoctorLines(actions, ['- libere este computador para o Zavorth continuar.'], 4);
  }

  return actions.slice(0, 4);
}

function formatCliOperationsDoctorSnapshot(snapshot: CliOperationsDoctorSnapshot): string {
  return renderCliScreen({
    eyebrow: 'Diagnostico',
    eyebrowTone: 'warning',
    title: 'Diagnostico do Zavorth',
    summary: normalizeDoctorSummary(snapshot.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      { title: 'Agora', lines: buildDoctorCurrentStateLines(snapshot), tone: 'neutral' },
      { title: 'Bloqueando agora', lines: buildDoctorBlockerLines(snapshot), tone: 'danger' },
      { title: 'Faca agora', lines: buildDoctorActionLines(snapshot), tone: 'brand' },
    ],
  });
}

async function readCliOpsQualitySnapshot(
  runtime: ZavorthCliRuntime,
  flags: Pick<ZavorthCliFlags, 'live' | 'userId' | 'sessionId' | 'chatId' | 'workspaceHint'>,
): Promise<OpsQualityDTO | null> {
  if (!runtime.operationsHealthService) {
    return null;
  }

  const publicApi = new CanonicalPublicApiService({
    getRuntime: () => ({}) as any,
    getGateway: () => runtime.gatewayService as any,
    getSessionPlane: () => runtime.sessionPlaneService as any,
    getNodeMesh: () => runtime.nodeMeshService as any,
    getPlatformRegistry: () => runtime.platformRegistryService as any,
    getRemoteTransports: () => null,
    getOperationsHealth: () => runtime.operationsHealthService as any,
    getLearningPlane: () => runtime.learningPlaneService as any,
    getLayeredMemory: () => runtime.layeredMemoryService as any,
  });

  return await publicApi.readOpsQuality({
    mode: flags.live ? 'live' : 'fast',
    userId: flags.userId,
    sessionId: flags.sessionId,
    chatId: flags.chatId,
    workspaceHint: flags.workspaceHint,
  });
}

function formatCliOpsQualitySnapshot(snapshot: OpsQualityDTO): string {
  return renderCliScreen({
    eyebrow: 'Ops quality',
    eyebrowTone: snapshot.healthy ? 'success' : 'warning',
    title: 'Ops quality do Zavorth',
    summary: snapshot.healthy
      ? `Gate ${snapshot.gate.state} com score ${snapshot.score}.`
      : `Gate ${snapshot.gate.state} com score ${snapshot.score} ainda pedindo atencao.`,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- promove: ${snapshot.gate.allowsPromotion ? 'sim' : 'nao'} | publica: ${snapshot.gate.allowsPublishing ? 'sim' : 'nao'}`,
          `- recovery ${snapshot.summary.recoveryState} | learning pendente ${snapshot.summary.learningPending} | quarentena ${snapshot.summary.quarantinedItems} | memoria ${snapshot.summary.memoryPressure}`,
          `- operations: uptime ${snapshot.operations.uptime}s | db ${snapshot.operations.components.database} | eventBus ${snapshot.operations.components.eventBus}`,
          `- learning: candidatos ${snapshot.learning.totalCandidates} | score medio ${snapshot.learning.averageScore} | promovidos ${snapshot.learning.promotedRate}`,
          `- memory: entradas ${snapshot.memory.totalEntries} | uso medio ${snapshot.memory.averageBudgetUsage} | pressao ${snapshot.memory.pressure}`,
          `- platform: trusted ${snapshot.platform.trusted} | review ${snapshot.platform.reviewPending} | learned local ${snapshot.platform.learnedLocal} | quarantined ${snapshot.platform.quarantined}`,
        ],
        tone: snapshot.healthy ? 'success' : 'warning',
      },
      {
        title: 'Pontos em foco',
        lines: [
          snapshot.gate.blockers[0] ? `- blocker principal: ${snapshot.gate.blockers[0]}` : null,
          snapshot.gate.warnings[0] ? `- warning principal: ${snapshot.gate.warnings[0]}` : null,
          snapshot.gate.nextStep ? `- proximo passo: ${snapshot.gate.nextStep}` : null,
        ].filter(Boolean) as string[],
        tone: snapshot.gate.blockers[0] ? 'danger' : 'muted',
      },
    ],
  });
}

function withCliConsoleSuppressed<T>(fn: () => T): T {
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    return fn();
  } finally {
    console.log = originalLog;
  }
}

async function buildCliRuntimeAccessProbeInput(runtime: ZavorthCliRuntime): Promise<Record<string, unknown>> {
  const input: Record<string, unknown> = {};
  if (runtime.learningPlaneService) {
    input.learning = runtime.learningPlaneService.buildSnapshot();
  }
  if (runtime.layeredMemoryService) {
    input.layeredMemory = await runtime.layeredMemoryService.buildStatus();
  }
  if (runtime.platformRegistryService) {
    input.platform = 'buildStatusSummarySnapshot' in runtime.platformRegistryService
      && typeof (runtime.platformRegistryService as any).buildStatusSummarySnapshot === 'function'
        ? (runtime.platformRegistryService as any).buildStatusSummarySnapshot()
        : 'buildSummarySnapshot' in runtime.platformRegistryService
          && typeof runtime.platformRegistryService.buildSummarySnapshot === 'function'
          ? runtime.platformRegistryService.buildSummarySnapshot()
          : runtime.platformRegistryService.buildSnapshot({});
  }
  return input;
}

function formatRuntimeAccessReadinessReport(report: RuntimeAccessReadinessReport): string {
  const selectedModel = buildCliProviderModelSnapshot(report);
  return renderCliScreen({
    eyebrow: 'Acesso',
    eyebrowTone: report.local.ready && report.remote.ready ? 'success' : 'warning',
    title: 'Access readiness do Zavorth',
    summary: sanitizeHumanCliText(report.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- local: ${report.local.ready ? 'pronto' : 'pendente'} | remoto: ${report.remote.ready ? 'pronto' : 'pendente'}`,
          `- base local: ${report.local.baseUrl}`,
          selectedModel ? `- modelo: ${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})` : null,
          report.recommendations[0] ? `- recomendacao: ${report.recommendations[0]}` : '- recomendacao: nenhuma',
        ].filter(Boolean) as string[],
        tone: report.local.ready && report.remote.ready ? 'success' : 'warning',
      },
    ],
  });
}

function formatRuntimeBootstrapReport(report: RuntimeBootstrapReport): string {
  const selectedModel = report.env.selectedModel;
  const providerLine = selectedModel
    ? `${selectedModel.providerLabel}/${selectedModel.modelLabel} (${selectedModel.readiness})`
    : report.env.llmProvider;
  return renderCliScreen({
    eyebrow: 'Bootstrap',
    eyebrowTone: report.dependencies.installRequired || report.dependencies.buildRequired ? 'warning' : 'success',
    title: 'Bootstrap do Zavorth',
    summary: sanitizeHumanCliText(report.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- projeto: ${report.projectRoot}`,
          `- .env: ${report.env.envFilePresent ? 'presente' : 'ausente'} | provider: ${providerLine}`,
          `- install: ${report.dependencies.installRequired ? 'pendente' : 'ok'} | build: ${report.dependencies.buildRequired ? 'pendente' : 'ok'}`,
        ],
        tone: report.dependencies.installRequired || report.dependencies.buildRequired ? 'warning' : 'success',
      },
      {
        title: 'Faca agora',
        lines: [report.actions[0] ? `- ${report.actions[0].title} (${report.actions[0].command})` : '- nenhuma acao imediata sugerida'],
        tone: 'brand',
      },
    ],
  });
}

function formatRuntimeBootstrapRepairReport(report: RuntimeBootstrapRepairReport): string {
  const executed = report.steps.filter((step) => step.status === 'executed').length;
  const failed = report.steps.filter((step) => step.status === 'failed').length;
  const skipped = report.steps.filter((step) => step.status === 'skipped').length;
  return renderCliScreen({
    eyebrow: 'Bootstrap repair',
    eyebrowTone: failed > 0 ? 'warning' : 'info',
    title: 'Bootstrap repair do Zavorth',
    summary: sanitizeHumanCliText(report.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- dry-run: ${report.dryRun ? 'sim' : 'nao'}`,
          `- etapas: ${report.steps.length} | executadas: ${executed} | falhas: ${failed} | puladas: ${skipped}`,
        ],
        tone: failed > 0 ? 'warning' : 'info',
      },
    ],
  });
}

function formatSupervisedReloadResult(result: SupervisedReloadRequestResult): string {
  return renderCliScreen({
    eyebrow: 'Reload',
    eyebrowTone: result.accepted ? 'success' : 'warning',
    title: 'Reload supervisionado do Zavorth',
    summary: sanitizeHumanCliText(result.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${result.accepted ? 'aceito' : 'recusado'}`,
          `- request: ${result.requestId}`,
        ],
        tone: result.accepted ? 'success' : 'warning',
      },
    ],
  });
}

function formatAutoRepairRunResult(result: AutoRepairRunResult): string {
  return renderCliScreen({
    eyebrow: 'Autorepair',
    eyebrowTone: result.success ? 'success' : 'warning',
    title: 'Autorepair do Zavorth',
    summary: sanitizeHumanCliText(result.summary),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${result.status}`,
          `- sucesso: ${result.success ? 'sim' : 'nao'}`,
        ],
        tone: result.success ? 'success' : 'warning',
      },
    ],
  });
}

function formatOperationsCockpitSnapshot(snapshot: OperationsCockpitSnapshot): string {
  const topAction = snapshot.actions[0] || null;
  const topAlert = snapshot.alerts[0] || null;
  const cockpitTone = snapshot.status === 'healthy' ? 'success' : snapshot.status === 'degraded' ? 'warning' : 'danger';
  const readySidecars = Number(snapshot.summary.readySidecars || 0);
  const enabledSidecars = Number(snapshot.summary.enabledSidecars || 0);
  const localHealthLine = enabledSidecars > 0
    ? `> componentes locais: ${readySidecars} de ${enabledSidecars} prontos; erros recentes: ${snapshot.summary.recentErrorCount}`
    : `> componentes locais: nenhum ativo; erros recentes: ${snapshot.summary.recentErrorCount}`;
  return renderCliScreen({
    eyebrow: 'Ops',
    eyebrowTone: cockpitTone,
    title: 'Operacao do Zavorth',
    summary: compactRuntimeLine(snapshot.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `${snapshot.status === 'healthy' ? '*' : '!'} estado: ${formatRuntimeStatusLabel(snapshot.status)}`,
          `> ambiente: ${snapshot.runtime.platformLabel} | ligado ha ${snapshot.runtime.uptimeLabel}`,
          `> memoria: ${formatRuntimeMemoryLabel(snapshot.runtime.memoryLabel)}`,
          localHealthLine,
        ],
        tone: cockpitTone,
      },
      {
        title: 'Em foco',
        lines: [
          `* ${compactRuntimeLine(snapshot.highlights[0] || 'Nenhum destaque operacional agora.')}`,
          topAlert ? `! alerta: ${compactRuntimeLine(topAlert.title)}` : '* sem alerta principal',
          topAction
            ? `> proximo passo: ${compactRuntimeLine(topAction.label, 80)} (${formatRuntimeDisplayCommand(topAction.command)})`
            : '> proximo passo: nenhum agora',
        ],
        tone: topAlert ? 'warning' : 'muted',
      },
    ],
  });
}

function formatOperatorBriefSnapshot(snapshot: OperatorBriefSnapshot): string {
  const postureTone =
    snapshot.posture === 'stable'
      ? 'success'
      : snapshot.posture === 'watch'
        ? 'warning'
        : 'danger';
  return renderCliScreen({
    eyebrow: 'Brief',
    eyebrowTone: postureTone,
    title: 'Briefing do operador',
    summary: compactRuntimeLine(snapshot.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: snapshot.highlights.slice(0, 2).map((highlight) => `${postureTone === 'success' ? '*' : '!'} ${compactRuntimeLine(highlight)}`),
        tone: postureTone,
      },
      {
        title: 'Faca agora',
        lines: [
          `> ${compactRuntimeLine(snapshot.nextAction.label, 90)}`,
          `> ${formatRuntimeDisplayCommand(snapshot.nextAction.command)}`,
          `porque: ${compactRuntimeLine(snapshot.nextAction.reason)}`,
        ],
        tone: 'brand',
      },
      {
        title: 'Se quiser detalhes',
        lines: [
          snapshot.channelProviderDoctor ? `> conversa: ${compactRuntimeLine(snapshot.channelProviderDoctor.summary)}` : null,
          snapshot.remoteTransportDoctor ? `> remoto: ${compactRuntimeLine(snapshot.remoteTransportDoctor.summary)}` : null,
          snapshot.maintenanceAutomation ? `> automacao: ${compactRuntimeLine(snapshot.maintenanceAutomation.summary)}` : null,
        ].filter(Boolean).slice(0, 2) as string[],
        tone: 'muted',
      },
    ],
  });
}

function formatOperationsActionDefinitions(
  definitions: ReturnType<OperationsActionService['listDefinitions']>,
): string {
  return renderCliScreen({
    eyebrow: 'Ops',
    eyebrowTone: 'info',
    title: 'Acoes operacionais do Zavorth',
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Catalogo',
        lines: definitions.map((definition) =>
          `- ${definition.id}: ${definition.label} [${definition.priority}] -> ${definition.command} ${definition.args.join(' ')}`),
        tone: 'info',
      },
    ],
  });
}

function formatOperationsActionExecution(execution: OperationsActionExecution): string {
  return renderCliScreen({
    eyebrow: 'Ops',
    eyebrowTone: execution.status === 'started' ? 'success' : 'danger',
    title: 'Acao operacional do Zavorth',
    summary: execution.label,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: [
          `- status: ${execution.status}`,
          `- comando: ${execution.command}`,
          `- pid: ${formatCliValue(execution.pid ? String(execution.pid) : null)}`,
          `- log: ${execution.logFile}`,
          execution.note ? `- nota: ${execution.note}` : null,
        ].filter(Boolean) as string[],
        tone: execution.status === 'started' ? 'success' : 'danger',
      },
    ],
  });
}

export {
  buildCliNodeMeshDoctorSnapshot,
  buildCliOperationsDoctorSnapshot,
  buildCliRuntimeAccessProbeInput,
  formatAutoRepairRunResult,
  formatCliOperationsDoctorSnapshot,
  formatCliOpsQualitySnapshot,
  formatLayeredMemoryMetrics,
  formatNodeMeshDoctorSnapshot,
  formatOperationsActionDefinitions,
  formatOperationsActionExecution,
  formatOperationsCockpitSnapshot,
  formatOperatorBriefSnapshot,
  formatRuntimeAccessReadinessReport,
  formatRuntimeBootstrapRepairReport,
  formatRuntimeBootstrapReport,
  formatSupervisedReloadResult,
  readCliBriefSnapshot,
  readCliCockpitSnapshot,
  readCliOpsQualitySnapshot,
  withCliConsoleSuppressed,
};
