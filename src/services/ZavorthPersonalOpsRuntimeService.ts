import { ZavorthRuntimeSecureIntegrationService } from './ZavorthRuntimeSecureIntegrationService.js';

import type {
  ZavorthRuntimePersonalConnector,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
} from '../contracts/ZavorthRuntimeStateBusContract.js';

import { ZavorthRuntimeStateBusService } from './ZavorthRuntimeStateBusService.js';
import { SecureStorageService } from './SecureStorageService.js';
import { logger } from '../logger.js';
import {
ZavorthPersonalOpsGoogleAdapter,
  ZavorthPersonalOpsMicrosoftGraphAdapter,
} from './ZavorthPersonalOpsLiveAdapters.js';
import { asErrorLike } from '../utils/errorLike.js';

export type ZavorthPersonalOpsKind = 'email' | 'calendar' | 'task';

export type ZavorthPersonalOpsProfile =
  | 'personal'
  | 'developer'
  | 'operator'
  | 'business'
  | string;

export type ZavorthPersonalOpsOperation =
  | 'email.read'
  | 'email.draft'
  | 'email.send'
  | 'calendar.read'
  | 'calendar.create-event'
  | 'calendar.update-event'
  | 'task.read'
  | 'task.create'
  | 'task.update';

export type ZavorthPersonalOpsProvider =
  | 'google'
  | 'microsoft'
  | 'local'
  | 'mcp'
  | 'imap'
  | 'caldav'
  | 'custom'
  | string;

export type ZavorthPersonalOpsAdapterInput = {
  connector: ZavorthRuntimePersonalConnector;
  connectorId: string;
  provider: string;
  operation: ZavorthPersonalOpsOperation;
  payload: Record<string, unknown>;
  approvalId: string;
  credentialRefs: string[];
  requestedAt: string;
};

export type ZavorthPersonalOpsAdapterResult = Record<string, unknown>;

export type ZavorthPersonalOpsAdapter = Partial<{
  readEmail: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  draftEmail: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  sendEmail: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  readCalendar: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  createCalendarEvent: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  updateCalendarEvent: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  readTasks: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  createTask: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
  updateTask: (input: ZavorthPersonalOpsAdapterInput) => Promise<ZavorthPersonalOpsAdapterResult> | ZavorthPersonalOpsAdapterResult;
}>;

export type ZavorthPersonalOpsConnectAccountInput = {
  kind: ZavorthPersonalOpsKind | string;
  provider: ZavorthPersonalOpsProvider;
  connectorId?: string | null;
  accountEmail?: string | null;
  label?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  oauthToken?: string | null;
  clientSecret?: string | null;
  scopes?: string[] | null;
  expiresAt?: string | null;
  approved?: boolean | null;
  profile?: ZavorthPersonalOpsProfile | null;
};

export type ZavorthPersonalOpsExecuteInput = {
  operation: ZavorthPersonalOpsOperation;
  connectorId: string;
  payload?: Record<string, unknown> | null;
  approved?: boolean | null;
  approvalId?: string | null;
  profile?: ZavorthPersonalOpsProfile | null;
};

export type ZavorthPersonalOpsVisibility = {
  profile: string;
  priority: 'primary' | 'discreet';
  reason: string;
};

export type ZavorthPersonalOpsPreview = {
  previewId: string;
  operation: ZavorthPersonalOpsOperation | 'connect-account';
  requiresApproval: true;
  reason: string;
  payloadSummary: {
    keys: string[];
    recipientCount: number;
    hasBody: boolean;
    hasTitle: boolean;
  };
};

export type ZavorthPersonalOpsReceipt = {
  id: string;
  createdAt: string;
  source: 'ZavorthPersonalOpsRuntimeService';
  operation: ZavorthPersonalOpsOperation | 'connect-account';
  connectorId: string;
  provider: string;
  status: 'configured' | 'pending-approval' | 'applied' | 'blocked' | 'failed';
  phase: 'preview' | 'approval' | 'execution' | 'receipt';
  summary: string;
  preview: ZavorthPersonalOpsPreview;
  approval: {
    required: true;
    approved: boolean;
    approvalId: string | null;
  };
  execution: {
    attempted: boolean;
    adapterMethod: string | null;
    resultKeys: string[];
  };
  safety: {
    rawSecretsSerialized: false;
    personalDataRedacted: true;
    approvalBypassPrevented: true;
  };
  metadata: {
    profile: string;
    connectorKind: ZavorthPersonalOpsKind | 'unknown';
    payloadKeys: string[];
    resultId: string | null;
  };
};

export type ZavorthPersonalOpsConnectAccountResult = {
  ok: boolean;
  status: 'configured' | 'pending-approval' | 'blocked';
  connector: ZavorthRuntimePersonalConnector | null;
  visibility: ZavorthPersonalOpsVisibility;
  receipt: ZavorthPersonalOpsReceipt;
  runtimeReceipt: ZavorthRuntimeStateBusDispatchResult['receipt'];
  snapshot: ZavorthRuntimeStateBusSnapshot;
  error: string | null;
};

export type ZavorthPersonalOpsExecuteResult = {
  ok: boolean;
  status: 'pending-approval' | 'applied' | 'blocked' | 'failed';
  preview: ZavorthPersonalOpsPreview;
  approval: ZavorthPersonalOpsReceipt['approval'];
  receipt: ZavorthPersonalOpsReceipt;
  result: ZavorthPersonalOpsAdapterResult | null;
  snapshot: ZavorthRuntimeStateBusSnapshot;
  error: string | null;
};

type RuntimeStateBusLike = Pick<ZavorthRuntimeStateBusService, 'dispatch' | 'buildSnapshot' | 'appendReceipt'>;
type SecureIntegrationLike = Pick<ZavorthRuntimeSecureIntegrationService, 'dispatch'>;

export type ZavorthPersonalOpsRuntimeOptions = {
  now?: () => Date;
  runtimeStateBus?: RuntimeStateBusLike;
  secureIntegration?: SecureIntegrationLike;
  secureStorage?: Pick<SecureStorageService, 'readSecret' | 'writeSecret'>;
  adapters?: Record<string, ZavorthPersonalOpsAdapter | undefined>;
};

const OPERATION_METHODS: Record<ZavorthPersonalOpsOperation, {
  kind: ZavorthPersonalOpsKind;
  method: keyof ZavorthPersonalOpsAdapter;
  label: string;
}> = {
  'email.read': { kind: 'email', method: 'readEmail', label: 'read email' },
  'email.draft': { kind: 'email', method: 'draftEmail', label: 'create email draft' },
  'email.send': { kind: 'email', method: 'sendEmail', label: 'send email' },
  'calendar.read': { kind: 'calendar', method: 'readCalendar', label: 'read calendar' },
  'calendar.create-event': { kind: 'calendar', method: 'createCalendarEvent', label: 'create calendar event' },
  'calendar.update-event': { kind: 'calendar', method: 'updateCalendarEvent', label: 'update calendar event' },
  'task.read': { kind: 'task', method: 'readTasks', label: 'read tasks' },
  'task.create': { kind: 'task', method: 'createTask', label: 'create task' },
  'task.update': { kind: 'task', method: 'updateTask', label: 'update task' },
};

export class ZavorthPersonalOpsRuntimeService {
  private readonly now: () => Date;
  private readonly runtimeStateBus: RuntimeStateBusLike;
  private readonly secureIntegration: SecureIntegrationLike;
  private readonly adapters: Record<string, ZavorthPersonalOpsAdapter | undefined>;
  private readonly providersByConnectorId = new Map<string, string>();
  private sequence = 0;

  public constructor(options: ZavorthPersonalOpsRuntimeOptions = {}) {
    this.now = options.now || (() => new Date());
    const secureStorage = options.secureStorage || new SecureStorageService();
    this.runtimeStateBus = options.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
    this.secureIntegration = options.secureIntegration
      || new ZavorthRuntimeSecureIntegrationService({
        now: this.now,
        runtimeStateBus: this.runtimeStateBus as RuntimeStateBusLike,
        secureStorage,
      });
    this.adapters = options.adapters || {
      google: new ZavorthPersonalOpsGoogleAdapter({
        secureStorage,
        oauthClientId: process.env.ZAVORTH_GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || null,
        oauthClientSecret: process.env.ZAVORTH_GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || null,
      }),
      microsoft: new ZavorthPersonalOpsMicrosoftGraphAdapter({
        secureStorage,
        oauthClientId: process.env.ZAVORTH_MICROSOFT_OAUTH_CLIENT_ID || process.env.MICROSOFT_OAUTH_CLIENT_ID || null,
        oauthClientSecret: process.env.ZAVORTH_MICROSOFT_OAUTH_CLIENT_SECRET || process.env.MICROSOFT_OAUTH_CLIENT_SECRET || null,
        tenantId: process.env.ZAVORTH_MICROSOFT_TENANT_ID || process.env.MICROSOFT_TENANT_ID || null,
      }),
    };
  }

  public connectAccount(input: ZavorthPersonalOpsConnectAccountInput): ZavorthPersonalOpsConnectAccountResult {
    const kind = normalizeKind(input.kind);
    const provider = safeId(input.provider) || 'custom';
    const profile = normalizeProfile(input.profile);
    const connectorId = normalizeConnectorId(input.connectorId, kind, input.accountEmail, provider);
    const label = clean(input.label)
      || `${formatLabel(provider)} ${kind}`;
    const preview = this.buildPreview({
      operation: 'connect-account',
      payload: {
        provider,
        accountEmail: input.accountEmail || null,
        scopes: input.scopes || [],
      },
      reason: 'Connecting a personal account exposes email, calendar or task data and requires explicit approval.',
    });
    const dispatchResult = this.secureIntegration.dispatch({
      type: 'register-personal-connector',
      source: 'personal-ops-runtime',
      approved: input.approved === true,
      payload: {
        personalConnector: {
          id: connectorId,
          kind,
          label,
          provider,
          accountEmail: clean(input.accountEmail),
          accessToken: input.accessToken,
          refreshToken: input.refreshToken,
          oauthToken: input.oauthToken,
          clientSecret: input.clientSecret,
          scopes: input.scopes || [],
          expiresAt: clean(input.expiresAt),
          enabled: input.approved === true,
          configured: input.approved === true,
          status: input.approved === true ? 'configured' : 'needs-setup',
        },
        metadata: {
          provider,
          profile,
          accountEmailDomain: emailDomain(input.accountEmail),
        },
      },
    });
    const connector = findConnector(dispatchResult.snapshot, connectorId);
    if (dispatchResult.ok && connector) {
      this.providersByConnectorId.set(connector.id, provider);
    }
    const status = dispatchResult.receipt.status === 'pending-approval'
      ? 'pending-approval'
      : dispatchResult.ok && connector?.status === 'configured'
        ? 'configured'
        : 'blocked';
    const receipt = this.buildReceipt({
      operation: 'connect-account',
      connectorId,
      connectorKind: kind,
      provider,
      status,
      phase: status === 'configured' ? 'receipt' : 'approval',
      preview,
      approved: input.approved === true && dispatchResult.ok,
      approvalId: dispatchResult.receipt.approval.approvalId,
      attempted: input.approved === true,
      adapterMethod: null,
      result: connector ? { connectorId: connector.id, status: connector.status } : null,
      profile,
      error: dispatchResult.error,
    });
    return {
      ok: status === 'configured',
      status,
      connector,
      visibility: profileVisibility(profile),
      receipt,
      runtimeReceipt: dispatchResult.receipt,
      snapshot: dispatchResult.snapshot,
      error: dispatchResult.error,
    };
  }

  public async executeOperation(input: ZavorthPersonalOpsExecuteInput): Promise<ZavorthPersonalOpsExecuteResult> {
    const definition = OPERATION_METHODS[input.operation];
    const profile = normalizeProfile(input.profile);
    const payload = record(input.payload) || {};
    const connectorId = safeId(input.connectorId);
    const connector = findConnector(this.runtimeStateBus.buildSnapshot(), connectorId);
    const provider = this.providersByConnectorId.get(connectorId) || inferProvider(connector);
    const preview = this.buildPreview({
      operation: input.operation,
      payload,
      reason: `${definition.label} touches personal data and must pass approval before adapter execution.`,
    });
    const approvalId = clean(input.approvalId) || this.nextId('personal-ops-approval');
    const verifiedApproval = input.approved === true
      && this.hasVerifiedApproval({
        approvalId,
        operation: input.operation,
        connectorId,
      });
    const approval = {
      required: true,
      approved: verifiedApproval,
      approvalId,
    } satisfies ZavorthPersonalOpsReceipt['approval'];

    if (!connector || connector.status !== 'configured' || connector.enabled !== true) {
      return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: definition.kind,
        provider,
        status: 'blocked',
        phase: 'preview',
        preview,
        approval,
        attempted: false,
        adapterMethod: definition.method,
        result: null,
        profile,
        error: 'personal_connector_not_configured',
      });
    }
    if (connector.kind !== definition.kind) {
      return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: connector.kind,
        provider,
        status: 'blocked',
        phase: 'preview',
        preview,
        approval,
        attempted: false,
        adapterMethod: definition.method,
        result: null,
        profile,
        error: 'personal_connector_kind_mismatch',
      });
    }
    if (!approval.approved) {
      return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: connector.kind,
        provider,
        status: 'pending-approval',
        phase: 'approval',
        preview,
        approval,
        attempted: false,
        adapterMethod: definition.method,
        result: null,
        profile,
        error: 'approval_required',
      });
    }

    const adapter = this.adapters[provider] || this.adapters.custom || this.adapters.local;
    const adapterMethod = adapter?.[definition.method];
    if (!adapter || typeof adapterMethod !== 'function') {
      return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: connector.kind,
        provider,
        status: 'blocked',
        phase: 'execution',
        preview,
        approval,
        attempted: false,
        adapterMethod: definition.method,
        result: null,
        profile,
        error: 'personal_ops_adapter_not_available',
      });
    }

    try {
      const result = await adapterMethod.call(adapter, {
        connector,
        connectorId,
        provider,
        operation: input.operation,
        payload,
        approvalId,
        credentialRefs: credentialRefsFor(connector.kind, connector.id),
        requestedAt: this.now().toISOString(),
      });
      this.publishOperationState(input.operation, connector, provider);
      return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: connector.kind,
        provider,
        status: 'applied',
        phase: 'receipt',
        preview,
        approval,
        attempted: true,
        adapterMethod: definition.method,
        result: record(result) || {},
        profile,
        error: null,
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Personal Ops Runtime] connection failed', error);
    return this.operationResult({
        operation: input.operation,
        connectorId,
        connectorKind: connector.kind,
        provider,
        status: 'failed',
        phase: 'receipt',
        preview,
        approval,
        attempted: true,
        adapterMethod: definition.method,
        result: null,
        profile,
        error: error instanceof Error ? err.message : 'personal_ops_adapter_failed',
      });
  }
  }

  private hasVerifiedApproval(input: {
    approvalId: string;
    operation: ZavorthPersonalOpsOperation;
    connectorId: string;
  }): boolean {
    const approvalId = clean(input.approvalId);
    if (!approvalId) return false;
    const snapshot = this.runtimeStateBus.buildSnapshot();
    return snapshot.receipts.some((receipt) => {
      if (receipt.approval.approved !== true) return false;
      if (receipt.status !== 'applied' && receipt.status !== 'noop') return false;
      if (receipt.approval.approvalId !== approvalId && receipt.id !== approvalId) return false;
      const payload = record(record(receipt.metadata)?.payload);
      const metadata = record(payload?.metadata);
      const approvalScope = clean(metadata?.approvalScope);
      const approvedOperation = clean(metadata?.operation);
      const approvedConnectorId = safeId(metadata?.connectorId);
      return approvalScope === 'personal-ops'
        && approvedOperation === input.operation
        && approvedConnectorId === safeId(input.connectorId);
    });
  }

  private operationResult(input: {
    operation: ZavorthPersonalOpsOperation;
    connectorId: string;
    connectorKind: ZavorthPersonalOpsKind;
    provider: string;
    status: ZavorthPersonalOpsExecuteResult['status'];
    phase: ZavorthPersonalOpsReceipt['phase'];
    preview: ZavorthPersonalOpsPreview;
    approval: ZavorthPersonalOpsReceipt['approval'];
    attempted: boolean;
    adapterMethod: keyof ZavorthPersonalOpsAdapter;
    result: ZavorthPersonalOpsAdapterResult | null;
    profile: string;
    error: string | null;
  }): ZavorthPersonalOpsExecuteResult {
    const receipt = this.buildReceipt({
      operation: input.operation,
      connectorId: input.connectorId,
      connectorKind: input.connectorKind,
      provider: input.provider,
      status: input.status,
      phase: input.phase,
      preview: input.preview,
      approved: input.approval.approved,
      approvalId: input.approval.approvalId,
      attempted: input.attempted,
      adapterMethod: input.adapterMethod,
      result: input.result,
      profile: input.profile,
      error: input.error,
    });
    return {
      ok: input.status === 'applied',
      status: input.status,
      preview: input.preview,
      approval: input.approval,
      receipt,
      result: input.result,
      snapshot: this.runtimeStateBus.buildSnapshot(),
      error: input.error,
    };
  }

  private buildPreview(input: {
    operation: ZavorthPersonalOpsOperation | 'connect-account';
    payload: Record<string, unknown>;
    reason: string;
  }): ZavorthPersonalOpsPreview {
    return {
      previewId: this.nextId('personal-ops-preview'),
      operation: input.operation,
      requiresApproval: true,
      reason: input.reason,
      payloadSummary: summarizePayload(input.payload),
    };
  }

  private buildReceipt(input: {
    operation: ZavorthPersonalOpsOperation | 'connect-account';
    connectorId: string;
    connectorKind: ZavorthPersonalOpsKind | 'unknown';
    provider: string;
    status: ZavorthPersonalOpsReceipt['status'];
    phase: ZavorthPersonalOpsReceipt['phase'];
    preview: ZavorthPersonalOpsPreview;
    approved: boolean;
    approvalId: string | null;
    attempted: boolean;
    adapterMethod: keyof ZavorthPersonalOpsAdapter | null;
    result: ZavorthPersonalOpsAdapterResult | null;
    profile: string;
    error: string | null;
  }): ZavorthPersonalOpsReceipt {
    const result = record(input.result) || {};
    const resultKeys = Object.keys(result).filter((key) => !isSensitiveKey(key)).slice(0, 12);
    const resultId = clean(result.messageId)
      || clean(result.draftId)
      || clean(result.eventId)
      || clean(result.taskId)
      || clean(result.connectorId);
    return {
      id: this.nextId('personal-ops-receipt'),
      createdAt: this.now().toISOString(),
      source: 'ZavorthPersonalOpsRuntimeService',
      operation: input.operation,
      connectorId: input.connectorId,
      provider: input.provider,
      status: input.status,
      phase: input.phase,
      summary: input.error ? `Personal operation ${input.operation} did not execute: ${input.error}.`
        : `Personal operation ${input.operation} completed with governed receipt.`,
      preview: input.preview,
      approval: {
        required: true,
        approved: input.approved,
        approvalId: input.approvalId,
      },
      execution: {
        attempted: input.attempted,
        adapterMethod: input.adapterMethod ? String(input.adapterMethod) : null,
        resultKeys,
      },
      safety: {
        rawSecretsSerialized: false,
        personalDataRedacted: true,
        approvalBypassPrevented: true,
      },
      metadata: {
        profile: input.profile,
        connectorKind: input.connectorKind,
        payloadKeys: input.preview.payloadSummary.keys,
        resultId,
      },
    };
  }

  private publishOperationState(
    operation: ZavorthPersonalOpsOperation,
    connector: ZavorthRuntimePersonalConnector,
    provider: string,
  ): void {
    this.runtimeStateBus.dispatch({
      type: 'surface-event',
      source: 'personal-ops-runtime',
      approved: true,
      payload: {
        domain: {
          domain: 'context',
          status: 'ready',
          summary: `Personal Ops executed ${operation} through ${provider} for ${connector.label}.`,
          actionIds: [`personalOps.${operation}`],
        },
        metadata: {
          operation,
          connectorId: connector.id,
          provider,
          rawSecretsSerialized: false,
        },
      },
    });
  }

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.now().getTime().toString(36)}-${this.sequence}`;
  }
}

function normalizeKind(value: unknown): ZavorthPersonalOpsKind {
  const normalized = safeId(value);
  if (normalized === 'calendar') return 'calendar';
  if (normalized === 'task' || normalized === 'tasks') return 'task';
  return 'email';
}

function normalizeProfile(value: unknown): string {
  return safeId(value) || 'personal';
}

function normalizeConnectorId(
  connectorId: unknown,
  kind: ZavorthPersonalOpsKind,
  accountEmail: unknown,
  provider: string,
): string {
  const explicit = safeId(connectorId);
  if (explicit) return explicit;
  const account = slugAccount(accountEmail);
  return `${kind}:${account || provider || 'primary'}`;
}

function slugAccount(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

function profileVisibility(profile: string): ZavorthPersonalOpsVisibility {
  if (profile === 'personal') {
    return {
      profile,
      priority: 'primary',
      reason: 'Personal profile prioritizes email, calendar and task connectors.',
    };
  }
  return {
    profile,
    priority: 'discreet',
    reason: 'Developer, operator and business profiles keep personal connectors secondary.',
  };
}

function findConnector(
  snapshot: ZavorthRuntimeStateBusSnapshot,
  connectorId: string,
): ZavorthRuntimePersonalConnector | null {
  return snapshot.projections.personalOps.connectors.find((connector) => connector.id === connectorId) || null;
}

function inferProvider(connector: ZavorthRuntimePersonalConnector | null): string {
  if (!connector) return 'custom';
  if (connector.provider) return connector.provider;
  if (connector.id.includes('google') || /gmail/i.test(connector.label)) return 'google';
  if (connector.id.includes('microsoft') || /outlook|office|microsoft/i.test(connector.label)) return 'microsoft';
  return 'local';
}

function credentialRefsFor(kind: ZavorthPersonalOpsKind, connectorId: string): string[] {
  const normalized = connectorId.replace(/[:/\\]+/g, '-');
  return [
    `personal.${kind}.${normalized}.accessToken`,
    `personal.${kind}.${normalized}.refreshToken`,
    `personal.${kind}.${normalized}.oauthToken`,
  ];
}

function summarizePayload(payload: Record<string, unknown>): ZavorthPersonalOpsPreview['payloadSummary'] {
  const keys = Object.keys(payload)
    .filter((key) => !isSensitiveKey(key))
    .slice(0, 16);
  const to = payload.to;
  const recipientCount = Array.isArray(to)
    ? to.length
    : typeof to === 'string' && to.trim()
      ? 1
      : 0;
  return {
    keys,
    recipientCount,
    hasBody: typeof payload.body === 'string' && payload.body.trim().length > 0,
    hasTitle: typeof payload.title === 'string' && payload.title.trim().length > 0,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function clean(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function safeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function formatLabel(value: string): string {
  return value
    .replace(/[:_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emailDomain(value: unknown): string | null {
  const email = String(value || '').trim();
  const domain = email.includes('@') ? email.split('@').pop() : null;
  return domain ? safeId(domain) : null;
}

function isSensitiveKey(value: string): boolean {
  return /(?:token|secret|password|credential|private|body|raw|html|text|content)$/i.test(value);
}
