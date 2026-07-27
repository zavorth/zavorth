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

  const actionLine = overview.actions.length ? `- Actions: ${overview.actions.map((action) =>
      `${action.label}${action.command ? ` | ${action.command}` : ''} | ${action.reason}`,
    ).join(' | ')}`
    : null;

  return [
    title,
    `- Posture: ${overview.posture}`,
    `- Headline: ${overview.headline}`,
    `- Summary: ${overview.operatorSummary}`,
    overview.nextAction ? `- Next action: ${overview.nextAction}` : null,
    actionLine,
    '',
  ].filter((line): line is string => Boolean(line));
}

export function formatOperationsReportText(snapshot: OperationsReportTextInput): string {
  const lines = [
    'Consolidated Zavorth Report',
    '',
    `Generated at: ${snapshot.generatedAt}`,
    '',
    snapshot.operatorBrief ? 'Operator briefing:' : null,
    snapshot.operatorBrief ? `- Posture: ${snapshot.operatorBrief.posture}` : null,
    snapshot.operatorBrief ? `- Headline: ${snapshot.operatorBrief.headline}` : null,
    snapshot.operatorBrief ? `- Next action: ${snapshot.operatorBrief.nextAction.label} | ${snapshot.operatorBrief.nextAction.command} | ${snapshot.operatorBrief.nextAction.reason}` : null,
    snapshot.operatorBrief ? '' : null,
    snapshot.continuity ? 'Cross-surface continuity:' : null,
    snapshot.continuity ? `- Suggested action: ${snapshot.continuity.suggestedAction.label} | ${snapshot.continuity.suggestedAction.reason}` : null,
    snapshot.continuity && snapshot.continuity.focusTask ? `- Current focus: ${snapshot.continuity.focusTask.shortId} | ${snapshot.continuity.focusTask.source} | ${snapshot.continuity.focusTask.status}`
      : (snapshot.continuity ? '- Current focus: no dominant task.' : null),
    snapshot.continuity ? `- Recent surfaces: Telegram ${snapshot.continuity.surfaces.telegram} | Web ${snapshot.continuity.surfaces.web} | Other ${snapshot.continuity.surfaces.other}`
      : null,
    snapshot.continuity ? '' : null,
    ...buildOverviewTextSection('Canonical operational overview:', snapshot.overviews.operational),
    ...buildOverviewTextSection('Canonical trust overview:', snapshot.overviews.trust),
    ...buildOverviewTextSection('Canonical product overview:', snapshot.overviews.product),
    'Executive summary:',
    ...snapshot.executiveSummary.map((line) => `- ${line}`),
    '',
    'Runtime:',
    `- Uptime: ${snapshot.runtime.uptimeLabel}`,
    `- Memory: ${snapshot.runtime.memoryLabel}`,
    `- Platform: ${snapshot.runtime.platformLabel}`,
    '',
    'Operations:',
    `- Sidecars: ${snapshot.operations.sidecarsLabel}`,
    `- Channels: ${snapshot.operations.channelsLabel}`,
    `- Native channels: ${snapshot.operations.channelProviderDoctorLabel}`,
    `- Remote transports: ${snapshot.operations.remoteTransportDoctorLabel}`,
    `- Tenants: ${snapshot.operations.tenantsLabel}`,
    `- Node Mesh: ${snapshot.operations.nodeMeshSmokeLabel}`,
    `- Publish: ${snapshot.operations.publishLabel}`,
    `- Storage: ${snapshot.operations.storageLabel}`,
    `- Automation: ${snapshot.operations.automationLabel}`,
    '',
    'Tenants:',
    `- Total: ${snapshot.tenants.totalCount} | shared ${snapshot.tenants.sharedCount} | personal ${snapshot.tenants.personalCount}`,
    `- Public: ${snapshot.tenants.publicServerCount} | pending onboarding ${snapshot.tenants.pendingOnboardingCount}`,
    `- Platforms: ${Object.entries(snapshot.tenants.byPlatform).map(([platform, count]) => `${platform}:${count}`).join(' | ') || 'no tenants observed'}`,
    ...(snapshot.tenants.recent.length
      ? [`- Recent: ${snapshot.tenants.recent.map((tenant) => `${tenant.platform}/${tenant.onboardingStatus}:${tenant.tenantId}`).join(' | ')}`]
      : ['- Recent: no records observed']),
    '',
    'Tasks:',
    `- Active now: ${snapshot.tasks.activeCount}`,
    `- Last 24h: ${snapshot.tasks.completedLast24h} completed | ${snapshot.tasks.failedLast24h} failed | ${snapshot.tasks.waitingApprovalLast24h} awaiting approval`,
    `- Most used executors: ${snapshot.tasks.topExecutors.length ? snapshot.tasks.topExecutors.join(' | ') : 'no significant volume'}`,
    '',
    snapshot.productObservability ? 'Product observability:' : null,
    snapshot.productObservability?.routeHeadline ? `- Routes: ${snapshot.productObservability.routeHeadline}` : null,
    snapshot.productObservability?.workflowHeadline ? `- Workflows: ${snapshot.productObservability.workflowHeadline}` : null,
    snapshot.productObservability?.executorHeadline ? `- Execution: ${snapshot.productObservability.executorHeadline}` : null,
    snapshot.productObservability?.approvalsHeadline ? `- Approvals: ${snapshot.productObservability.approvalsHeadline}` : null,
    snapshot.productObservability?.artifactHeadline ? `- Deliveries: ${snapshot.productObservability.artifactHeadline}` : null,
    snapshot.productObservability?.topRoutes.length ? `- Dominant routes: ${snapshot.productObservability.topRoutes.join(' | ')}`
      : null,
    snapshot.productObservability?.recentWorkflows.length ? `- Recent workflows: ${snapshot.productObservability.recentWorkflows.join(' | ')}`
      : null,
    snapshot.productObservability?.topExecutors.length ? `- Most effective executors: ${snapshot.productObservability.topExecutors.join(' | ')}`
      : null,
    ...(snapshot.productObservability?.insights.length
      ? ['', 'Product insights:', ...snapshot.productObservability.insights.map((line) => `- ${line}`)]
      : []),
    snapshot.productObservability ? '' : null,
    snapshot.pendingPermissions.length ? 'Pending permissions:' : 'Pending permissions: none.',
    ...snapshot.pendingPermissions.map((permission) =>
      `- ${permission.executor}/${permission.kind}: ${permission.reason}`,
    ),
    '',
    snapshot.alerts.length ? 'Recent alerts:' : 'Recent alerts: none.',
    ...snapshot.alerts.map((alert) => `- ${alert.source}: ${alert.title} | ${alert.detail}`),
    '',
    snapshot.actions.length ? 'Recommended next actions:' : 'Recommended next actions: none.',
    ...snapshot.actions.map((action) => `- ${action.label}: ${action.command} | ${action.reason}`),
  ];

  return lines.join('\n');
}
