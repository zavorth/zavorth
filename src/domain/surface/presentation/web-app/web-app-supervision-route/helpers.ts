import crypto from 'crypto';
import type { IMessageContext } from '../../../../../contracts/core/IMessageBroker.js';
import type {
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
  SystemOverlordExecutionProfile,
} from '../../../../../contracts/SystemOverlordContract.js';
import type http from 'http';
import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import type { WebAppSupervisionRouteContext } from './types.js';

interface EngineeringWebBody {
  sessionId?: string;
  text?: string;
}

interface OperatorApprovalBody {
  approved?: boolean;
  confirmed?: boolean;
  approvalGranted?: boolean;
}

const SYSTEM_OVERLORD_CAPABILITIES: readonly SystemOverlordCapability[] = [
  'host.shell',
  'host.files.write',
  'host.install',
  'desktop.automation',
  'browser.control',
  'docker.exec',
  'wsl.exec',
  'network.tunnel',
  'secrets.read',
  'node.invoke',
  'computer_use.visual_action',
];

const SYSTEM_OVERLORD_PROFILES: readonly SystemOverlordExecutionProfile[] = [
  'safe',
  'trusted',
  'dangerous',
  'owner',
];

export function asNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  return value.trim() || null;
}

export function asLooseRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function isSystemOverlordCapability(value: string): value is SystemOverlordCapability {
  return SYSTEM_OVERLORD_CAPABILITIES.some((capability) => capability === value);
}

export function normalizeSystemOverlordCapability(value: unknown): SystemOverlordCapability | null {
  const capability = String(value || '').trim();
  return isSystemOverlordCapability(capability) ? capability : null;
}

export function normalizeSystemOverlordExecutionProfile(
  value: unknown,
): SystemOverlordExecutionProfile | null {
  const profile = String(value || '').trim();
  return SYSTEM_OVERLORD_PROFILES.some((candidate) => candidate === profile)
    ? profile as SystemOverlordExecutionProfile
    : null;
}

export function normalizeSystemOverlordAutonomyLevel(
  value: unknown,
): SystemOverlordAutonomyLevel | null {
  const numeric = Number(value || 0);
  if (numeric === 1 || numeric === 2 || numeric === 3 || numeric === 4 || numeric === 5 || numeric === 6) {
    return numeric;
  }
  return null;
}

export function isComputerUseAllowed(): boolean {
  const explicit = String(process.env.ZAVORTH_COMPUTER_USE_ENABLED || '').trim().toLowerCase();
  if (explicit === 'true') {
    return true;
  }
  if (explicit === 'false') {
    return false;
  }

  const profile = String(
    process.env.ZAVORTH_COMPUTER_USE_PROFILE
    || process.env.ZAVORTH_WEB_RUNTIME_PROFILE
    || process.env.ZAVORTH_MCP_PROFILE
    || 'safe',
  ).trim().toLowerCase();
  return profile === 'trusted' || profile === 'dangerous';
}

export function getRequestedBy(ctx: WebAppSupervisionRouteContext, fallback: string | null = null): string | null {
  return String(ctx.deps.runtime.webUserId || '').trim() || fallback;
}

export function buildEngineeringWebContext(
  ctx: WebAppSupervisionRouteContext,
  body: EngineeringWebBody,
): { engineeringSessionId: string; webCtx: IMessageContext } {
  const engineeringSessionId = String(body.sessionId || '').trim() || `engineering-web-${Date.now()}`;
  const baseCtx = asLooseRecord(ctx.deps.createWebContext(engineeringSessionId)) || {};
  return {
    engineeringSessionId,
    webCtx: {
      ...baseCtx,
      platform: 'web',
      userId: String(ctx.deps.runtime.webUserId || 'web-user'),
      chatId: String(baseCtx.chatId || `web:${engineeringSessionId}`),
      isGroup: false,
      rawText: String(body.text || '').trim() || 'continue',
      threadId: engineeringSessionId,
      reply: async () => undefined,
      editMessage: async () => undefined,
    },
  };
}

export function isWebOperatorApprovalRequested(body: OperatorApprovalBody | null | undefined): boolean {
  return body?.approved === true || body?.confirmed === true || body?.approvalGranted === true;
}

export function isStrongWebOperatorApprovalAccepted(
  ctx: WebAppSupervisionRouteContext,
  body: OperatorApprovalBody | null | undefined,
): boolean {
  if (!isWebOperatorApprovalRequested(body)) {
    return false;
  }
  const expected = String(
    process.env.ZAVORTH_OPERATOR_APPROVAL_TOKEN
    || process.env.ZAVORTH_RUNTIME_ADAPTER_API_APPROVAL_TOKEN
    || process.env.ZAVORTH_ZAVORTH_CONTROL_OPERATOR_TOKEN
    || '',
  ).trim();
  if (expected.length < 16) {
    return false;
  }
  const provided = readHeaderValue(ctx.req, 'x-zavorth-operator-approval');
  return safeTokenEquals(provided, expected);
}

export function buildWebOperatorApprovalSafety(
  ctx: WebAppSupervisionRouteContext,
  body: OperatorApprovalBody | null | undefined,
): {
  operatorApprovalRequested: boolean;
  operatorApprovalAccepted: boolean;
  bodyApprovalIgnored: boolean;
  approvalRequiresHeaderToken: boolean;
} {
  const operatorApprovalRequested = isWebOperatorApprovalRequested(body);
  const operatorApprovalAccepted = isStrongWebOperatorApprovalAccepted(ctx, body);
  return {
    operatorApprovalRequested,
    operatorApprovalAccepted,
    bodyApprovalIgnored: operatorApprovalRequested && !operatorApprovalAccepted,
    approvalRequiresHeaderToken: true,
  };
}

export function buildWebAppSupervisionRouteContext(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL,
  pathname: string,
  deps: WebAppRuntimeRouteDeps,
): WebAppSupervisionRouteContext {
  const isSessionV2Route = (suffix: string = '') =>
    pathname === `/api/web/experimental/session-v2${suffix}` || pathname === `/api/web/gateway/session-v2${suffix}`;
  const isSessionV2RecordingRoute =
    pathname.startsWith('/api/web/experimental/session-v2/recordings/')
    || pathname.startsWith('/api/web/gateway/session-v2/recordings/');
  const isSwarmV2Route = (suffix: string = '') =>
    pathname === `/api/web/experimental/swarm-v2${suffix}` || pathname === `/api/web/gateway/swarm-v2${suffix}`;
  const isSwarmScaleRoute = (suffix: string = '') =>
    pathname === `/api/web/experimental/swarm-scale${suffix}` || pathname === `/api/web/gateway/swarm-scale${suffix}`;
  const experimentalAlias =
    pathname.includes('/api/web/experimental/session-v2')
    || pathname.includes('/api/web/experimental/swarm-v2')
    || pathname.includes('/api/web/experimental/swarm-scale');

  return {
    req,
    res,
    url,
    pathname,
    deps,
    experimentalAlias,
    sessionV2Service: deps.sessionV2 || deps.experimentalSessionV2 || null,
    swarmV2Service: deps.swarmV2 || deps.experimentalSwarmV2 || null,
    swarmScalePlaneService: deps.swarmScalePlane || null,
    sessionV2Label: 'Session v2',
    swarmV2Label: 'Swarm v2',
    isSessionV2Route,
    isSessionV2RecordingRoute,
    isSwarmV2Route,
    isSwarmScaleRoute,
  };
}

function readHeaderValue(req: http.IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value || '').trim();
}

function safeTokenEquals(provided: string, expected: string): boolean {
  const left = Buffer.from(String(provided || ''), 'utf8');
  const right = Buffer.from(String(expected || ''), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
