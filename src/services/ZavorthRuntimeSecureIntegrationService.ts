import os from 'node:os';
import path from 'node:path';
import type {
  ZavorthRuntimeStateBusActionInput,
  ZavorthRuntimeStateBusDispatchResult,
  ZavorthRuntimeStateBusSnapshot,
  ZavorthRuntimeStateDomain,
  ZavorthRuntimeStateReceipt,
} from '../contracts/ZavorthRuntimeStateBusContract.js';
import type { McpSecurityProfile } from '../mcp/McpToolPolicy.js';
import { McpToolPolicyFileService } from './McpToolPolicyFileService.js';
import { SecureStorageService } from './SecureStorageService.js';
import { TrustedWorkspacePolicyService } from './TrustedWorkspacePolicyService.js';
import { ZavorthRuntimeStateBusService } from './ZavorthRuntimeStateBusService.js';
import { logger } from '../logger.js';

type RuntimeStateBusLike = Pick<ZavorthRuntimeStateBusService, 'dispatch' | 'buildSnapshot' | 'appendReceipt'>;
type SecureStorageLike = Pick<SecureStorageService, 'writeSecret' | 'readSecret'>;
type WorkspacePolicyLike = Pick<TrustedWorkspacePolicyService, 'validatePolicyInput' | 'evaluate'>;
type McpPolicyLike = Pick<McpToolPolicyFileService, 'setProfile' | 'allowTool' | 'removeTool' | 'readPolicy'>;

export type ZavorthRuntimeSecureIntegrationRuntime = {
  now?: () => Date;
  runtimeStateBus?: RuntimeStateBusLike;
  secureStorage?: SecureStorageLike;
  workspacePolicy?: WorkspacePolicyLike | null;
  mcpPolicy?: McpPolicyLike | null;
};

const SECRET_FIELD_NAMES = new Set([
  'apikey',
  'api_key',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'oauth_token',
  'clientsecret',
  'client_secret',
  'credential',
  'credentials',
  'privatekey',
  'private_key',
  'password',
  'secret',
]);

const SENSITIVE_PATH_PATTERN = /(^|[\\/])(\.env(?:\.|$)|\.ssh|\.aws|\.gnupg|secrets.*|credentials.*|private[-_]?key|id_rsa|id_ed25519)([\\/]|$)/i;
const SYSTEM_PATH_PATTERN = /(^[a-z]:[\\/](windows|program files|program files \(x86\)|programdata)([\\/]|$)|^[\\/]?(etc|bin|usr|var|root)([\\/]|$))/i;
const BROAD_WINDOWS_ROOT_PATTERN = /^[a-z]:[\\/]?$/i;

export class ZavorthRuntimeSecureIntegrationService {
  private readonly now: () => Date;
  private readonly runtimeStateBus: RuntimeStateBusLike;
  private readonly secureStorage: SecureStorageLike;
  private readonly workspacePolicy: WorkspacePolicyLike | null;
  private readonly mcpPolicy: McpPolicyLike | null;
  private sequence = 0;

  public constructor(runtime: ZavorthRuntimeSecureIntegrationRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.runtimeStateBus = runtime.runtimeStateBus || new ZavorthRuntimeStateBusService({ now: this.now });
    this.secureStorage = runtime.secureStorage || new SecureStorageService();
    this.workspacePolicy = runtime.workspacePolicy === null
      ? null
      : runtime.workspacePolicy || new TrustedWorkspacePolicyService();
    this.mcpPolicy = runtime.mcpPolicy === null
      ? null
      : runtime.mcpPolicy || new McpToolPolicyFileService({ now: this.now });
  }

  public dispatch(input: ZavorthRuntimeStateBusActionInput): ZavorthRuntimeStateBusDispatchResult {
    if (input.type === 'set-provider-connection') {
      return this.dispatchProviderConnection(input);
    }
    if (input.type === 'register-personal-connector') {
      return this.dispatchPersonalConnector(input);
    }
    if (input.type === 'set-workspace-knowledge') {
      return this.dispatchWorkspaceKnowledge(input);
    }
    if (input.type === 'set-mcp-trust') {
      return this.dispatchMcpTrust(input);
    }
    return this.runtimeStateBus.dispatch(input);
  }

  private dispatchProviderConnection(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult {
    const provider = record(input.payload?.providerConnection);
    const providerId = safeId(provider?.providerId || provider?.id);
    if (!provider || !providerId) {
      return this.blocked(input, 'model', 'provider_connection_id_required');
    }
    const storedRefs = this.storeSecretFields({
      record: provider,
      namespace: `providers.${providerId}`,
    });
    const sanitized = this.withoutSecretFields(provider);
    const configuredByCredential = storedRefs.length > 0 || Boolean(sanitized.credentialRef || sanitized.credentialRefs);
    const nextInput = this.withPayload(input, {
      providerConnection: {
        ...sanitized,
        providerId,
        status: configuredByCredential ? 'configured' : sanitized.status,
        defaultRouteAllowed: sanitized.defaultRouteAllowed === true || configuredByCredential,
      },
      metadata: {
        ...record(input.payload?.metadata),
        credentialRefs: storedRefs,
        rawSecretsSerialized: false,
        secureSetup: storedRefs.length > 0,
      },
    });
    return this.runtimeStateBus.dispatch(nextInput);
  }

  private dispatchPersonalConnector(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult {
    const connector = record(input.payload?.personalConnector);
    if (!connector) {
      return this.blocked(input, 'context', 'personal_connector_payload_required');
    }
    const kind = normalizePersonalKind(connector.kind);
    const id = safeId(connector.id || `${kind}:primary`);
    if (!id) {
      return this.blocked(input, 'context', 'personal_connector_id_required');
    }
    const approved = input.approved === true;
    const storedRefs = approved
      ? this.storeSecretFields({
        record: connector,
        namespace: `personal.${kind}.${id.replace(/[:/\\]+/g, '-')}`,
      })
      : [];
    const sanitized = this.withoutSecretFields(connector);
    const configured = approved && (storedRefs.length > 0 || sanitized.configured === true || sanitized.status === 'configured');
    const nextInput = this.withPayload(input, {
      personalConnector: {
        ...sanitized,
        id,
        kind,
        configured,
        status: configured ? 'configured' : sanitized.status,
        enabled: sanitized.enabled === true && configured,
      },
      metadata: {
        ...record(input.payload?.metadata),
        credentialRefs: storedRefs,
        rawSecretsSerialized: false,
        personalConnectorSetup: storedRefs.length > 0,
        credentialStorageDeferredUntilApproval: !approved,
      },
    });
    return this.runtimeStateBus.dispatch(nextInput);
  }

  private dispatchWorkspaceKnowledge(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult {
    const workspaceKnowledge = record(input.payload?.workspaceKnowledge) || {};
    const allowedPaths = Array.isArray(workspaceKnowledge.allowedPaths)
      ? workspaceKnowledge.allowedPaths.map((entry) => String(entry || '').trim()).filter(Boolean)
      : [];
    const checked = this.validateKnowledgePaths(allowedPaths);
    if (!checked.ok) {
      return this.blocked(input, 'context', 'workspace_knowledge_path_blocked', {
        rejectedPath: checked.rejectedPath,
        reason: checked.reason,
      });
    }
    const nextInput = this.withPayload(input, {
      workspaceKnowledge: {
        ...workspaceKnowledge,
        allowedPaths: checked.paths,
        ragSources: sanitizeRagSources(workspaceKnowledge.ragSources),
        untrustedContextWrapping: true,
      },
      metadata: {
        ...record(input.payload?.metadata),
        workspaceKnowledgeValidated: true,
        rejectedPaths: [],
      },
    });
    return this.runtimeStateBus.dispatch(nextInput);
  }

  private dispatchMcpTrust(
    input: ZavorthRuntimeStateBusActionInput,
  ): ZavorthRuntimeStateBusDispatchResult {
    const trust = record(input.payload?.mcpTrust);
    if (!trust) {
      return this.blocked(input, 'skills', 'mcp_trust_payload_required');
    }
    const state = normalizeMcpTrustState(trust.trustState);
    const toolNames = Array.isArray(trust.toolNames)
      ? trust.toolNames.map((entry) => safeId(entry)).filter((entry): entry is string => Boolean(entry))
      : [];
    const nextInput = this.withPayload(input, {
      mcpTrust: {
        ...trust,
        trustState: state,
        toolNames,
        exposedToModel: state === 'trusted',
      },
      metadata: {
        ...record(input.payload?.metadata),
        mcpPolicyApplied: Boolean(this.mcpPolicy),
        rawSecretsSerialized: false,
      },
    });
    const result = this.runtimeStateBus.dispatch(nextInput);
    if (result.ok && result.receipt.approval.approved && this.mcpPolicy) {
      this.mcpPolicy.setProfile(profileForMcpTrustState(state));
      for (const toolName of toolNames) {
        if (state === 'trusted') {
          this.mcpPolicy.allowTool(toolName);
        } else {
          this.mcpPolicy.removeTool(toolName);
        }
      }
    }
    return result;
  }

  private storeSecretFields(input: {
    record: Record<string, unknown>;
    namespace: string;
  }): string[] {
    const refs: string[] = [];
    for (const [key, value] of Object.entries(input.record)) {
      if (!isSecretField(key)) {
        continue;
      }
      const secretValue = String(value || '').trim();
      if (!secretValue || isSecretReference(secretValue)) {
        continue;
      }
      const ref = `${input.namespace}.${key}`;
      if (this.secureStorage.writeSecret(ref, secretValue)) {
        refs.push(ref);
      }
    }
    return refs;
  }

  private withoutSecretFields(value: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (isSecretField(key)) {
        continue;
      }
      sanitized[key] = entry;
    }
    return sanitized;
  }

  private withPayload(
    input: ZavorthRuntimeStateBusActionInput,
    payload: NonNullable<ZavorthRuntimeStateBusActionInput['payload']>,
  ): ZavorthRuntimeStateBusActionInput {
    return {
      ...input,
      payload: {
        ...(input.payload || {}),
        ...payload,
      },
    };
  }

  private validateKnowledgePaths(paths: string[]): {
    ok: boolean;
    paths: string[];
    rejectedPath: string | null;
    reason: string | null;
  } {
    const normalizedPaths: string[] = [];
    for (const entry of paths) {
      const resolved = safeResolve(entry);
      if (!resolved) {
        return { ok: false, paths: normalizedPaths, rejectedPath: entry, reason: 'invalid-path' };
      }
      const root = path.parse(resolved).root;
      if (resolved === root || BROAD_WINDOWS_ROOT_PATTERN.test(resolved)) {
        return { ok: false, paths: normalizedPaths, rejectedPath: resolved, reason: 'broad-root' };
      }
      if (resolved.toLowerCase() === path.resolve(os.homedir()).toLowerCase()) {
        return { ok: false, paths: normalizedPaths, rejectedPath: resolved, reason: 'home-root' };
      }
      if (SYSTEM_PATH_PATTERN.test(resolved) || SENSITIVE_PATH_PATTERN.test(resolved)) {
        return { ok: false, paths: normalizedPaths, rejectedPath: resolved, reason: 'sensitive-or-system-path' };
      }
      if (this.workspacePolicy) {
        const validation = this.workspacePolicy.validatePolicyInput(resolved);
        if (!validation.ok) {
          return { ok: false, paths: normalizedPaths, rejectedPath: validation.path, reason: validation.reason || 'workspace-policy-blocked' };
        }
        const evaluation = this.workspacePolicy.evaluate(resolved);
        if (!evaluation.allowedForVelocity) {
          return { ok: false, paths: normalizedPaths, rejectedPath: evaluation.path || resolved, reason: evaluation.reason || 'workspace-policy-blocked' };
        }
      }
      normalizedPaths.push(resolved);
    }
    return { ok: true, paths: Array.from(new Set(normalizedPaths)), rejectedPath: null, reason: null };
  }

  private blocked(
    input: ZavorthRuntimeStateBusActionInput,
    domain: ZavorthRuntimeStateDomain,
    error: string,
    metadata: Record<string, unknown> = {},
  ): ZavorthRuntimeStateBusDispatchResult {
    const receipt: ZavorthRuntimeStateReceipt = {
      id: this.nextReceiptId(),
      createdAt: this.now().toISOString(),
      domain,
      action: input.type,
      status: 'blocked',
      phase: 'receipt',
      summary: `Runtime secure integration blocked ${input.type}: ${error}.`,
      preview: {
        mutation: input.type.replace(/-/g, ' '),
        requiresApproval: true,
        reason: error,
      },
      approval: {
        required: true,
        approved: false,
        approvalId: null,
      },
      safety: {
        pathValidated: input.type === 'set-workspace-knowledge',
        rawSecretsSerialized: false,
        receiptSpoofingPrevented: true,
        approvalBypassPrevented: true,
      },
      metadata: {
        ...metadata,
        error,
        source: 'ZavorthRuntimeSecureIntegrationService',
        rawSecretsSerialized: false,
      },
    };
    const snapshot = this.runtimeStateBus.appendReceipt(receipt);
    return {
      ok: false,
      applied: false,
      receipt,
      snapshot: snapshot as ZavorthRuntimeStateBusSnapshot,
      error,
    };
  }

  private nextReceiptId(): string {
    this.sequence += 1;
    return `secure-runtime-receipt-${this.now().getTime().toString(36)}-${this.sequence}`;
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeId(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function isSecretField(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9_]+/gi, '').toLowerCase();
  return SECRET_FIELD_NAMES.has(normalized)
    || /(?:api[_-]?key|token|secret|password|credential|private[_-]?key)$/i.test(key);
}

function isSecretReference(value: string): boolean {
  return /^secret-ref:[a-z0-9_.:/-]+$/i.test(value) || /^[A-Z][A-Z0-9_]+$/.test(value);
}

function normalizePersonalKind(value: unknown): 'email' | 'calendar' | 'task' {
  const normalized = safeId(value);
  if (normalized === 'calendar') return 'calendar';
  if (normalized === 'task' || normalized === 'tasks') return 'task';
  return 'email';
}

function normalizeMcpTrustState(value: unknown): 'blocked' | 'review' | 'trusted' {
  const normalized = safeId(value);
  if (normalized === 'trusted') return 'trusted';
  if (normalized === 'blocked' || normalized === 'dangerous') return 'blocked';
  return 'review';
}

function profileForMcpTrustState(state: 'blocked' | 'review' | 'trusted'): McpSecurityProfile {
  return state === 'trusted' ? 'trusted' : 'safe';
}

function sanitizeRagSources(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => record(entry))
    .filter((entry): entry is Record<string, unknown> => Boolean(entry))
    .map((entry) => ({
      id: safeId(entry.id || entry.label) || 'source',
      kind: safeId(entry.kind) || 'document',
      label: String(entry.label || entry.name || 'Knowledge source').trim(),
      trusted: entry.trusted === true,
    }))
    .slice(0, 30);
}

function safeResolve(value: string): string | null {
  try {
    return path.resolve(value);
  } catch (error: unknown) {logger.warn('[Zavorth Runtime Secure Integration] operation failed', error); return null; }
}
