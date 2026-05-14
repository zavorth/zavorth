import {
  SalesPackMvpService,
  SalesPackPolicyEngineService,
  SalesPackProfileRegistryService,
  SalesPackScopedMemoryService,
} from '../../../src/domain/platform-ecosystem/application/sales-pack';

function deterministicIdFactory(): (prefix: string) => string {
  let next = 0;
  return (prefix: string) => `${prefix}-${++next}`;
}

describe('SalesPackMvpService', () => {
  it('runs the demo sales flow through ledger, routing, memory, CRM signal and delivery', () => {
    const now = () => new Date('2026-05-08T12:00:00.000Z');
    const service = new SalesPackMvpService({
      mode: 'demo',
      now,
      idFactory: deterministicIdFactory(),
    });

    const result = service.processInboundMessage({
      tenantId: 'demo-org',
      customerId: 'lead-ana',
      text: 'Achei caro, mas ainda tenho interesse. Ainda tem vaga?',
      surface: 'demo',
      traceId: 'trace-demo',
    });

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('demo');
    expect(result.selectedAgent.role).toBe('sales');
    expect(result.signal).toMatchObject({
      customerId: 'lead-ana',
      intent: 'price_objection',
      objection: 'price',
      stage: 'negotiating',
      handoffRequired: false,
    });
    expect(result.preview).toMatchObject({
      actionKind: 'send_message',
      decision: 'allowed',
      dryRun: true,
    });
    expect(result.deliveryReceipt?.status).toBe('sent');

    const eventKinds = result.events.map((event) => event.kind);
    expect(eventKinds).toEqual(expect.arrayContaining([
      'message.received',
      'intent.classified',
      'agent.routed',
      'memory.retrieved',
      'lead.updated',
      'tool.previewed',
      'tool.executed',
      'message.sent',
    ]));
    expect(result.events.every((event) => event.traceId === 'trace-demo')).toBe(true);

    const snapshot = service.buildSnapshot();
    expect(snapshot.summary).toMatchObject({
      posture: 'healthy',
      mode: 'demo',
      conversations: 1,
      leads: 1,
      pendingApprovals: 0,
      deliveryReceipts: 1,
    });
    expect(snapshot.sourceSnapshots.inbox).toHaveLength(1);
    expect(snapshot.sourceSnapshots.crm[0].nextAction).toContain('comparacao');
    expect(snapshot.sourceSnapshots.agents.map((agent) => agent.role)).toEqual(expect.arrayContaining([
      'sales',
      'support',
      'recovery',
      'crm',
      'supervisor',
    ]));
    expect(snapshot.sourceSnapshots.ledger.byKind['message.received']).toBe(1);
    expect(snapshot.actions.map((action) => action.id)).toContain('sales-pack:configure-whatsapp');
  });

  it('enforces commercial policy for discounts, payment links and blocked claims', () => {
    const registry = new SalesPackProfileRegistryService();
    const engine = new SalesPackPolicyEngineService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });
    const profile = registry.resolveProfileByRole('sales');
    const policy = registry.resolvePolicyForProfile(profile);

    const blockedDiscount = engine.evaluateAction({
      profile,
      policy,
      actionKind: 'apply_discount',
      requestedBy: 'operator',
      surface: 'policy-simulator',
      traceId: 'trace-policy',
      discountPercent: 80,
    });
    expect(blockedDiscount.decision).toBe('blocked');
    expect(blockedDiscount.approvalRequired).toBe(false);
    expect(blockedDiscount.reasons.join(' ')).toContain('excede');

    const paymentLink = engine.evaluateAction({
      profile,
      policy,
      actionKind: 'send_payment_link',
      requestedBy: 'operator',
      surface: 'policy-simulator',
      traceId: 'trace-policy',
      amount: 700,
    });
    expect(paymentLink.decision).toBe('requires_approval');
    expect(paymentLink.approvalRequired).toBe(true);

    const blockedClaim = engine.evaluateAction({
      profile,
      policy,
      actionKind: 'send_message',
      requestedBy: 'operator',
      surface: 'policy-simulator',
      traceId: 'trace-policy',
      messageText: 'Esse produto tem resultado garantido para todos.',
    });
    expect(blockedClaim.decision).toBe('blocked');
    expect(blockedClaim.risk).toBe('medium');
  });

  it('keeps scoped memories isolated and redacts sensitive entries in snapshots', () => {
    const memory = new SalesPackScopedMemoryService({
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    memory.remember({
      scope: 'customer',
      ownerId: 'lead-a',
      key: 'produto',
      value: 'Plano X',
    });
    memory.remember({
      scope: 'customer',
      ownerId: 'lead-b',
      key: 'produto',
      value: 'Plano Y',
    });
    memory.remember({
      scope: 'operator',
      ownerId: 'operator-1',
      key: 'token_atendimento',
      value: 'secret-token-123456',
      sensitive: true,
    });

    expect(memory.recall({ scope: 'customer', ownerId: 'lead-a', key: 'produto' })?.value).toBe('Plano X');
    expect(memory.recall({ scope: 'customer', ownerId: 'lead-b', key: 'produto' })?.value).toBe('Plano Y');
    expect(memory.recall({ scope: 'customer', ownerId: 'lead-a', key: 'missing' })).toBeNull();

    const redacted = memory.listByScope({
      scope: 'operator',
      ownerId: 'operator-1',
      redacted: true,
    });
    expect(redacted[0].value).toContain('[redacted]');
    expect(redacted[0].value).not.toContain('secret-token-123456');
  });

  it('creates a human handoff and approval request for cancellation risk', () => {
    const service = new SalesPackMvpService({
      mode: 'demo',
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    const result = service.processInboundMessage({
      tenantId: 'demo-org',
      customerId: 'lead-cancel',
      text: 'quero cancelar e pedir reembolso',
      traceId: 'trace-handoff',
    });

    expect(result.ok).toBe(true);
    expect(result.selectedAgent.role).toBe('support');
    expect(result.signal).toMatchObject({
      intent: 'cancellation',
      handoffRequired: true,
      stage: 'handoff',
      risk: 'high',
    });
    expect(result.preview.decision).toBe('requires_approval');
    expect(result.deliveryReceipt).toBeNull();
    expect(result.conversation.status).toBe('waiting_human');

    const eventKinds = result.events.map((event) => event.kind);
    expect(eventKinds).toEqual(expect.arrayContaining([
      'approval.requested',
      'handoff.created',
    ]));

    const snapshot = service.buildSnapshot();
    expect(snapshot.summary.pendingApprovals).toBe(1);
    expect(snapshot.actions.map((action) => action.id)).toEqual(expect.arrayContaining([
      'sales-pack:review-approvals',
      'sales-pack:handoff',
    ]));
  });

  it.each([
    ['meu pedido chegou?', 'order_status', 'support'],
    ['quero cancelar', 'cancellation', 'support'],
    ['ainda tem vaga?', 'availability', 'sales'],
  ])('simulates "%s" as intent %s routed to %s', (text, intent, role) => {
    const service = new SalesPackMvpService({
      mode: 'stub',
      now: () => new Date('2026-05-08T12:00:00.000Z'),
      idFactory: deterministicIdFactory(),
    });

    const result = service.processInboundMessage({
      tenantId: 'demo-org',
      customerId: `lead-${intent}`,
      text,
      traceId: `trace-${intent}`,
    });

    expect(result.signal.intent).toBe(intent);
    expect(result.selectedAgent.role).toBe(role);
    expect(result.events.length).toBeGreaterThanOrEqual(7);
  });
});
