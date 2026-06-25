import {
  ZavorthGatewayRuntimeService,
  type ZavorthGatewayControlApiSnapshot,
} from "../../../../services/ZavorthGatewayRuntimeService.js";
import { AIGatewayProxyService } from "../../../../services/AIGatewayProxyService.js";
import { ProviderControlPlaneService } from "../../../../services/ProviderControlPlaneService.js";
import { PermissionService } from "../../../../services/PermissionService.js";
import type { PermissionRequest } from "../../../../contracts/PermissionRequest.js";

export type GatewayControlReadResource =
  | "overview"
  | "providers"
  | "models"
  | "health"
  | "combos"
  | "cache"
  | "rate-limits";

export type GatewayControlOperationResource =
  | "providers.test"
  | "combos.validate"
  | "cache.invalidate"
  | "rate-limits.toggle";

export type GatewayControlOperationDescriptor = {
  id: GatewayControlOperationResource;
  risk: "write" | "sensitive";
  delegatedRoute: string;
  existingEquivalent: string;
};

export type GatewayControlOperationContract = GatewayControlOperationDescriptor & {
  method: "POST";
  publicPath: string;
  requiresApproval: true;
  status: "available";
  source: "ai-gateway-route";
};

export const GATEWAY_CONTROL_OPERATION_CONTRACTS: readonly GatewayControlOperationContract[] = [
  {
    id: "providers.test",
    method: "POST",
    publicPath: "/api/gateway-control/providers/test",
    risk: "sensitive",
    requiresApproval: true,
    status: "available",
    source: "ai-gateway-route",
    delegatedRoute: "/api/providers/[id]/test",
    existingEquivalent: "testSingleConnection(connectionId, validationModelId)",
  },
  {
    id: "combos.validate",
    method: "POST",
    publicPath: "/api/gateway-control/combos/validate",
    risk: "write",
    requiresApproval: true,
    status: "available",
    source: "ai-gateway-route",
    delegatedRoute: "/api/combos/test",
    existingEquivalent: "POST /api/combos/test",
  },
  {
    id: "cache.invalidate",
    method: "POST",
    publicPath: "/api/gateway-control/cache/invalidate",
    risk: "write",
    requiresApproval: true,
    status: "available",
    source: "ai-gateway-route",
    delegatedRoute: "/api/cache",
    existingEquivalent: "DELETE /api/cache",
  },
  {
    id: "rate-limits.toggle",
    method: "POST",
    publicPath: "/api/gateway-control/rate-limits/toggle",
    risk: "write",
    requiresApproval: true,
    status: "available",
    source: "ai-gateway-route",
    delegatedRoute: "/api/rate-limits",
    existingEquivalent: "POST /api/rate-limits",
  },
];

export type GatewayControlApprovalDecision = {
  approved: boolean;
  approvalId?: string;
  approvedBy?: string;
  reason?: string;
};

export type GatewayControlOperationDelegateRequest = {
  resource: GatewayControlOperationResource;
  input: Record<string, unknown>;
  operation: GatewayControlOperationDescriptor;
  approval: GatewayControlApprovalDecision;
  timeoutMs: number;
};

export type GatewayControlOperationAuditReceipt = {
  receiptId: string;
  startedAt: string;
  finishedAt: string;
  latencyMs: number;
  timeoutMs: number;
  timedOut: boolean;
  delegatedRoute: string;
  existingEquivalent: string;
  approvalId?: string;
  approvedBy?: string;
};

export type GatewayControlOperationPayload = {
  ok: boolean;
  httpStatus: 200 | 400 | 403 | 500 | 504;
  status: "invalid" | "approval_required" | "delegated" | "failed" | "timeout";
  resource: GatewayControlOperationResource;
  contractVersion: ZavorthGatewayControlApiSnapshot["contractVersion"];
  generatedAt: string;
  operation: GatewayControlOperationDescriptor;
  approval: {
    required: true;
    satisfied: boolean;
    mechanism: "gateway-control-policy";
    reason: string;
    approvalId?: string;
    approvedBy?: string;
  };
  input: Record<string, unknown>;
  audit?: GatewayControlOperationAuditReceipt;
  result?: Record<string, unknown>;
  errors: string[];
  message: string;
};

type GatewayControlRouteRuntime = {
  gatewayControlService?: Pick<ZavorthGatewayRuntimeService, "buildGatewayControlApiSnapshot">;
};

type GatewayControlPermissionPolicyService = Pick<PermissionService, "findApprovedRequest">;
type GatewayControlFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type GatewayControlRouteOptions = GatewayControlRouteRuntime & {
  includeAdvancedProviders?: boolean;
  approveOperation?: (
    request: Omit<GatewayControlOperationDelegateRequest, "approval" | "timeoutMs">,
  ) => GatewayControlApprovalDecision | Promise<GatewayControlApprovalDecision>;
  delegateOperation?: (
    request: GatewayControlOperationDelegateRequest,
  ) => Promise<Record<string, unknown>>;
  now?: () => Date;
  timeoutMs?: number;
};

export type GatewayControlOperationRouteOptionsOverrides = GatewayControlRouteRuntime & {
  permissionService?: GatewayControlPermissionPolicyService;
  fetchImpl?: GatewayControlFetch;
  timeoutMs?: number;
};

export function parseGatewayControlRouteOptions(request: Request): Pick<GatewayControlRouteOptions, "includeAdvancedProviders"> {
  const searchParams = new URL(request.url).searchParams;
  return {
    includeAdvancedProviders: searchParams.get("advanced") === "true",
  };
}

export function buildGatewayControlOperationRouteOptions(
  request: Request,
  overrides: GatewayControlOperationRouteOptionsOverrides = {},
): GatewayControlRouteOptions {
  return {
    ...parseGatewayControlRouteOptions(request),
    gatewayControlService: overrides.gatewayControlService,
    approveOperation: createGatewayControlPermissionApproval(request, overrides.permissionService),
    delegateOperation: createGatewayControlHttpDelegate(request, overrides.fetchImpl),
    timeoutMs: overrides.timeoutMs,
  };
}

export function buildGatewayControlReadPayload(
  resource: GatewayControlReadResource,
  options: GatewayControlRouteOptions = {},
): Record<string, unknown> {
  const snapshot = getGatewayControlSnapshot(options);
  const base = {
    ok: snapshot.ok,
    contractVersion: snapshot.contractVersion,
    generatedAt: snapshot.generatedAt,
    resource,
    warnings: snapshot.warnings,
  };

  switch (resource) {
    case "providers":
      return { ...base, providers: snapshot.providers };
    case "models":
      return { ...base, models: snapshot.models };
    case "health":
      return { ...base, health: snapshot.health };
    case "combos":
      return { ...base, combos: snapshot.combos };
    case "cache":
      return { ...base, cache: snapshot.cache };
    case "rate-limits":
      return { ...base, rateLimits: snapshot.rateLimits };
    case "overview":
    default:
      return snapshot;
  }
}

export async function readGatewayControlJsonBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: true, body: {} };
  }
}

export function buildGatewayControlOperationPayload(
  resource: GatewayControlOperationResource,
  body: unknown,
  options: GatewayControlRouteOptions = {},
): GatewayControlOperationPayload {
  const snapshot = getGatewayControlSnapshot(options);
  const input = sanitizeGatewayControlPayload(asRecord(body));
  const errors = validateGatewayControlOperationInput(resource, input);
  const operation = describeGatewayControlOperation(resource);

  if (errors.length > 0) {
    return {
      ok: false,
      httpStatus: 400,
      status: "invalid",
      resource,
      contractVersion: snapshot.contractVersion,
      generatedAt: new Date().toISOString(),
      operation,
      approval: {
        required: true,
        satisfied: false,
        mechanism: "gateway-control-policy",
        reason: "Entrada invalida; a operacao sensivel nao foi encaminhada.",
      },
      input,
      errors,
      message: "Gateway Control API recusou a operacao antes de qualquer chamada externa.",
    };
  }

  return {
    ok: false,
    httpStatus: 403,
    status: "approval_required",
    resource,
    contractVersion: snapshot.contractVersion,
    generatedAt: new Date().toISOString(),
    operation,
    approval: {
      required: true,
      satisfied: false,
      mechanism: "gateway-control-policy",
      reason: "Gateway Control API exige approval/policy canonica antes da delegacao real.",
    },
    input,
    errors: [],
    message: "Operacao sensivel bloqueada de forma estruturada; nenhuma chamada externa foi executada.",
  };
}

export async function buildGatewayControlDelegatedOperationPayload(
  resource: GatewayControlOperationResource,
  body: unknown,
  options: GatewayControlRouteOptions = {},
): Promise<GatewayControlOperationPayload> {
  const gatePayload = buildGatewayControlOperationPayload(resource, body, options);
  if (gatePayload.status === "invalid") {
    return gatePayload;
  }

  if (!options.approveOperation || !options.delegateOperation) {
    return gatePayload;
  }

  const approval = await options.approveOperation({
    resource,
    input: gatePayload.input,
    operation: gatePayload.operation,
  });
  if (!approval.approved) {
    return {
      ...gatePayload,
      approval: {
        ...gatePayload.approval,
        reason: approval.reason || "Approval/policy negou a operacao sensivel.",
        approvalId: approval.approvalId,
        approvedBy: approval.approvedBy,
      },
    };
  }

  const timeoutMs = normalizeGatewayControlTimeout(options.timeoutMs);
  const startedAtDate = getGatewayControlNow(options);
  const startedAt = startedAtDate.toISOString();
  const request: GatewayControlOperationDelegateRequest = {
    resource,
    input: gatePayload.input,
    operation: gatePayload.operation,
    approval,
    timeoutMs,
  };

  try {
    const result = await runGatewayControlDelegateWithTimeout(
      options.delegateOperation(request),
      timeoutMs,
    );
    const finishedAtDate = getGatewayControlNow(options);
    return {
      ...gatePayload,
      ok: true,
      httpStatus: 200,
      status: "delegated",
      generatedAt: finishedAtDate.toISOString(),
      approval: buildSatisfiedGatewayControlApproval(gatePayload, approval),
      audit: buildGatewayControlAuditReceipt({
        payload: gatePayload,
        approval,
        startedAt,
        finishedAtDate,
        startedAtDate,
        timeoutMs,
        timedOut: false,
      }),
      result: sanitizeGatewayControlPayload(result),
      errors: [],
      message: "Operacao aprovada e delegada para o equivalente existente.",
    };
  } catch (error) {
    const finishedAtDate = getGatewayControlNow(options);
    const timedOut = error instanceof GatewayControlOperationTimeoutError;
    return {
      ...gatePayload,
      ok: false,
      httpStatus: timedOut ? 504 : 500,
      status: timedOut ? "timeout" : "failed",
      generatedAt: finishedAtDate.toISOString(),
      approval: buildSatisfiedGatewayControlApproval(gatePayload, approval),
      audit: buildGatewayControlAuditReceipt({
        payload: gatePayload,
        approval,
        startedAt,
        finishedAtDate,
        startedAtDate,
        timeoutMs,
        timedOut,
      }),
      errors: [
        timedOut
          ? `Delegacao excedeu o timeout de ${timeoutMs}ms.`
          : getGatewayControlErrorMessage(error),
      ],
      message: timedOut
        ? "Operacao aprovada, mas a delegacao excedeu o timeout configurado."
        : "Operacao aprovada, mas a delegacao falhou no equivalente existente.",
    };
  }
}

function getGatewayControlSnapshot(options: GatewayControlRouteOptions): ZavorthGatewayControlApiSnapshot {
  const service = options.gatewayControlService || createGatewayControlReadService();
  return service.buildGatewayControlApiSnapshot({
    includeAdvancedProviders: options.includeAdvancedProviders,
  });
}

function describeGatewayControlOperation(resource: GatewayControlOperationResource): GatewayControlOperationDescriptor {
  const operation = GATEWAY_CONTROL_OPERATION_CONTRACTS.find((entry) => entry.id === resource);
  if (!operation) {
    throw new Error(`Unsupported Gateway Control operation resource: ${resource}`);
  }
  return {
    id: operation.id,
    risk: operation.risk,
    delegatedRoute: operation.delegatedRoute,
    existingEquivalent: operation.existingEquivalent,
  };
}

function createGatewayControlReadService(): Pick<ZavorthGatewayRuntimeService, "buildGatewayControlApiSnapshot"> {
  const service = new ZavorthGatewayRuntimeService({
    getStatus: () => ({
      enabled: false,
      source: "runtime-file",
      tokenFile: "",
    }),
  } as any);
  service.attachOperations({
    providerControlPlane: new ProviderControlPlaneService(),
    aiGatewayGateway: new AIGatewayProxyService(),
  });
  return service;
}

function createGatewayControlPermissionApproval(
  request: Request,
  permissionService: GatewayControlPermissionPolicyService = new PermissionService(),
): NonNullable<GatewayControlRouteOptions["approveOperation"]> {
  const workspace = resolveGatewayControlWorkspace(request);

  return async ({ resource, input, operation }) => {
    const target = resolveGatewayControlOperationTarget(resource, input);
    const permission = await permissionService.findApprovedRequest(
      "gateway-control",
      "operation_access",
      workspace,
      {
        policy_family: "gateway_control_operation",
        resource,
        target,
        risk: operation.risk,
      },
    );

    if (!permission) {
      return {
        approved: false,
        reason: [
          "Nenhuma permissao aprovada encontrada no PermissionService para Gateway Control.",
          `executor=gateway-control kind=operation_access resource=${resource} target=${target}`,
        ].join(" "),
      };
    }

    return {
      approved: true,
      approvalId: permission.permission_id,
      approvedBy: permission.decided_by || permission.requested_by || "permission-service",
      reason: "PermissionService autorizou a operacao da Gateway Control API.",
    };
  };
}

function createGatewayControlHttpDelegate(
  request: Request,
  fetchImpl: GatewayControlFetch = fetch,
): NonNullable<GatewayControlRouteOptions["delegateOperation"]> {
  return async ({ resource, input, approval }) => {
    const equivalentRequest = buildGatewayControlEquivalentRequest(resource, input);
    const url = new URL(equivalentRequest.path, request.url);
    const response = await fetchImpl(url.toString(), {
      method: equivalentRequest.method,
      headers: {
        "Content-Type": "application/json",
        "X-Zavorth-Gateway-Control": "true",
        ...(approval.approvalId ? { "X-Zavorth-Approval-Id": approval.approvalId } : {}),
      },
      ...(equivalentRequest.body ? { body: JSON.stringify(equivalentRequest.body) } : {}),
    });
    const payload = await readGatewayControlEquivalentJson(response);

    if (!response.ok) {
      throw new Error(`Equivalent route returned HTTP ${response.status}.`);
    }

    return {
      ok: true,
      httpStatus: response.status,
      equivalentPath: equivalentRequest.path,
      data: payload,
    };
  };
}

function validateGatewayControlOperationInput(
  resource: GatewayControlOperationResource,
  input: Record<string, unknown>,
): string[] {
  if (resource === "providers.test") {
    const connectionId = String(input.connectionId || input.providerConnectionId || "").trim();
    return connectionId ? [] : ["connectionId e obrigatorio para providers.test."];
  }

  if (resource === "combos.validate") {
    const comboName = String(input.comboName || "").trim();
    return comboName ? [] : ["comboName e obrigatorio para combos.validate."];
  }

  if (resource === "rate-limits.toggle") {
    return validateGatewayControlRateLimitToggleInput(input);
  }

  return validateGatewayControlCacheInvalidationInput(input);
}

function resolveGatewayControlWorkspace(request: Request): string | null {
  const value = request.headers.get("x-zavorth-workspace")
    || request.headers.get("x-zavorth-workspace-id");
  const normalized = String(value || "").trim();
  return normalized || null;
}

function resolveGatewayControlOperationTarget(
  resource: GatewayControlOperationResource,
  input: Record<string, unknown>,
): string {
  if (resource === "providers.test") {
    return String(input.connectionId || input.providerConnectionId || "").trim();
  }

  if (resource === "cache.invalidate") {
    return resolveGatewayControlCacheTarget(input);
  }

  if (resource === "rate-limits.toggle") {
    return resolveGatewayControlRateLimitTarget(input);
  }

  return String(input.comboName || "").trim();
}

function buildGatewayControlEquivalentRequest(
  resource: GatewayControlOperationResource,
  input: Record<string, unknown>,
): { method: "POST" | "DELETE"; path: string; body?: Record<string, unknown> } {
  if (resource === "providers.test") {
    const connectionId = resolveGatewayControlOperationTarget(resource, input);
    return {
      method: "POST",
      path: `/api/providers/${encodeURIComponent(connectionId)}/test`,
      body: pickDefinedGatewayControlFields({
        validationModelId: input.validationModelId,
      }),
    };
  }

  if (resource === "cache.invalidate") {
    return buildGatewayControlCacheInvalidationRequest(input);
  }

  if (resource === "rate-limits.toggle") {
    return {
      method: "POST",
      path: "/api/rate-limits",
      body: {
        connectionId: String(input.connectionId || "").trim(),
        enabled: input.enabled === true,
      },
    };
  }

  return {
    method: "POST",
    path: "/api/combos/test",
    body: {
      comboName: resolveGatewayControlOperationTarget(resource, input),
    },
  };
}

function validateGatewayControlCacheInvalidationInput(input: Record<string, unknown>): string[] {
  const scope = resolveGatewayControlCacheScope(input);
  if (!["all", "model", "signature", "stale"].includes(scope)) {
    return ["scope deve ser all, model, signature ou stale para cache.invalidate."];
  }

  if (scope === "model" && !String(input.model || "").trim()) {
    return ["model e obrigatorio quando scope=model para cache.invalidate."];
  }

  if (scope === "signature" && !String(input.signature || "").trim()) {
    return ["signature e obrigatorio quando scope=signature para cache.invalidate."];
  }

  if (scope === "stale" && !isPositiveGatewayControlInteger(input.staleMs)) {
    return ["staleMs positivo e obrigatorio quando scope=stale para cache.invalidate."];
  }

  return [];
}

function buildGatewayControlCacheInvalidationRequest(
  input: Record<string, unknown>,
): { method: "DELETE"; path: string } {
  const scope = resolveGatewayControlCacheScope(input);
  const params = new URLSearchParams();

  if (scope === "model") {
    params.set("model", String(input.model || "").trim());
  } else if (scope === "signature") {
    params.set("signature", String(input.signature || "").trim());
  } else if (scope === "stale") {
    params.set("staleMs", String(Math.floor(Number(input.staleMs))));
  }

  const query = params.toString();
  return {
    method: "DELETE",
    path: query ? `/api/cache?${query}` : "/api/cache",
  };
}

function validateGatewayControlRateLimitToggleInput(input: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!String(input.connectionId || "").trim()) {
    errors.push("connectionId e obrigatorio para rate-limits.toggle.");
  }
  if (typeof input.enabled !== "boolean") {
    errors.push("enabled booleano e obrigatorio para rate-limits.toggle.");
  }
  return errors;
}

function resolveGatewayControlRateLimitTarget(input: Record<string, unknown>): string {
  const connectionId = String(input.connectionId || "").trim();
  const action = input.enabled === true ? "enable" : "disable";
  return `connection:${connectionId}:${action}`;
}

function resolveGatewayControlCacheTarget(input: Record<string, unknown>): string {
  const scope = resolveGatewayControlCacheScope(input);
  if (scope === "model") {
    return `model:${String(input.model || "").trim()}`;
  }
  if (scope === "signature") {
    return `signature:${String(input.signature || "").trim()}`;
  }
  if (scope === "stale") {
    return `stale:${Math.floor(Number(input.staleMs))}`;
  }
  return "all";
}

function resolveGatewayControlCacheScope(input: Record<string, unknown>): string {
  return String(input.scope || "").trim().toLowerCase();
}

function isPositiveGatewayControlInteger(value: unknown): boolean {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0;
}

function pickDefinedGatewayControlFields(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && value !== "") {
      output[key] = value;
    }
  }
  return output;
}

async function readGatewayControlEquivalentJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value = await response.json();
    return asRecord(value);
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sanitizeGatewayControlPayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeGatewayControlPayload(entry)) as T;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveGatewayControlKey(key)
      ? entry ? "[redacted]" : entry
      : sanitizeGatewayControlPayload(entry);
  }
  return output as T;
}

function isSensitiveGatewayControlKey(key: string): boolean {
  return /api[-_]?key|access[-_]?token|refresh[-_]?token|id[-_]?token|secret|authorization|credential|password/i
    .test(key);
}

function normalizeGatewayControlTimeout(timeoutMs: number | undefined): number {
  return timeoutMs && Number.isFinite(timeoutMs) && timeoutMs > 0
    ? Math.floor(timeoutMs)
    : 20_000;
}

function getGatewayControlNow(options: GatewayControlRouteOptions): Date {
  return options.now ? options.now() : new Date();
}

function buildSatisfiedGatewayControlApproval(
  payload: GatewayControlOperationPayload,
  approval: GatewayControlApprovalDecision,
): GatewayControlOperationPayload["approval"] {
  return {
    ...payload.approval,
    satisfied: true,
    reason: approval.reason || "Approval/policy autorizou a delegacao sensivel.",
    approvalId: approval.approvalId,
    approvedBy: approval.approvedBy,
  };
}

function buildGatewayControlAuditReceipt(input: {
  payload: GatewayControlOperationPayload;
  approval: GatewayControlApprovalDecision;
  startedAt: string;
  startedAtDate: Date;
  finishedAtDate: Date;
  timeoutMs: number;
  timedOut: boolean;
}): GatewayControlOperationAuditReceipt {
  const finishedAt = input.finishedAtDate.toISOString();
  return {
    receiptId: [
      "gateway-control",
      input.payload.resource,
      input.startedAt,
      input.approval.approvalId || "approved",
    ].join(":"),
    startedAt: input.startedAt,
    finishedAt,
    latencyMs: Math.max(0, input.finishedAtDate.getTime() - input.startedAtDate.getTime()),
    timeoutMs: input.timeoutMs,
    timedOut: input.timedOut,
    delegatedRoute: input.payload.operation.delegatedRoute,
    existingEquivalent: input.payload.operation.existingEquivalent,
    approvalId: input.approval.approvalId,
    approvedBy: input.approval.approvedBy,
  };
}

async function runGatewayControlDelegateWithTimeout<T>(
  delegatePromise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      delegatePromise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new GatewayControlOperationTimeoutError(timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getGatewayControlErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Delegacao falhou sem mensagem estruturada.";
}

class GatewayControlOperationTimeoutError extends Error {
  constructor(readonly timeoutMs: number) {
    super(`Gateway Control operation timed out after ${timeoutMs}ms`);
    this.name = "GatewayControlOperationTimeoutError";
  }
}
