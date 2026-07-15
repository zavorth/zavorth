import {
  createSurfaceResponse,
  type SurfaceReceiptStatus,
  type SurfaceResponse,
  type SurfaceResponseAction,
} from '../domain/surface/application/surface-response/index.js';
import {
  ZAVORTH_PERCEPTION_INVOCATION_CONTRACT_VERSION,
  type ZavorthPerceptionInvocationInput,
  type ZavorthPerceptionInvocationPlan,
  type ZavorthPerceptionInvocationStatus,
  type ZavorthPerceptionActivationHint,
  type ZavorthPerceptionRoleId,
  type ZavorthPerceptionRouteKind,
  type ZavorthPerceptionSurfaceCommand,
  type ZavorthPerceptionTargetKind,
} from '../contracts/ZavorthPerceptionInvocationContract.js';

import type { ZavorthGovernedSubagentProfileId } from '../contracts/runtime/ZavorthGovernedSubagentContract.js';
import type { ZavorthSubagentRuntimeSnapshot } from '../contracts/runtime/ZavorthSubagentRuntimeContract.js';

type RouteIntent = {
  targetKind: ZavorthPerceptionTargetKind;
  primaryRoute: ZavorthPerceptionRouteKind;
  routes: ZavorthPerceptionRouteKind[];
  confidence: number;
  mutationRequested: boolean;
  sensitive: boolean;
  explicitSubagents: boolean;
};

type RenderOptions = {
  subagentRuntime?: ZavorthSubagentRuntimeSnapshot | null;
};

/**
 * Free-text purity: this router never keyword-activates product routes from NL.
 * Routes, mutation, sensitive, and subagent paths require structured input flags
 * (tools / slash / UI). Free text is observation payload only.
 */
export class ZavorthPerceptionInvocationRouter {
  /**
   * Free text never activates perception as a feature router.
   * Structured callers should invoke plan() with explicit flags.
   */
  public canHandle(_text: string): boolean {
    return false;
  }

  public plan(input: ZavorthPerceptionInvocationInput): ZavorthPerceptionInvocationPlan {
    const text = String(input.text || '').trim();
    const channel = String(input.channel || input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const actorId = String(input.actorId || '').trim() || null;
    const intent = resolveIntent(input);
    const status = resolveStatus(intent, input.approvalId || null);
    const targetLabel = resolveTargetLabel(text, intent.targetKind);
    const sourceSurface = channel;
    const factsObserved = buildFacts(intent);
    const actionsBlocked = buildBlockedActions(intent);
    const perceptionRoles = selectPerceptionRoles(intent);
    const runtimeRoleIds = mapRuntimeRoles(perceptionRoles);
    const liveRequested = input.liveRequested === true;

    return {
      generatedAt: new Date().toISOString(),
      contractVersion: ZAVORTH_PERCEPTION_INVOCATION_CONTRACT_VERSION,
      source: 'ZavorthPerceptionInvocationRouter',
      status,
      requestText: text,
      channel,
      actorId,
      primaryRoute: intent.primaryRoute,
      routes: intent.routes,
      confidence: intent.confidence,
      target: {
        kind: intent.targetKind,
        label: targetLabel,
        liveRequested,
        mutationRequested: intent.mutationRequested,
        sensitive: intent.sensitive,
      },
      commands: {
        vision: buildVisionInput(text, intent, sourceSurface, actorId, input.visionAction || null),
        browser: intent.routes.includes('browser') ? buildBrowserInput(text, intent, sourceSurface, actorId) : null,
        computer: intent.routes.includes('computer') ? buildComputerInput(text, intent, sourceSurface, actorId) : null,
        android: intent.routes.includes('android')
          ? buildAndroidInput(text, intent, sourceSurface, actorId, liveRequested)
          : null,
        subagent: intent.routes.includes('subagent_perception')
          ? {
              task: buildSubagentTask(text, intent, factsObserved, actionsBlocked),
              mode: 'oneshot',
              perceptionRoles,
              runtimeRoleIds,
              readOnlyOnly: true,
            }
          : null,
      },
      approval: {
        required: intent.mutationRequested || intent.sensitive,
        reason: intent.sensitive
          ? 'Sensitive visual/device target flagged; only explanation is allowed until the user chooses a safe target.'
          : intent.mutationRequested
            ? 'Any click, tap, type, keyevent, intent or desktop mutation requires owner approval.'
            : null,
        approvalId: input.approvalId || null,
      },
      explanation: {
        factsObserved,
        inferences: buildInferences(intent),
        actionsExecuted: ['No live mutation was executed by the router.'],
        actionsBlocked,
        nextStep: nextStep(intent),
      },
      safety: {
        policyBrokerRequired: true,
        readOnlyObservationAllowed: true,
        subagentsReadOnlyOnly: true,
        mutationRequiresApproval: true,
        liveCaptureExplicitOnly: true,
        noRawSecretsSerialized: true,
        promptInjectionEvidenceIsUntrusted: true,
      },
      activation: {
        normalUserDoesNotNeedManualCommand: true,
        autoUseWhenReady: true,
        setupShownOnlyWhenCapabilityMissing: true,
        hints: buildActivationHints(intent),
      },
      surfaceCommands: buildSurfaceCommands(intent, text),
      receipts: [
        receipt('route', 'done', `Selected ${intent.primaryRoute} for ${intent.targetKind}.`),
        receipt(
          'policy',
          status === 'denied' ? 'blocked' : status === 'approval-required' ? 'approval-required' : 'done',
          statusReason(status, intent),
        ),
        ...(intent.routes.includes('subagent_perception')
          ? [
              receipt(
                'subagent',
                'done',
                'Read-only perception subagents selected: observer, evidence-summarizer and safety-reviewer.',
              ),
            ]
          : []),
      ],
    };
  }

  public buildSurfaceResponse(plan: ZavorthPerceptionInvocationPlan, options: RenderOptions = {}): SurfaceResponse {
    const receipts = plan.receipts.map((entry) => ({
      id: entry.id,
      title: entry.kind,
      status: mapReceiptStatus(entry.status),
      reason: entry.reason,
      policyProfile: 'perception-invocation-checkpoint-5',
      redacted: false,
      riskBlocked: entry.status === 'blocked',
      createdAt: plan.generatedAt,
      metadata: {
        rawSecretSerialized: entry.rawSecretSerialized,
      },
    }));
    const execution = options.subagentRuntime
      ? `Subagents: ${options.subagentRuntime.status}; workers=${options.subagentRuntime.summary?.workerResults ?? 0}; live=${options.subagentRuntime.summary?.liveRuns ?? 0}.`
      : 'Subagents: not executed in this response.';
    const activationItems = buildActivationSetupItems(plan);

    return createSurfaceResponse({
      id: `zavorth-perception-${safeId(plan.primaryRoute)}-${safeId(plan.generatedAt)}`,
      intent: 'status',
      title: 'Perception Invocation Router',
      summary: `${plan.primaryRoute}: ${plan.explanation.nextStep}`,
      tone: plan.status === 'denied' ? 'danger' : plan.status === 'approval-required' ? 'warning' : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Natural reading',
          text: [
            'Perception Invocation Router',
            '',
            `Status: ${plan.status}`,
            `Route: ${plan.primaryRoute}`,
            `Target: ${plan.target.kind} (${plan.target.label})`,
            `Confidence: ${plan.confidence}`,
            execution,
            '',
            'Facts observed:',
            ...plan.explanation.factsObserved.map((entry) => `- ${entry}`),
            '',
            'Inferences:',
            ...plan.explanation.inferences.map((entry) => `- ${entry}`),
            '',
            'Actions executed:',
            ...plan.explanation.actionsExecuted.map((entry) => `- ${entry}`),
            '',
            'Actions blocked:',
            ...plan.explanation.actionsBlocked.map((entry) => `- ${entry}`),
            '',
            `Next step: ${plan.explanation.nextStep}`,
          ].join('\n'),
        },
        {
          kind: 'list',
          title: 'Equivalent commands',
          items: plan.surfaceCommands.slice(0, 8).map((command) => `${command.label}: ${command.command}`),
        },
        ...(activationItems.length > 0
          ? [
              {
                kind: 'list' as const,
                title: 'Activation when capability is missing',
                items: activationItems,
              },
            ]
          : []),
        ...receipts.map((entry) => ({
          kind: 'receipt' as const,
          receipt: entry,
        })),
      ],
      actions: buildActions(plan),
      receipts,
      metadata: {
        source: plan.source,
        primaryRoute: plan.primaryRoute,
        routes: plan.routes,
        mutationRequested: plan.target.mutationRequested,
        approvalRequired: plan.approval.required,
      },
    });
  }

  public formatPlanText(plan: ZavorthPerceptionInvocationPlan): string {
    return [
      'Perception Invocation Router',
      '',
      `Status: ${plan.status}`,
      `Route: ${plan.primaryRoute}`,
      `Target: ${plan.target.kind} (${plan.target.label})`,
      `Confidence: ${plan.confidence}`,
      `Approval: ${plan.approval.required ? plan.approval.reason || 'required' : 'not required'}`,
      '',
      'Facts observed:',
      ...plan.explanation.factsObserved.map((entry) => `- ${entry}`),
      '',
      'Inferences:',
      ...plan.explanation.inferences.map((entry) => `- ${entry}`),
      '',
      'Actions executed:',
      ...plan.explanation.actionsExecuted.map((entry) => `- ${entry}`),
      '',
      'Actions blocked:',
      ...plan.explanation.actionsBlocked.map((entry) => `- ${entry}`),
      '',
      'Equivalent commands:',
      ...plan.surfaceCommands.map((command) => `- ${command.command}`),
      '',
      'Activation when capability is missing:',
      ...plan.activation.hints
        .filter((hint) => hint.state !== 'ready')
        .flatMap((hint) => [
          `- ${hint.title}: ${hint.reason}`,
          ...hint.commands.slice(0, 3).map((command) => `  command: ${command}`),
        ]),
      '',
      `Next step: ${plan.explanation.nextStep}`,
    ].join('\n');
  }
}

function resolveIntent(input: ZavorthPerceptionInvocationInput): RouteIntent {
  // Structured flags only — free text never activates routes or safety blocks.
  const explicitSubagents = input.requestSubagents === true || input.complexReview === true;
  const mutationRequested = input.mutationRequested === true;
  const sensitive = input.sensitive === true;
  const targetKind = normalizeTargetKind(input.targetKind);
  const baseRoute = routeForTarget(targetKind);
  const routes = uniqueRoutes([
    explicitSubagents ? 'subagent_perception' : baseRoute,
    explicitSubagents ? baseRoute : null,
  ]);
  return {
    targetKind,
    primaryRoute: sensitive ? 'deny' : routes[0] || 'vision',
    routes: sensitive ? ['deny', baseRoute] : routes,
    confidence: confidenceFor(targetKind, explicitSubagents),
    mutationRequested,
    sensitive,
    explicitSubagents,
  };
}

function normalizeTargetKind(value: unknown): ZavorthPerceptionTargetKind {
  const kind = String(value || '')
    .trim()
    .toLowerCase();
  if (
    kind === 'android' ||
    kind === 'browser' ||
    kind === 'desktop' ||
    kind === 'artifact' ||
    kind === 'visual' ||
    kind === 'unknown'
  ) {
    return kind;
  }
  // Default when no structured target is provided.
  return 'unknown';
}

function routeForTarget(targetKind: ZavorthPerceptionTargetKind): ZavorthPerceptionRouteKind {
  if (targetKind === 'android') return 'android';
  if (targetKind === 'browser') return 'browser';
  if (targetKind === 'desktop') return 'computer';
  return 'vision';
}

function buildVisionInput(
  text: string,
  intent: RouteIntent,
  sourceSurface: string,
  actorId: string | null,
  visionAction: ZavorthPerceptionInvocationInput['visionAction'],
): ZavorthPerceptionInvocationPlan['commands']['vision'] {
  const action =
    visionAction === 'vision.ocr' || visionAction === 'vision.explain' || visionAction === 'vision.inspect'
      ? visionAction
      : 'vision.inspect';
  return {
    action,
    targetKind:
      intent.targetKind === 'android'
        ? 'android'
        : intent.targetKind === 'browser'
          ? 'browser'
          : intent.targetKind === 'artifact'
            ? 'artifact'
            : intent.targetKind === 'desktop'
              ? 'desktop'
              : 'unknown',
    observationText: text,
    sourceSurface,
    actorId,
    requestedByNaturalLanguage: true,
  };
}

function buildBrowserInput(
  text: string,
  intent: RouteIntent,
  sourceSurface: string,
  actorId: string | null,
): ZavorthPerceptionInvocationPlan['commands']['browser'] {
  return {
    action: intent.mutationRequested ? 'browser.plan' : 'browser.inspect',
    url: extractFirstUrl(text),
    requestText: text,
    live: Boolean(extractFirstUrl(text)),
    sourceSurface,
    actorId,
  };
}

function buildComputerInput(
  text: string,
  intent: RouteIntent,
  sourceSurface: string,
  actorId: string | null,
): ZavorthPerceptionInvocationPlan['commands']['computer'] {
  return {
    action: intent.mutationRequested ? 'computer.plan' : 'computer.observe',
    targetWindow: extractNaturalWindowTitle(text),
    targetKind: 'desktop-window',
    objective: text,
    sourceSurface,
    actorId,
  };
}

function buildAndroidInput(
  text: string,
  intent: RouteIntent,
  sourceSurface: string,
  actorId: string | null,
  liveRequested: boolean,
): ZavorthPerceptionInvocationPlan['commands']['android'] {
  const action = intent.mutationRequested ? 'device.plan' : 'device.observe';
  return {
    action,
    objective: text,
    packageName: extractNaturalPackageName(text),
    sourceSurface,
    actorId,
    live: action !== 'device.plan' && liveRequested,
  };
}

function buildSubagentTask(
  text: string,
  intent: RouteIntent,
  factsObserved: string[],
  actionsBlocked: string[],
): string {
  return [
    'Analyze this perception request in read-only mode.',
    `Target: ${intent.targetKind}.`,
    `Request: ${text}`,
    `Initial facts: ${factsObserved.join(' | ')}`,
    `Blocks: ${actionsBlocked.join(' | ')}`,
    'Separate observed fact, inference, risk, blocked action, and next safe step.',
  ].join('\n');
}

function selectPerceptionRoles(intent: RouteIntent): ZavorthPerceptionRoleId[] {
  const roles: ZavorthPerceptionRoleId[] = ['observer', 'evidence-summarizer', 'safety-reviewer'];
  if (intent.mutationRequested) roles.splice(1, 0, 'ui-navigator');
  return roles;
}

function mapRuntimeRoles(roles: ZavorthPerceptionRoleId[]): ZavorthGovernedSubagentProfileId[] {
  const mapped: ZavorthGovernedSubagentProfileId[] = ['researcher', 'auditor'];
  if (roles.includes('ui-navigator')) mapped.push('qa');
  return mapped;
}

function buildSurfaceCommands(intent: RouteIntent, text: string): ZavorthPerceptionSurfaceCommand[] {
  const request = firstLine(text, 80);
  const commands: ZavorthPerceptionSurfaceCommand[] = [
    surfaceCommand('vision', '/vision inspect', 'Vision', 'Inspect visual evidence read-only.', false),
    surfaceCommand('browser', '/computer browser inspect', 'Browser', 'Inspect browser DOM/PDF evidence.', false),
    surfaceCommand('computer', '/computer observe', 'Desktop', 'Observe desktop window read-only.', false),
    surfaceCommand('android', '/device inspect', 'Android', 'Inspect Android device read-only.', false),
  ];
  if (intent.mutationRequested) {
    commands.push(
      surfaceCommand('approval', '/perm pending', 'Approval', 'Review pending approval before mutation.', true),
    );
  }
  if (intent.routes.includes('subagent_perception')) {
    commands.push(
      surfaceCommand(
        'subagents',
        `/agents spawn "${request}"`,
        'Subagents',
        'Spawn read-only perception subagents.',
        false,
      ),
    );
  }
  return commands.filter(
    (command) =>
      command.id === intent.primaryRoute ||
      command.id === routeForTarget(intent.targetKind) ||
      ['approval', 'subagents', 'vision'].includes(command.id),
  );
}

function buildActivationHints(intent: RouteIntent): ZavorthPerceptionActivationHint[] {
  const hints: ZavorthPerceptionActivationHint[] = [
    activationHint({
      id: 'vision-ready',
      target: 'visual',
      state: 'ready',
      title: 'Vision ready',
      reason: 'User-provided visual evidence can be read without extra setup.',
      commands: ['/vision inspect'],
    }),
  ];

  if (intent.routes.includes('browser')) {
    hints.push(
      activationHint({
        id: 'browser-sidecar-setup',
        target: 'browser',
        state: 'setup-if-missing',
        title: 'Browser live',
        reason: 'Zavorth tries the browser sidecar automatically; if it is not ready, doctor and activation are shown.',
        userSteps: [
          'Run the sidecar doctor when live browser appears as not configured.',
          'Activate the browser sidecar once to allow read-only page inspection.',
        ],
        commands: [
          'zavorth doctor sidecars --profile=desktop',
          'zavorth capability activate browser --profile=desktop --apply',
          'zavorth sidecar start browser --profile=desktop --apply',
        ],
      }),
    );
  }

  if (intent.routes.includes('android')) {
    hints.push(
      activationHint({
        id: 'android-adb-setup',
        target: 'android',
        state: 'physical-step-if-missing',
        title: 'Android USB/ADB',
        reason:
          'Android observation uses read-only ADB; if authorization is missing, Zavorth explains the physical step required.',
        userSteps: [
          'Enable Developer options and USB debugging on Android.',
          'Connect the USB cable.',
          'Accept the ADB authorization prompt on the phone.',
        ],
        commands: ['/device android doctor', '/device screenshot', '/device inspect'],
      }),
    );
  }

  if (intent.routes.includes('computer')) {
    hints.push(
      activationHint({
        id: 'computer-watch-mode-setup',
        target: 'desktop',
        state: intent.mutationRequested ? 'approval-required' : 'setup-if-missing',
        title: 'Computer Watch Mode',
        reason: 'Zavorth observes and plans first; click, type, and key actions still require governed approval.',
        userSteps: [
          'Use read-only observation first.',
          'Approve plans before any action that clicks, types, or presses keys.',
        ],
        commands: ['/computer observe', '/watchmode', 'npm run ops:watch-mode'],
      }),
    );
  }

  if (intent.routes.includes('subagent_perception')) {
    hints.push(
      activationHint({
        id: 'perception-subagents-ready',
        target: 'subagent',
        state: 'auto-use-when-ready',
        title: 'Perception subagents',
        reason:
          'When structured intent requests review or subagents, Zavorth uses read-only workers to separate facts, inferences, and risks.',
        commands: ['/agents spawn "<task>"', '/agents status'],
      }),
    );
  }

  if (intent.sensitive) {
    hints.push(
      activationHint({
        id: 'sensitive-target-blocked',
        target: intent.targetKind,
        state: 'blocked',
        title: 'Sensitive target blocked',
        reason: 'Bank, wallet, password, MFA, CAPTCHA, and payment screens are not control surfaces.',
        commands: ['/vision explain'],
        autoUseWhenReady: false,
      }),
    );
  }

  return hints;
}

function activationHint(input: {
  id: string;
  target: ZavorthPerceptionActivationHint['target'];
  state: ZavorthPerceptionActivationHint['state'];
  title: string;
  reason: string;
  userSteps?: string[];
  commands: string[];
  visibleOnlyWhenNeeded?: boolean;
  autoUseWhenReady?: boolean;
}): ZavorthPerceptionActivationHint {
  return {
    id: input.id,
    target: input.target,
    state: input.state,
    title: input.title,
    reason: input.reason,
    userSteps: input.userSteps || [],
    commands: input.commands,
    visibleOnlyWhenNeeded: input.visibleOnlyWhenNeeded !== false,
    autoUseWhenReady: input.autoUseWhenReady !== false,
  };
}

function surfaceCommand(
  id: string,
  command: string,
  label: string,
  description: string,
  requiresApproval: boolean,
): ZavorthPerceptionSurfaceCommand {
  return {
    id,
    command,
    label,
    description,
    requiresApproval,
    interactiveWhenSupported: true,
  };
}

function buildFacts(intent: RouteIntent): string[] {
  return [
    `Request classified as target ${intent.targetKind}.`,
    `Primary route selected: ${intent.primaryRoute}.`,
    intent.explicitSubagents
      ? 'Structured intent requested subagents / reviewed perception.'
      : 'No structured subagent request.',
  ];
}

function buildInferences(intent: RouteIntent): string[] {
  return [
    intent.mutationRequested
      ? 'Structured intent may alter UI; the correct step is to plan before acting.'
      : 'Request can be handled as read-only observation.',
    intent.routes.includes('subagent_perception')
      ? 'Subagents help separate facts, inferences, and risks without touching the UI.'
      : 'A single perception surface is enough to start.',
  ];
}

function buildBlockedActions(intent: RouteIntent): string[] {
  const blocked = ['No click, tap, typing, keyevent, or intent is executed by the router.'];
  if (intent.sensitive) blocked.push('Sensitive screen flagged; UI control was blocked.');
  if (intent.mutationRequested) blocked.push('Mutation stays pending governed approval.');
  return blocked;
}

function nextStep(intent: RouteIntent): string {
  if (intent.sensitive) return 'Choose a non-sensitive target or ask only for a safe explanation.';
  if (intent.mutationRequested) return 'Generate a preview and request approval before tapping, clicking, or typing.';
  if (intent.routes.includes('subagent_perception'))
    return 'Run read-only subagents to review the evidence and synthesize risks.';
  return 'Run read-only observation on the selected surface.';
}

function resolveStatus(intent: RouteIntent, approvalId: string | null): ZavorthPerceptionInvocationStatus {
  if (intent.sensitive) return 'denied';
  if (intent.mutationRequested && !approvalId) return 'approval-required';
  return 'ready';
}

function statusReason(status: ZavorthPerceptionInvocationStatus, intent: RouteIntent): string {
  if (status === 'denied') return 'Sensitive perception target is blocked for UI control.';
  if (status === 'approval-required') return 'Mutation-like perception request requires owner approval.';
  return `Read-only ${intent.primaryRoute} route can proceed.`;
}

function confidenceFor(targetKind: ZavorthPerceptionTargetKind, explicitSubagents: boolean): number {
  if (explicitSubagents) return 0.96;
  if (targetKind === 'unknown') return 0.62;
  return 0.88;
}

function resolveTargetLabel(text: string, targetKind: ZavorthPerceptionTargetKind): string {
  if (targetKind === 'browser') return extractFirstUrl(text) || 'browser-target';
  if (targetKind === 'desktop') return extractNaturalWindowTitle(text) || 'desktop-target';
  if (targetKind === 'android') return extractNaturalPackageName(text) || 'android-device';
  return `${targetKind}-target`;
}

function receipt(
  kind: ZavorthPerceptionInvocationPlan['receipts'][number]['kind'],
  status: ZavorthPerceptionInvocationPlan['receipts'][number]['status'],
  reason: string,
): ZavorthPerceptionInvocationPlan['receipts'][number] {
  return {
    id: `perception-${kind}-${safeId(status)}-${hashShort(reason)}`,
    kind,
    status,
    reason,
    rawSecretSerialized: false,
  };
}

function buildActions(plan: ZavorthPerceptionInvocationPlan): SurfaceResponseAction[] {
  return plan.surfaceCommands.slice(0, 6).map((command, index) => ({
    id: `perception-action-${command.id}`,
    label: command.label,
    kind: 'command',
    command: command.command,
    callbackData: command.command,
    style: index === 0 ? 'primary' : command.requiresApproval ? 'danger' : 'secondary',
    confirmationRequired: command.requiresApproval,
  }));
}

function buildActivationSetupItems(plan: ZavorthPerceptionInvocationPlan): string[] {
  return plan.activation.hints
    .filter((hint) => hint.state !== 'ready')
    .flatMap((hint) => [
      `${hint.title}: ${hint.reason}`,
      ...hint.commands.slice(0, 3).map((command) => `command: ${command}`),
    ])
    .slice(0, 8);
}

function mapReceiptStatus(status: ZavorthPerceptionInvocationPlan['receipts'][number]['status']): SurfaceReceiptStatus {
  if (status === 'blocked') return 'blocked';
  if (status === 'approval-required') return 'require_admin_policy';
  return 'done';
}

function uniqueRoutes(values: Array<ZavorthPerceptionRouteKind | null>): ZavorthPerceptionRouteKind[] {
  return [...new Set(values.filter(Boolean) as ZavorthPerceptionRouteKind[])];
}

function extractNaturalWindowTitle(value: string): string | null {
  const text = String(value || '').trim();
  const match = text.match(
    /\b(?:window|app|application|program|janela|aplicativo|programa)\s+(?:do|da|de|of)?\s*([a-z0-9 ._-]{2,48})/i,
  );
  return match?.[1]?.replace(/\b(no|na|em|e|para|que|and|on|in)\b.*$/i, '').trim() || null;
}

function extractNaturalPackageName(value: string): string | null {
  const text = String(value || '').trim();
  const explicit = text.match(/\b(?:package|pacote)\s+([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\b/i);
  if (explicit?.[1]) return explicit[1];
  const androidLike = text.match(/\b([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2})\b/i);
  return androidLike?.[1] || null;
}

function extractFirstUrl(value: string): string | null {
  const match = String(value || '').match(/\bhttps?:\/\/[^\s<>"']+/i);
  return match?.[0] || null;
}

function firstLine(value: string, maxLength: number): string {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
}

function hashShort(value: unknown): string {
  let hash = 0;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 8).padStart(4, '0');
}

function safeId(value: unknown): string {
  return (
    String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'item'
  );
}
