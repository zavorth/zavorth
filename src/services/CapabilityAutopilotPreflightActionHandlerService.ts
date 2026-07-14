import type { CapabilityAutopilotSurface } from '../contracts/CapabilityAutopilotContract.js';
import type {
  CapabilityAutopilotPreflightCheck,
  CapabilityAutopilotPreflightSnapshot,
} from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightSurfaceAction,
  CapabilityPreflightSurfaceActionKind,
  CapabilityPreflightSurfacePayload,
} from './CapabilityAutopilotPreflightSurfaceService.js';

export type CapabilityPreflightActionHandlerKind =
  | 'open_preflight_snapshot'
  | 'start_diagnosis_preview'
  | 'prepare_permission_request'
  | 'open_fallback_selection'
  | 'prepare_validation_check'
  | 'prepare_resume_after_validation'
  | 'open_redacted_memory_hint';

export type CapabilityPreflightActionHandlerStatus =
  | 'handler_ready'
  | 'blocked';

export type CapabilityPreflightActionHandlerStage =
  | 'view'
  | 'diagnosis'
  | 'permission'
  | 'fallback'
  | 'validation'
  | 'resume'
  | 'memory';

export type CapabilityPreflightActionHandlerRequest = {
  surface: CapabilityAutopilotSurface;
  actionId?: string | null;
  actionKind?: CapabilityPreflightSurfaceActionKind | null;
  route?: string | null;
  command?: string | null;
  callbackData?: string | null;
  userConfirmed?: boolean;
};

export type CapabilityPreflightActionHandlerResult = {
  gate: 'capability-autopilot-preflight-action-handler';
  generatedAt: string;
  surface: 'capability-autopilot-preflight-action-handler';
  status: CapabilityPreflightActionHandlerStatus;
  capabilityId: string;
  sourceSurface: CapabilityAutopilotSurface;
  sourceAction: {
    id: string;
    kind: CapabilityPreflightSurfaceActionKind;
    label: string;
  } | null;
  handlerKind: CapabilityPreflightActionHandlerKind | null;
  handlerStage: CapabilityPreflightActionHandlerStage | null;
  target: {
    command: string | null;
    route: string | null;
    callbackData: string | null;
  };
  requiresExplicitUserAction: true;
  requiresApproval: boolean;
  requiresValidation: boolean;
  userConfirmed: boolean;
  readyForExplicitDispatch: boolean;
  shouldRunAutomatically: false;
  dispatchAttempted: false;
  blockers: string[];
  safeSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightActionHandlerSnapshot = {
  gate: 'capability-autopilot-preflight-action-handler';
  surface: 'capability-autopilot-preflight-action-handler';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityAutopilotPreflightSnapshot['gate'];
  plans: CapabilityPreflightActionHandlerResult[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedGate: {
    gate: 'capability-autopilot-preflight-dispatch-receipt';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightActionHandlerRuntime = {
  now?: () => Date;
};

const HANDLER_BY_ACTION: Record<CapabilityPreflightSurfaceActionKind, {
  handlerKind: CapabilityPreflightActionHandlerKind;
  handlerStage: CapabilityPreflightActionHandlerStage;
  requiresApproval: boolean;
  requiresValidation: boolean;
}> = {
  view_preflight: {
    handlerKind: 'open_preflight_snapshot',
    handlerStage: 'view',
    requiresApproval: false,
    requiresValidation: false,
  },
  run_diagnosis: {
    handlerKind: 'start_diagnosis_preview',
    handlerStage: 'diagnosis',
    requiresApproval: false,
    requiresValidation: false,
  },
  request_permission: {
    handlerKind: 'prepare_permission_request',
    handlerStage: 'permission',
    requiresApproval: true,
    requiresValidation: false,
  },
  show_fallbacks: {
    handlerKind: 'open_fallback_selection',
    handlerStage: 'fallback',
    requiresApproval: false,
    requiresValidation: false,
  },
  run_validation: {
    handlerKind: 'prepare_validation_check',
    handlerStage: 'validation',
    requiresApproval: false,
    requiresValidation: true,
  },
  resume_after_check: {
    handlerKind: 'prepare_resume_after_validation',
    handlerStage: 'resume',
    requiresApproval: false,
    requiresValidation: true,
  },
  open_memory_hint: {
    handlerKind: 'open_redacted_memory_hint',
    handlerStage: 'memory',
    requiresApproval: false,
    requiresValidation: false,
  },
};

export class CapabilityAutopilotPreflightActionHandlerService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightActionHandlerRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public handleAction(
    snapshot: CapabilityAutopilotPreflightSnapshot,
    request: CapabilityPreflightActionHandlerRequest,
  ): CapabilityPreflightActionHandlerResult {
    const generatedAt = this.now().toISOString();
    const payload = snapshot.payloads.find((candidate) => candidate.surface === request.surface) || null;
    if (!payload) {
      return this.blockedResult(snapshot, request, generatedAt, [`surface_not_found:${request.surface}`]);
    }

    const action = this.findAction(payload, request);
    if (!action) {
      return this.blockedResult(snapshot, request, generatedAt, [`action_not_found:${request.actionId || request.actionKind || '<unspecified>'}`]);
    }

    const blockers = this.resolveBlockers(action);
    const mapping = HANDLER_BY_ACTION[action.kind];
    if (!mapping) {
      blockers.push(`handler_not_mapped:${action.kind}`);
    }
    const status: CapabilityPreflightActionHandlerStatus = blockers.length > 0 ? 'blocked' : 'handler_ready';
    const userConfirmed = request.userConfirmed === true;

    return {
      gate: 'capability-autopilot-preflight-action-handler',
      generatedAt,
      surface: 'capability-autopilot-preflight-action-handler',
      status,
      capabilityId: snapshot.capabilityId,
      sourceSurface: payload.surface,
      sourceAction: {
        id: action.id,
        kind: action.kind,
        label: action.label,
      },
      handlerKind: mapping?.handlerKind || null,
      handlerStage: mapping?.handlerStage || null,
      target: {
        command: action.command || null,
        route: action.route || null,
        callbackData: action.callbackData || null,
      },
      requiresExplicitUserAction: true,
      requiresApproval: mapping?.requiresApproval || false,
      requiresValidation: mapping?.requiresValidation || false,
      userConfirmed,
      readyForExplicitDispatch: status === 'handler_ready' && userConfirmed,
      shouldRunAutomatically: false,
      dispatchAttempted: false,
      blockers,
      safeSummary: this.buildSafeSummary(action, mapping?.handlerKind || null, status),
      metadata: {
        gate: 'capability-autopilot-preflight-action-handler',
        sourceSnapshotGate: snapshot.gate,
        sourcePayloadSurface: payload.surface,
        sourceActionId: action.id,
        sourceActionKind: action.kind,
        autoExecute: false,
        dispatchAttempted: false,
      },
    };
  }

  public buildWiringSnapshot(
    snapshot: CapabilityAutopilotPreflightSnapshot,
  ): CapabilityPreflightActionHandlerSnapshot {
    const generatedAt = this.now().toISOString();
    const plans = snapshot.payloads.flatMap((payload) =>
      payload.actions.map((action) =>
        this.handleAction(snapshot, {
          surface: payload.surface,
          actionId: action.id,
        }),
      ),
    );
    const checks = this.buildChecks(snapshot, plans);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'capability-autopilot-preflight-action-handler',
      surface: 'capability-autopilot-preflight-action-handler',
      generatedAt,
      capabilityId: snapshot.capabilityId,
      status: failed > 0 ? 'blocked' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      sourceSnapshotGate: snapshot.gate,
      plans,
      checks,
      nextRecommendedGate: {
        gate: 'capability-autopilot-preflight-dispatch-receipt',
        title: 'Preflight Handler Execution Receipts',
        reason:
          'Depois de mapear actions para handlers explicitos, o proximo passo e gerar receipts de dispatch sem executar repair, fallback ou resume automaticamente.',
      },
      metadata: {
        gate: 'capability-autopilot-preflight-action-handler',
        sourceSnapshotStatus: snapshot.status,
        payloadCount: snapshot.payloads.length,
        actionPlanCount: plans.length,
        autoExecute: false,
        dispatchAttempted: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightActionHandlerSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-actions] Preflight Action Handler Wiring');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`plans: ${snapshot.plans.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private findAction(
    payload: CapabilityPreflightSurfacePayload,
    request: CapabilityPreflightActionHandlerRequest,
  ): CapabilityPreflightSurfaceAction | null {
    return payload.actions.find((action) =>
      (request.actionId && action.id === request.actionId) ||
      (request.actionKind && action.kind === request.actionKind) ||
      (request.route && action.route === request.route) ||
      (request.command && action.command === request.command) ||
      (request.callbackData && action.callbackData === request.callbackData)
    ) || null;
  }

  private resolveBlockers(action: CapabilityPreflightSurfaceAction): string[] {
    const blockers: string[] = [];
    if (!action.enabled) {
      blockers.push('action_disabled');
    }
    if (action.requiresExplicitUserAction !== true) {
      blockers.push('missing_explicit_user_action_contract');
    }
    return blockers;
  }

  private buildChecks(
    source: CapabilityAutopilotPreflightSnapshot,
    plans: CapabilityPreflightActionHandlerResult[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, plans });
    const blocked = plans.filter((plan) => plan.status === 'blocked');
    const sensitivePlans = plans.filter((plan) =>
      plan.sourceAction?.kind === 'request_permission' ||
      plan.sourceAction?.kind === 'show_fallbacks' ||
      plan.sourceAction?.kind === 'run_validation' ||
      plan.sourceAction?.kind === 'resume_after_check'
    );
    const sourceActionCount = source.payloads.reduce((sum, payload) => sum + payload.actions.length, 0);

    return [
      this.check(
        'capability-autopilot-preflight-actions:coverage',
        'actions mapeadas',
        plans.length === sourceActionCount && blocked.length === 0 ? 'pass' : 'fail',
        'Toda action de preflight precisa ter um handler seguro mapeado.',
        [
          `sourceActions=${sourceActionCount}`,
          `plans=${plans.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((plan) => `${plan.sourceSurface}:${plan.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-actions:no-auto-dispatch',
        'sem dispatch automatico',
        plans.every((plan) =>
          plan.shouldRunAutomatically === false &&
          plan.dispatchAttempted === false &&
          plan.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Este gate so prepara wiring; nenhum handler pode despachar execucao automaticamente.',
        plans.map((plan) =>
          `${plan.sourceSurface}:${plan.sourceAction?.kind || '<none>'}:auto=${plan.shouldRunAutomatically}:dispatch=${plan.dispatchAttempted}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-actions:explicit-only',
        'somente acao explicita',
        plans.every((plan) => plan.requiresExplicitUserAction === true && plan.readyForExplicitDispatch === false) ? 'pass' : 'fail',
        'O snapshot de wiring nasce sem confirmacao do usuario; dispatch explicito fica para o chamador.',
        plans.map((plan) =>
          `${plan.sourceSurface}:${plan.sourceAction?.kind || '<none>'}:confirmed=${plan.userConfirmed}:ready=${plan.readyForExplicitDispatch}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-actions:sensitive-gates',
        'acoes sensiveis preservam gates',
        sensitivePlans.every((plan) =>
          plan.requiresExplicitUserAction &&
          (
            plan.sourceAction?.kind === 'request_permission'
              ? plan.requiresApproval
              : true
          ) &&
          (
            plan.sourceAction?.kind === 'run_validation' || plan.sourceAction?.kind === 'resume_after_check'
              ? plan.requiresValidation
              : true
          )
        ) ? 'pass' : 'fail',
        'Permissao, fallback, validacao e resume precisam continuar visiveis e governados.',
        sensitivePlans.map((plan) =>
          `${plan.sourceSurface}:${plan.sourceAction?.kind}:approval=${plan.requiresApproval}:validation=${plan.requiresValidation}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-actions:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Wiring publico nao pode reintroduzir chaves de intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private blockedResult(
    snapshot: CapabilityAutopilotPreflightSnapshot,
    request: CapabilityPreflightActionHandlerRequest,
    generatedAt: string,
    blockers: string[],
  ): CapabilityPreflightActionHandlerResult {
    return {
      gate: 'capability-autopilot-preflight-action-handler',
      generatedAt,
      surface: 'capability-autopilot-preflight-action-handler',
      status: 'blocked',
      capabilityId: snapshot.capabilityId,
      sourceSurface: request.surface,
      sourceAction: null,
      handlerKind: null,
      handlerStage: null,
      target: {
        command: null,
        route: null,
        callbackData: null,
      },
      requiresExplicitUserAction: true,
      requiresApproval: false,
      requiresValidation: false,
      userConfirmed: request.userConfirmed === true,
      readyForExplicitDispatch: false,
      shouldRunAutomatically: false,
      dispatchAttempted: false,
      blockers,
      safeSummary: `Action handler bloqueado: ${blockers.join(', ')}.`,
      metadata: {
        gate: 'capability-autopilot-preflight-action-handler',
        sourceSnapshotGate: snapshot.gate,
        requestedSurface: request.surface,
        requestedActionId: request.actionId || null,
        requestedActionKind: request.actionKind || null,
        autoExecute: false,
        dispatchAttempted: false,
      },
    };
  }

  private buildSafeSummary(
    action: CapabilityPreflightSurfaceAction,
    handlerKind: CapabilityPreflightActionHandlerKind | null,
    status: CapabilityPreflightActionHandlerStatus,
  ): string {
    if (status === 'blocked') {
      return `Action ${action.kind} is blocked for safe wiring.`;
    }
    return `Action ${action.kind} mapeada para ${handlerKind}; nada foi executado automaticamente.`;
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
