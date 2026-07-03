import type {
  CapabilityHubItem,
  CapabilityHubItemKind,
} from '../contracts/CapabilityHubContract.js';
import {
  NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION,
  type NaturalSetupAssistantInput,
  type NaturalSetupAssistantSnapshot,
  type NaturalSetupConversation,
  type NaturalSetupDetectedIntent,
  type NaturalSetupIntentAction,
  type NaturalSetupReadiness,
  type NaturalSetupReadinessCheck,
  type NaturalSetupSecretInput,
  type NaturalSetupSecretPlan,
} from '../contracts/NaturalSetupAssistantContract.js';
import type {
  GovernanceRecipeExecutionReceipt,
  GovernanceRecipePlan,
} from '../contracts/GovernanceRecipeContract.js';
import {
  ZavorthCapabilityHubApiService,
  type CapabilityHubApiInspectResult,
  type CapabilityHubApiListInput,
} from './ZavorthCapabilityHubApiService.js';
import { ZavorthGovernanceRecipeApiService } from './ZavorthGovernanceRecipeApiService.js';
import type { GovernanceRecipePlanInput } from './ZavorthGovernanceRecipeService.js';
import type { ZavorthCapabilityHubRuntime } from './ZavorthCapabilityHubService.js';

type CapabilityHubApiLike = {
  list(input?: CapabilityHubApiListInput): CapabilityHubItem[];
  inspect(id: string): CapabilityHubApiInspectResult;
};

type GovernanceRecipeApiLike = {
  plan(input?: GovernanceRecipePlanInput): GovernanceRecipePlan | null;
  dryRun(input?: GovernanceRecipePlanInput): GovernanceRecipeExecutionReceipt | null;
};

export type ZavorthNaturalSetupAssistantRuntime = ZavorthCapabilityHubRuntime & {
  capabilityHubApiService?: CapabilityHubApiLike;
  governanceRecipeApiService?: GovernanceRecipeApiLike;
};

const ACTION_PATTERNS: Array<{ action: NaturalSetupIntentAction; patterns: RegExp[] }> = [
  {
    action: 'connect',
    patterns: [
      /\b(conectar|conecta|ligar|liga|integrar|integra|ativar|ativa|habilitar|habilita|usar)\b/i,
      /\b(connect|enable|activate|link|integrate|use)\b/i,
    ],
  },
  {
    action: 'configure',
    patterns: [
      /\b(configurar|configura|ajustar|setup|preparar|prepara|instalar|instala)\b/i,
      /\b(configure|setup|install|prepare)\b/i,
    ],
  },
  {
    action: 'validate',
    patterns: [
      /\b(validar|valida|valide|testar|testa|teste|verificar|verifica|verifique|checar|checa|cheque|doctor|diagnosticar)\b/i,
      /\b(validate|test|check|verify|diagnose)\b/i,
    ],
  },
  {
    action: 'inspect',
    patterns: [
      /\b(mostrar|mostra|listar|lista|inspecionar|inspeciona|explicar|explica|ver)\b/i,
      /\b(show|list|inspect|explain|view)\b/i,
    ],
  },
];

const KIND_ALIASES: Array<{ kind: CapabilityHubItemKind; patterns: RegExp[] }> = [
  { kind: 'channel', patterns: [/\b(canal|chat|telegram|discord|slack|whatsapp|instagram|insta|email|matrix)\b/i] },
  { kind: 'provider', patterns: [/\b(modelo|provider|provedor|gemini|openai|claude|anthropic|ollama|lm studio|vllm)\b/i] },
  { kind: 'mcp', patterns: [/\b(mcp|ferramenta externa|servidor de ferramenta|filesystem)\b/i] },
  { kind: 'integration', patterns: [/\b(integracao|integração|github|figma|vercel|linear|notion|calendar|calendario)\b/i] },
  { kind: 'skill', patterns: [/\b(skill|habilidade|automacao|automação)\b/i] },
  { kind: 'recipe', patterns: [/\b(receita|blueprint|governanca|governança)\b/i] },
];

const SECRET_PATTERNS: RegExp[] = [
  /\b(?:xox[baprs]-[A-Za-z0-9-]{8,})\b/g,
  /\b(?:sk-[A-Za-z0-9_-]{12,})\b/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{12,})\b/g,
  /\b(?:AIza[0-9A-Za-z_-]{12,})\b/g,
  /\b(?:[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/g,
  /\b(?:token|api[_ -]?key|secret|senha|password|chave)\s*[:=]\s*([^\s,;]+)/gi,
];

export class ZavorthNaturalSetupAssistantService {
  private readonly now: () => Date;
  private readonly capabilityHub: CapabilityHubApiLike;
  private readonly governanceRecipes: GovernanceRecipeApiLike;

  constructor(runtime: ZavorthNaturalSetupAssistantRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.capabilityHub = runtime.capabilityHubApiService || new ZavorthCapabilityHubApiService(runtime);
    this.governanceRecipes = runtime.governanceRecipeApiService || new ZavorthGovernanceRecipeApiService(runtime);
  }

  public buildSnapshot(input: NaturalSetupAssistantInput): NaturalSetupAssistantSnapshot {
    const text = String(input.text || '').trim();
    const secretInputs = this.detectSecretInputs(text, input.providedSecrets || {});
    const redactedText = this.redactText(text, secretInputs);
    const detectedIntent = this.detectIntent(redactedText);
    const selectedCapability = this.resolveCapability(input, redactedText, detectedIntent);
    const planInput = selectedCapability
      ? {
          targetItemId: selectedCapability.id,
          search: selectedCapability.label,
          dryRun: true,
          approvalId: input.approvalId || null,
        }
      : {};
    const governancePlan = selectedCapability ? this.governanceRecipes.plan(planInput) : null;
    const dryRunReceipt = selectedCapability ? this.governanceRecipes.dryRun(planInput) : null;
    const secretPlan = this.buildSecretPlan(selectedCapability, secretInputs, input.persistSecrets === true);
    const readiness = this.buildReadiness(selectedCapability, governancePlan, secretPlan);
    const conversation = this.buildConversation(selectedCapability, detectedIntent, governancePlan, secretPlan, readiness);

    return {
      contractVersion: NATURAL_SETUP_ASSISTANT_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      request: {
        inputText: redactedText,
        redactedText,
        actorLabel: input.actorLabel || null,
      },
      detectedIntent,
      selectedCapability,
      governancePlan,
      dryRunReceipt,
      secretPlan,
      readiness,
      conversation,
      safety: {
        previewOnly: true,
        liveActivation: false,
        secretsSerialized: false,
        approvalRequired: Boolean(governancePlan?.permissions.approvalRequired),
        ownerApprovalRequired: Boolean(governancePlan?.recipe.approval.ownerOnly),
        jargonHidden: true,
      },
    };
  }

  public renderReply(input: NaturalSetupAssistantInput): string {
    const snapshot = this.buildSnapshot(input);
    const lines = [
      snapshot.conversation.headline,
      '',
      snapshot.conversation.explanation,
    ];

    if (snapshot.conversation.simpleSteps.length > 0) {
      lines.push('', 'Próximos passos:');
      for (const step of snapshot.conversation.simpleSteps) {
        lines.push(`- ${step}`);
      }
    }

    if (snapshot.conversation.questions.length > 0) {
      lines.push('', 'Preciso confirmar:');
      for (const question of snapshot.conversation.questions) {
        lines.push(`- ${question}`);
      }
    }

    lines.push('', `Segurança: preview=${snapshot.safety.previewOnly}; ativação live=${snapshot.safety.liveActivation}; secrets serializados=${snapshot.safety.secretsSerialized}.`);
    return lines.join('\n');
  }

  private detectIntent(text: string): NaturalSetupDetectedIntent {
    const matchedAliases: string[] = [];
    let action: NaturalSetupIntentAction = 'unknown';
    let confidence = 0.35;

    for (const candidate of ACTION_PATTERNS) {
      const matched = candidate.patterns.some((pattern) => pattern.test(text));
      if (matched) {
        action = candidate.action;
        confidence = candidate.action === 'inspect' ? 0.7 : 0.82;
        matchedAliases.push(candidate.action);
        break;
      }
    }

    const targetText = this.extractTargetText(text);
    return {
      action,
      confidence: targetText ? confidence : Math.min(confidence, 0.55),
      targetText,
      matchedAliases,
    };
  }

  private resolveCapability(
    input: NaturalSetupAssistantInput,
    redactedText: string,
    detectedIntent: NaturalSetupDetectedIntent,
  ): CapabilityHubItem | null {
    if (input.preferredCapabilityId) {
      const inspected = this.capabilityHub.inspect(input.preferredCapabilityId);
      if (inspected.item) {
        return inspected.item;
      }
    }

    const query = detectedIntent.targetText || redactedText;
    const kind = this.detectKind(redactedText);
    const exact = this.resolveBySearch(query, kind);
    if (exact) {
      return exact;
    }
    if (kind) {
      return this.capabilityHub.list({ kind })[0] || null;
    }
    return this.capabilityHub.list({ search: query })[0] || null;
  }

  private resolveBySearch(query: string, kind: CapabilityHubItemKind | null): CapabilityHubItem | null {
    const candidates = this.capabilityHub.list({
      search: query,
      kind,
    });
    if (candidates.length === 0 && kind) {
      return this.capabilityHub.list({ search: query })[0] || null;
    }
    if (candidates.length === 0) {
      return null;
    }

    const normalizedQuery = this.normalize(query);
    const exact = candidates.find((item) =>
      this.normalize(item.id).includes(normalizedQuery)
      || this.normalize(item.label) === normalizedQuery
      || item.tags.some((tag) => this.normalize(tag) === normalizedQuery));
    return exact || candidates[0];
  }

  private detectKind(text: string): CapabilityHubItemKind | null {
    for (const alias of KIND_ALIASES) {
      if (alias.patterns.some((pattern) => pattern.test(text))) {
        return alias.kind;
      }
    }
    return null;
  }

  private extractTargetText(text: string): string | null {
    const cleaned = text
      .replace(/\b(quero|preciso|pode|por favor|para mim|pra mim|me ajuda|ajuda|please)\b/gi, ' ')
      .replace(/\b(conectar|conecta|ligar|liga|integrar|integra|ativar|ativa|habilitar|habilita|configurar|configura|validar|valida|valide|testar|testa|teste|verificar|verifica|verifique|usar|use|connect|configure|validate|test|check|enable|activate)\b/gi, ' ')
      .replace(/\b(com|meu|minha|o|a|um|uma|de|do|da|no|na|ao|as|os)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || cleaned.length < 2) {
      return null;
    }
    return cleaned.split(/[,.]/)[0]?.trim() || null;
  }

  private buildSecretPlan(
    selectedCapability: CapabilityHubItem | null,
    detectedSecretInputs: NaturalSetupSecretInput[],
    persistSecrets: boolean,
  ): NaturalSetupSecretPlan {
    const requiredRefs = selectedCapability
      ? selectedCapability.requirements.secretRefs
        .filter((value, index, all) => value && all.indexOf(value) === index)
      : [];
    const providedRefs = detectedSecretInputs
      .map((input) => input.secretRef)
      .filter((value): value is string => Boolean(value));
    const missingRefs = requiredRefs.filter((ref) => !providedRefs.includes(ref));

    return {
      requiredRefs,
      missingRefs,
      providedRefs,
      detectedSecretInputs,
      rawSecretValuesSerialized: false,
      persistenceMode: persistSecrets ? 'explicit-only' : 'disabled',
    };
  }

  private buildReadiness(
    selectedCapability: CapabilityHubItem | null,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
  ): NaturalSetupReadiness {
    if (!selectedCapability) {
      return {
        status: 'needs_manual_choice',
        checks: [{
          id: 'capability',
          status: 'missing',
          summary: 'Nao consegui identificar qual recurso voce quer configurar.',
        }],
        blockers: ['Escolha uma capacidade do Capability Hub.'],
        nextSafeAction: 'Diga o nome do canal, app, provedor, ferramenta ou habilidade que quer preparar.',
      };
    }

    const checks: NaturalSetupReadinessCheck[] = [
      {
        id: 'capability',
        status: 'passed',
        summary: `${selectedCapability.label} foi encontrado no Capability Hub.`,
      },
      {
        id: 'secrets',
        status: secretPlan.missingRefs.length > 0 ? 'next' : 'passed',
        summary: secretPlan.missingRefs.length > 0
          ? `Faltam ${secretPlan.missingRefs.length} segredo(s)/credencial(is) em entrada segura.`
          : 'Nenhum segredo bruto precisa ser salvo neste preview.',
      },
      {
        id: 'governance',
        status: governancePlan ? 'passed' : 'blocked',
        summary: governancePlan
          ? `Plano governado ${governancePlan.recipeId} gerado em dry-run.`
          : 'Nao encontrei receita de governanca para este recurso.',
      },
      {
        id: 'approval',
        status: governancePlan?.permissions.approvalRequired ? 'next' : 'passed',
        summary: governancePlan?.permissions.approvalRequired
          ? 'Ativacao real so acontece depois de aprovacao explicita.'
          : 'Readiness/validacao pode continuar sem ativacao live.',
      },
    ];
    const blockers = checks
      .filter((check) => check.status === 'blocked' || check.status === 'missing')
      .map((check) => check.summary);
    const status = blockers.length > 0
      ? 'blocked'
      : secretPlan.missingRefs.length > 0
        ? 'needs_secret_input'
        : 'ready_for_preview';

    return {
      status,
      checks,
      blockers,
      nextSafeAction: this.nextSafeAction(selectedCapability, governancePlan, secretPlan),
    };
  }

  private buildConversation(
    selectedCapability: CapabilityHubItem | null,
    detectedIntent: NaturalSetupDetectedIntent,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
    readiness: NaturalSetupReadiness,
  ): NaturalSetupConversation {
    if (!selectedCapability) {
      return {
        headline: 'Consigo ajudar, mas preciso saber qual recurso voce quer preparar.',
        explanation: 'Eu transformo pedidos normais em um plano seguro de configuracao, validacao e aprovacao.',
        questions: ['Qual app, canal, modelo, ferramenta ou habilidade voce quer usar?'],
        simpleSteps: ['Escolha o recurso.', 'Eu mostro o que falta.', 'Nada live e ativado sem aprovacao.'],
      };
    }

    const actionText = this.actionToHumanText(detectedIntent.action);
    const questions = secretPlan.missingRefs.map((ref) => `Informe ${this.humanizeRef(ref)} por entrada segura.`);
    if (governancePlan?.permissions.approvalRequired) {
      questions.push('Confirme a aprovacao quando quiser sair do preview para uso real.');
    }

    return {
      headline: `Preparei um plano para ${actionText} ${selectedCapability.label}.`,
      explanation: `${selectedCapability.summary} Eu escondi detalhes tecnicos e mantive tudo em preview com receipts e politica de aprovacao.`,
      questions,
      simpleSteps: [
        `Validar readiness de ${selectedCapability.label}.`,
        secretPlan.missingRefs.length > 0
          ? 'Coletar credenciais em canal seguro, salvando apenas referencias.'
          : 'Confirmar que nao ha segredo pendente para o preview.',
        governancePlan
          ? `Aplicar a receita segura "${governancePlan.recipe.label}" em dry-run.`
          : 'Escolher uma receita de governanca antes de qualquer execucao.',
        readiness.nextSafeAction,
      ],
    };
  }

  private nextSafeAction(
    selectedCapability: CapabilityHubItem,
    governancePlan: GovernanceRecipePlan | null,
    secretPlan: NaturalSetupSecretPlan,
  ): string {
    if (secretPlan.missingRefs.length > 0) {
      return `Abrir coleta segura para ${this.humanizeRef(secretPlan.missingRefs[0])}.`;
    }
    if (governancePlan?.permissions.approvalRequired) {
      return 'Mostrar o plano ao dono e pedir aprovacao explicita antes da ativacao live.';
    }
    if (selectedCapability.readiness !== 'ready') {
      return 'Rodar doctor/readiness check sem ativar live.';
    }
    return 'Continuar em dry-run ou pedir aprovacao para ativacao real.';
  }

  private detectSecretInputs(
    text: string,
    providedSecrets: Record<string, string | null | undefined>,
  ): NaturalSetupSecretInput[] {
    const detected: NaturalSetupSecretInput[] = [];
    for (const pattern of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match = pattern.exec(text);
      while (match) {
        const value = match[1] || match[0];
        detected.push({
          field: this.guessSecretField(value),
          valuePreview: this.previewSecret(value),
          source: 'text',
          secretRef: this.guessSecretField(value),
          acceptedForPersistence: false,
        });
        match = pattern.exec(text);
      }
    }

    for (const [field, value] of Object.entries(providedSecrets)) {
      if (!value) {
        continue;
      }
      detected.push({
        field,
        valuePreview: this.previewSecret(value),
        source: 'providedSecrets',
        secretRef: field,
        acceptedForPersistence: false,
      });
    }
    return this.uniqueSecretInputs(detected);
  }

  private redactText(text: string, secretInputs: NaturalSetupSecretInput[]): string {
    let redacted = text;
    for (const input of secretInputs) {
      const escapedPreview = input.valuePreview.replace(/\*/g, '');
      if (escapedPreview.length < 4) {
        continue;
      }
    }
    for (const pattern of SECRET_PATTERNS) {
      redacted = redacted.replace(pattern, (match, group) => {
        if (typeof group === 'string' && group.length > 0) {
          return match.replace(group, '[SECRET_REDACTED]');
        }
        return '[SECRET_REDACTED]';
      });
    }
    return redacted;
  }

  private guessSecretField(value: string): string {
    if (/^xox/i.test(value)) {
      return 'slack.botToken';
    }
    if (/^gh[pousr]_/i.test(value)) {
      return 'github.token';
    }
    if (/^AIza/.test(value)) {
      return 'gemini.apiKey';
    }
    if (/^sk-/i.test(value)) {
      return 'apiKey';
    }
    return 'secret';
  }

  private previewSecret(value: string): string {
    const cleaned = String(value || '').trim();
    if (cleaned.length <= 8) {
      return `${cleaned.slice(0, 1)}***`;
    }
    return `${cleaned.slice(0, 4)}...${cleaned.slice(-4)}`;
  }

  private uniqueSecretInputs(inputs: NaturalSetupSecretInput[]): NaturalSetupSecretInput[] {
    const seen = new Set<string>();
    return inputs.filter((input) => {
      const key = `${input.field}:${input.valuePreview}:${input.source}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private actionToHumanText(action: NaturalSetupIntentAction): string {
    if (action === 'connect') {
      return 'conectar';
    }
    if (action === 'configure') {
      return 'configurar';
    }
    if (action === 'validate') {
      return 'validar';
    }
    if (action === 'inspect') {
      return 'entender';
    }
    return 'preparar';
  }

  private humanizeRef(ref: string): string {
    return ref
      .replace(/[_-]/g, ' ')
      .replace(/\./g, ' ')
      .replace(/\btoken\b/gi, 'token')
      .replace(/\bapi key\b/gi, 'chave de API');
  }

  private normalize(value: string | null | undefined): string {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9:._-]+/g, ' ')
      .trim();
  }
}
