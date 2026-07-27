import type {
  AgentPolicy,
  AgentProfile,
  ExecutionPreview,
  SalesActionKind,
  SalesAgentRole,
  SalesPolicyDecision,
  SalesRiskLevel,
} from '../../../../contracts/SalesPackContract.js';

type SalesPackProfileRegistryRuntime = {
  profiles?: AgentProfile[];
  policies?: AgentPolicy[];
};

type SalesPackPolicyEngineRuntime = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
};

type EvaluateSalesActionInput = {
  profile: AgentProfile;
  policy: AgentPolicy;
  actionKind: SalesActionKind;
  requestedBy: string;
  surface: string;
  traceId: string;
  amount?: number | null;
  discountPercent?: number | null;
  messageText?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SalesPackSupervisorReview = {
  ok: boolean;
  risk: SalesRiskLevel;
  blocked: boolean;
  reasons: string[];
};

export class SalesPackProfileRegistryService {
  private readonly profiles = new Map<string, AgentProfile>();
  private readonly policies = new Map<string, AgentPolicy>();

  constructor(runtime: SalesPackProfileRegistryRuntime = {}) {
    for (const policy of runtime.policies || buildDefaultSalesAgentPolicies()) {
      this.policies.set(policy.id, clonePolicy(policy));
    }
    for (const profile of runtime.profiles || buildDefaultSalesAgentProfiles()) {
      this.profiles.set(profile.id, cloneProfile(profile));
    }
  }

  public listProfiles(): AgentProfile[] {
    return Array.from(this.profiles.values()).map(cloneProfile);
  }

  public listPolicies(): AgentPolicy[] {
    return Array.from(this.policies.values()).map(clonePolicy);
  }

  public getProfile(id: string): AgentProfile | null {
    const profile = this.profiles.get(clean(id));
    return profile ? cloneProfile(profile) : null;
  }

  public getPolicy(id: string): AgentPolicy | null {
    const policy = this.policies.get(clean(id));
    return policy ? clonePolicy(policy) : null;
  }

  public resolveProfileByRole(role: SalesAgentRole): AgentProfile {
    const direct = this.listProfiles().find((profile) => profile.role === role);
    if (direct) {
      return direct;
    }
    return this.listProfiles().find((profile) => profile.role === 'sales') || buildDefaultSalesAgentProfiles()[0];
  }

  public resolvePolicyForProfile(profile: AgentProfile): AgentPolicy {
    return this.getPolicy(profile.policyId) || buildDefaultSalesAgentPolicies()[0];
  }
}

export class SalesPackPolicyEngineService {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;

  constructor(runtime: SalesPackPolicyEngineRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.idFactory = runtime.idFactory || defaultIdFactory;
  }

  public evaluateAction(input: EvaluateSalesActionInput): ExecutionPreview {
    const reasons: string[] = [];
    const profileLimit = input.profile.commercialLimits;
    const risk = resolveActionRisk(input.actionKind);
    let decision: SalesPolicyDecision = input.policy.defaultDecision;

    if (input.policy.blockedActions.includes(input.actionKind)) {
      decision = 'blocked';
      reasons.push(`Action ${input.actionKind} is blocked by policy.`);
    }

    if (input.actionKind === 'send_payment_link' && !profileLimit.canSendPaymentLink) {
      decision = 'blocked';
      reasons.push('The agent profile cannot send payment links.');
    }

    if (input.actionKind === 'change_order' && !profileLimit.canChangeOrder) {
      decision = 'blocked';
      reasons.push('The agent profile cannot modify orders.');
    }

    if (input.actionKind === 'create_campaign' && !profileLimit.canCreateCampaign) {
      decision = 'blocked';
      reasons.push('The agent profile cannot create campaigns.');
    }

    const maxDiscount = Math.min(
      normalizeNumber(profileLimit.maxDiscountPercent, 0),
      normalizeNumber(input.policy.maxDiscountPercent, 0),
    );
    const discountPercent = normalizeOptionalNumber(input.discountPercent);
    if (discountPercent !== null && discountPercent > maxDiscount) {
      decision = 'blocked';
      reasons.push(`Requested discount ${discountPercent}% exceeds the ${maxDiscount}% limit.`);
    }

    const amount = normalizeOptionalNumber(input.amount);
    const approvalLimit = Math.min(
      normalizeNumber(profileLimit.maxApprovalFreeAmount, 0),
      normalizeNumber(input.policy.requiresApprovalAboveAmount, 0),
    );
    if (decision !== 'blocked' && amount !== null && approvalLimit > 0 && amount > approvalLimit) {
      decision = 'requires_approval';
      reasons.push(`Value ${amount} requires approval above ${approvalLimit}.`);
    }

    const blockedClaim = findBlockedClaim(input.messageText, input.policy.blockedClaims);
    if (blockedClaim) {
      decision = 'blocked';
      reasons.push(`Response contains blocked claim: ${blockedClaim}.`);
    }

    if (decision !== 'blocked' && input.policy.sensitiveActionKinds.includes(input.actionKind)) {
      decision = 'requires_approval';
      reasons.push(`Action ${input.actionKind} is sensitive and requires approval.`);
    }

    if (
      decision === input.policy.defaultDecision
      && decision !== 'blocked'
      && input.policy.dryRunRequiredFor.includes(input.actionKind)
    ) {
      decision = 'requires_dryRun';
      reasons.push(`Action ${input.actionKind} needs dry run before real execution.`);
    }

    if (decision === 'allowed' && reasons.length === 0) {
      reasons.push('Action allowed within profile and policy limits.');
    }

    return {
      previewId: this.idFactory('sales-preview'),
      createdAt: this.now().toISOString(),
      traceId: clean(input.traceId, 'trace-unknown'),
      profileId: input.profile.id,
      policyId: input.policy.id,
      actionKind: input.actionKind,
      requestedBy: clean(input.requestedBy, 'operator'),
      surface: clean(input.surface, 'sales-pack'),
      dryRun: true,
      decision,
      risk: decision === 'blocked' ? escalateRisk(risk) : risk,
      approvalRequired: decision === 'requires_approval',
      reasons,
      metadata: sanitizeMetadata(input.metadata),
    };
  }

  public reviewAssistantMessage(input: {
    policy: AgentPolicy;
    text: string;
  }): SalesPackSupervisorReview {
    const reasons: string[] = [];
    const blockedClaim = findBlockedClaim(input.text, input.policy.blockedClaims);
    if (blockedClaim) {
      reasons.push(`Claim blocked detectado: ${blockedClaim}.`);
    }
    if (/\b\d{3}\....\d{3}\....\d{3}-...\d{2}\b/.test(input.text)) {
      reasons.push('Possible personal identifier or sensitive personal data detected.');
    }
    if ((input.text.match(/https?:\/\//g) || []).length > 2) {
      reasons.push('Response contains too many links for safe handling.');
    }
    const blocked = reasons.length > 0;
    return {
      ok: !blocked,
      risk: blocked ? 'high' : 'low',
      blocked,
      reasons: blocked ? reasons : ['Response approved by supervised review.'],
    };
  }
}

export function buildDefaultSalesAgentProfiles(): AgentProfile[] {
  const baseLimits = {
    maxDiscountPercent: 15,
    maxApprovalFreeAmount: 500,
    canSendPaymentLink: true,
    canChangeOrder: false,
    canCreateCampaign: false,
  };
  return [
    {
      id: 'sales-default',
      version: 'sales-pack.agent-profile.v1',
      role: 'sales',
      label: 'Agente de Vendas',
      objective: 'Qualify leads, answer objections, and guide the customer to the next safe action.',
      voiceTone: 'consultivo, claro e direct',
      allowedToolIds: ['memory.read', 'knowledge.search', 'crm.update', 'message.send'],
      memoryScopes: ['organization', 'customer', 'conversation', 'knowledge'],
      policyId: 'sales-safe-default',
      commercialLimits: { ...baseLimits },
      metadata: {},
    },
    {
      id: 'support-default',
      version: 'sales-pack.agent-profile.v1',
      role: 'support',
      label: 'Agente de Suporte',
      objective: 'Resolve questions, consult context, and open handoff when there is operational risk.',
      voiceTone: 'calmo, objetivo e responsavel',
      allowedToolIds: ['memory.read', 'knowledge.search', 'handoff.create', 'message.send'],
      memoryScopes: ['customer', 'conversation', 'knowledge'],
      policyId: 'sales-safe-default',
      commercialLimits: { ...baseLimits, canSendPaymentLink: false },
      metadata: {},
    },
    {
      id: 'recovery-default',
      version: 'sales-pack.agent-profile.v1',
      role: 'recovery',
      label: 'Agente de Recuperaction',
      objective: 'resume stalled leads without spam and with next-action recommendation.',
      voiceTone: 'breve, util e without pressure',
      allowedToolIds: ['memory.read', 'crm.update', 'message.send'],
      memoryScopes: ['customer', 'conversation'],
      policyId: 'sales-safe-default',
      commercialLimits: { ...baseLimits, canSendPaymentLink: false },
      metadata: {},
    },
    {
      id: 'crm-default',
      version: 'sales-pack.agent-profile.v1',
      role: 'crm',
      label: 'Agente de CRM',
      objective: 'Resumir conversas, atualizar estagios e explicar lead score.',
      voiceTone: 'analitico e sintetico',
      allowedToolIds: ['memory.read', 'crm.update'],
      memoryScopes: ['customer', 'conversation', 'operator'],
      policyId: 'sales-safe-default',
      commercialLimits: { ...baseLimits, canSendPaymentLink: false },
      metadata: {},
    },
    {
      id: 'supervisor-default',
      version: 'sales-pack.agent-profile.v1',
      role: 'supervisor',
      label: 'Agente Supervisor',
      objective: 'review risk, claims, descontos, spam e usage seguro de tools.',
      voiceTone: 'firm and careful',
      allowedToolIds: ['policy.review', 'approval.request'],
      memoryScopes: ['operator', 'organization', 'procedural'],
      policyId: 'sales-safe-default',
      commercialLimits: { ...baseLimits, canSendPaymentLink: false },
      metadata: {},
    },
  ];
}

export function buildDefaultSalesAgentPolicies(): AgentPolicy[] {
  return [
    {
      id: 'sales-safe-default',
      version: 'sales-pack.agent-policy.v1',
      label: 'Sales Pack Safe Default',
      blockedClaims: [
        'garantia absoluta',
        'guaranteed result',
        'cura garantida',
        '80% de desconto',
      ],
      blockedActions: ['create_campaign'],
      sensitiveActionKinds: ['send_payment_link', 'apply_discount', 'change_order', 'create_handoff'],
      dryRunRequiredFor: ['send_payment_link', 'apply_discount', 'change_order', 'update_crm', 'create_campaign'],
      requiresApprovalAboveAmount: 500,
      maxDiscountPercent: 15,
      defaultDecision: 'allowed',
      metadata: {},
    },
  ];
}

function resolveActionRisk(actionKind: SalesActionKind): SalesRiskLevel {
  if (actionKind === 'create_campaign' || actionKind === 'change_order') {
    return 'high';
  }
  if (actionKind === 'send_payment_link' || actionKind === 'apply_discount' || actionKind === 'create_handoff') {
    return 'medium';
  }
  return 'low';
}

function escalateRisk(risk: SalesRiskLevel): SalesRiskLevel {
  if (risk === 'low') {
    return 'medium';
  }
  if (risk === 'medium') {
    return 'high';
  }
  return risk;
}

function findBlockedClaim(text: unknown, claims: string[]): string | null {
  const normalizedText = clean(text).toLowerCase();
  if (!normalizedText) {
    return null;
  }
  return claims.find((claim) => normalizedText.includes(clean(claim).toLowerCase())) || null;
}

function sanitizeMetadata(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (key && value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function normalizeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeOptionalNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function defaultIdFactory(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clean(value: unknown, fallback = ''): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

function cloneProfile(profile: AgentProfile): AgentProfile {
  return {
    ...profile,
    allowedToolIds: profile.allowedToolIds.slice(),
    memoryScopes: profile.memoryScopes.slice(),
    commercialLimits: { ...profile.commercialLimits },
    metadata: { ...profile.metadata },
  };
}

function clonePolicy(policy: AgentPolicy): AgentPolicy {
  return {
    ...policy,
    blockedClaims: policy.blockedClaims.slice(),
    blockedActions: policy.blockedActions.slice(),
    sensitiveActionKinds: policy.sensitiveActionKinds.slice(),
    dryRunRequiredFor: policy.dryRunRequiredFor.slice(),
    metadata: { ...policy.metadata },
  };
}
