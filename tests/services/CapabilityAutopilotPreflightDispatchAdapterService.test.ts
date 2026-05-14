import type { CapabilityAutopilotPreflightSnapshot } from '../../src/services/CapabilityAutopilotPreflightEntrypointService';
import { CapabilityAutopilotPreflightActionHandlerService } from '../../src/services/CapabilityAutopilotPreflightActionHandlerService';
import { CapabilityAutopilotPreflightDispatchAdapterService } from '../../src/services/CapabilityAutopilotPreflightDispatchAdapterService';
import { CapabilityAutopilotPreflightDispatchReceiptService } from '../../src/services/CapabilityAutopilotPreflightDispatchReceiptService';
import { CapabilityAutopilotPreflightSurfaceService } from '../../src/services/CapabilityAutopilotPreflightSurfaceService';
import type {
  CapabilityPreflightHintKind,
  CapabilityPreflightHintResult,
} from '../../src/services/CapabilityAutopilotPreflightHintService';
import type { CapabilityReadinessSnapshot } from '../../src/contracts/CapabilityAutopilotContract';

const FIXED_NOW = new Date('2026-04-26T06:00:00.000Z');

const readiness: CapabilityReadinessSnapshot = {
  capabilityId: 'executor-gemini-cli',
  generatedAt: FIXED_NOW.toISOString(),
  status: 'missing',
  severity: 'error',
  ready: false,
  safeToRun: false,
  summary: 'Gemini CLI ainda nao esta pronto.',
  detail: 'Autenticacao ausente.',
  checkedTargets: [],
  missingRequirements: [],
  blockingReason: 'missing_auth',
  probe: null,
  executor: null,
  evidence: [],
};

function createHint(
  hintKind: CapabilityPreflightHintKind,
  recommendedNextAction: string | null,
): CapabilityPreflightHintResult {
  return {
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'hint_available',
    hintKind,
    readiness: hintKind === 'ready'
      ? {
        ...readiness,
        status: 'ready',
        severity: 'info',
        ready: true,
        safeToRun: true,
        summary: 'Gemini CLI esta pronto.',
        blockingReason: null,
      }
      : readiness,
    recall: {
      generatedAt: FIXED_NOW.toISOString(),
      status: 'match_found',
      query: {
        capabilityId: 'executor-gemini-cli',
        workspaceHash: 'w'.repeat(64),
        intentFingerprint: 'i'.repeat(64),
        failureKind: 'missing_auth',
      },
      matches: [],
      bestMatch: null,
      shouldPreloadHint: true,
      recommendedNextAction,
      safeSummary: 'Memoria procedural redigida. Nada deve ser executado automaticamente.',
      metadata: {
        autoExecute: false,
      },
    },
    headline: 'Preflight conhecido.',
    userSummary: 'Existe uma dica de preflight, mas nada sera executado automaticamente.',
    technicalSummary: `preflightHint=hint_available; hintKind=${hintKind}; autoExecute=false`,
    recommendedNextAction,
    shouldAskPermission: hintKind === 'permission' || hintKind === 'fallback' || hintKind === 'repair',
    requiresExplicitUserChoice: hintKind === 'permission' || hintKind === 'fallback' || hintKind === 'repair',
    shouldRunAutomatically: false,
    metadata: {
      autoExecute: false,
    },
  };
}

function createSnapshot(hint: CapabilityPreflightHintResult): CapabilityAutopilotPreflightSnapshot {
  const surfaceService = new CapabilityAutopilotPreflightSurfaceService({
    now: () => FIXED_NOW,
  });
  const payloads = surfaceService.buildPayloads(hint, ['cli', 'web', 'chat', 'telegram', 'api']);

  return {
    phase: '68',
    surface: 'capability-autopilot-preflight-entrypoint',
    generatedAt: FIXED_NOW.toISOString(),
    capabilityId: 'executor-gemini-cli',
    status: 'ready',
    summary: {
      ok: true,
      passed: 6,
      warnings: 0,
      failed: 0,
    },
    hint,
    records: [],
    payloads,
    checks: [],
    nextRecommendedPhase: {
      phase: '69',
      title: 'Preflight Action Handler Wiring',
      reason: 'Wire explicit actions.',
    },
    metadata: {
      autoExecute: false,
    },
  };
}

function createServices() {
  const actionHandlerService = new CapabilityAutopilotPreflightActionHandlerService({
    now: () => FIXED_NOW,
  });
  const receiptService = new CapabilityAutopilotPreflightDispatchReceiptService({
    now: () => FIXED_NOW,
    actionHandlerService,
  });
  const adapterService = new CapabilityAutopilotPreflightDispatchAdapterService({
    now: () => FIXED_NOW,
  });
  return {
    actionHandlerService,
    receiptService,
    adapterService,
  };
}

describe('CapabilityAutopilotPreflightDispatchAdapterService', () => {
  it('builds adapter envelopes for all receipt surfaces without invocation', () => {
    const { receiptService, adapterService } = createServices();
    const source = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const receipts = receiptService.buildReceiptSnapshot(source, {
      explicitlyConfirmed: true,
      confirmationId: 'confirm-adapters',
      actorId: 'operator-1',
    });

    const adapters = adapterService.buildAdapterSnapshot(receipts);

    expect(adapters).toMatchObject({
      phase: '71',
      status: 'ready',
      summary: {
        ok: true,
        failed: 0,
      },
      metadata: {
        autoExecute: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    });
    expect(adapters.envelopes.length).toBe(receipts.receipts.length);
    expect(adapters.envelopes.every((envelope) => envelope.status === 'adapter_ready')).toBe(true);
    expect(adapters.envelopes.every((envelope) => envelope.adapterInvoked === false)).toBe(true);
    expect(adapters.envelopes.every((envelope) => envelope.dispatchExecuted === false)).toBe(true);
    expect(adapters.envelopes.some((envelope) => envelope.adapterKind === 'cli_command_preview')).toBe(true);
    expect(adapters.envelopes.some((envelope) => envelope.adapterKind === 'web_route_intent')).toBe(true);
    expect(adapters.envelopes.some((envelope) => envelope.adapterKind === 'api_operation_descriptor')).toBe(true);
    expect(adapters.envelopes.some((envelope) => envelope.adapterKind === 'chat_callback_ack')).toBe(true);
    expect(adapters.envelopes.some((envelope) => envelope.adapterKind === 'telegram_callback_ack')).toBe(true);
    expect(JSON.stringify(adapters)).not.toContain('rawText');
    expect(JSON.stringify(adapters)).not.toContain('normalizedText');
  });

  it('keeps web/API routes and chat/Telegram callbacks in their own adapter targets', () => {
    const { receiptService, adapterService } = createServices();
    const source = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const receipts = receiptService.buildReceiptSnapshot(source, {
      explicitlyConfirmed: true,
    });

    const adapters = adapterService.buildAdapterSnapshot(receipts);
    const webPermission = adapters.envelopes.find((envelope) =>
      envelope.sourceSurface === 'web' &&
      envelope.sourceAction?.kind === 'request_permission'
    );
    const apiPermission = adapters.envelopes.find((envelope) =>
      envelope.sourceSurface === 'api' &&
      envelope.sourceAction?.kind === 'request_permission'
    );
    const chatPermission = adapters.envelopes.find((envelope) =>
      envelope.sourceSurface === 'chat' &&
      envelope.sourceAction?.kind === 'request_permission'
    );
    const telegramPermission = adapters.envelopes.find((envelope) =>
      envelope.sourceSurface === 'telegram' &&
      envelope.sourceAction?.kind === 'request_permission'
    );

    expect(webPermission).toMatchObject({
      adapterKind: 'web_route_intent',
      target: {
        route: '/capabilities/executor-gemini-cli/autopilot/preflight/permission',
        method: 'GET',
      },
    });
    expect(apiPermission).toMatchObject({
      adapterKind: 'api_operation_descriptor',
      target: {
        route: '/api/capabilities/executor-gemini-cli/autopilot/preflight/permission',
        method: 'POST',
      },
    });
    expect(chatPermission).toMatchObject({
      adapterKind: 'chat_callback_ack',
      target: {
        callbackData: 'capability_autopilot_preflight:executor-gemini-cli:permission',
      },
    });
    expect(telegramPermission).toMatchObject({
      adapterKind: 'telegram_callback_ack',
      target: {
        callbackData: 'capability_autopilot_preflight:executor-gemini-cli:permission',
      },
    });
  });

  it('preserves validation requirements for resume adapters', () => {
    const { receiptService, adapterService } = createServices();
    const source = createSnapshot(createHint(
      'ready',
      'resume_original_intent_after_readiness_check',
    ));
    const receipts = receiptService.buildReceiptSnapshot(source, {
      explicitlyConfirmed: true,
    });

    const adapters = adapterService.buildAdapterSnapshot(receipts);
    const apiResume = adapters.envelopes.find((envelope) =>
      envelope.sourceSurface === 'api' &&
      envelope.sourceAction?.kind === 'resume_after_check'
    );

    expect(apiResume).toMatchObject({
      adapterKind: 'api_operation_descriptor',
      requiresValidation: true,
      dispatchExecuted: false,
      target: {
        route: '/api/capabilities/executor-gemini-cli/autopilot/preflight/resume',
        method: 'POST',
      },
    });
  });

  it('blocks adapter envelopes when receipts are not ready', () => {
    const { receiptService, adapterService } = createServices();
    const source = createSnapshot(createHint(
      'permission',
      'ask_for_explicit_approval_with_scoped_permissions',
    ));
    const receipts = receiptService.buildReceiptSnapshot(source, {
      explicitlyConfirmed: false,
    });

    const adapters = adapterService.buildAdapterSnapshot(receipts);

    expect(adapters.status).toBe('blocked');
    expect(adapters.envelopes.some((envelope) => envelope.status === 'blocked')).toBe(true);
    expect(adapters.envelopes[0]).toMatchObject({
      adapterInvoked: false,
      dispatchExecuted: false,
      sideEffectLevel: 'none',
    });
    expect(adapterService.renderReport(adapters)).toContain('Fase 71 - Preflight Dispatch Adapter Integration');
    expect(adapterService.renderReport(adapters)).toContain('proxima fase recomendada: 72 - Preflight Dispatch Side-Effect Gate');
  });
});
