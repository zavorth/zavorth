export const SALES_PACK_MODES = ['demo', 'stub', 'cloud-api'] as const;
export type SalesPackMode = typeof SALES_PACK_MODES[number];

export const SALES_AGENT_ROLES = ['sales', 'support', 'recovery', 'crm', 'supervisor', 'custom'] as const;
export type SalesAgentRole = typeof SALES_AGENT_ROLES[number];

export const SALES_MEMORY_SCOPES = [
  'operator',
  'organization',
  'customer',
  'conversation',
  'knowledge',
  'procedural',
] as const;
export type SalesMemoryScope = typeof SALES_MEMORY_SCOPES[number];

export const SALES_ACTION_KINDS = [
  'send_message',
  'send_payment_link',
  'apply_discount',
  'change_order',
  'update_crm',
  'create_handoff',
  'create_campaign',
  'read_knowledge',
] as const;
export type SalesActionKind = typeof SALES_ACTION_KINDS[number];

export const SALES_POLICY_DECISIONS = ['allowed', 'blocked', 'requires_approval', 'requires_simulation'] as const;
export type SalesPolicyDecision = typeof SALES_POLICY_DECISIONS[number];

export type SalesRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export const SALES_EVENT_KINDS = [
  'message.received',
  'intent.classified',
  'agent.routed',
  'memory.retrieved',
  'tool.previewed',
  'approval.requested',
  'tool.executed',
  'message.sent',
  'lead.updated',
  'handoff.created',
] as const;
export type SalesEventKind = typeof SALES_EVENT_KINDS[number];

export type SalesIntent =
  | 'price_objection'
  | 'order_status'
  | 'cancellation'
  | 'availability'
  | 'payment'
  | 'greeting'
  | 'unknown';

export type SalesObjection = 'price' | 'trust' | 'timing' | 'cancellation' | 'none';

export type SalesChannelPlatform =
  | 'whatsapp'
  | 'instagram'
  | 'site-chat'
  | 'email'
  | 'telegram'
  | 'sms'
  | 'slack';

export type AgentCommercialLimits = {
  maxDiscountPercent: number;
  maxApprovalFreeAmount: number;
  canSendPaymentLink: boolean;
  canChangeOrder: boolean;
  canCreateCampaign: boolean;
};

export type AgentProfile = {
  id: string;
  version: string;
  role: SalesAgentRole;
  label: string;
  objective: string;
  voiceTone: string;
  allowedToolIds: string[];
  memoryScopes: SalesMemoryScope[];
  policyId: string;
  commercialLimits: AgentCommercialLimits;
  metadata: Record<string, unknown>;
};

export type AgentPolicy = {
  id: string;
  version: string;
  label: string;
  blockedClaims: string[];
  blockedActions: SalesActionKind[];
  sensitiveActionKinds: SalesActionKind[];
  simulationRequiredFor: SalesActionKind[];
  requiresApprovalAboveAmount: number;
  maxDiscountPercent: number;
  defaultDecision: SalesPolicyDecision;
  metadata: Record<string, unknown>;
};

export type ExecutionPreview = {
  previewId: string;
  createdAt: string;
  traceId: string;
  profileId: string;
  policyId: string;
  actionKind: SalesActionKind;
  requestedBy: string;
  surface: string;
  dryRun: true;
  decision: SalesPolicyDecision;
  risk: SalesRiskLevel;
  approvalRequired: boolean;
  reasons: string[];
  metadata: Record<string, unknown>;
};

export type ScopedMemoryEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  scope: SalesMemoryScope;
  ownerId: string;
  key: string;
  value: string;
  sensitive: boolean;
  redactedValue: string;
  metadata: Record<string, unknown>;
};

export type ChannelAccount = {
  id: string;
  platform: SalesChannelPlatform;
  label: string;
  mode: SalesPackMode;
  provider: 'stub' | 'meta-cloud-api' | 'local-outbox';
  configured: boolean;
  webhookPath: string | null;
  metadata: Record<string, unknown>;
};

export type ConversationSession = {
  id: string;
  tenantId: string;
  channelAccountId: string;
  customerId: string;
  status: 'open' | 'waiting_human' | 'closed';
  lastIntent: SalesIntent;
  lastMessageAt: string;
  summary: string;
  metadata: Record<string, unknown>;
};

export type DeliveryReceipt = {
  id: string;
  createdAt: string;
  channelAccountId: string;
  conversationId: string;
  platform: SalesChannelPlatform;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'blocked';
  providerMessageId: string | null;
  error: string | null;
  metadata: Record<string, unknown>;
};

export type CommercialSignal = {
  leadId: string;
  customerId: string;
  intent: SalesIntent;
  objection: SalesObjection;
  leadScore: number;
  stage: 'new' | 'qualifying' | 'negotiating' | 'hot' | 'support' | 'handoff';
  nextAction: string;
  risk: SalesRiskLevel;
  explanation: string;
  handoffRequired: boolean;
};

export type SalesPackLedgerEvent = {
  id: string;
  kind: SalesEventKind;
  createdAt: string;
  traceId: string;
  runId: string | null;
  sessionId: string;
  tenantId: string;
  channelAccountId: string;
  actorId: string;
  payload: Record<string, unknown>;
};

export type SalesPackInboundMessageInput = {
  tenantId: string;
  channelAccountId?: string | null;
  customerId: string;
  conversationId?: string | null;
  actorId?: string | null;
  text: string;
  traceId?: string | null;
  runId?: string | null;
  surface?: string | null;
  receivedAt?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SalesPackConversationResult = {
  ok: boolean;
  mode: SalesPackMode;
  traceId: string;
  conversation: ConversationSession;
  selectedAgent: AgentProfile;
  signal: CommercialSignal;
  preview: ExecutionPreview;
  replyText: string;
  deliveryReceipt: DeliveryReceipt | null;
  events: SalesPackLedgerEvent[];
};

export type SalesPackControlPlaneAction = {
  id: string;
  label: string;
  severity: 'info' | 'warn' | 'critical';
  reason: string;
  command: string | null;
};

export type SalesPackControlPlaneSnapshot = {
  generatedAt: string;
  summary: {
    posture: 'healthy' | 'attention' | 'critical';
    mode: SalesPackMode;
    conversations: number;
    leads: number;
    agentProfiles: number;
    pendingApprovals: number;
    deliveryReceipts: number;
  };
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  actions: SalesPackControlPlaneAction[];
  sourceSnapshots: {
    inbox: ConversationSession[];
    crm: CommercialSignal[];
    agents: AgentProfile[];
    channelHealth: ChannelAccount;
    ledger: {
      totalEvents: number;
      byKind: Record<SalesEventKind, number>;
    };
  };
};
