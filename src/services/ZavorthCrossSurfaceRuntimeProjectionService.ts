import {
  ZAVORTH_CROSS_SURFACE_RUNTIME_PROJECTION_CONTRACT_VERSION,
  type ZavorthDashboardRuntimeProjection,
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
      dashboardProjection,
      channelFallbacks,
      receipts,
      safety,
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --text "<request>"',
        json: 'npx tsx scripts/zavorth-cross-surface-runtime-projection.ts --json --text "<request>"',
        check: 'node scripts/zavorth-cross-surface-runtime-projection-check.mjs',
        nextStage: 'Runtime gateway - Operational Rollout And Continuous Eval Assimilation',
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
      `Next: ${snapshot.commands.nextStage}`,
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
    `Rotas: ${runtime.summary.routes}; verificações bloqueantes: ${runtime.summary.blockingVerification}`,
    `Resposta final permitida: ${runtime.finalAnswerGuard.canClaimCompletion ? 'sim' : 'não'}`,
    ...routes.map((route) => `${route.title}: ${route.decision} (${route.surface})`),
  ];
  const metrics = [
    metric('rotas', String(runtime.summary.routes), toneForCount(runtime.summary.routes)),
    metric('aprovações', String(runtime.summary.approvalRoutes), runtime.summary.approvalRoutes > 0 ? 'attention' : 'success'),
    metric('bloqueios', String(runtime.summary.deniedRoutes), runtime.summary.deniedRoutes > 0 ? 'blocked' : 'success'),
    metric('verificação', `${runtime.summary.satisfiedVerification}/${runtime.summary.verificationItems}`, runtime.summary.blockingVerification > 0 ? 'attention' : 'success'),
  ];

  return {
    id: `checkpoint-5-card-${surface}`,
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
    actions.push(action(surface, 'blocked', 'Explicar bloqueio', '/invoke explain-block', routeKinds, false, false, 'A política bloqueou a rota original.'));
    actions.push(action(surface, 'secondary', 'Sugerir caminho seguro', '/invoke safe-alternative', routeKinds, true, false, 'O usuário pode receber alternativa sem impacto externo.'));
    return actions;
  }
  if (status === 'approval-required') {
    actions.push(action(surface, 'approval', 'Pedir aprovação', '/approve pending-action', routeKinds, true, true, 'Há escrita, comando, envio externo ou impacto live.'));
    actions.push(action(surface, 'secondary', 'Replanejar read-only', '/invoke readonly-plan', routeKinds, true, false, 'Mantém progresso sem mutação.'));
    return actions;
  }
  if (status === 'needs-setup') {
    actions.push(action(surface, 'setup', 'Rodar doctor', '/doctor required-surface', routeKinds, true, false, 'A superfície necessária ainda não está configurada.'));
    actions.push(action(surface, 'secondary', 'Usar fallback seguro', '/invoke fallback', routeKinds, true, false, 'Usa uma superfície alternativa quando existir.'));
    return actions;
  }
  if (status === 'verification-required') {
    actions.push(action(surface, 'verification', 'Anexar evidência', '/verify attach-evidence', routeKinds, true, false, 'É preciso evidência antes de afirmar conclusão.'));
    actions.push(action(surface, 'primary', 'Continuar observando', '/invoke continue-readonly', routeKinds, true, false, 'Ações read-only podem continuar sob política.'));
    return actions;
  }
  actions.push(action(surface, 'primary', 'Responder com evidência', '/invoke answer-with-evidence', routeKinds, true, false, 'A verificação suficiente já foi registrada.'));
  actions.push(action(surface, 'secondary', 'Mostrar recibos', '/receipts latest', routeKinds, true, false, 'Exibe a rastreabilidade da execução.'));
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
    id: `checkpoint-5-action-${surface}-${kind}`,
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
    fallback[surface] = card?.fallbackText || `${titleForSurface(surface)} sem projeção ativa.`;
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
        purpose: 'Ler projeção cross-surface atual.',
        requiresApproval: false,
      },
      {
        method: 'POST',
        path: '/api/runtime/invoke',
        purpose: 'Solicitar execução governada da ação projetada.',
        requiresApproval: runtime.status === 'approval-required',
      },
      {
        method: 'POST',
        path: '/api/runtime/verify',
        purpose: 'Anexar evidência e recibos de verificação.',
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
    projectionId: 'checkpoint-5-dashboard-runtime-projection',
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
      id: 'checkpoint-5-projection-receipt',
      kind: 'checkpoint-5-cross-surface-projection',
      surface: 'all',
      status: receiptStatus(status),
      summary: `${cards.length} superfícies receberam a mesma decisão sem executar ação live.`,
    },
    {
      id: 'checkpoint-5-api-projection-receipt',
      kind: 'api-projection',
      surface: 'api',
      status: receiptStatus(status),
      summary: `${apiProjection.endpoints.length} endpoints projetados como contrato JSON.`,
    },
    {
      id: 'checkpoint-5-dashboard-boundary-receipt',
      kind: 'visual-change-boundary',
      surface: 'command_center',
      status: 'recorded',
      summary: dashboard.visualMutationApplied
        ? 'Mutação visual aplicada.'
        : 'Dashboard recebeu apenas view-model; mudança visual exige aprovação separada.',
    },
  ];
  for (const card of cards) {
    receipts.push({
      id: `checkpoint-5-card-receipt-${card.surface}`,
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
  if (surface === 'cli') return `Tabela operacional pronta com ${runtime.summary.routes} rotas e ${runtime.summary.verificationItems} verificações.`;
  if (surface === 'api') return `Payload JSON pronto para status ${runtime.status}.`;
  if (surface === 'command_center') return 'View-model seguro para o Dashboard, sem alteração visual automática.';
  if (BUTTON_SURFACES.has(surface)) return `Menus e botões projetados para status ${runtime.status}.`;
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
  if (surface === 'command_center') return `Dashboard pode mostrar status ${status}, aguardando aprovação visual para novos cards.`;
  if (BUTTON_SURFACES.has(surface)) return `${titleForSurface(surface)}: ${status}. Ação sugerida: ${primary}.`;
  return `${titleForSurface(surface)}: ${status}. Responda com o comando textual "${actions[0]?.command || '/status'}" para continuar.`;
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
      headline: 'Projeção pronta para resposta final com evidência.',
      operatorSummary: `${cards.length} superfícies receberam ações equivalentes e o Dashboard ficou em modo view-model.`,
      nextAction: 'Responder com evidência ou expor recibos.',
    };
  }
  if (status === 'approval-required') {
    return {
      headline: 'Ação live precisa de aprovação antes de continuar.',
      operatorSummary: 'As superfícies exibem a mesma fronteira de aprovação.',
      nextAction: 'Pedir aprovação ou replanejar em modo read-only.',
    };
  }
  if (status === 'needs-setup') {
    return {
      headline: 'Uma superfície necessária precisa de setup.',
      operatorSummary: 'Canais e CLI receberam ação de doctor/fallback sem tentar executar setup automaticamente.',
      nextAction: 'Rodar doctor da superfície ausente.',
    };
  }
  if (status === 'blocked') {
    return {
      headline: 'Rota bloqueada pela política.',
      operatorSummary: 'Todas as superfícies preservam o bloqueio e oferecem alternativa segura.',
      nextAction: 'Explicar o bloqueio e sugerir uma rota permitida.',
    };
  }
  return {
    headline: 'Verificação necessária antes de afirmar conclusão.',
    operatorSummary: `${cards.length} superfícies mostram a necessidade de evidência. Mutação visual aplicada: ${dashboard.visualMutationApplied}.`,
    nextAction: 'Anexar evidência, recibos ou screenshots antes da resposta final.',
  };
}
