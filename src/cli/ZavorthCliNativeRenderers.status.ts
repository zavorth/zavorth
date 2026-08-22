import type { ZavorthPlatformRegistrySnapshot, ZavorthPlatformRegistryStatusSummarySnapshot, ZavorthPlatformRegistrySummarySnapshot } from '../services/ZavorthPlatformRegistryService.js';
import type { ZavorthSessionPlaneSnapshot, ZavorthSessionPlaneStatusSummarySnapshot } from '../services/ZavorthSessionPlaneService.js';
import type { ZavorthCliFlags, ZavorthCliRuntime } from './ZavorthCliContract.js';
import type { CliDomainsSnapshot, CliStatusSnapshot } from './ZavorthCliSurfaceHelpers.js';
import { readCliBriefSnapshot, readCliCockpitSnapshot } from './ZavorthCliNativeRenderers.runtime.js';
import { formatCount, sanitizeHumanCliText } from './ZavorthCliText.js';
import { renderCliScreen } from './ZavorthCliVisualSystem.js';
import { config } from '../config/index.js';
import { getI18nService } from '../i18n/ZavorthI18nService.js';

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
    ? `There are still ${formatCount(snapshot.summary.pending, 'domain', 'domains')} needs attention.`
    : 'All primary domains are initialized.';
  return renderCliScreen({
    eyebrow: 'Domains',
    eyebrowTone: snapshot.summary.pending > 0 ? 'warning' : 'success',
    title: 'Zavorth domains',
    summary: headline,
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: 'Now',
        lines: [
          `- initialized: ${snapshot.summary.initialized}/${snapshot.summary.total}`,
          `- pending: ${snapshot.summary.pending}`,
        ],
        tone: snapshot.summary.pending > 0 ? 'warning' : 'success',
      },
      {
        title: 'Map',
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
    .replace(/action do operador/gi, 'your attention')
    .replace(/runtime/gi, 'Zavorth');
}

function normalizeStatusAttentionItem(item: string): string {
  const normalized = sanitizeHumanCliText(item).trim();
  if (!normalized) {
    return normalized;
  }

  const lower = normalized.toLowerCase();
  if (lower.includes('remote transports are not ready yet')) {
    return 'The remote connection is not ready yet.';
  }

  if (lower.includes('security posture needs attention')) {
    return 'Basic security still needs attention.';
  }

  if (lower.includes('no remote transport eligible for doctor')) {
    return 'The remote connection does not have a ready validation path yet.';
  }

  return normalized
    .replace(/\bruntime\b/gi, 'Zavorth')
    .replace(/\bnodes\b/gi, 'devices');
}

function normalizeStatusActionLabel(label: string | null | undefined): string | null {
  const normalized = sanitizeHumanCliText(label || '').trim();
  if (!normalized) {
    return 'Follow the main suggested step.';
  }

  if (normalized.toLowerCase().includes('reconcile local runtime')) {
    return 'Reconcile local Zavorth';
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
      label: normalizedLabel || 'Follow the main suggested step.',
      command: normalizedCommand,
    };
  }

  if (attentionItems.length > 0) {
    return {
      label: 'Try recovering the main Zavorth entry',
      command: 'zavorth go',
    };
  }

  if (normalizedCommand) {
    return {
      label: 'Open the main diagnostic',
      command: 'zavorth doctor',
    };
  }

  return {
    label: 'No immediate action suggested.',
    command: null,
  };
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
    items.add(`${formatCount(snapshot.nodes.staleQueued, 'stale item waiting on devices', 'stale items waiting on devices')}.`);
  }

  return Array.from(items);
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

  const llmProvider = String(config.llmProvider || '').trim() || 'not configured';
  let llmModel = 'not configured';
  if (llmProvider === 'gemini') {
    llmModel = config.geminiModel || config.geminiDefaultModel || 'provider-default';
  } else if (llmProvider === 'openai') {
    llmModel = config.openaiModel || 'provider-default';
  } else if (llmProvider === 'deepseek') {
    llmModel = config.deepseekModel || 'provider-default';
  } else if (llmProvider === 'aigateway') {
    llmModel = config.AIGatewayModel || 'provider-default';
  } else if (llmProvider === 'openrouter') {
    llmModel = config.openRouterModel || 'provider-default';
  } else if (llmProvider !== 'not configured') {
    llmModel = 'provider-default';
  }

  const memoryMetricsRaw = runtime.layeredMemoryService
    ? await runtime.layeredMemoryService.readMetrics({
        userId: flags.userId,
        platform: flags.platform,
        chatId: flags.chatId || null,
        sessionId: flags.sessionId || null,
      })
    : null;

  const taskOsRaw = runtime.taskOperatingSystemService
    ? await runtime.taskOperatingSystemService.buildSnapshot({
        userId: flags.userId,
      })
    : null;

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
    llm: {
      provider: llmProvider,
      model: llmModel,
    },
    memoryMetrics: memoryMetricsRaw
      ? {
          total: memoryMetricsRaw.summary.totalEntries,
          episodic: memoryMetricsRaw.summary.episodic,
          semantic: memoryMetricsRaw.summary.semantic,
          procedural: memoryMetricsRaw.summary.procedural,
          pressure: memoryMetricsRaw.summary.pressure,
        }
      : null,
    taskOs: taskOsRaw
      ? {
          total: taskOsRaw.summary.tasks,
          active: taskOsRaw.summary.active,
          awaitingPermission: taskOsRaw.summary.awaitingPermission,
        }
      : null,
  };
}

function formatCliStatusSnapshot(snapshot: CliStatusSnapshot): string {
  const i18n = getI18nService();
  const attentionItems = buildStatusAttentionItems(snapshot);
  const primaryAction = resolveStatusPrimaryAction(snapshot, attentionItems);

  // 1. Panel: General
  const generalLines: string[] = [];
  if (snapshot.llm) {
    const providerCapitalized = snapshot.llm.provider.charAt(0).toUpperCase() + snapshot.llm.provider.slice(1);
    generalLines.push(i18n.t('cli.status.provider', {
      fallback: `- LLM Provider: ${providerCapitalized} (via ${snapshot.llm.model})`,
      vars: { provider: providerCapitalized, model: snapshot.llm.model }
    }));
  } else {
    generalLines.push(i18n.t('cli.status.provider', {
      fallback: `- LLM Provider: Gemini (via gemini-2.5-flash)`,
      vars: { provider: 'Gemini', model: 'gemini-2.5-flash' }
    }));
  }

  const readinessLabel = attentionItems.length === 0
    ? i18n.t('cli.status.state_ready', { fallback: 'Ready to use' })
    : i18n.t('cli.status.state_pending', { fallback: 'Awaiting setup / attention' });
  generalLines.push(i18n.t('cli.status.agent_state', {
    fallback: `- Agent state: ${readinessLabel}`,
    vars: { state: readinessLabel }
  }));

  if (snapshot.platform) {
    generalLines.push(i18n.t('cli.status.resources', {
      fallback: `- Resources: ${snapshot.platform.skills} skills, ${snapshot.platform.plugins} plugins, ${snapshot.platform.mcps} MCP servers`,
      vars: {
        skills: String(snapshot.platform.skills),
        plugins: String(snapshot.platform.plugins),
        mcps: String(snapshot.platform.mcps)
      }
    }));
  }

  // 2. Panel: Cognition & Autonomy
  const cognitionLines: string[] = [];
  const sessionsCount = snapshot.sessions ? snapshot.sessions.total : 0;
  cognitionLines.push(i18n.t('cli.status.sessions', {
    fallback: `- Active sessions: ${sessionsCount} in history`,
    vars: { count: String(sessionsCount) }
  }));

  if (snapshot.taskOs) {
    cognitionLines.push(i18n.t('cli.status.autonomy', {
      fallback: `- Autonomy: ${snapshot.taskOs.active} sub-agents running (${snapshot.taskOs.total} tasks registered)`,
      vars: {
        active: String(snapshot.taskOs.active),
        total: String(snapshot.taskOs.total)
      }
    }));
  } else {
    cognitionLines.push(i18n.t('cli.status.no_autonomy', { fallback: '- Autonomy: No active background tasks' }));
  }

  if (snapshot.memoryMetrics) {
    cognitionLines.push(i18n.t('cli.status.memory_episodic', {
      fallback: `- Episodic Memory: ${snapshot.memoryMetrics.episodic} recent entries`,
      vars: { count: String(snapshot.memoryMetrics.episodic) }
    }));
    cognitionLines.push(i18n.t('cli.status.memory_semantic', {
      fallback: `- Semantic Memory: ${snapshot.memoryMetrics.semantic} facts assimilated`,
      vars: { count: String(snapshot.memoryMetrics.semantic) }
    }));
    cognitionLines.push(i18n.t('cli.status.memory_procedural', {
      fallback: `- Procedural Memory: ${snapshot.memoryMetrics.procedural} routines saved`,
      vars: { count: String(snapshot.memoryMetrics.procedural) }
    }));

    let pressureKey = 'cli.status.pressure_healthy';
    let pressureFallback = 'Healthy';
    if (snapshot.memoryMetrics.pressure === 'elevated') {
      pressureKey = 'cli.status.pressure_elevated';
      pressureFallback = 'Elevated (consolidation recommended)';
    } else if (snapshot.memoryMetrics.pressure === 'critical') {
      pressureKey = 'cli.status.pressure_critical';
      pressureFallback = 'Critical (clean/reconciliation required)';
    }
    const pressureLabel = i18n.t(pressureKey, { fallback: pressureFallback });
    cognitionLines.push(i18n.t('cli.status.recall_pressure', {
      fallback: `- Recall pressure: ${pressureLabel}`,
      vars: { pressure: pressureLabel }
    }));
  } else {
    cognitionLines.push(i18n.t('cli.status.memory_episodic', { fallback: '- Episodic Memory: 0 recent entries', vars: { count: '0' } }));
    cognitionLines.push(i18n.t('cli.status.memory_semantic', { fallback: '- Semantic Memory: 0 facts assimilated', vars: { count: '0' } }));
    cognitionLines.push(i18n.t('cli.status.memory_procedural', { fallback: '- Procedural Memory: 0 routines saved', vars: { count: '0' } }));
  }

  // 3. Panel: Do Now
  const actionLines = [
    `> ${primaryAction.label}`,
    ...(primaryAction.command ? [`> ${primaryAction.command}`] : []),
    i18n.t('cli.status.diagnose', { fallback: '... for deep diagnostics: zavorth doctor' }),
  ];

  return renderCliScreen({
    eyebrow: i18n.t('cli.status.eyebrow', { fallback: 'Quick Status' }),
    eyebrowTone: attentionItems.length > 0 ? 'warning' : 'success',
    title: i18n.t('cli.status.title', { fallback: 'Operation Dashboard' }),
    summary: normalizeStatusHeadline(snapshot.headline),
    mode: 'compact',
    showWordmark: false,
    panels: [
      {
        title: i18n.t('cli.status.general', { fallback: 'General' }),
        lines: generalLines,
        tone: attentionItems.length > 0 ? 'warning' : 'success',
      },
      {
        title: i18n.t('cli.status.cognition', { fallback: 'Cognition & Autonomy' }),
        lines: cognitionLines,
        tone: 'neutral',
      },
      {
        title: i18n.t('cli.status.do_now', { fallback: 'Do now' }),
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
