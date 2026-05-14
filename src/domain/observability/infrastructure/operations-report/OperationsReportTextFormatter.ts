import type {
  OperationsReportOverviewSection,
  OperationsReportTextInput,
} from './OperationsReportTypes.js';

function buildOverviewTextSection(
  title: string,
  overview: OperationsReportOverviewSection | null,
): string[] {
  if (!overview) {
    return [];
  }

  const actionLine = overview.actions.length
    ? `- Acoes: ${overview.actions.map((action) =>
      `${action.label}${action.command ? ` | ${action.command}` : ''} | ${action.reason}`,
    ).join(' | ')}`
    : null;

  return [
    title,
    `- Postura: ${overview.posture}`,
    `- Headline: ${overview.headline}`,
    `- Resumo: ${overview.operatorSummary}`,
    overview.nextAction ? `- Proxima acao: ${overview.nextAction}` : null,
    actionLine,
    '',
  ].filter((line): line is string => Boolean(line));
}

export function formatOperationsReportText(snapshot: OperationsReportTextInput): string {
  const lines = [
    'Relatorio consolidado do Zavorth',
    '',
    `Gerado em: ${snapshot.generatedAt}`,
    '',
    snapshot.operatorBrief ? 'Briefing do operador:' : null,
    snapshot.operatorBrief ? `- Postura: ${snapshot.operatorBrief.posture}` : null,
    snapshot.operatorBrief ? `- Headline: ${snapshot.operatorBrief.headline}` : null,
    snapshot.operatorBrief ? `- Proxima acao: ${snapshot.operatorBrief.nextAction.label} | ${snapshot.operatorBrief.nextAction.command} | ${snapshot.operatorBrief.nextAction.reason}` : null,
    snapshot.operatorBrief ? '' : null,
    snapshot.continuity ? 'Continuidade entre superficies:' : null,
    snapshot.continuity ? `- Acao sugerida: ${snapshot.continuity.suggestedAction.label} | ${snapshot.continuity.suggestedAction.reason}` : null,
    snapshot.continuity && snapshot.continuity.focusTask
      ? `- Foco atual: ${snapshot.continuity.focusTask.shortId} | ${snapshot.continuity.focusTask.source} | ${snapshot.continuity.focusTask.status}`
      : (snapshot.continuity ? '- Foco atual: sem task dominante.' : null),
    snapshot.continuity
      ? `- Superficies recentes: Telegram ${snapshot.continuity.surfaces.telegram} | Web ${snapshot.continuity.surfaces.web} | Outras ${snapshot.continuity.surfaces.other}`
      : null,
    snapshot.continuity ? '' : null,
    ...buildOverviewTextSection('Overview operacional canonico:', snapshot.overviews.operational),
    ...buildOverviewTextSection('Overview de trust canonico:', snapshot.overviews.trust),
    ...buildOverviewTextSection('Overview de produto canonico:', snapshot.overviews.product),
    'Resumo executivo:',
    ...snapshot.executiveSummary.map((line) => `- ${line}`),
    '',
    'Runtime:',
    `- Uptime: ${snapshot.runtime.uptimeLabel}`,
    `- Memoria: ${snapshot.runtime.memoryLabel}`,
    `- Plataforma: ${snapshot.runtime.platformLabel}`,
    '',
    'Operacao:',
    `- Sidecars: ${snapshot.operations.sidecarsLabel}`,
    `- Canais: ${snapshot.operations.channelsLabel}`,
    `- Canais nativos: ${snapshot.operations.channelProviderDoctorLabel}`,
    `- Transportes remotos: ${snapshot.operations.remoteTransportDoctorLabel}`,
    `- Tenants: ${snapshot.operations.tenantsLabel}`,
    `- Node Mesh: ${snapshot.operations.nodeMeshSmokeLabel}`,
    `- Publish: ${snapshot.operations.publishLabel}`,
    `- Disco: ${snapshot.operations.storageLabel}`,
    `- Automacao: ${snapshot.operations.automationLabel}`,
    '',
    'Tenants:',
    `- Total: ${snapshot.tenants.totalCount} | compartilhados ${snapshot.tenants.sharedCount} | pessoais ${snapshot.tenants.personalCount}`,
    `- Publicos: ${snapshot.tenants.publicServerCount} | onboarding pendente ${snapshot.tenants.pendingOnboardingCount}`,
    `- Plataformas: ${Object.entries(snapshot.tenants.byPlatform).map(([platform, count]) => `${platform}:${count}`).join(' | ') || 'sem tenants observados'}`,
    ...(snapshot.tenants.recent.length
      ? [`- Recentes: ${snapshot.tenants.recent.map((tenant) => `${tenant.platform}/${tenant.onboardingStatus}:${tenant.tenantId}`).join(' | ')}`]
      : ['- Recentes: nenhum registro observado']),
    '',
    'Tasks:',
    `- Ativas agora: ${snapshot.tasks.activeCount}`,
    `- Ultimas 24h: ${snapshot.tasks.completedLast24h} concluidas | ${snapshot.tasks.failedLast24h} com falha | ${snapshot.tasks.waitingApprovalLast24h} aguardando aprovacao`,
    `- Executores mais usados: ${snapshot.tasks.topExecutors.length ? snapshot.tasks.topExecutors.join(' | ') : 'sem volume relevante'}`,
    '',
    snapshot.productObservability ? 'Observabilidade de produto:' : null,
    snapshot.productObservability?.routeHeadline ? `- Rotas: ${snapshot.productObservability.routeHeadline}` : null,
    snapshot.productObservability?.workflowHeadline ? `- Workflows: ${snapshot.productObservability.workflowHeadline}` : null,
    snapshot.productObservability?.executorHeadline ? `- Execucao: ${snapshot.productObservability.executorHeadline}` : null,
    snapshot.productObservability?.approvalsHeadline ? `- Aprovacoes: ${snapshot.productObservability.approvalsHeadline}` : null,
    snapshot.productObservability?.artifactHeadline ? `- Entregas: ${snapshot.productObservability.artifactHeadline}` : null,
    snapshot.productObservability?.topRoutes.length
      ? `- Rotas dominantes: ${snapshot.productObservability.topRoutes.join(' | ')}`
      : null,
    snapshot.productObservability?.recentWorkflows.length
      ? `- Workflows recentes: ${snapshot.productObservability.recentWorkflows.join(' | ')}`
      : null,
    snapshot.productObservability?.topExecutors.length
      ? `- Executores mais efetivos: ${snapshot.productObservability.topExecutors.join(' | ')}`
      : null,
    ...(snapshot.productObservability?.insights.length
      ? ['', 'Insights de produto:', ...snapshot.productObservability.insights.map((line) => `- ${line}`)]
      : []),
    snapshot.productObservability ? '' : null,
    snapshot.pendingPermissions.length ? 'Permissoes pendentes:' : 'Permissoes pendentes: nenhuma.',
    ...snapshot.pendingPermissions.map((permission) =>
      `- ${permission.executor}/${permission.kind}: ${permission.reason}`,
    ),
    '',
    snapshot.alerts.length ? 'Alertas recentes:' : 'Alertas recentes: nenhum.',
    ...snapshot.alerts.map((alert) => `- ${alert.source}: ${alert.title} | ${alert.detail}`),
    '',
    snapshot.actions.length ? 'Proximas acoes recomendadas:' : 'Proximas acoes recomendadas: nenhuma.',
    ...snapshot.actions.map((action) => `- ${action.label}: ${action.command} | ${action.reason}`),
  ];

  return lines.join('\n');
}
