import type {
  AgentProfile,
  ChannelAccount,
  CommercialSignal,
  ConversationSession,
  DeliveryReceipt,
  ExecutionPreview,
  SalesIntent,
  SalesObjection,
  SalesPackControlPlaneAction,
  SalesPackControlPlaneSnapshot,
  SalesPackConversationResult,
  SalesPackInboundMessageInput,
  SalesPackLedgerEvent,
  SalesPackMode,
  SalesRiskLevel,
} from '../../../../contracts/SalesPackContract.js';
import type { AppendSalesPackEventInput } from './SalesPackEventLedgerService.js';
import { SalesPackEventLedgerService } from './SalesPackEventLedgerService.js';
import {
  SalesPackPolicyEngineService,
  SalesPackProfileRegistryService,
} from './SalesPackProfilePolicyService.js';
import { SalesPackScopedMemoryService } from './SalesPackScopedMemoryService.js';

type SalesPackMvpRuntime = {
  mode?: SalesPackMode;
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  ledger?: SalesPackEventLedgerService;
  registry?: SalesPackProfileRegistryService;
  policyEngine?: SalesPackPolicyEngineService;
  memory?: SalesPackScopedMemoryService;
  channelAccount?: ChannelAccount;
};

type LeadRecord = CommercialSignal & {
  updatedAt: string;
};

export class SalesPackMvpService {
  private readonly mode: SalesPackMode;
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private readonly ledger: SalesPackEventLedgerService;
  private readonly registry: SalesPackProfileRegistryService;
  private readonly policyEngine: SalesPackPolicyEngineService;
  private readonly memory: SalesPackScopedMemoryService;
  private readonly channelAccount: ChannelAccount;
  private readonly conversations = new Map<string, ConversationSession>();
  private readonly leads = new Map<string, LeadRecord>();
  private readonly deliveryReceipts: DeliveryReceipt[] = [];
  private pendingApprovals = 0;

  constructor(runtime: SalesPackMvpRuntime = {}) {
    this.mode = runtime.mode || 'demo';
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || defaultIdFactory;
    this.ledger = runtime.ledger || new SalesPackEventLedgerService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.registry = runtime.registry || new SalesPackProfileRegistryService();
    this.policyEngine = runtime.policyEngine || new SalesPackPolicyEngineService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.memory = runtime.memory || new SalesPackScopedMemoryService({
      now: this.now,
      idFactory: this.idFactory,
    });
    this.channelAccount = runtime.channelAccount || buildDefaultChannelAccount(this.mode);
    this.seedDefaultKnowledge();
  }

  public processInboundMessage(input: SalesPackInboundMessageInput): SalesPackConversationResult {
    const tenantId = clean(input.tenantId, 'tenant-demo');
    const customerId = clean(input.customerId, 'customer-demo');
    const channelAccountId = clean(input.channelAccountId, this.channelAccount.id);
    const conversationId = clean(input.conversationId, `${channelAccountId}:${customerId}`);
    const traceId = clean(input.traceId, this.idFactory('sales-trace'));
    const actorId = clean(input.actorId, customerId);
    const surface = clean(input.surface, 'sales-pack');
    const runId = cleanNullable(input.runId);
    const text = clean(input.text);

    const eventsBefore = this.ledger.list({ traceId }).length;
    const conversation = this.upsertConversation({
      id: conversationId,
      tenantId,
      channelAccountId,
      customerId,
      lastIntent: 'unknown',
      lastMessageAt: clean(input.receivedAt, this.now().toISOString()),
      summary: '',
      status: 'open',
      metadata: { source: surface },
    });

    this.appendEvent('message.received', {
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
      payload: {
        text,
        receivedAt: clean(input.receivedAt, this.now().toISOString()),
        metadata: input.metadata || {},
      },
    });

    const intent = classifyIntent(text);
    this.appendEvent('intent.classified', {
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
      payload: { intent },
    });

    const selectedAgent = this.routeAgent(intent);
    this.appendEvent('agent.routed', {
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
      payload: {
        profileId: selectedAgent.id,
        role: selectedAgent.role,
      },
    });

    const memories = this.memory.listRelevant({
      query: text,
      scopes: selectedAgent.memoryScopes,
      ownerIds: [tenantId, customerId, conversationId, 'sales-pack'],
      redacted: true,
      limit: 6,
    });
    this.appendEvent('memory.retrieved', {
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
      payload: {
        count: memories.length,
        scopes: selectedAgent.memoryScopes,
      },
    });

    const signal = this.buildSignal({
      tenantId,
      customerId,
      conversationId,
      intent,
      text,
    });
    this.leads.set(signal.leadId, { ...signal, updatedAt: this.now().toISOString() });
    this.appendEvent('lead.updated', {
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
      payload: signal,
    });

    const replyText = this.buildReply(intent, signal, memories.map((entry) => entry.value));
    const policy = this.registry.resolvePolicyForProfile(selectedAgent);
    const supervisorReview = this.policyEngine.reviewAssistantMessage({ policy, text: replyText });
    const preview = this.policyEngine.evaluateAction({
      profile: selectedAgent,
      policy,
      actionKind: signal.handoffRequired ? 'create_handoff' : 'send_message',
      requestedBy: actorId,
      surface,
      traceId,
      messageText: replyText,
      metadata: { supervisorReview },
    });

    this.appendPreviewEvents({
      preview,
      traceId,
      runId,
      sessionId: conversationId,
      tenantId,
      channelAccountId,
      actorId,
    });

    const deliveryReceipt = this.maybeDeliver({
      preview,
      conversationId,
      channelAccountId,
      traceId,
      runId,
      tenantId,
      actorId,
      replyText,
    });

    if (signal.handoffRequired) {
      conversation.status = 'waiting_human';
      this.appendEvent('handoff.created', {
        traceId,
        runId,
        sessionId: conversationId,
        tenantId,
        channelAccountId,
        actorId,
        payload: {
          leadId: signal.leadId,
          reason: signal.explanation,
        },
      });
    }

    conversation.lastIntent = intent;
    conversation.lastMessageAt = this.now().toISOString();
    conversation.summary = summarizeConversation(text, replyText, signal);
    this.conversations.set(conversation.id, { ...conversation, metadata: { ...conversation.metadata } });

    return {
      ok: preview.decision !== 'blocked',
      mode: this.mode,
      traceId,
      conversation: cloneConversation(conversation),
      selectedAgent,
      signal,
      preview,
      replyText,
      deliveryReceipt,
      events: this.ledger.list({ traceId }).slice(eventsBefore),
    };
  }

  public buildSnapshot(): SalesPackControlPlaneSnapshot {
    const conversations = this.listConversations();
    const leads = this.listLeads();
    const actions = this.buildActions(conversations, leads);
    const posture = this.pendingApprovals > 0
      ? 'critical'
      : this.mode === 'cloud-api' && !this.channelAccount.configured
        ? 'attention'
        : conversations.length > 0
          ? 'healthy'
          : 'attention';

    return {
      generatedAt: this.now().toISOString(),
      summary: {
        posture,
        mode: this.mode,
        conversations: conversations.length,
        leads: leads.length,
        agentProfiles: this.registry.listProfiles().length,
        pendingApprovals: this.pendingApprovals,
        deliveryReceipts: this.deliveryReceipts.length,
      },
      narrative: {
        headline: 'Sales OS Pack',
        operatorSummary:
          `${conversations.length} conversa(s), ${leads.length} lead(s), `
          + `${this.pendingApprovals} approval(s) pendente(s) e modo ${this.mode}.`,
        nextAction: actions[0]?.label || 'Rodar uma conversa demo para validar inbox, CRM e policy.',
      },
      actions,
      sourceSnapshots: {
        inbox: conversations,
        crm: leads,
        agents: this.registry.listProfiles(),
        channelHealth: { ...this.channelAccount, metadata: { ...this.channelAccount.metadata } },
        ledger: this.ledger.buildSummary(),
      },
    };
  }

  public seedDemoScenario(): SalesPackConversationResult {
    return this.processInboundMessage({
      tenantId: 'demo-org',
      customerId: 'lead-demo-ana',
      text: 'Achei caro, mas ainda tenho interesse. Ainda tem vaga?',
      surface: 'demo',
    });
  }

  public getMemory(): SalesPackScopedMemoryService {
    return this.memory;
  }

  private routeAgent(intent: SalesIntent): AgentProfile {
    if (intent === 'order_status' || intent === 'cancellation') {
      return this.registry.resolveProfileByRole('support');
    }
    if (intent === 'unknown') {
      return this.registry.resolveProfileByRole('crm');
    }
    return this.registry.resolveProfileByRole('sales');
  }

  private buildSignal(input: {
    tenantId: string;
    customerId: string;
    conversationId: string;
    intent: SalesIntent;
    text: string;
  }): CommercialSignal {
    const objection = resolveObjection(input.intent, input.text);
    const handoffRequired = input.intent === 'cancellation';
    const leadScore = resolveLeadScore(input.intent, input.text);
    return {
      leadId: `${input.tenantId}:${input.customerId}`,
      customerId: input.customerId,
      intent: input.intent,
      objection,
      leadScore,
      phase: handoffRequired
        ? 'handoff'
        : input.intent === 'order_status'
          ? 'support'
          : leadScore >= 80
            ? 'hot'
            : input.intent === 'price_objection'
              ? 'negotiating'
              : 'qualifying',
      nextAction: resolveNextAction(input.intent),
      risk: handoffRequired ? 'high' : input.intent === 'payment' ? 'medium' : 'low',
      explanation: explainSignal(input.intent, objection, leadScore),
      handoffRequired,
    };
  }

  private buildReply(intent: SalesIntent, signal: CommercialSignal, memoryLines: string[]): string {
    const memoryHint = memoryLines[0] ? ` Contexto considerado: ${memoryLines[0]}` : '';
    switch (intent) {
      case 'price_objection':
        return `Entendi a preocupacao com o valor. Posso te mostrar a opcao mais acessivel e comparar com o que voce ganha em cada plano.${memoryHint}`;
      case 'order_status':
        return 'Consigo te ajudar com o status do pedido. Vou precisar localizar o cadastro ou o codigo de rastreio antes de afirmar qualquer prazo.';
      case 'cancellation':
        return 'Entendi. Vou chamar uma pessoa do time para cuidar disso com seguranca e evitar qualquer promessa errada.';
      case 'availability':
        return 'Sim, ainda posso verificar disponibilidade para voce. Pelo seu interesse, a melhor proxima acao e confirmar perfil e prazo.';
      case 'payment':
        return 'Posso orientar o pagamento, mas envio de link ou cobranca passa pelas regras de seguranca configuradas.';
      case 'greeting':
        return 'Oi. Me diga o que voce procura que eu te ajudo a encontrar o melhor caminho.';
      default:
        return 'Recebi sua mensagem. Vou organizar o contexto e indicar a melhor proxima acao.';
    }
  }

  private maybeDeliver(input: {
    preview: ExecutionPreview;
    conversationId: string;
    channelAccountId: string;
    traceId: string;
    runId: string | null;
    tenantId: string;
    actorId: string;
    replyText: string;
  }): DeliveryReceipt | null {
    if (input.preview.decision === 'blocked') {
      return this.recordDelivery(input, 'blocked', 'policy_blocked');
    }
    if (input.preview.decision === 'requires_approval') {
      this.pendingApprovals += 1;
      this.appendEvent('approval.requested', {
        traceId: input.traceId,
        runId: input.runId,
        sessionId: input.conversationId,
        tenantId: input.tenantId,
        channelAccountId: input.channelAccountId,
        actorId: input.actorId,
        payload: {
          previewId: input.preview.previewId,
          reasons: input.preview.reasons,
        },
      });
      return null;
    }
    const receipt = this.recordDelivery(input, this.mode === 'demo' ? 'sent' : 'queued', null);
    this.appendEvent('message.sent', {
      traceId: input.traceId,
      runId: input.runId,
      sessionId: input.conversationId,
      tenantId: input.tenantId,
      channelAccountId: input.channelAccountId,
      actorId: input.actorId,
      payload: {
        receipt,
        text: input.replyText,
      },
    });
    return receipt;
  }

  private recordDelivery(input: {
    conversationId: string;
    channelAccountId: string;
  }, status: DeliveryReceipt['status'], error: string | null): DeliveryReceipt {
    const receipt: DeliveryReceipt = {
      id: this.idFactory('sales-delivery'),
      createdAt: this.now().toISOString(),
      channelAccountId: input.channelAccountId,
      conversationId: input.conversationId,
      platform: this.channelAccount.platform,
      status,
      providerMessageId: status === 'sent' ? this.idFactory('provider-message') : null,
      error,
      metadata: {
        mode: this.mode,
        provider: this.channelAccount.provider,
      },
    };
    this.deliveryReceipts.push(receipt);
    return { ...receipt, metadata: { ...receipt.metadata } };
  }

  private appendPreviewEvents(input: {
    preview: ExecutionPreview;
    traceId: string;
    runId: string | null;
    sessionId: string;
    tenantId: string;
    channelAccountId: string;
    actorId: string;
  }): void {
    this.appendEvent('tool.previewed', {
      traceId: input.traceId,
      runId: input.runId,
      sessionId: input.sessionId,
      tenantId: input.tenantId,
      channelAccountId: input.channelAccountId,
      actorId: input.actorId,
      payload: input.preview,
    });
    if (input.preview.decision === 'allowed') {
      this.appendEvent('tool.executed', {
        traceId: input.traceId,
        runId: input.runId,
        sessionId: input.sessionId,
        tenantId: input.tenantId,
        channelAccountId: input.channelAccountId,
        actorId: input.actorId,
        payload: {
          actionKind: input.preview.actionKind,
          previewId: input.preview.previewId,
        },
      });
    }
  }

  private appendEvent(kind: SalesPackLedgerEvent['kind'], input: Omit<AppendSalesPackEventInput, 'kind'>): void {
    this.ledger.append({ kind, ...input });
  }

  private upsertConversation(input: ConversationSession): ConversationSession {
    const existing = this.conversations.get(input.id);
    const next = existing || {
      ...input,
      lastMessageAt: this.now().toISOString(),
      metadata: { ...input.metadata },
    };
    this.conversations.set(next.id, next);
    return next;
  }

  private listConversations(): ConversationSession[] {
    return Array.from(this.conversations.values())
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt))
      .map(cloneConversation);
  }

  private listLeads(): CommercialSignal[] {
    return Array.from(this.leads.values())
      .sort((left, right) => right.leadScore - left.leadScore)
      .map(({ updatedAt: _updatedAt, ...signal }) => ({ ...signal }));
  }

  private buildActions(conversations: ConversationSession[], leads: CommercialSignal[]): SalesPackControlPlaneAction[] {
    const actions: SalesPackControlPlaneAction[] = [];
    if (this.pendingApprovals > 0) {
      actions.push({
        id: 'sales-pack:review-approvals',
        label: 'Revisar approvals do Sales Pack',
        severity: 'critical',
        reason: `${this.pendingApprovals} acao(oes) comerciais aguardam decisao humana.`,
        command: '/sales approvals',
      });
    }
    if (this.mode !== 'cloud-api') {
      actions.push({
        id: 'sales-pack:configure-whatsapp',
        label: 'Configurar WhatsApp Cloud API',
        severity: 'warn',
        reason: 'Modo demo/stub esta pronto para teste, mas producao exige Cloud API oficial.',
        command: '/channels whatsapp',
      });
    }
    if (conversations.length === 0) {
      actions.push({
        id: 'sales-pack:seed-demo',
        label: 'Rodar conversa demo',
        severity: 'info',
        reason: 'Nenhuma conversa foi processada ainda.',
        command: '/sales demo',
      });
    }
    if (leads.some((lead) => lead.handoffRequired)) {
      actions.push({
        id: 'sales-pack:handoff',
        label: 'Atender handoffs humanos',
        severity: 'warn',
        reason: 'Ha lead(s) que a IA marcou como exigindo humano.',
        command: '/sales handoff',
      });
    }
    return actions.slice(0, 6);
  }

  private seedDefaultKnowledge(): void {
    if (this.memory.buildSnapshot().total > 0) {
      return;
    }
    this.memory.remember({
      scope: 'knowledge',
      ownerId: 'sales-pack',
      key: 'politica_desconto',
      value: 'Desconto maximo padrao e 15%; acima disso exige decisao humana.',
      sensitive: false,
    });
    this.memory.remember({
      scope: 'procedural',
      ownerId: 'sales-pack',
      key: 'handoff',
      value: 'Cancelamento, promessa sensivel ou alteracao de pedido deve ir para humano.',
      sensitive: false,
    });
  }
}

function buildDefaultChannelAccount(mode: SalesPackMode): ChannelAccount {
  return {
    id: 'sales-pack-whatsapp-demo',
    platform: 'whatsapp',
    label: 'WhatsApp Sales Pack',
    mode,
    provider: mode === 'cloud-api' ? 'meta-cloud-api' : 'local-outbox',
    configured: mode !== 'cloud-api',
    webhookPath: mode === 'cloud-api' ? '/api/webhooks/whatsapp' : null,
    metadata: {
      officialProviderFirst: true,
    },
  };
}

function classifyIntent(text: string): SalesIntent {
  const normalized = normalize(text);
  if (/\b(caro|preco|valor|desconto|barato)\b/.test(normalized)) {
    return 'price_objection';
  }
  if (/\b(pedido|rastreio|entrega|chegou|status)\b/.test(normalized)) {
    return 'order_status';
  }
  if (/\b(cancelar|cancelamento|reembolso|devolver)\b/.test(normalized)) {
    return 'cancellation';
  }
  if (/\b(vaga|disponivel|tem|agenda|horario)\b/.test(normalized)) {
    return 'availability';
  }
  if (/\b(pagar|pagamento|pix|boleto|cartao|checkout)\b/.test(normalized)) {
    return 'payment';
  }
  if (/\b(oi|ola|bom dia|boa tarde|boa noite)\b/.test(normalized)) {
    return 'greeting';
  }
  return 'unknown';
}

function resolveObjection(intent: SalesIntent, text: string): SalesObjection {
  if (intent === 'price_objection') {
    return 'price';
  }
  if (intent === 'cancellation') {
    return 'cancellation';
  }
  if (/\b(confiar|garantia|medo|golpe)\b/.test(normalize(text))) {
    return 'trust';
  }
  if (/\b(depois|amanha|sem tempo)\b/.test(normalize(text))) {
    return 'timing';
  }
  return 'none';
}

function resolveLeadScore(intent: SalesIntent, text: string): number {
  const normalized = normalize(text);
  const clickedPaymentLike = /\b(pix|checkout|pagamento|boleto)\b/.test(normalized);
  const score = intent === 'payment'
    ? 88
    : intent === 'availability'
      ? 82
      : intent === 'price_objection'
        ? 68
        : intent === 'order_status'
          ? 40
          : intent === 'cancellation'
            ? 35
            : 50;
  return Math.max(0, Math.min(100, clickedPaymentLike ? score + 6 : score));
}

function resolveNextAction(intent: SalesIntent): string {
  switch (intent) {
    case 'price_objection':
      return 'Enviar comparacao de valor, prova social e opcao mais acessivel.';
    case 'order_status':
      return 'Consultar pedido antes de prometer prazo.';
    case 'cancellation':
      return 'Criar handoff humano imediato.';
    case 'availability':
      return 'Confirmar perfil e disponibilidade.';
    case 'payment':
      return 'Simular envio de link e pedir approval se necessario.';
    case 'greeting':
      return 'Qualificar necessidade principal.';
    default:
      return 'Resumir contexto e pedir uma informacao objetiva.';
  }
}

function explainSignal(intent: SalesIntent, objection: SalesObjection, score: number): string {
  return `Intent=${intent}; objection=${objection}; lead_score=${score}.`;
}

function summarizeConversation(userText: string, replyText: string, signal: CommercialSignal): string {
  return [
    `Cliente: ${clip(userText, 120)}`,
    `IA: ${clip(replyText, 160)}`,
    `Sinal: ${signal.intent}, score ${signal.leadScore}, proxima acao: ${signal.nextAction}`,
  ].join('\n');
}

function clean(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cleanNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalize(value: string): string {
  return clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function clip(value: string, limit: number): string {
  const normalized = clean(value);
  return normalized.length <= limit ? normalized : `${normalized.slice(0, Math.max(0, limit - 3))}...`;
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneConversation(conversation: ConversationSession): ConversationSession {
  return {
    ...conversation,
    metadata: { ...conversation.metadata },
  };
}
