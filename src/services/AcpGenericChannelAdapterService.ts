import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import {
  ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION,
  type AcpGenericChannelAdapterReceipt,
  type AcpGenericChannelAdapterSnapshot,
  type AcpGenericChannelAdapterStatus,
  type AcpGenericChannelEnvelope,
  type AcpGenericChannelFrameKind,
} from '../contracts/AcpGenericChannelAdapterContract.js';
import { SourceAgentRuntimeToolPolicyService } from './SourceAgentRuntimeToolPolicyService.js';
import type {
  RuntimeAdapterApprovalEnvelope,
} from '../runtime/zavorth-runtime-adapters/contracts.js';
import {
  normalizeRuntimeAdapterGatewayHandshake,
} from '../runtime/zavorth-runtime-adapters/RuntimeAdapterGatewayHandshakeBoundary.js';
import {
  normalizeRuntimeAdapterGatewayProtocolFrame,
  type RuntimeAdapterGatewayProtocolFrame,
} from '../runtime/zavorth-runtime-adapters/RuntimeAdapterGatewayProtocolBoundary.js';

type Runtime = {
  now?: () => Date;
  projectRoot?: string;
  receiptPath?: string;
  toolPolicyService?: SourceAgentRuntimeToolPolicyService;
  writeFileSync?: typeof fs.writeFileSync;
  mkdirSync?: typeof fs.mkdirSync;
};

type Counters = {
  accepted: number;
  approvalRequired: number;
  duplicates: number;
  blocked: number;
  failed: number;
};

const DEFAULT_RECEIPT_PATH = 'data/runtime/acp-generic-channel-adapter-last.json';
const MAX_TEXT_CHARS = 12_000;

export class AcpGenericChannelAdapterService {
  private readonly now: () => Date;
  private readonly projectRoot: string;
  private readonly receiptPath: string;
  private readonly toolPolicyService: SourceAgentRuntimeToolPolicyService;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly seenIdempotencyKeys = new Map<string, string>();
  private readonly counters: Counters = {
    accepted: 0,
    approvalRequired: 0,
    duplicates: 0,
    blocked: 0,
    failed: 0,
  };
  private lastReceiptId: string | null = null;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.projectRoot = runtime.projectRoot || config.projectRoot;
    this.receiptPath = runtime.receiptPath || DEFAULT_RECEIPT_PATH;
    this.toolPolicyService = runtime.toolPolicyService || new SourceAgentRuntimeToolPolicyService({ now: this.now });
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
  }

  public buildSnapshot(): AcpGenericChannelAdapterSnapshot {
    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION,
      surface: 'acp-generic-channel-adapter',
      adapter: {
        id: 'acp-generic',
        label: 'ACP Generic Channel Adapter',
        protocolFamily: 'acp-compatible',
        conceptualDependency: 'zavorth-native',
        inbound: true,
        outbound: false,
        dispatchesDirectlyToExecutor: false,
      },
      summary: {
        ...this.counters,
        lastReceiptId: this.lastReceiptId,
      },
      safety: {
        sourceRuntimeAuthority: false,
        sourceTokensAuthoritative: false,
        toolExecutionPerformed: false,
        diskMutationPerformed: false,
        gatewayNormalizationOnly: true,
        rawSecretsSerialized: false,
      },
      routes: {
        zavorthControlStatus: '/api/web/acp-generic-channel-adapter',
        zavorthControlIngest: '/api/web/acp-generic-channel-adapter',
        cliStatus: 'zavorth acp channel status',
        cliIngest: 'zavorth acp channel ingest --text "<message>"',
      },
    };
  }

  public ingest(raw: unknown, options: { emitGatewayEvent?: boolean; receiptPath?: string | null } = {}): AcpGenericChannelAdapterReceipt {
    try {
      const envelope = normalizeEnvelope(raw);
      const frameKind = normalizeFrameKind(envelope);
      const frameId = normalizeText(envelope.id, `acp-frame-${randomUUID()}`);
      const runtimeId = normalizeId(envelope.runtimeId, 'acp-generic-runtime');
      const sessionId = normalizeId(envelope.sessionId, 'acp-generic-session');
      const idempotencyKey = normalizeText(envelope.idempotencyKey, frameId);
      const sourceRuntimeName = clean(envelope.source?.runtimeName);
      const sourceRuntimeVersion = clean(envelope.source?.runtimeVersion);

      if (this.seenIdempotencyKeys.has(idempotencyKey)) {
        const receipt = this.buildReceipt({
          status: 'duplicate',
          envelope,
          frameKind,
          frameId,
          runtimeId,
          sessionId,
          idempotencyKey,
          duplicateOf: this.seenIdempotencyKeys.get(idempotencyKey) || null,
          sourceRuntimeName,
          sourceRuntimeVersion,
          nativeContract: 'RuntimeAdapterEventEnvelope',
          reachesExecutor: false,
          gatewayEventEmitted: false,
          outputText: 'Duplicate ACP channel frame ignored by idempotency key.',
        });
        this.record(receipt, options.receiptPath);
        return receipt;
      }

      let receipt: AcpGenericChannelAdapterReceipt;
      if (frameKind === 'handshake') {
        receipt = this.ingestHandshake({
          envelope,
          frameKind,
          frameId,
          runtimeId,
          sessionId,
          idempotencyKey,
          sourceRuntimeName,
          sourceRuntimeVersion,
          gatewayEventEmitted: options.emitGatewayEvent === true,
        });
      } else {
        receipt = this.ingestProtocolFrame({
          envelope,
          frameKind,
          frameId,
          runtimeId,
          sessionId,
          idempotencyKey,
          sourceRuntimeName,
          sourceRuntimeVersion,
          gatewayEventEmitted: options.emitGatewayEvent === true,
        });
      }

      this.seenIdempotencyKeys.set(idempotencyKey, receipt.id);
      this.record(receipt, options.receiptPath);
      return receipt;
    } catch (error: any) {
      const receipt = this.buildReceipt({
        status: 'failed',
        envelope: {},
        frameKind: 'error',
        frameId: `acp-frame-${randomUUID()}`,
        runtimeId: 'acp-generic-runtime',
        sessionId: 'acp-generic-session',
        idempotencyKey: `failed-${randomUUID()}`,
        duplicateOf: null,
        sourceRuntimeName: null,
        sourceRuntimeVersion: null,
        nativeContract: 'ZavorthStructuredGatewayError/v1',
        reachesExecutor: false,
        gatewayEventEmitted: false,
        outputText: error instanceof Error ? error.message : String(error),
      });
      this.record(receipt, options.receiptPath);
      return receipt;
    }
  }

  public renderText(receiptOrSnapshot: AcpGenericChannelAdapterReceipt | AcpGenericChannelAdapterSnapshot): string {
    if ('adapter' in receiptOrSnapshot && 'input' in receiptOrSnapshot) {
      const receipt = receiptOrSnapshot;
      return [
        'Zavorth ACP Generic Channel Adapter',
        `Status: ${receipt.status}`,
        `Frame: ${receipt.input.frameKind} ${receipt.input.frameId}`,
        `Session: ${receipt.input.sessionId}`,
        `Executor reach: ${receipt.normalization.reachesExecutor ? 'yes' : 'no'}`,
        `Gateway event: ${receipt.normalization.gatewayEventEmitted ? 'yes' : 'no'}`,
        '',
        receipt.output.text,
      ].join('\n');
    }

    const snapshot = receiptOrSnapshot;
    return [
      'Zavorth ACP Generic Channel Adapter',
      `Status: ${snapshot.adapter.conceptualDependency}`,
      `Accepted: ${snapshot.summary.accepted}`,
      `Approval required: ${snapshot.summary.approvalRequired}`,
      `Duplicates: ${snapshot.summary.duplicates}`,
      `Blocked: ${snapshot.summary.blocked}`,
      '',
      'Safety: source runtimes are normalized as evidence only; tools, disk and executor dispatch stay under Zavorth policy.',
    ].join('\n');
  }

  private ingestHandshake(input: {
    envelope: AcpGenericChannelEnvelope;
    frameKind: AcpGenericChannelFrameKind;
    frameId: string;
    runtimeId: string;
    sessionId: string;
    idempotencyKey: string;
    sourceRuntimeName: string | null;
    sourceRuntimeVersion: string | null;
    gatewayEventEmitted: boolean;
  }): AcpGenericChannelAdapterReceipt {
    const handshake = normalizeRuntimeAdapterGatewayHandshake({
      clientId: normalizeText(input.envelope.handshake?.clientId, input.runtimeId),
      sourceRole: normalizeText(input.envelope.handshake?.role, 'runtime-adapter'),
      sourceScopes: uniqueStrings(input.envelope.handshake?.scopes || []),
      sourceTokenPresent: input.envelope.handshake?.tokenPresent === true,
      sourceEvidence: {
        sourceRuntimeName: input.sourceRuntimeName || undefined,
        sourceRuntimeVersion: input.sourceRuntimeVersion || undefined,
        sourcePaths: sourcePathsFor(input.envelope),
        observedAt: this.now().toISOString(),
        notes: input.envelope.source?.notes,
      },
    }, {
      descriptorIdPrefix: 'zavorth-acp-generic-channel',
      label: 'ACP generic channel handshake',
      transport: 'http',
      observedAt: this.now().toISOString(),
      acceptedScopes: ['gateway:read', 'sessions:read', 'messages:send'],
      sourceRuntimeVersion: input.sourceRuntimeVersion || undefined,
    });

    return this.buildReceipt({
      ...input,
      status: handshake.trust.downgradedScopes.length > 0 ? 'diagnostic' : 'accepted',
      duplicateOf: null,
      nativeContract: 'RuntimeAdapterGatewayHandshake',
      reachesExecutor: false,
      handshake,
      gatewayEventEmitted: input.gatewayEventEmitted,
      outputText: handshake.trust.downgradedScopes.length > 0
        ? `Handshake accepted with downgraded scopes: ${handshake.trust.downgradedScopes.join(', ')}.`
        : 'Handshake accepted as Zavorth-native ACP channel evidence.',
    });
  }

  private ingestProtocolFrame(input: {
    envelope: AcpGenericChannelEnvelope;
    frameKind: AcpGenericChannelFrameKind;
    frameId: string;
    runtimeId: string;
    sessionId: string;
    idempotencyKey: string;
    sourceRuntimeName: string | null;
    sourceRuntimeVersion: string | null;
    gatewayEventEmitted: boolean;
  }): AcpGenericChannelAdapterReceipt {
    const requestedTools = requestedToolsFor(input.envelope);
    const toolPolicy = requestedTools.length > 0
      ? this.toolPolicyService.buildDoctor({
        mode: 'configured',
        requestedTools,
      })
      : null;
    const denied = toolPolicy?.decisions.filter((decision) => decision.decision === 'deny') || [];
    const approvalRequired = toolPolicy?.decisions.filter((decision) => decision.decision === 'approval_required') || [];
    const frame = toProtocolFrame(input.envelope, input);
    const normalized = normalizeRuntimeAdapterGatewayProtocolFrame(frame, {
      runtimeId: input.runtimeId,
      observedAt: this.now().toISOString(),
      defaultUserId: normalizeText(input.envelope.actor?.id, 'external-user'),
      sourceRuntimeVersion: input.sourceRuntimeVersion || undefined,
    });

    if (!normalized.ok) {
      return this.buildReceipt({
        ...input,
        status: 'blocked',
        duplicateOf: null,
        nativeContract: 'ZavorthStructuredGatewayError/v1',
        reachesExecutor: false,
        gatewayEventEmitted: false,
        outputText: normalized.error.message,
      });
    }

    const blockedByToolPolicy = denied.length > 0 || approvalRequired.length > 0;
    const status: AcpGenericChannelAdapterStatus = denied.length > 0
      ? 'blocked'
      : approvalRequired.length > 0
        ? 'approval_required'
        : normalized.nativeContract === 'RuntimeAdapterEventEnvelope'
          ? 'diagnostic'
          : 'accepted';

    return this.buildReceipt({
      ...input,
      status,
      duplicateOf: null,
      nativeContract: normalized.nativeContract,
      reachesExecutor: normalized.reachesExecutor && !blockedByToolPolicy,
      gatewayEventEmitted: input.gatewayEventEmitted && normalized.reachesExecutor && !blockedByToolPolicy,
      message: blockedByToolPolicy ? null : normalized.message || null,
      eventEnvelope: normalized.envelope,
      approvals: buildApprovals(input, approvalRequired),
      toolPolicy,
      outputText: outputTextFor(status, requestedTools),
    });
  }

  private buildReceipt(input: {
    status: AcpGenericChannelAdapterStatus;
    envelope: AcpGenericChannelEnvelope;
    frameKind: AcpGenericChannelFrameKind;
    frameId: string;
    runtimeId: string;
    sessionId: string;
    idempotencyKey: string;
    duplicateOf: string | null;
    sourceRuntimeName: string | null;
    sourceRuntimeVersion: string | null;
    nativeContract: AcpGenericChannelAdapterReceipt['normalization']['nativeContract'];
    reachesExecutor: boolean;
    gatewayEventEmitted: boolean;
    outputText: string;
    message?: AcpGenericChannelAdapterReceipt['message'];
    eventEnvelope?: AcpGenericChannelAdapterReceipt['eventEnvelope'];
    handshake?: AcpGenericChannelAdapterReceipt['handshake'];
    approvals?: RuntimeAdapterApprovalEnvelope[];
    toolPolicy?: AcpGenericChannelAdapterReceipt['toolPolicy'];
  }): AcpGenericChannelAdapterReceipt {
    return {
      id: `acp-generic-receipt-${hash(`${input.frameId}:${input.idempotencyKey}:${this.now().toISOString()}`)}`,
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_ACP_GENERIC_CHANNEL_ADAPTER_CONTRACT_VERSION,
      surface: 'acp-generic-channel-adapter',
      status: input.status,
      adapter: {
        id: 'acp-generic',
        protocolFamily: 'acp-compatible',
        source: 'AcpGenericChannelAdapterService',
      },
      input: {
        frameId: redact(input.frameId),
        frameKind: input.frameKind,
        runtimeId: redact(input.runtimeId),
        sessionId: redact(input.sessionId),
        idempotencyKey: redact(input.idempotencyKey),
        sourceRuntimeName: input.sourceRuntimeName ? redact(input.sourceRuntimeName) : null,
        sourceRuntimeVersion: input.sourceRuntimeVersion ? redact(input.sourceRuntimeVersion) : null,
      },
      normalization: {
        nativeContract: input.nativeContract,
        reachesExecutor: input.reachesExecutor,
        gatewayEventEmitted: input.gatewayEventEmitted,
        duplicateOf: input.duplicateOf,
      },
      message: sanitizeValue(input.message || null),
      eventEnvelope: sanitizeValue(input.eventEnvelope || null),
      handshake: sanitizeValue(input.handshake || null),
      approvals: sanitizeValue(input.approvals || []),
      toolPolicy: sanitizeValue(input.toolPolicy || null),
      output: {
        text: truncate(redact(input.outputText)),
      },
      safety: this.buildSnapshot().safety,
    };
  }

  private record(receipt: AcpGenericChannelAdapterReceipt, receiptPath?: string | null): void {
    this.lastReceiptId = receipt.id;
    if (receipt.status === 'accepted' || receipt.status === 'diagnostic') this.counters.accepted += 1;
    if (receipt.status === 'approval_required') this.counters.approvalRequired += 1;
    if (receipt.status === 'duplicate') this.counters.duplicates += 1;
    if (receipt.status === 'blocked') this.counters.blocked += 1;
    if (receipt.status === 'failed') this.counters.failed += 1;

    const target = this.resolveReceiptPath(receiptPath);
    this.mkdirSyncImpl(path.dirname(target), { recursive: true });
    this.writeFileSyncImpl(target, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  }

  private resolveReceiptPath(receiptPath?: string | null): string {
    const runtimeDir = path.resolve(this.projectRoot, 'data', 'runtime');
    const fallback = path.resolve(this.projectRoot, this.receiptPath);
    if (!receiptPath) return fallback;
    const resolved = path.resolve(String(receiptPath));
    const relative = path.relative(runtimeDir, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return fallback;
    }
    return resolved;
  }
}

function normalizeEnvelope(raw: unknown): AcpGenericChannelEnvelope {
  if (raw && typeof raw === 'object') {
    return raw as AcpGenericChannelEnvelope;
  }
  const text = String(raw || '').trim();
  return {
    kind: 'message',
    payload: { text },
  };
}

function normalizeFrameKind(envelope: AcpGenericChannelEnvelope): AcpGenericChannelFrameKind {
  const kind = String(envelope.kind || '').trim().toLowerCase();
  if (kind === 'handshake') return 'handshake';
  if (kind === 'tool_request' || kind === 'tool-request' || kind === 'tool') return 'tool_request';
  if (kind === 'event') return 'event';
  if (kind === 'response') return 'response';
  if (kind === 'error' || envelope.status === 'error') return 'error';
  return 'message';
}

function toProtocolFrame(
  envelope: AcpGenericChannelEnvelope,
  input: {
    frameKind: AcpGenericChannelFrameKind;
    frameId: string;
    runtimeId: string;
    sessionId: string;
    idempotencyKey: string;
    sourceRuntimeName: string | null;
    sourceRuntimeVersion: string | null;
  },
): RuntimeAdapterGatewayProtocolFrame {
  return {
    frameKind: externalFrameKindFor(input.frameKind),
    id: input.frameId,
    runtimeId: input.runtimeId,
    sessionId: input.sessionId,
    operation: normalizeText(envelope.operation || envelope.method || envelope.event, operationFor(input.frameKind)),
    method: clean(envelope.method) || undefined,
    event: clean(envelope.event) || undefined,
    status: envelope.status === 'error' || input.frameKind === 'error' ? 'error' : 'ok',
    sequence: Number(envelope.sequence || 0) || undefined,
    idempotencyKey: input.idempotencyKey,
    actor: {
      id: clean(envelope.actor?.id) || undefined,
      role: normalizeActorRole(envelope.actor?.role),
    },
    payload: {
      text: redact(truncate(clean(envelope.payload?.text) || '', MAX_TEXT_CHARS)),
      channel: clean(envelope.payload?.channel) || 'api',
      workspace: clean(envelope.payload?.workspace),
      requestedTools: requestedToolsFor(envelope),
      errorCode: clean(envelope.payload?.errorCode) || undefined,
      errorMessage: clean(envelope.payload?.errorMessage) || undefined,
      data: sanitizeValue({
        ...(envelope.payload?.data || {}),
        acpGenericChannel: true,
        toolArgumentsPreview: envelope.tool?.arguments ? hash(JSON.stringify(envelope.tool.arguments)) : null,
      }),
    },
    sourceEvidence: {
      sourceRuntimeName: input.sourceRuntimeName || undefined,
      sourceRuntimeVersion: input.sourceRuntimeVersion || undefined,
      sourcePaths: sourcePathsFor(envelope),
      observedAt: new Date().toISOString(),
      notes: envelope.source?.notes,
    },
  };
}

function externalFrameKindFor(kind: AcpGenericChannelFrameKind): RuntimeAdapterGatewayProtocolFrame['frameKind'] {
  if (kind === 'event') return 'event';
  if (kind === 'response') return 'response';
  if (kind === 'error') return 'error';
  return 'request';
}

function operationFor(kind: AcpGenericChannelFrameKind): string {
  if (kind === 'tool_request') return 'tool.request';
  if (kind === 'event') return 'session.event';
  if (kind === 'response') return 'gateway.response';
  if (kind === 'error') return 'gateway.error';
  return 'message.send';
}

function requestedToolsFor(envelope: AcpGenericChannelEnvelope): string[] {
  return uniqueStrings([
    ...(envelope.payload?.requestedTools || []),
    envelope.tool?.name || '',
  ]);
}

function buildApprovals(
  input: {
    frameId: string;
    runtimeId: string;
    sessionId: string;
    envelope: AcpGenericChannelEnvelope;
  },
  decisions: NonNullable<ReturnType<SourceAgentRuntimeToolPolicyService['buildDoctor']>['decisions']>,
): RuntimeAdapterApprovalEnvelope[] {
  return decisions.map((decision) => ({
    id: `acp-generic-approval:${normalizeId(`${input.frameId}:${decision.toolName}`, 'tool')}`,
    runtimeId: input.runtimeId,
    sessionId: input.sessionId,
    eventId: input.frameId,
    requestedAt: new Date().toISOString(),
    title: `ACP tool request: ${decision.toolName}`,
    reason: decision.reason,
    risk: decision.risk,
    status: 'pending',
    action: {
      kind: decision.toolName.toLowerCase().includes('bash') ? 'tool' : 'tool',
      label: decision.toolName,
      requestedToolNames: [decision.toolName],
      data: sanitizeValue({
        source: 'acp-generic-channel-adapter',
        frameId: input.frameId,
        payloadHash: hash(JSON.stringify(input.envelope.payload || {})),
      }),
    },
  }));
}

function outputTextFor(status: AcpGenericChannelAdapterStatus, requestedTools: string[]): string {
  if (status === 'approval_required') {
    return `ACP frame normalized, but tool approval is required before executor dispatch: ${requestedTools.join(', ')}.`;
  }
  if (status === 'blocked') {
    return `ACP frame blocked by Zavorth policy: ${requestedTools.join(', ') || 'invalid frame'}.`;
  }
  if (status === 'diagnostic') {
    return 'ACP diagnostic frame recorded. It does not reach the executor.';
  }
  return 'ACP frame accepted and normalized through Zavorth-native channel contracts.';
}

function sourcePathsFor(envelope: AcpGenericChannelEnvelope): string[] {
  const paths = uniqueStrings(envelope.source?.paths || []);
  return paths.length > 0 ? paths : ['zavorth://acp-generic-channel-adapter'];
}

function normalizeActorRole(value: unknown): 'user' | 'assistant' | 'system' | 'worker' {
  if (value === 'assistant' || value === 'system' || value === 'worker') return value;
  return 'user';
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  return normalized || fallback;
}

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function uniqueStrings(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function truncate(value: string, max = MAX_TEXT_CHARS): string {
  return value.length > max ? `${value.slice(0, max)}\n[truncated]` : value;
}

function redact(value: unknown): string {
  return String(value || '')
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, 'sk-[redacted]')
    .replace(/\b(xox[baprs]-[A-Za-z0-9-]{12,})\b/g, 'xox-[redacted]')
    .replace(/\b(gh[pousr]_[A-Za-z0-9_]{12,})\b/g, 'gh_[redacted]')
    .replace(/\b([A-Za-z0-9+/]{40,}={0,2})\b/g, '[redacted-secret-like-token]')
    .replace(/\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASS|CREDENTIAL)[A-Z0-9_]*)\s*[:=]\s*([^\s"'`,;]+)/gi, '$1=[redacted]');
}

function sanitizeValue<T>(value: T): T {
  if (value === null || value === undefined) return value;
  return JSON.parse(redact(JSON.stringify(value))) as T;
}
