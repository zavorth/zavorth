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
import type { ZavorthGovernedSubagentProfileId } from '../contracts/ZavorthGovernedSubagentContract.js';
import type { ZavorthSubagentRuntimeSnapshot } from '../contracts/ZavorthSubagentRuntimeContract.js';

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

const MUTATION_PATTERN = /\b(clique|clicar|toque|tocar|tap|swipe|deslize|digite|preencha|preencher|pressione|keyevent|resolver|corrigir|arrumar|submit|enviar formulario)\b/;
const SENSITIVE_PATTERN = /\b(password|senha|mfa|2fa|otp|authenticator|autenticador|captcha|passkey|webauthn|banco|bank|pix|pagamento|payment|wallet|carteira|seed|private key|chave privada)\b/;
const SUBAGENT_PATTERN = /\b(use subagentes?|subagentes?|subagents?|mande um agente|outro revisar|outro validar|revisar o que aparece|auditar o que aparece)\b/;
const COMPLEX_REVIEW_PATTERN = /\b(compare|comparar|revisar|validar|auditar|sintetizar)\b/;

export class ZavorthPerceptionInvocationRouter {
  public canHandle(text: string): boolean {
    const normalized = normalizeNatural(text);
    return looksLikePerception(normalized);
  }

  public plan(input: ZavorthPerceptionInvocationInput): ZavorthPerceptionInvocationPlan {
    const text = String(input.text || '').trim();
    const normalized = normalizeNatural(text);
    const channel = String(input.channel || input.sourceSurface || 'shared-surface').trim() || 'shared-surface';
    const actorId = String(input.actorId || '').trim() || null;
    const intent = resolveIntent(normalized);
    const status = resolveStatus(intent, input.approvalId || null);
    const targetLabel = resolveTargetLabel(text, intent.targetKind);
    const sourceSurface = channel;
    const factsObserved = buildFacts(intent);
    const actionsBlocked = buildBlockedActions(intent);
    const perceptionRoles = selectPerceptionRoles(intent);
    const runtimeRoleIds = mapRuntimeRoles(perceptionRoles);

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
        liveRequested: wantsLiveCapture(normalized),
        mutationRequested: intent.mutationRequested,
        sensitive: intent.sensitive,
      },
      commands: {
        vision: buildVisionInput(text, intent, sourceSurface, actorId),
        browser: intent.routes.includes('browser') ? buildBrowserInput(text, normalized, sourceSurface, actorId) : null,
        computer: intent.routes.includes('computer') ? buildComputerInput(text, normalized, sourceSurface, actorId) : null,
        android: intent.routes.includes('android') ? buildAndroidInput(text, normalized, sourceSurface, actorId) : null,
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
          ? 'Sensitive visual/device target detected; only explanation is allowed until the user chooses a safe target.'
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
        receipt('policy', status === 'denied' ? 'blocked' : status === 'approval-required' ? 'approval-required' : 'done', statusReason(status, intent)),
        ...(intent.routes.includes('subagent_perception')
          ? [receipt('subagent', 'done', 'Read-only perception subagents selected: observer, evidence-summarizer and safety-reviewer.')]
          : []),
      ],
    };
  }

  public buildSurfaceResponse(
    plan: ZavorthPerceptionInvocationPlan,
    options: RenderOptions = {},
  ): SurfaceResponse {
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
      tone: plan.status === 'denied'
        ? 'danger'
        : plan.status === 'approval-required'
          ? 'warning'
          : 'success',
      blocks: [
        {
          kind: 'text',
          title: 'Leitura natural',
          text: [
            'Perception Invocation Router',
            '',
            `Status: ${plan.status}`,
            `Route: ${plan.primaryRoute}`,
            `Target: ${plan.target.kind} (${plan.target.label})`,
            `Confidence: ${plan.confidence}`,
            execution,
            '',
            'Fatos observados:',
            ...plan.explanation.factsObserved.map((entry) => `- ${entry}`),
            '',
            'Inferencias:',
            ...plan.explanation.inferences.map((entry) => `- ${entry}`),
            '',
            'Acoes executadas:',
            ...plan.explanation.actionsExecuted.map((entry) => `- ${entry}`),
            '',
            'Acoes bloqueadas:',
            ...plan.explanation.actionsBlocked.map((entry) => `- ${entry}`),
            '',
            `Proximo passo: ${plan.explanation.nextStep}`,
          ].join('\n'),
        },
        {
          kind: 'list',
          title: 'Comandos equivalentes',
          items: plan.surfaceCommands.slice(0, 8).map((command) => `${command.label}: ${command.command}`),
        },
        ...(activationItems.length > 0
          ? [{
              kind: 'list' as const,
              title: 'Ativacao quando faltar capacidade',
              items: activationItems,
            }]
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
      'Fatos observados:',
      ...plan.explanation.factsObserved.map((entry) => `- ${entry}`),
      '',
      'Inferencias:',
      ...plan.explanation.inferences.map((entry) => `- ${entry}`),
      '',
      'Acoes executadas:',
      ...plan.explanation.actionsExecuted.map((entry) => `- ${entry}`),
      '',
      'Acoes bloqueadas:',
      ...plan.explanation.actionsBlocked.map((entry) => `- ${entry}`),
      '',
      'Comandos equivalentes:',
      ...plan.surfaceCommands.map((command) => `- ${command.command}`),
      '',
      'Ativacao quando faltar capacidade:',
      ...plan.activation.hints
        .filter((hint) => hint.state !== 'ready')
        .flatMap((hint) => [
          `- ${hint.title}: ${hint.reason}`,
          ...hint.commands.slice(0, 3).map((command) => `  comando: ${command}`),
        ]),
      '',
      `Proximo passo: ${plan.explanation.nextStep}`,
    ].join('\n');
  }
}

function resolveIntent(normalized: string): RouteIntent {
  const explicitSubagents = SUBAGENT_PATTERN.test(normalized) && looksLikePerception(normalized);
  const mutationRequested = MUTATION_PATTERN.test(normalized);
  const sensitive = SENSITIVE_PATTERN.test(normalized);
  const targetKind = inferTargetKind(normalized);
  const baseRoute = routeForTarget(targetKind);
  const complexSubagents = explicitSubagents || (COMPLEX_REVIEW_PATTERN.test(normalized) && looksLikePerception(normalized));
  const routes = uniqueRoutes([
    complexSubagents ? 'subagent_perception' : baseRoute,
    complexSubagents ? baseRoute : null,
  ]);
  return {
    targetKind,
    primaryRoute: sensitive ? 'deny' : routes[0] || 'vision',
    routes: sensitive ? ['deny', baseRoute] : routes,
    confidence: confidenceFor(targetKind, explicitSubagents, complexSubagents),
    mutationRequested,
    sensitive,
    explicitSubagents,
  };
}

function inferTargetKind(normalized: string): ZavorthPerceptionTargetKind {
  if (/\b(celular|android|adb|telefone|smartphone|device|dispositivo|toque|tocar)\b/.test(normalized)) return 'android';
  if (/\b(site|browser|navegador|pagina|web|pdf|url|link|http)\b/.test(normalized)) return 'browser';
  if (/\b(computador|desktop|pc|janela|app|aplicativo|programa)\b/.test(normalized)) return 'desktop';
  if (/\b(arquivo|imagem|anexo|foto)\b/.test(normalized)) return 'artifact';
  if (/\b(tela|visual|visualmente|screenshot|print|ocr|camera)\b/.test(normalized)) return 'visual';
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
): ZavorthPerceptionInvocationPlan['commands']['vision'] {
  return {
    action: /\b(ocr|texto da imagem|ler a tela)\b/.test(normalizeNatural(text))
      ? 'vision.ocr'
      : /\b(explique|explicar|interprete|interpretar)\b/.test(normalizeNatural(text))
        ? 'vision.explain'
        : 'vision.inspect',
    targetKind: intent.targetKind === 'android'
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
  normalized: string,
  sourceSurface: string,
  actorId: string | null,
): ZavorthPerceptionInvocationPlan['commands']['browser'] {
  return {
    action: MUTATION_PATTERN.test(normalized) ? 'browser.plan' : 'browser.inspect',
    url: extractFirstUrl(text),
    requestText: text,
    live: Boolean(extractFirstUrl(text)),
    sourceSurface,
    actorId,
  };
}

function buildComputerInput(
  text: string,
  normalized: string,
  sourceSurface: string,
  actorId: string | null,
): ZavorthPerceptionInvocationPlan['commands']['computer'] {
  return {
    action: MUTATION_PATTERN.test(normalized) ? 'computer.plan' : 'computer.observe',
    targetWindow: extractNaturalWindowTitle(text),
    targetKind: /\b(app|aplicativo|programa)\b/.test(normalized) ? 'local-app' : 'desktop-window',
    objective: text,
    sourceSurface,
    actorId,
  };
}

function buildAndroidInput(
  text: string,
  normalized: string,
  sourceSurface: string,
  actorId: string | null,
): ZavorthPerceptionInvocationPlan['commands']['android'] {
  const action = MUTATION_PATTERN.test(normalized)
    ? 'device.plan'
    : /\b(screenshot|print|captur)\b/.test(normalized)
      ? 'device.screenshot'
      : 'device.observe';
  return {
    action,
    objective: text,
    packageName: extractNaturalPackageName(text),
    sourceSurface,
    actorId,
    live: action !== 'device.plan',
  };
}

function buildSubagentTask(
  text: string,
  intent: RouteIntent,
  factsObserved: string[],
  actionsBlocked: string[],
): string {
  return [
    'Analise esta solicitacao de percepcao em modo read-only.',
    `Target: ${intent.targetKind}.`,
    `Pedido: ${text}`,
    `Fatos iniciais: ${factsObserved.join(' | ')}`,
    `Bloqueios: ${actionsBlocked.join(' | ')}`,
    'Separe fato observado, inferencia, risco, acao bloqueada e proximo passo seguro.',
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
    commands.push(surfaceCommand('approval', '/perm pending', 'Approval', 'Review pending approval before mutation.', true));
  }
  if (intent.routes.includes('subagent_perception')) {
    commands.push(surfaceCommand('subagents', `/agents spawn "${request}"`, 'Subagents', 'Spawn read-only perception subagents.', false));
  }
  return commands.filter((command) => command.id === intent.primaryRoute || command.id === routeForTarget(intent.targetKind) || ['approval', 'subagents', 'vision'].includes(command.id));
}

function buildActivationHints(intent: RouteIntent): ZavorthPerceptionActivationHint[] {
  const hints: ZavorthPerceptionActivationHint[] = [
    activationHint({
      id: 'vision-ready',
      target: 'visual',
      state: 'ready',
      title: 'Vision ready',
      reason: 'Evidencia visual fornecida pelo usuario pode ser lida sem setup extra.',
      commands: ['/vision inspect'],
    }),
  ];

  if (intent.routes.includes('browser')) {
    hints.push(activationHint({
      id: 'browser-sidecar-setup',
      target: 'browser',
      state: 'setup-if-missing',
      title: 'Browser live',
      reason: 'O Zavorth tenta usar o browser sidecar automaticamente; se ele nao estiver pronto, mostra doctor e ativacao.',
      userSteps: [
        'Rode o doctor de sidecars quando o browser live aparecer como nao configurado.',
        'Ative o browser sidecar uma vez para permitir inspecao read-only de paginas.',
      ],
      commands: [
        'zavorth doctor sidecars --profile=desktop',
        'zavorth capability activate browser --profile=desktop --apply',
        'zavorth sidecar start browser --profile=desktop --apply',
      ],
    }));
  }

  if (intent.routes.includes('android')) {
    hints.push(activationHint({
      id: 'android-adb-setup',
      target: 'android',
      state: 'physical-step-if-missing',
      title: 'Android USB/ADB',
      reason: 'Pedidos como "olhe meu celular" tentam ADB read-only; se faltar autorizacao, o Zavorth explica o passo fisico necessario.',
      userSteps: [
        'Ative Opcoes do desenvolvedor e Depuracao USB no Android.',
        'Conecte o cabo USB.',
        'Aceite no celular o prompt de autorizacao ADB.',
      ],
      commands: [
        '/device android doctor',
        '/device screenshot',
        '/device inspect',
      ],
    }));
  }

  if (intent.routes.includes('computer')) {
    hints.push(activationHint({
      id: 'computer-watch-mode-setup',
      target: 'desktop',
      state: intent.mutationRequested ? 'approval-required' : 'setup-if-missing',
      title: 'Computer Watch Mode',
      reason: 'O Zavorth observa e planeja naturalmente; click, digitacao e tecla continuam exigindo approval governado.',
      userSteps: [
        'Use observacao read-only primeiro.',
        'Aprove planos antes de qualquer acao que clique, digite ou pressione teclas.',
      ],
      commands: [
        '/computer observe',
        '/watchmode',
        'npm run ops:watch-mode',
      ],
    }));
  }

  if (intent.routes.includes('subagent_perception')) {
    hints.push(activationHint({
      id: 'perception-subagents-ready',
      target: 'subagent',
      state: 'auto-use-when-ready',
      title: 'Subagentes de percepcao',
      reason: 'Quando o usuario pede revisao ou subagentes, o Zavorth usa workers read-only para separar fatos, inferencias e riscos.',
      commands: ['/agents spawn "<tarefa>"', '/agents status'],
    }));
  }

  if (intent.sensitive) {
    hints.push(activationHint({
      id: 'sensitive-target-blocked',
      target: intent.targetKind,
      state: 'blocked',
      title: 'Alvo sensivel bloqueado',
      reason: 'Telas de banco, wallet, senha, MFA, CAPTCHA e pagamento nao viram superficie de controle.',
      commands: ['/vision explain'],
      autoUseWhenReady: false,
    }));
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
    `Pedido classificado como alvo ${intent.targetKind}.`,
    `Rota primaria escolhida: ${intent.primaryRoute}.`,
    intent.explicitSubagents ? 'Usuario pediu subagentes/percepcao revisada.' : 'Sem pedido explicito de subagentes.',
  ];
}

function buildInferences(intent: RouteIntent): string[] {
  return [
    intent.mutationRequested
      ? 'O pedido pode alterar UI; a etapa correta e planejar antes de agir.'
      : 'O pedido pode ser atendido como observacao read-only.',
    intent.routes.includes('subagent_perception')
      ? 'Subagentes sao uteis para separar fatos, inferencias e riscos sem tocar na UI.'
      : 'Uma unica superficie de percepcao e suficiente para iniciar.',
  ];
}

function buildBlockedActions(intent: RouteIntent): string[] {
  const blocked = ['Nenhum clique, toque, digitacao, keyevent ou intent e executado pelo roteador.'];
  if (intent.sensitive) blocked.push('Tela sensivel detectada; controle de UI foi bloqueado.');
  if (intent.mutationRequested) blocked.push('Mutacao fica pendente de approval governado.');
  return blocked;
}

function nextStep(intent: RouteIntent): string {
  if (intent.sensitive) return 'Escolha um alvo nao sensivel ou peca apenas uma explicacao segura.';
  if (intent.mutationRequested) return 'Gerar preview e pedir aprovacao antes de tocar, clicar ou digitar.';
  if (intent.routes.includes('subagent_perception')) return 'Executar subagentes read-only para revisar a evidencia e sintetizar riscos.';
  return 'Executar observacao read-only na superficie escolhida.';
}

function resolveStatus(
  intent: RouteIntent,
  approvalId: string | null,
): ZavorthPerceptionInvocationStatus {
  if (intent.sensitive) return 'denied';
  if (intent.mutationRequested && !approvalId) return 'approval-required';
  return 'ready';
}

function statusReason(status: ZavorthPerceptionInvocationStatus, intent: RouteIntent): string {
  if (status === 'denied') return 'Sensitive perception target is blocked for UI control.';
  if (status === 'approval-required') return 'Mutation-like perception request requires owner approval.';
  return `Read-only ${intent.primaryRoute} route can proceed.`;
}

function confidenceFor(
  targetKind: ZavorthPerceptionTargetKind,
  explicitSubagents: boolean,
  complexSubagents: boolean,
): number {
  if (explicitSubagents) return 0.96;
  if (complexSubagents) return 0.91;
  if (targetKind === 'unknown') return 0.62;
  return 0.88;
}

function wantsLiveCapture(normalized: string): boolean {
  return /\b(ao vivo|live|agora|conectado|usb|adb autorizado)\b/.test(normalized);
}

function looksLikePerception(normalized: string): boolean {
  return /\b(olhe|veja|ver|confirme visualmente|visualmente|screenshot|print|tela|ocr|imagem|camera|celular|android|adb|computador|desktop|browser|navegador|site|pagina|web)\b/.test(normalized);
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
      ...hint.commands.slice(0, 3).map((command) => `comando: ${command}`),
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

function normalizeNatural(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s._:/-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractNaturalWindowTitle(value: string): string | null {
  const text = String(value || '').trim();
  const match = text.match(/\b(?:janela|app|aplicativo|programa)\s+(?:do|da|de)?\s*([a-z0-9 ._-]{2,48})/i);
  return match?.[1]?.replace(/\b(no|na|em|e|para|que)\b.*$/i, '').trim() || null;
}

function extractNaturalPackageName(value: string): string | null {
  const text = String(value || '').trim();
  const explicit = text.match(/\b(?:package|pacote)\s+([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\b/i);
  if (explicit?.[1]) return explicit[1];
  const androidLike = text.match(/\b([a-z][a-z0-9_]*(?:\.[a-z0-9_]+){2,})\b/i);
  return androidLike?.[1] || null;
}

function extractFirstUrl(value: string): string | null {
  const match = String(value || '').match(/\bhttps?:\/\/[^\s<>"']+/i);
  return match?.[0] || null;
}

function firstLine(value: string, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
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
  return String(value || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'item';
}
