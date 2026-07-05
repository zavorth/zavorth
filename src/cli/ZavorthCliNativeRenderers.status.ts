import type { ZavorthPlatformRegistrySnapshot, ZavorthPlatformRegistryStatusSummarySnapshot, ZavorthPlatformRegistrySummarySnapshot } from '../services/ZavorthPlatformRegistryService.js';
import type { ZavorthSessionPlaneSnapshot, ZavorthSessionPlaneStatusSummarySnapshot } from '../services/ZavorthSessionPlaneService.js';
import type { ZavorthCliFlags, ZavorthCliRuntime } from './ZavorthCliContract.js';
import type { CliDomainsSnapshot, CliStatusSnapshot } from './ZavorthCliSurfaceHelpers.js';
import { readCliBriefSnapshot, readCliCockpitSnapshot } from './ZavorthCliNativeRenderers.runtime.js';
import { formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen } from './ZavorthCliVisualSystem.js';

function buildCliDomainsSnapshot(
  runtime: ZavorthCliRuntime,
  includeDetails = false,
): CliDomainsSnapshot | null {
  const gateway = runtime.gatewayService;
  if (!gateway) {
    return null;
  }

  if (includeDetails && typeof gateway.buildDomainSnapshot === 'function') {
    const snapshot = gateway.buildDomainSnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      domains: Object.values(snapshot.domains).map((entry) => ({
        id: entry.id,
        label: entry.label,
        initialized: entry.initialized,
        initializedAt: entry.initializedAt,
        summary: entry.summary,
        metrics: entry.metrics,
      })),
    };
  }

  if (typeof gateway.buildDomainSummarySnapshot === 'function') {
    const snapshot = gateway.buildDomainSummarySnapshot();
    return {
      generatedAt: snapshot.generatedAt,
      summary: snapshot.summary,
      domains: snapshot.domains.map((entry) => ({
        id: entry.id,
        label: entry.label,
        initialized: entry.initialized,
        initializedAt: entry.initializedAt,
      })),
    };
  }

  return null;
}

function formatCliDomainsSnapshot(snapshot: CliDomainsSnapshot): string {
  const headline = snapshot.summary.pending > 0
    ? `Ainda ha ${formatCount(snapshot.summary.pending, 'dominio', 'dominios')} needs attention.`
    : 'Todos os dominios principais estao inicializados.';
  return renderCliScreen({
    eyebrow: 'Dominios',
    eyebrowTone: snapshot.summary.pending > 0 ? 'warning' : 'success',
    title: 'Dominios do Zavorth',
    summary: headline,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Agora',
        lines: [
          `- inicializados: ${snapshot.summary.initialized}/${snapshot.summary.total}`,
          `- pendings: ${snapshot.summary.pending}`,
        ],
        tone: snapshot.summary.pending > 0 ? 'warning' : 'success',
      },
      {
        title: 'Mapa',
        lines: snapshot.domains.map((entry) =>
          `- ${entry.label}: ${entry.initialized ? 'ready' : 'pending'}`
          + (entry.summary ? ` | ${entry.summary}` : '')
        ),
        tone: 'neutral',
      },
    ],
  });
}

function normalizeStatusActionCommand(command: string | null | undefined): string {
  const normalized = String(command || '').trim();
  if (!normalized) {
    return 'zavorth status';
  }

  const lower = normalized.toLowerCase();
  if (lower === 'npm run ops:maintain') {
    return 'zavorth ops run recover-sidecars';
  }
  if (lower === 'npm run security:preflight') {
    return 'zavorth ops run security-preflight';
  }
  if (lower === 'npm run remote:publish') {
    return 'zavorth ops run remote-publish';
  }
  if (lower === 'npm run test:nodes:smoke') {
    return 'zavorth ops run validate-node-mesh-smoke';
  }
  if (lower === 'npm run test:channels:smoke') {
    return 'zavorth ops run validate-channel-providers';
  }
  if (lower === 'npm run test:transports:smoke') {
    return 'zavorth ops run validate-remote-transports';
  }

  return normalized;
}

function normalizeStatusHeadline(headline: string | null | undefined): string {
  const sanitized = sanitizeHumanCliText(headline || '').trim();
  if (!sanitized) {
    return 'Zavorth ready for use.';
  }

  return sanitized
    .replace(/acao do operador/gi, 'sua atencao')
    .replace(/runtime/gi, 'Zavorth');
}

function normalizeStatusAttentionItem(item: string): string {
  const normalized = sanitizeHumanCliText(item).trim();
  if (!normalized) {
    return normalized;
  }

  if (/remote transports are not ready yet/i.test(normalized)) {
    return 'The remote connection is not ready yet.';
  }

  if (/transport remoto recomenda:/i.test(normalized)) {
    return normalized.replace(/^Transporte remoto recomenda:/i, 'Para liberar o acesso remoto:');
  }

  if (/sidecar habilitado fora do estado ready/i.test(normalized)) {
    return 'Existe um componente local pedindo reconciliacao segura.';
  }

  if (/security posture needs attention/i.test(normalized)) {
    return 'Basic security still needs attention.';
  }

  if (/no remote transport eligible for doctor/i.test(normalized)) {
    return 'The remote connection does not have a ready validation path yet.';
  }

  return normalized
    .replace(/\bruntime\b/gi, 'Zavorth')
    .replace(/\bnodes\b/gi, 'dispositivos');
}

function normalizeStatusActionLabel(label: string | null | undefined): string | null {
  const normalized = sanitizeHumanCliText(label || '').trim();
  if (!normalized) {
    return 'Siga o passo principal sugerido.';
  }

  if (/reconciliar runtime local/i.test(normalized)) {
    return 'Reconciliar o Zavorth local';
  }

  return normalized.replace(/\bruntime\b/gi, 'Zavorth');
}

function isAdvancedStatusCommand(command: string | null | undefined): boolean {
  const normalized = String(command || '').trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.startsWith('zavorth ops ')
    || normalized.startsWith('npm run ')
    || normalized.startsWith('/')
    || normalized.includes('validate-')
    || normalized.includes('recover-')
    || normalized.includes('security-preflight')
    || normalized.includes('remote-publish');
}

function resolveStatusPrimaryAction(
  snapshot: CliStatusSnapshot,
  attentionItems: string[],
): {
  label: string;
  command: string | null;
} {
  const normalizedCommand = snapshot.nextAction
    ? normalizeStatusActionCommand(snapshot.nextAction.command)
    : null;
  const normalizedLabel = snapshot.nextAction
    ? normalizeStatusActionLabel(snapshot.nextAction.label)
    : null;

  if (normalizedCommand && !isAdvancedStatusCommand(normalizedCommand)) {
    return {
      label: normalizedLabel || 'Siga o passo principal sugerido.',
      command: normalizedCommand,
    };
  }

  if (attentionItems.length > 0) {
    return {
      label: 'Tentar recuperar a entrada principal do Zavorth',
      command: 'zavorth go',
    };
  }

  if (normalizedCommand) {
    return {
      label: 'Abrir o diagnostico principal',
      command: 'zavorth doctor',
    };
  }

  return {
    label: 'Nenhuma acao imediata sugerida.',
    command: null,
  };
}

function formatStatusRuntimeLine(snapshot: CliStatusSnapshot): string {
  if (!snapshot.gateway) {
    return '- Zavorth could not build a service snapshot yet.';
  }

  const { channelsReady, channelsTotal, runtimeModesReady, securityPosture } = snapshot.gateway;
  const readiness = channelsTotal > 0 && channelsReady === channelsTotal && runtimeModesReady > 0
    ? 'ready'
    : channelsReady > 0 || runtimeModesReady > 0
      ? 'partial'
      : 'pending';
  void securityPosture;

  switch (readiness) {
    case 'ready':
      return '- Zavorth is ready to use.';
    case 'partial':
      return '- Zavorth is partially ready to use.';
    default:
      return '- Zavorth is not ready to use yet.';
  }
}

function formatStatusConversationLine(snapshot: CliStatusSnapshot): string {
  if (!snapshot.sessions) {
    return '- The conversation cannot be evaluated in this snapshot yet.';
  }

  const readiness = snapshot.sessions.sendReady && snapshot.sessions.spawnReady
    ? 'pronta para continuar e abrir novas sessions'
    : snapshot.sessions.sendReady || snapshot.sessions.spawnReady
      ? 'partial'
      : 'ainda limitada';

  if (readiness === 'pronta para continuar e abrir novas sessions') {
    return '- The conversation is ready to continue.';
  }

  if (readiness === 'partial') {
    return '- The conversation is partially ready.';
  }

  return '- The conversation is still limited.';
}

function formatStatusDomainsLine(snapshot: CliStatusSnapshot): string | null {
  if (!snapshot.domains) {
    return null;
  }

  if (snapshot.domains.pending === 0) {
    return '- Os recursos principais ja estao carregados.';
  }

  return '- Alguns recursos principais ainda pedem atencao.';
}

function formatStatusNodesLine(snapshot: CliStatusSnapshot): string | null {
  if (!snapshot.nodes) {
    return null;
  }

  if (snapshot.nodes.total === 0) {
    return null;
  }

  if (snapshot.nodes.online === snapshot.nodes.total) {
    return `- ${snapshot.nodes.total} dispositivo${snapshot.nodes.total === 1 ? '' : 's'} conectado${snapshot.nodes.total === 1 ? '' : 's'} now.`;
  }

  return `- ${snapshot.nodes.online}/${snapshot.nodes.total} dispositivos estao online now.`;
}

function formatStatusCatalogLine(snapshot: CliStatusSnapshot): string | null {
  if (!snapshot.platform) {
    return null;
  }

  if (snapshot.platform.plugins <= 0) {
    return null;
  }

  return '- As integracoes principais ja foram carregadas.';
}

function buildStatusAttentionItems(snapshot: CliStatusSnapshot): string[] {
  const items = new Set<string>();

  if (snapshot.cockpit?.topAlert) {
    items.add(normalizeStatusAttentionItem(snapshot.cockpit.topAlert));
  }

  if (snapshot.transports) {
    if (snapshot.transports.total === 0 || snapshot.transports.status !== 'passed') {
      items.add(normalizeStatusAttentionItem(
        snapshot.transports.summary
          ? snapshot.transports.summary
          : 'Remote transports are not ready yet.',
      ));
    }
  }

  if (snapshot.sessions?.pendingPermissions) {
    items.add(`${formatCount(snapshot.sessions.pendingPermissions, 'pending approval', 'pending approvals')} now.`);
  }

  if (snapshot.nodes && snapshot.nodes.staleQueued > 0) {
    items.add(`${formatCount(snapshot.nodes.staleQueued, 'item antigo esperando em dispositivos', 'itens antigos esperando em dispositivos')}.`);
  }

  return Array.from(items);
}

function buildStatusSummaryLines(snapshot: CliStatusSnapshot, attentionItems: string[]): string[] {
  const lines: Array<string | null> = [
    formatStatusRuntimeLine(snapshot),
    formatStatusConversationLine(snapshot),
    ...attentionItems.slice(0, 2).map((item) => `- ${item}`),
  ];

  if (attentionItems.length === 0) {
    lines.push('- Nenhum bloqueio imediato apareceu neste retrato.');
  }

  if (lines.filter(Boolean).length < 4) {
    const domainsLine = formatStatusDomainsLine(snapshot);
    if (snapshot.domains?.pending && domainsLine) {
      lines.push(domainsLine);
    }
  }

  if (lines.filter(Boolean).length < 4) {
    const nodesLine = formatStatusNodesLine(snapshot);
    if (snapshot.nodes?.total && nodesLine) {
      lines.push(nodesLine);
    }
  }

  if (lines.filter(Boolean).length < 4) {
    lines.push(formatStatusCatalogLine(snapshot));
  }

  return lines.filter((entry): entry is string => Boolean(entry)).slice(0, 4);
}

async function buildCliStatusSnapshot(
  runtime: ZavorthCliRuntime,
  flags: Pick<ZavorthCliFlags, 'userId' | 'chatId' | 'sessionId' | 'platform' | 'live'>,
): Promise<CliStatusSnapshot> {
  const cockpit = runtime.operationsCockpitService
    ? readCliCockpitSnapshot(runtime, flags.live)
    : null;
  const brief = runtime.operatorBriefService
    ? readCliBriefSnapshot(runtime, flags.live, cockpit)
    : null;
  const gateway = runtime.gatewayService
    ? ('buildSnapshot' in runtime.gatewayService && typeof runtime.gatewayService.buildSnapshot === 'function'
      ? runtime.gatewayService.buildSnapshot({
          userId: flags.userId,
          chatId: null,
          sessionId: null,
        })
      : await runtime.gatewayService.buildHydratedSnapshot({
          userId: flags.userId,
          chatId: null,
          sessionId: null,
        }))
    : null;
  const domains = buildCliDomainsSnapshot(runtime);
  const platform:
    | ZavorthPlatformRegistryStatusSummarySnapshot
    | ZavorthPlatformRegistrySummarySnapshot
    | ZavorthPlatformRegistrySnapshot
    | null = runtime.platformRegistryService
    ? ('buildFastStatusSummarySnapshot' in runtime.platformRegistryService
      && typeof (runtime.platformRegistryService as unknown as { buildFastStatusSummarySnapshot: () => ZavorthPlatformRegistryStatusSummarySnapshot }).buildFastStatusSummarySnapshot === 'function'
        ? (runtime.platformRegistryService as unknown as { buildFastStatusSummarySnapshot: () => ZavorthPlatformRegistryStatusSummarySnapshot }).buildFastStatusSummarySnapshot()
        : 'buildStatusSummarySnapshot' in runtime.platformRegistryService
      && typeof runtime.platformRegistryService.buildStatusSummarySnapshot === 'function'
        ? runtime.platformRegistryService.buildStatusSummarySnapshot()
        : 'buildSummarySnapshot' in runtime.platformRegistryService
          && typeof runtime.platformRegistryService.buildSummarySnapshot === 'function'
          ? runtime.platformRegistryService.buildSummarySnapshot()
          : runtime.platformRegistryService.buildSnapshot({}))
    : null;
  const sessions: ZavorthSessionPlaneSnapshot | ZavorthSessionPlaneStatusSummarySnapshot | null = runtime.sessionPlaneService
    ? ('buildStatusSummary' in runtime.sessionPlaneService && typeof runtime.sessionPlaneService.buildStatusSummary === 'function'
      ? await (runtime.sessionPlaneService as unknown as {
          buildStatusSummary: (input: {
            userId?: string | null;
            platform?: string | null;
            chatId?: string | null;
            sessionId?: string | null;
            sourceUserId?: string | null;
          }) => Promise<ZavorthSessionPlaneStatusSummarySnapshot>;
        }).buildStatusSummary({
          userId: flags.userId,
          platform: flags.platform,
          chatId: flags.chatId || null,
          sessionId: flags.sessionId || null,
          sourceUserId: null,
        })
      : await runtime.sessionPlaneService.buildSnapshot({
          userId: flags.userId,
          platform: flags.platform,
          chatId: null,
          sessionId: null,
          sourceUserId: null,
        }))
    : null;
  const nodes = runtime.nodeMeshService
    ? runtime.nodeMeshService.buildSnapshot()
    : null;
  const remoteTransportDoctor = cockpit?.operations?.remoteTransportDoctor || null;
  const remoteTransportItems = Array.isArray(remoteTransportDoctor?.items) ? remoteTransportDoctor.items : [];

  return {
    generatedAt: new Date().toISOString(),
    headline:
      brief?.headline
      || cockpit?.headline
      || gateway?.narrative?.headline
      || 'Zavorth ready for use.',
    nextAction: brief
      ? {
          label: brief.nextAction.label,
          command: brief.nextAction.command,
          reason: brief.nextAction.reason,
        }
      : null,
    brief: brief
      ? {
          posture: brief.posture,
          headline: brief.headline,
        }
      : null,
    cockpit: cockpit
      ? {
          status: cockpit.status,
          headline: cockpit.headline,
          topAlert: cockpit.alerts[0]?.title || null,
        }
      : null,
    gateway: gateway
      ? {
          channelsReady: gateway.summary.channelsReady,
          channelsTotal: gateway.summary.channelsTotal,
          runtimeModesReady: gateway.summary.runtimeModesReady,
          securityPosture: gateway.summary.securityPosture,
        }
      : null,
    domains: domains
      ? {
          total: domains.summary.total,
          initialized: domains.summary.initialized,
          pending: domains.summary.pending,
        }
      : null,
    platform: platform
      ? {
          plugins: platform.summary.plugins,
          skills: platform.summary.skills,
          mcps: platform.summary.mcps,
          collections: Number(platform.summary.collections || 0),
          recipes: Number(platform.summary.recipes || 0),
          syncSummary: platform.catalogSync?.summary || null,
        }
      : null,
    sessions: sessions
      ? {
          total: sessions.summary.sessions,
          historyItems: sessions.summary.historyItems,
          pendingPermissions: Number((sessions.summary as Record<string, unknown>).pendingPermissions || 0),
          sendReady: sessions.summary.sendReady,
          spawnReady: sessions.summary.spawnReady,
        }
      : null,
    nodes: nodes
      ? {
          total: nodes.summary.total,
          paired: nodes.summary.paired,
          online: nodes.summary.online,
          queued: nodes.summary.queued,
          staleQueued: Number(nodes.summary.staleQueued || 0),
        }
      : null,
    transports: remoteTransportDoctor
      ? {
          status: remoteTransportDoctor.status,
          healthy: remoteTransportItems.filter((entry) => entry.status === 'passed').length,
          total: remoteTransportItems.length,
          stale: Boolean(remoteTransportDoctor.stale),
          summary: remoteTransportDoctor.summary || null,
          recommendedAction: remoteTransportDoctor.recommendedAction || null,
        }
      : null,
  };
}

function formatCliStatusSnapshot(snapshot: CliStatusSnapshot): string {
  const attentionItems = buildStatusAttentionItems(snapshot);
  const primaryAction = resolveStatusPrimaryAction(snapshot, attentionItems);
  const summaryLines = buildStatusSummaryLines(snapshot, attentionItems);
  const actionLines = [
    `> ${primaryAction.label}`,
    ...(primaryAction.command ? [`> ${primaryAction.command}`] : []),
    '? se quiser detalhes: zavorth doctor',
  ];

  return renderCliScreen({
    eyebrow: 'Status rapido',
    eyebrowTone: attentionItems.length > 0 ? 'warning' : 'success',
    title: 'Status do Zavorth',
    summary: normalizeStatusHeadline(snapshot.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Em resumo',
        lines: summaryLines,
        tone: attentionItems.length > 0 ? 'warning' : 'success',
      },
      {
        title: 'Faca agora',
        lines: actionLines,
        tone: 'brand',
      },
    ],
  });
}

export {
  buildCliDomainsSnapshot,
  buildCliStatusSnapshot,
  formatCliDomainsSnapshot,
  formatCliStatusSnapshot,
};
