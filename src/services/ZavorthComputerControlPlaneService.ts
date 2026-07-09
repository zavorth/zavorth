import crypto from 'node:crypto';
import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/index.js';
import {
  ZAVORTH_COMPUTER_CONTROL_PLANE_CONTRACT_VERSION,
  type ZavorthComputerControlAction,
  type ZavorthComputerControlInput,
  type ZavorthComputerControlReceipt,
  type ZavorthComputerControlSnapshot,
  type ZavorthComputerControlStatus,
  type ZavorthComputerPlanStep,
  type ZavorthComputerPlanStepKind,
  type ZavorthComputerRiskKind,
  type ZavorthComputerTargetKind,
} from '../contracts/ZavorthComputerControlPlaneContract.js';
import type { ZavorthVisionPolicyDecision } from '../contracts/ZavorthVisionControlPlaneContract.js';
import type { ComputerUseWatchModeService } from './ComputerUseWatchModeService.js';
import type { WatchModeSnapshot } from './computer-use-watch-mode/ComputerUseWatchModeSharedTypes.js';
import { ZavorthVisionControlPlaneService } from './ZavorthVisionControlPlaneService.js';
import { logger } from '../logger.js';

type WatchModeLike = Pick<
  ComputerUseWatchModeService,
  'buildSnapshot' | 'previewMutation' | 'pauseRun' | 'stopRun'
>;

type ComputerControlDeps = {
  watchMode?: WatchModeLike | null;
  vision?: ZavorthVisionControlPlaneService;
};

const DEFAULT_BUDGETS = {
  maxIterations: 8,
  maxScreenshots: 24,
  maxDurationMs: 10 * 60 * 1000,
  idleTtlMs: 2 * 60 * 1000,
};

const SENSITIVE_RULES: Array<{
  risk: ZavorthComputerRiskKind;
  pattern: RegExp;
  reason: string;
}> = [
  {
    risk: 'shell-launcher',
    pattern: /\b(win\s*\+\s*r|executar|run dialog|windows run)\b/i,
    reason: 'Run/Executar and shell launcher surfaces are blocked.',
  },
  {
    risk: 'terminal',
    pattern: /\b(powershell|pwsh|cmd(?:\.exe)?|command prompt|prompt de comando|windows terminal|terminal|conhost|wsl|bash|zsh|fish)\b/i,
    reason: 'Terminal or shell windows cannot be controlled through desktop automation.',
  },
  {
    risk: 'password-manager',
    pattern: /\b(bitwarden|1password|onepassword|lastpass|keepass|dashlane|keeper|password manager|gerenciador de senhas|senhas)\b/i,
    reason: 'Password manager surfaces are blocked.',
  },
  {
    risk: 'file-manager-outside-workspace',
    pattern: /\b(file explorer|windows explorer|explorer\.exe|gerenciador de arquivos|explorador de arquivos)\b/i,
    reason: 'File managers are blocked unless a later phase proves workspace-scoped control.',
  },
  {
    risk: 'banking-or-payment',
    pattern: /\b(bank|banco|pix|pagamento|payment|checkout|cartao|credit card|boleto|paypal|stripe)\b/i,
    reason: 'Banking, checkout and payment screens are blocked.',
  },
  {
    risk: 'seed-phrase-or-wallet',
    pattern: /\b(seed phrase|frase seed|wallet|carteira|metamask|ledger|trezor|private key|chave privada)\b/i,
    reason: 'Wallet, seed phrase and private key screens are blocked.',
  },
  {
    risk: 'mfa-or-auth',
    pattern: /\b(mfa|2fa|otp|authenticator|autenticador|login approval|aprovar login|captcha|passkey|webauthn)\b/i,
    reason: 'MFA, auth prompts, passkeys and CAPTCHA surfaces are blocked.',
  },
  {
    risk: 'destructive-or-exfiltration',
    pattern: /\b(delete|deletar|apagar tudo|formatar|exfiltrate|exfiltrar|send files|envie os arquivos|upload secrets|mande segredos)\b/i,
    reason: 'Destructive or exfiltration requests are blocked.',
  },
];

const MUTATING_STEP_KINDS = new Set<ZavorthComputerPlanStepKind>([
  'click-element',
  'type-text',
  'press-key',
]);

export class ZavorthComputerControlPlaneService {
  private readonly vision: ZavorthVisionControlPlaneService;
  private readonly watchMode: WatchModeLike | null;

  constructor(deps: ComputerControlDeps = {}) {
    this.vision = deps.vision || new ZavorthVisionControlPlaneService();
    this.watchMode = deps.watchMode === undefined ? null : deps.watchMode;
  }

  public async execute(input: ZavorthComputerControlInput = {}): Promise<ZavorthComputerControlSnapshot> {
    const action = normalizeAction(input.action);
    const sourceSurface = String(input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const watchSnapshot = this.safeWatchSnapshot();
    const hardBlocks = detectHardBlocks(input);
    const receipts: ZavorthComputerControlReceipt[] = [];

    if (hardBlocks.matched) {
      receipts.push(receipt('block', 'blocked', hardBlocks.reason || 'Computer control was blocked by hard safety policy.'));
      return this.buildSnapshot({
        input,
        action,
        sourceSurface,
        watchSnapshot,
        status: 'blocked',
        hardBlocks,
        steps: [],
        receipts,
        watchModeUsed: false,
        runId: input.runId || null,
      });
    }

    const steps = buildPlanSteps(input, action);
    const mutationRequested = steps.some((step) => step.mutation);
    const approvalRequired = mutationRequested && !input.approvalId;
    if (steps.length > 0) {
      receipts.push(receipt(
        'plan',
        approvalRequired ? 'approval-required' : 'done',
        approvalRequired
          ? 'Desktop plan contains click, type or key actions and requires owner approval.'
          : 'Desktop plan is read-only or carries an approval reference.',
      ));
    }

    let watchModeUsed = false;
    let runId = input.runId || null;
    if (action === 'computer.approve' && input.approvalId) {
      receipts.push(receipt(
        'approval',
        'done',
        'Approval reference accepted for supervised Watch Mode handoff; live mutation remains disabled in this preview.',
      ));
    }
    if (action === 'computer.cancel') {
      const cancelled = this.tryCancel(input);
      watchModeUsed = cancelled.used;
      runId = cancelled.runId || runId;
      receipts.push(receipt(
        'cancel',
        cancelled.used ? 'done' : 'skipped',
        cancelled.reason,
      ));
    }
    if (action === 'computer.observe') {
      receipts.push(receipt('watch-mode', 'done', 'Observe is read-only and can be handed to ComputerUseWatchModeService after capability approval.'));
    }
    if (action === 'computer.plan' && mutationRequested) {
      receipts.push(receipt('watch-mode', 'approval-required', 'ComputerUseWatchModeService is the canonical executor after approval.'));
    }

    const status = resolveStatus(action, approvalRequired, mutationRequested, this.watchMode !== null, false);
    return this.buildSnapshot({
      input,
      action,
      sourceSurface,
      watchSnapshot,
      status,
      hardBlocks,
      steps,
      receipts,
      watchModeUsed,
      runId,
      approvalRequired,
      mutationRequested,
    });
  }

  public buildSurfaceResponse(snapshot: ZavorthComputerControlSnapshot): SurfaceResponse {
    const receipts = snapshot.receipts.map((entry) => ({
      id: entry.id,
      title: entry.kind,
      status: mapReceiptStatus(entry.status),
      reason: entry.reason,
      policyProfile: snapshot.policy.profile,
      redacted: snapshot.vision.redaction.applied,
      riskBlocked: entry.status === 'blocked',
      createdAt: snapshot.generatedAt,
      metadata: {
        rawSecretSerialized: entry.rawSecretSerialized,
      },
    }));
    const actions = this.buildActions(snapshot);
    return createSurfaceResponse({
      id: `zavorth-computer-${safeId(snapshot.action)}-${safeId(snapshot.generatedAt)}`,
      intent: 'status',
      title: 'Computer Control Plane',
      summary: `${snapshot.status}: ${snapshot.policy.reason}`,
      tone: snapshot.status === 'blocked'
        ? 'danger'
        : snapshot.status === 'approval-required' || snapshot.status === 'redacted'
          ? 'warning'
          : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Desktop governado',
          text: this.formatSnapshotText(snapshot),
        },
        {
          kind: 'table',
          table: {
            title: 'Policy',
            columns: [
              { key: 'item', label: 'Item', width: 28 },
              { key: 'valor', label: 'Valor', width: 48 },
            ],
            rows: [
              { item: 'decision', valor: snapshot.policy.decision },
              { item: 'target', valor: snapshot.target.windowTitle || 'n/d' },
              { item: 'watch mode', valor: snapshot.watchMode.available ? 'available' : 'not attached' },
              { item: 'hard blocks', valor: snapshot.hardBlocks.matched ? snapshot.hardBlocks.risks.join(', ') : 'none' },
              { item: 'approval', valor: snapshot.plan.approvalRequired ? 'required' : 'not required' },
            ],
          },
        },
        ...buildComputerSetupBlocks(snapshot),
        {
          kind: 'list',
          title: 'Plano',
          items: snapshot.plan.steps.length > 0
            ? snapshot.plan.steps.map((step) => `${step.kind}: ${step.label} | approval=${step.requiresApproval ? 'yes' : 'no'}`)
            : ['No active plan. Use /computer observe or /computer plan.'],
        },
        ...receipts.map((entry) => ({
          kind: 'receipt' as const,
          receipt: entry,
        })),
      ],
      actions,
      receipts,
      metadata: {
        source: snapshot.source,
        action: snapshot.action,
        status: snapshot.status,
        mutationRequested: snapshot.plan.mutationRequested,
        watchModeAvailable: snapshot.watchMode.available,
        liveMutationPerformed: snapshot.safety.liveMutationPerformed,
        setupRequired: !snapshot.watchMode.available && snapshot.status !== 'blocked',
      },
    });
  }

  public formatSnapshotText(snapshot: ZavorthComputerControlSnapshot): string {
    return [
      'Computer Control Plane',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Window: ${snapshot.target.windowTitle || 'n/d'}`,
      `Policy: ${snapshot.policy.decision}`,
      `Watch Mode: available=${snapshot.watchMode.available} used=${snapshot.watchMode.used} run=${snapshot.watchMode.runId || 'n/d'}`,
      `Hard blocks: ${snapshot.hardBlocks.matched ? snapshot.hardBlocks.risks.join(', ') : 'none'}`,
      '',
      'Safety:',
      '- preview before click or typing',
      '- pause/cancel always available',
      '- terminal, Run/Executar and shell launchers blocked',
      '- password managers, wallets, banking, MFA and auth prompts blocked',
      '- file managers outside workspace blocked',
      '- budgets enforce screenshots, iterations, duration and idle timeout',
      '',
      'Plan:',
      ...(snapshot.plan.steps.length > 0
        ? snapshot.plan.steps.map((step) => `- ${step.kind}: ${step.label} | approval=${step.requiresApproval ? 'yes' : 'no'}`)
        : ['- none']),
      '',
      'Commands:',
      `- ${snapshot.commands.status}`,
      `- ${snapshot.commands.observe}`,
      `- ${snapshot.commands.plan}`,
      `- ${snapshot.commands.approve}`,
      `- ${snapshot.commands.cancel}`,
      '',
      `Next: ${snapshot.nextSafeAction}`,
    ].join('\n');
  }

  private buildSnapshot(input: {
    input: ZavorthComputerControlInput;
    action: ZavorthComputerControlAction;
    sourceSurface: string;
    watchSnapshot: WatchModeSnapshot | null;
    status: ZavorthComputerControlStatus;
    hardBlocks: HardBlockResult;
    steps: ZavorthComputerPlanStep[];
    receipts: ZavorthComputerControlReceipt[];
    watchModeUsed: boolean;
    runId: string | null;
    approvalRequired?: boolean;
    mutationRequested?: boolean;
  }): ZavorthComputerControlSnapshot {
    const budgets = resolveBudgets(input.input, input.watchSnapshot);
    const targetWindow = sanitizeTargetWindow(input.input.targetWindow);
    const vision = this.vision.buildSnapshot({
      action: 'vision.inspect',
      targetKind: 'desktop',
      targetRef: targetWindow,
      sourceSurface: input.sourceSurface,
      actorId: input.input.actorId,
      observationText: input.input.screenText || input.input.objective || targetWindow || 'Desktop control plane status.',
      requestedByNaturalLanguage: Boolean(input.input.objective),
      retentionTtlMs: 15 * 60 * 1000,
    });
    const redactedStatus = input.status === 'ready' && vision.status === 'redacted' ? 'redacted' : input.status;
    const mutationRequested = input.mutationRequested ?? input.steps.some((step) => step.mutation);
    const approvalRequired = input.approvalRequired ?? (mutationRequested && !input.input.approvalId);
    const decision = resolvePolicyDecision(redactedStatus, input.hardBlocks, mutationRequested, approvalRequired, vision.policy.decision);
    const planId = input.steps.length > 0 ? input.input.planId || makePlanId(input.input, input.steps) : input.input.planId || null;
    const planStatus = resolvePlanStatus(input.action, input.steps, input.hardBlocks, approvalRequired, input.input.approvalId);
    const policyReason = resolvePolicyReason(redactedStatus, input.hardBlocks, mutationRequested, approvalRequired, input.watchSnapshot !== null);

    return {
      contractVersion: ZAVORTH_COMPUTER_CONTROL_PLANE_CONTRACT_VERSION,
      generatedAt: new Date().toISOString(),
      source: 'ZavorthComputerControlPlaneService',
      status: redactedStatus,
      action: input.action,
      target: {
        kind: input.input.targetKind || 'desktop-window',
        windowTitle: targetWindow,
        sourceSurface: input.sourceSurface,
      },
      watchMode: {
        canonicalExecutor: 'ComputerUseWatchModeService',
        available: input.watchSnapshot !== null,
        used: input.watchModeUsed,
        runId: input.runId,
        activeStatus: input.watchSnapshot?.activeRun?.status || null,
        strictApprovalDefault: input.watchSnapshot?.policy.strictApprovalDefault ?? true,
        allowedApps: input.watchSnapshot?.policy.allowedApps || [],
        allowedSites: input.watchSnapshot?.policy.allowedSites || [],
        budgets,
      },
      plan: {
        id: planId,
        status: planStatus,
        steps: input.steps,
        mutationRequested,
        approvalRequired,
        approvalId: input.input.approvalId || null,
      },
      policy: {
        decision,
        profile: 'computer-control-checkpoint-3',
        reason: policyReason,
        mutationAllowed: false,
        providerPayloadMinimized: true,
      },
      hardBlocks: input.hardBlocks,
      safety: {
        previewBeforeClickOrTyping: true,
        pauseCancelAlwaysAvailable: true,
        terminalAutomationBlocked: true,
        runDialogBlocked: true,
        passwordManagersBlocked: true,
        fileManagersOutsideWorkspaceBlocked: true,
        bankingWalletMfaBlocked: true,
        maxScreenshotsEnforced: true,
        maxIterationsEnforced: true,
        maxDurationEnforced: true,
        idleTimeoutEnforced: true,
        rawSecretSerialized: false,
        liveMutationPerformed: false,
      },
      vision,
      receipts: [
        receipt('policy', decision, policyReason),
        receipt('vision', vision.policy.decision, 'Desktop evidence was minimized through Vision Control Plane.'),
        ...input.receipts,
      ],
      commands: {
        status: '/computer status',
        observe: '/computer observe',
        plan: '/computer plan',
        approve: '/computer approve <plan>',
        cancel: '/computer cancel',
        nextStage: 'Connector registry - Android ADB And Device Bridge',
      },
      nextSafeAction: nextSafeAction(redactedStatus, input.hardBlocks, mutationRequested, approvalRequired, input.watchSnapshot !== null),
    };
  }

  private safeWatchSnapshot(): WatchModeSnapshot | null {
    if (!this.watchMode) {
      return null;
    }
    try {
      return this.watchMode.buildSnapshot(6);
    } catch (error: unknown) {logger.warn('[Zavorth Computer Control Plane] connection failed', error); return null; }
  }

  private tryCancel(input: ZavorthComputerControlInput): { used: boolean; runId: string | null; reason: string } {
    const runId = String(input.runId || '').trim();
    if (!this.watchMode) {
      return {
        used: false,
        runId: runId || null,
        reason: 'Watch Mode executor is not attached; cancel is represented as a safe preview.',
      };
    }
    if (!runId) {
      return {
        used: false,
        runId: null,
        reason: 'No run id was supplied for cancel.',
      };
    }
    try {
      const run = this.watchMode.stopRun(runId, input.actorId || null);
      return {
        used: true,
        runId: run.runId,
        reason: `Watch Mode run ${run.runId} cancel requested.`,
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Computer Control Plane] lifecycle operation failed', error);
    return {
        used: false,
        runId,
        reason: error instanceof Error ? error.message : String(error),
      };
  }
  }

  private buildActions(snapshot: ZavorthComputerControlSnapshot): SurfaceResponseAction[] {
    const actions: SurfaceResponseAction[] = [
      commandAction('computer-status', 'Status', snapshot.commands.status, 'primary'),
      commandAction('computer-observe', 'Observe', snapshot.commands.observe, 'secondary'),
      commandAction('computer-plan', 'Plan', snapshot.commands.plan, 'secondary'),
      {
        ...commandAction('computer-approve', 'Approve', snapshot.plan.id ? `/computer approve ${snapshot.plan.id}` : snapshot.commands.approve, 'success'),
        confirmationRequired: true,
        disabled: !snapshot.plan.id,
      },
      commandAction('computer-cancel', 'Cancel', snapshot.watchMode.runId ? `/computer cancel ${snapshot.watchMode.runId}` : snapshot.commands.cancel, 'danger'),
    ];
    if (!snapshot.watchMode.available && snapshot.status !== 'blocked') {
      actions.push(
        commandAction('computer-watchmode', 'Watch Mode', '/watchmode', 'secondary'),
        commandAction('computer-watchmode-cli', 'Doctor desktop', 'npm run ops:watch-mode', 'secondary'),
      );
    }
    return actions;
  }
}

function buildComputerSetupBlocks(snapshot: ZavorthComputerControlSnapshot): SurfaceResponse['blocks'] {
  if (snapshot.watchMode.available || snapshot.status === 'blocked') {
    return [];
  }
  return [
    {
      kind: 'list',
      title: 'Ativar observacao do computador',
      tone: 'warning',
      items: [
        'O pedido natural ja foi roteado para desktop.',
        'Without Watch Mode attached, Zavorth returns a safe preview and does not touch the screen.',
        'Rode: /watchmode',
        'Pela CLI, rode: npm run ops:watch-mode',
        'After approval/configuration, supervised observation can be used naturally.',
      ],
    },
  ];
}

type HardBlockResult = {
  matched: boolean;
  risks: ZavorthComputerRiskKind[];
  reason: string | null;
};

function normalizeAction(value: unknown): ZavorthComputerControlAction {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'observe' || normalized === 'computer.observe') return 'computer.observe';
  if (normalized === 'plan' || normalized === 'computer.plan') return 'computer.plan';
  if (normalized === 'approve' || normalized === 'computer.approve') return 'computer.approve';
  if (normalized === 'cancel' || normalized === 'stop' || normalized === 'computer.cancel') return 'computer.cancel';
  return 'computer.status';
}

function detectHardBlocks(input: ZavorthComputerControlInput): HardBlockResult {
  const haystack = [
    input.targetWindow,
    input.objective,
    input.screenText,
    input.targetText,
    input.payload,
  ].map((entry) => String(entry || '')).join('\n');
  const matches = SENSITIVE_RULES.filter((rule) => rule.pattern.test(haystack));
  const risks = [...new Set(matches.map((entry) => entry.risk))];
  return {
    matched: risks.length > 0,
    risks,
    reason: matches.map((entry) => entry.reason).join(' ') || null,
  };
}

function buildPlanSteps(
  input: ZavorthComputerControlInput,
  action: ZavorthComputerControlAction,
): ZavorthComputerPlanStep[] {
  if (action === 'computer.status' || action === 'computer.cancel') {
    return [];
  }
  const targetWindow = sanitizeTargetWindow(input.targetWindow);
  const text = `${input.objective || ''} ${input.targetText || ''} ${input.payload || ''}`.toLowerCase();
  const steps: ZavorthComputerPlanStep[] = [
    planStep('focus-window', 'Focus approved target window', targetWindow, null, null),
    planStep('list-elements', 'List visible accessibility elements before acting', targetWindow, null, null),
    planStep('screenshot', 'Capture redacted screenshot metadata for observation', targetWindow, null, null),
  ];
  if (action === 'computer.observe') {
    return steps;
  }
  if (/\b(click|clicar|aperte|pressione|botao|button)\b/.test(text) || input.targetText) {
    steps.push(planStep('click-element', 'Click approved visible element', targetWindow, input.targetText || null, null));
  }
  if (/\b(type|digite|preencha|preencher|texto|input|campo)\b/.test(text) || input.payload) {
    steps.push(planStep('type-text', 'Type approved text after preview', targetWindow, input.targetText || null, input.payload || input.objective || null));
  }
  if (/\b(enter|tab|atalho|hotkey|ctrl|alt|pressione tecla|press key)\b/.test(text)) {
    steps.push(planStep('press-key', 'Press approved key after preview', targetWindow, null, input.payload || null));
  }
  return dedupeSteps(steps);
}

function planStep(
  kind: ZavorthComputerPlanStepKind,
  label: string,
  targetWindow: string | null,
  targetText: string | null,
  payloadPreview: string | null,
): ZavorthComputerPlanStep {
  const mutation = MUTATING_STEP_KINDS.has(kind);
  return {
    id: `step-${kind}`,
    kind,
    label,
    targetWindow,
    targetText: targetText ? safePreview(targetText, 80) : null,
    payloadPreview: payloadPreview ? safePreview(payloadPreview, 80) : null,
    mutation,
    requiresApproval: mutation,
    risk: mutation ? 'high' : 'low',
  };
}

function dedupeSteps(steps: ZavorthComputerPlanStep[]): ZavorthComputerPlanStep[] {
  const seen = new Set<string>();
  return steps.filter((step) => {
    if (seen.has(step.kind)) return false;
    seen.add(step.kind);
    return true;
  });
}

function resolveStatus(
  action: ZavorthComputerControlAction,
  approvalRequired: boolean,
  mutationRequested: boolean,
  watchModeAvailable: boolean,
  redacted: boolean,
): ZavorthComputerControlStatus {
  if (approvalRequired) return 'approval-required';
  if (redacted) return 'redacted';
  if (action === 'computer.observe' && watchModeAvailable) return 'watch-mode-ready';
  if (mutationRequested) return 'approval-required';
  return 'ready';
}

function resolvePolicyDecision(
  status: ZavorthComputerControlStatus,
  hardBlocks: HardBlockResult,
  mutationRequested: boolean,
  approvalRequired: boolean,
  visionDecision: ZavorthVisionPolicyDecision,
): ZavorthVisionPolicyDecision {
  if (hardBlocks.matched || status === 'blocked') return 'deny';
  if (approvalRequired || mutationRequested) return 'require_owner_approval';
  if (visionDecision === 'allow_with_redaction' || status === 'redacted') return 'allow_with_redaction';
  return 'allow_readonly';
}

function resolvePlanStatus(
  action: ZavorthComputerControlAction,
  steps: ZavorthComputerPlanStep[],
  hardBlocks: HardBlockResult,
  approvalRequired: boolean,
  approvalId: string | null | undefined,
): ZavorthComputerControlSnapshot['plan']['status'] {
  if (hardBlocks.matched) return 'blocked';
  if (steps.length === 0) return action === 'computer.cancel' ? 'cancelled-preview' : 'none';
  if (approvalRequired) return 'approval-required';
  if (action === 'computer.approve' && approvalId) return 'approved-preview';
  return 'planned';
}

function resolvePolicyReason(
  status: ZavorthComputerControlStatus,
  hardBlocks: HardBlockResult,
  mutationRequested: boolean,
  approvalRequired: boolean,
  watchModeAvailable: boolean,
): string {
  if (hardBlocks.matched) return hardBlocks.reason || 'Computer control target is blocked by hard policy.';
  if (status === 'blocked') return 'Computer control was blocked by policy.';
  if (approvalRequired) return 'Desktop click, type and key actions require owner approval before Watch Mode execution.';
  if (mutationRequested) return 'Desktop mutation remains preview-only even with an approval reference until Watch Mode applies it.';
  if (!watchModeAvailable) return 'Read-only desktop control plane is ready; attach ComputerUseWatchModeService for live supervised observation.';
  return 'Read-only desktop observation is allowed; ComputerUseWatchModeService is the canonical supervised executor.';
}

function nextSafeAction(
  status: ZavorthComputerControlStatus,
  hardBlocks: HardBlockResult,
  mutationRequested: boolean,
  approvalRequired: boolean,
  watchModeAvailable: boolean,
): string {
  if (hardBlocks.matched || status === 'blocked') {
    return 'Use a non-sensitive target window or ask for a safe explanation instead of UI control.';
  }
  if (approvalRequired) {
    return 'Review the preview and attach owner approval before any click, type or key action.';
  }
  if (!watchModeAvailable) {
    return 'Use this preview for planning, or wire the ComputerUseWatchModeService executor for live supervised observe.';
  }
  if (mutationRequested) {
    return 'Keep the plan previewed until approval is attached and Watch Mode is explicitly started.';
  }
  return 'Observe first, then request a plan before any desktop mutation.';
}

function resolveBudgets(
  input: ZavorthComputerControlInput,
  watchSnapshot: WatchModeSnapshot | null,
): ZavorthComputerControlSnapshot['watchMode']['budgets'] {
  const base = watchSnapshot?.policy.defaultBudget;
  return {
    maxIterations: positiveNumber(input.maxIterations, base?.maxIterations || DEFAULT_BUDGETS.maxIterations),
    maxScreenshots: positiveNumber(input.maxScreenshots, base?.maxScreenshots || DEFAULT_BUDGETS.maxScreenshots),
    maxDurationMs: positiveNumber(input.maxDurationMs, base?.maxDurationMs || DEFAULT_BUDGETS.maxDurationMs),
    idleTtlMs: positiveNumber(input.idleTtlMs, base?.idleTtlMs || DEFAULT_BUDGETS.idleTtlMs),
  };
}

function makePlanId(
  input: ZavorthComputerControlInput,
  steps: ZavorthComputerPlanStep[],
): string {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify({
      targetWindow: input.targetWindow || null,
      objective: input.objective || null,
      steps: steps.map((step) => step.kind),
    }))
    .digest('hex');
  return `computer-plan-${hash.slice(0, 16)}`;
}

function receipt(
  kind: ZavorthComputerControlReceipt['kind'],
  status: ZavorthComputerControlReceipt['status'],
  reason: string,
): ZavorthComputerControlReceipt {
  return {
    id: `computer-${kind}-${safeId(status)}-${hashShort(reason)}`,
    kind,
    status,
    reason,
    rawSecretSerialized: false,
  };
}

function mapReceiptStatus(status: ZavorthComputerControlReceipt['status']): SurfaceReceiptStatus {
  if (status === 'allow_readonly') return 'allowed';
  if (status === 'allow_with_redaction') return 'allowed_with_redaction';
  if (status === 'require_user_confirmation') return 'require_user_confirmation';
  if (status === 'require_admin_policy' || status === 'require_owner_approval' || status === 'approval-required') return 'require_admin_policy';
  if (status === 'deny') return 'denied';
  if (status === 'blocked') return 'blocked';
  if (status === 'skipped') return 'blocked';
  return 'done';
}

function sanitizeTargetWindow(value: unknown): string | null {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  return normalized ? safePreview(normalized, 120) : null;
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function commandAction(
  id: string,
  label: string,
  command: string,
  style: SurfaceResponseAction['style'],
): SurfaceResponseAction {
  return {
    id,
    label,
    kind: 'command',
    command,
    callbackData: command,
    style,
  };
}

function hashShort(value: unknown): string {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 8);
}

function safePreview(value: unknown, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function safeId(value: unknown): string {
  const text = String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return text || 'item';
}
