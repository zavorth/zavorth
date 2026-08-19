import {
  ZAVORTH_CROSS_SURFACE_RUNTIME_PROJECTION_CONTRACT_VERSION,
  type ZavorthCrossSurfaceActionKind,
  type ZavorthCrossSurfaceActionProjection,
  type ZavorthCrossSurfaceApiProjection,
  type ZavorthCrossSurfaceInteractionMode,
  type ZavorthCrossSurfaceProjectionCard,
  type ZavorthCrossSurfaceProjectionReceipt,
  type ZavorthCrossSurfaceProjectionSafety,
  type ZavorthCrossSurfaceProjectionSurface,
  type ZavorthCrossSurfaceProjectionTone,
  type ZavorthCrossSurfaceRuntimeProjectionInput,
  type ZavorthCrossSurfaceRuntimeProjectionSnapshot,
  type ZavorthDashboardRuntimeProjection,
} from '../contracts/ZavorthCrossSurfaceRuntimeProjectionContract.js';
import type {
  ZavorthToolOrchestrationVerificationSnapshot,
  ZavorthToolOrchestrationVerificationStatus,
  ZavorthToolRoute,
  ZavorthToolRouteKind,
} from '../contracts/ZavorthToolOrchestrationVerificationContract.js';
import { ZavorthToolOrchestrationVerificationService } from './ZavorthToolOrchestrationVerificationService.js';

type Runtime = {
  now?: () => Date;
  toolOrchestration?: Pick<ZavorthToolOrchestrationVerificationService, 'buildSnapshot'>;
};

const DEFAULT_SURFACES: ZavorthCrossSurfaceProjectionSurface[] = [
  'cli',
  'telegram',
  'discord',
  'whatsapp',
  'signal',
  'imessage',
  'web',
  'api',
  'command_center',
];

const BUTTON_SURFACES = new Set<ZavorthCrossSurfaceProjectionSurface>(['telegram', 'discord', 'web']);
const TEXT_FALLBACK_SURFACES = new Set<ZavorthCrossSurfaceProjectionSurface>(['whatsapp', 'signal', 'imessage']);

export class ZavorthCrossSurfaceRuntimeProjectionService {
  private readonly now: () => Date;
  private readonly toolOrchestration: Pick<ZavorthToolOrchestrationVerificationService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.toolOrchestration = runtime.toolOrchestration || new ZavorthToolOrchestrationVerificationService({
      now: this.now,
    });
  }

  public buildSnapshot(input: ZavorthCrossSurfaceRuntimeProjectionInput): ZavorthCrossSurfaceRuntimeProjectionSnapshot {
    const generatedAt = this.now().toISOString();
    const toolOrchestration = this.toolOrchestration.buildSnapshot(input);
    const surfaces = normalizeSurfaces(input.projectionSurfaces);
    const surfaceCards = surfaces.map((surface) => buildSurfaceCard(surface, toolOrchestration, Boolean(input.compact)));
    const channelFallbacks = buildFallbacks(surfaceCards);
    const apiProjection = buildApiProjection(toolOrchestration);
    const dashboardProjection = buildDashboardProjection(toolOrchestration);
    const receipts = buildReceipts(surfaceCards, apiProjection, dashboardProjection, toolOrchestration.status);
    const safety = buildSafety();
    const summary = summarize(surfaceCards, dashboardProjection);

    return {
      generatedAt,
      contractVersion: ZAVORTH_CROSS_SURFACE_RUNTIME_PROJECTION_CONTRACT_VERSION,
      source: 'ZavorthCrossSurfaceRuntimeProjectionService',
      phase: 'checkpoint-5-cross-surface-runtime-projection',
      status: toolOrchestration.status,
      request: {
        surface: toolOrchestration.request.surface,
        actorId: toolOrchestration.request.actorId,
        textPreview: toolOrchestration.request.textPreview,
        rawSecretsSerialized: false,
      },
      toolOrchestration,
      surfaceCards,
      apiProjection,
      dashboardProjection: dashboardProjection,
      channelFallbacks,
      receipts,
      safety,
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --text "<request>"',
        json: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --json --text "<request>"',
        check: 'node scripts/zavorth-cross-surface-runtime-projection-check.mjs',
        nextAction: 'Runtime gateway - Operational Rollout And Continuous Eval Assimilation',
      },
      narrative: buildNarrative(toolOrchestration.status, surfaceCards, dashboardProjection),
    };
  }

  public formatSnapshotText(snapshot: ZavorthCrossSurfaceRuntimeProjectionSnapshot): string {
    const lines = [
      'Zavorth Cross-Surface Runtime Projection - Credential vault',
      '',
      `Status: ${snapshot.status}`,
      `Surfaces: ${snapshot.summary.surfaces} | actions=${snapshot.summary.actionCount} | approvals=${snapshot.summary.approvalActions} | disabled=${snapshot.summary.disabledActions}`,
      `Dashboard visual mutation: ${snapshot.summary.dashboardVisualMutation}`,
      '',
      'Surface cards:',
      ...snapshot.surfaceCards.map((card) => `- ${card.surface}: ${card.status} | ${card.summary}`),
      '',
      'Actions:',
      ...snapshot.surfaceCards.flatMap((card) => card.actions.slice(0, 3).map((action) => `- ${action.surface}/${action.kind}: ${action.label} -> ${action.command}`)).slice(0, 18),
      '',
      'Fallbacks:',
      ...snapshot.surfaceCards.filter((card) => TEXT_FALLBACK_SURFACES.has(card.surface)).map((card) => `- ${card.surface}: ${card.fallbackText}`),
      '',
      `Next: ${snapshot.commands.nextAction}`,
    ];
    return lines.join('\n');
  }
}

function normalizeSurfaces(input: ZavorthCrossSurfaceProjectionSurface[] | null | undefined): ZavorthCrossSurfaceProjectionSurface[] {
  if (!input || input.length === 0) return DEFAULT_SURFACES;
  const allowed = new Set(DEFAULT_SURFACES);
  const unique: ZavorthCrossSurfaceProjectionSurface[] = [];
  for (const item of input) {
    if (allowed.has(item) && !unique.includes(item)) unique.push(item);
  }
  return unique.length > 0 ? unique : DEFAULT_SURFACES;
}

function buildSurfaceCard(
  surface: ZavorthCrossSurfaceProjectionSurface,
  runtime: ZavorthToolOrchestrationVerificationSnapshot,
  compact: boolean,
): ZavorthCrossSurfaceProjectionCard {
  const modes = interactionModes(surface);
  const routes = compact ? runtime.routes.slice(0, 4) : runtime.routes;
  const actions = buildActions(surface, runtime.status, runtime.routes);
  const tone = toneForStatus(runtime.status);
  const summary = summaryForSurface(surface, runtime);
  const lines = [
    `Status: ${runtime.status}`,
    `Routes: ${runtime.summary.routes}; blocking verifications: ${runtime.summary.blockingVerification}`,
    `Final answer allowed: ${runtime.finalAnswerGuard.canClaimCompletion ? 'yes' : 'no'}`,
    ...routes.map((route) => `${route.title}: ${route.decision} (${route.surface})`),
  ];
  const metrics = [
    metric('rotas', String(runtime.summary.routes), toneForCount(runtime.summary.routes)),
    metric('approvals', String(runtime.summary.approvalRoutes), runtime.summary.approvalRoutes > 0 ? 'attention' : 'success'),
    metric('bloqueios', String(runtime.summary.deniedRoutes), runtime.summary.deniedRoutes > 0 ? 'blocked' : 'success'),
    metric('verification', `${runtime.summary.satisfiedVerification}/${runtime.summary.verificationItems}`, runtime.summary.blockingVerification > 0 ? 'attention' : 'success'),
  ];

  return {
    id: `gate-5-card-${surface}`,
    surface,
    title: titleForSurface(surface),
    status: runtime.status,
    tone,
    modes,
    summary,
    metrics,
    lines,
    actions,
    fallbackText: fallbackForSurface(surface, runtime.status, actions),
    sameSemanticStatusAsRuntime: true,
  };
}

function interactionModes(surface: ZavorthCrossSurfaceProjectionSurface): ZavorthCrossSurfaceInteractionMode[] {
  if (surface === 'cli') return ['table', 'text'];
  if (surface === 'api') return ['json'];
  if (surface === 'command_center') return ['dashboard_projection', 'text'];
  if (BUTTON_SURFACES.has(surface)) return ['buttons', 'menu', 'text'];
  return ['text'];
}

function buildActions(
  surface: ZavorthCrossSurfaceProjectionSurface,
  status: ZavorthToolOrchestrationVerificationStatus,
  routes: ZavorthToolRoute[],
): ZavorthCrossSurfaceActionProjection[] {
  const routeKinds = uniqueKinds(routes);
  const actions: ZavorthCrossSurfaceActionProjection[] = [];
  if (status === 'blocked') {
    actions.push(action(surface, 'blocked', 'Explain Block', '/invoke explain-block', routeKinds, false, false, 'The policy blocked the original route.'));
    actions.push(action(surface, 'secondary', 'Suggest Safe Path', '/invoke safe-alternative', routeKinds, true, false, 'The user can receive an alternative without external impact.'));
    return actions;
  }
  if (status === 'approval-required') {
    actions.push(action(surface, 'approval', 'Request Approval', '/approve pending-action', routeKinds, true, true, 'There is write, command, external send, or live impact.'));
    actions.push(action(surface, 'secondary', 'Replan Read-Only', '/invoke readonly-plan', routeKinds, true, false, 'Keeps progress without mutation.'));
    return actions;
  }
  if (status === 'needs-setup') {
    actions.push(action(surface, 'setup', 'Run Doctor', '/doctor required-surface', routeKinds, true, false, 'The required surface is not configured yet.'));
    actions.push(action(surface, 'secondary', 'Use Safe Fallback', '/invoke fallback', routeKinds, true, false, 'Uses an alternative surface when available.'));
    return actions;
  }
  if (status === 'verification-required') {
    actions.push(action(surface, 'verification', 'Attach Evidence', '/verify attach-evidence', routeKinds, true, false, 'Evidence is required before claiming completion.'));
    actions.push(action(surface, 'primary', 'Keep Observing', '/invoke continue-readonly', routeKinds, true, false, 'Read-only actions can continue under policy.'));
    return actions;
  }
  actions.push(action(surface, 'primary', 'Answer With Evidence', '/invoke answer-with-evidence', routeKinds, true, false, 'Sufficient verification has already been recorded.'));
  actions.push(action(surface, 'secondary', 'Show Receipts', '/receipts latest', routeKinds, true, false, 'Shows execution traceability.'));
  return actions;
}

function action(
  surface: ZavorthCrossSurfaceProjectionSurface,
  kind: ZavorthCrossSurfaceActionKind,
  label: string,
  command: string,
  routeKinds: ZavorthToolRouteKind[],
  enabled: boolean,
  requiresApproval: boolean,
  reason: string,
): ZavorthCrossSurfaceActionProjection {
  return {
    id: `gate-5-action-${surface}-${kind}`,
    surface,
    kind,
    label,
    command,
    routeKinds,
    enabled,
    requiresApproval,
    reason,
  };
}

function uniqueKinds(routes: ZavorthToolRoute[]): ZavorthToolRouteKind[] {
  const values: ZavorthToolRouteKind[] = [];
  for (const route of routes) {
    if (!values.includes(route.kind)) values.push(route.kind);
  }
  return values;
}

function buildFallbacks(cards: ZavorthCrossSurfaceProjectionCard[]): Record<ZavorthCrossSurfaceProjectionSurface, string> {
  const fallback = {} as Record<ZavorthCrossSurfaceProjectionSurface, string>;
  for (const surface of DEFAULT_SURFACES) {
    const card = cards.find((item) => item.surface === surface);
    fallback[surface] = card?.fallbackText || `${titleForSurface(surface)} has no active projection.`;
  }
  return fallback;
}

function buildApiProjection(runtime: ZavorthToolOrchestrationVerificationSnapshot): ZavorthCrossSurfaceApiProjection {
  return {
    jsonReady: true,
    noLiveActionExecuted: true,
    endpoints: [
      {
        method: 'GET',
        path: '/api/runtime/projection',
        purpose: 'Read the current cross-surface projection.',
        requiresApproval: false,
      },
      {
        method: 'POST',
        path: '/api/runtime/invoke',
        purpose: 'Request governed execution of the projected action.',
        requiresApproval: runtime.status === 'approval-required',
      },
      {
        method: 'POST',
        path: '/api/runtime/verify',
        purpose: 'Attach evidence and verification receipts.',
        requiresApproval: false,
      },
    ],
    payloadShape: {
      status: runtime.status,
      cards: 'ZavorthCrossSurfaceProjectionCard[]',
      receipts: 'ZavorthCrossSurfaceProjectionReceipt[]',
      safety: 'ZavorthCrossSurfaceProjectionSafety',
    },
  };
}

function buildDashboardProjection(runtime: ZavorthToolOrchestrationVerificationSnapshot): ZavorthDashboardRuntimeProjection {
  return {
    projectionId: 'gate-5-dashboard-runtime-projection',
    title: 'Runtime projection',
    statusPill: runtime.status,
    visualMutationApplied: false,
    requiresOwnerApprovalForVisualChange: true,
    suggestedSlots: ['header_summary', 'route_table', 'actions_panel', 'receipts_timeline', 'channel_fallbacks'],
    safeViewModelOnly: true,
  };
}

function buildReceipts(
  cards: ZavorthCrossSurfaceProjectionCard[],
  apiProjection: ZavorthCrossSurfaceApiProjection,
  dashboard: ZavorthDashboardRuntimeProjection,
  status: ZavorthToolOrchestrationVerificationStatus,
): ZavorthCrossSurfaceProjectionReceipt[] {
  const receipts: ZavorthCrossSurfaceProjectionReceipt[] = [
    {
      id: 'gate-5-projection-receipt',
      kind: 'gate-5-cross-surface-projection',
      surface: 'all',
      status: receiptStatus(status),
      summary: `${cards.length} surfaces received the same decision without executing a live action.`,
    },
    {
      id: 'gate-5-api-projection-receipt',
      kind: 'api-projection',
      surface: 'api',
      status: receiptStatus(status),
      summary: `${apiProjection.endpoints.length} endpoints projetados como contrato JSON.`,
    },
    {
      id: 'gate-5-dashboard-boundary-receipt',
      kind: 'visual-change-boundary',
      surface: 'command_center',
      status: 'recorded',
      summary: dashboard.visualMutationApplied ? 'Visual mutation applied.'
        : 'Dashboard received only a view model; visual change requires separate approval.',
    },
  ];
  for (const card of cards) {
    receipts.push({
      id: `gate-5-card-receipt-${card.surface}`,
      kind: TEXT_FALLBACK_SURFACES.has(card.surface) ? 'channel-fallback' : 'surface-card',
      surface: card.surface,
      status: receiptStatus(card.status),
      summary: `${card.title}: ${card.status}; modos=${card.modes.join(',')}.`,
    });
  }
  return receipts;
}

function buildSafety(): ZavorthCrossSurfaceProjectionSafety {
  return {
    noDashboardVisualMutation: true,
    dashboardIsViewModelOnly: true,
    noLiveActionExecuted: true,
    sameSemanticsAcrossSurfaces: true,
    telegramNotPrivileged: true,
    channelFallbacksRequired: true,
    rawSecretsSerialized: false,
  };
}

function summarize(
  cards: ZavorthCrossSurfaceProjectionCard[],
  dashboard: ZavorthDashboardRuntimeProjection,
): ZavorthCrossSurfaceRuntimeProjectionSnapshot['summary'] {
  const actions = cards.flatMap((card) => card.actions);
  return {
    surfaces: cards.length,
    buttonSurfaces: cards.filter((card) => card.modes.includes('buttons')).length,
    fallbackSurfaces: cards.filter((card) => card.modes.length === 1 && card.modes[0] === 'text').length,
    actionCount: actions.length,
    approvalActions: actions.filter((actionItem) => actionItem.requiresApproval).length,
    disabledActions: actions.filter((actionItem) => !actionItem.enabled).length,
    dashboardVisualMutation: dashboard.visualMutationApplied,
  };
}

function summaryForSurface(
  surface: ZavorthCrossSurfaceProjectionSurface,
  runtime: ZavorthToolOrchestrationVerificationSnapshot,
): string {
  if (surface === 'cli') return `Operational table ready with ${runtime.summary.routes} routes and ${runtime.summary.verificationItems} verifications.`;
  if (surface === 'api') return `JSON payload ready for status ${runtime.status}.`;
  if (surface === 'command_center') return 'Safe view model for Dashboard, with no automatic visual change.';
  if (BUTTON_SURFACES.has(surface)) return `Menus and buttons projected for status ${runtime.status}.`;
  return `Fallback textual equivalente projetado para status ${runtime.status}.`;
}

function fallbackForSurface(
  surface: ZavorthCrossSurfaceProjectionSurface,
  status: ZavorthToolOrchestrationVerificationStatus,
  actions: ZavorthCrossSurfaceActionProjection[],
): string {
  const primary = actions.find((item) => item.enabled)?.label || 'Ver status';
  if (surface === 'cli') return `Status ${status}. Use: ${actions.map((item) => item.command).join(' | ')}`;
  if (surface === 'api') return `GET /api/runtime/projection retorna status ${status}.`;
  if (surface === 'command_center') return `Dashboard can show status ${status}, waiting for visual approval for new cards.`;
  if (BUTTON_SURFACES.has(surface)) return `${titleForSurface(surface)}: ${status}. Suggested action: ${primary}.`;
  return `${titleForSurface(surface)}: ${status}. Reply with the text command "${actions[0]?.command || '/status'}" to continue.`;
}

function titleForSurface(surface: ZavorthCrossSurfaceProjectionSurface): string {
  if (surface === 'cli') return 'CLI';
  if (surface === 'telegram') return 'Telegram';
  if (surface === 'discord') return 'Discord';
  if (surface === 'whatsapp') return 'WhatsApp';
  if (surface === 'signal') return 'Signal';
  if (surface === 'imessage') return 'iMessage';
  if (surface === 'web') return 'Web';
  if (surface === 'api') return 'API';
  return 'Dashboard';
}

function metric(label: string, value: string, tone: ZavorthCrossSurfaceProjectionTone): ZavorthCrossSurfaceProjectionCard['metrics'][number] {
  return { label, value, tone };
}

function toneForStatus(status: ZavorthToolOrchestrationVerificationStatus): ZavorthCrossSurfaceProjectionTone {
  if (status === 'ready') return 'success';
  if (status === 'verification-required' || status === 'needs-setup') return 'attention';
  if (status === 'approval-required') return 'danger';
  return 'blocked';
}

function toneForCount(count: number): ZavorthCrossSurfaceProjectionTone {
  return count > 0 ? 'neutral' : 'attention';
}

function receiptStatus(status: ZavorthToolOrchestrationVerificationStatus): ZavorthCrossSurfaceProjectionReceipt['status'] {
  if (status === 'blocked') return 'blocked';
  if (status === 'approval-required') return 'requires-approval';
  if (status === 'verification-required' || status === 'needs-setup') return 'requires-verification';
  return 'recorded';
}

function buildNarrative(
  status: ZavorthToolOrchestrationVerificationStatus,
  cards: ZavorthCrossSurfaceProjectionCard[],
  dashboard: ZavorthDashboardRuntimeProjection,
): ZavorthCrossSurfaceRuntimeProjectionSnapshot['narrative'] {
  if (status === 'ready') {
    return {
      headline: 'Projection ready for final answer with evidence.',
      operatorSummary: `${cards.length} surfaces received equivalent actions and Dashboard stayed in view-model mode.`,
      nextAction: 'Answer with evidence or expose receipts.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Live action needs approval before continuing.',
      operatorSummary: 'Surfaces show the same approval boundary.',
      nextAction: 'Request approval or replan in read-only mode.',
    };
  }
  if (status === 'needs-setup') {
    return {
      headline: 'A required surface needs setup.',
      operatorSummary: 'Channels and CLI received doctor/fallback actions without attempting setup automatically.',
      nextAction: 'Run doctor for the missing surface.',
    };
  }
  if (status === 'blocked') {
    return {
      headline: 'Route blocked by policy.',
      operatorSummary: 'All surfaces preserve the block and offer a safe alternative.',
      nextAction: 'Explicar o block e sugerir uma rota permitida.',
    };
  }
  return {
    headline: 'Verification required before claiming completion.',
    operatorSummary: `${cards.length} surfaces show the need for evidence. Visual mutation applied: ${dashboard.visualMutationApplied}.`,
    nextAction: 'Attach evidence, receipts, or screenshots before the final answer.',
  };
}
