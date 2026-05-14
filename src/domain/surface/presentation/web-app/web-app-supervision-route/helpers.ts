import type {
  SystemOverlordAutonomyLevel,
  SystemOverlordCapability,
} from '../../../../../contracts/SystemOverlordContract.js';
import type http from 'http';
import type { WebAppRuntimeRouteDeps } from '../WebAppRuntimeRouteService.js';
import type { WebAppSupervisionRouteContext } from './types.js';

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

export function isSystemOverlordCapability(value: string): value is SystemOverlordCapability {
  return SYSTEM_OVERLORD_CAPABILITIES.some((capability) => capability === value);
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
  body: Record<string, any>,
) {
  const engineeringSessionId = String(body.sessionId || '').trim() || `engineering-web-${Date.now()}`;
  const baseCtx = ctx.deps.createWebContext(engineeringSessionId) || {};
  return {
    engineeringSessionId,
    webCtx: {
      ...baseCtx,
      platform: 'web',
      userId: ctx.deps.runtime.webUserId,
      chatId: baseCtx.chatId || `web:${engineeringSessionId}`,
      isGroup: false,
      rawText: String(body.text || '').trim() || 'continue',
      threadId: engineeringSessionId,
      reply: async () => undefined,
      editMessage: async () => undefined,
    },
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
  const experimentalAlias =
    pathname.includes('/api/web/experimental/session-v2')
    || pathname.includes('/api/web/experimental/swarm-v2');

  return {
    req,
    res,
    url,
    pathname,
    deps,
    experimentalAlias,
    sessionV2Service: deps.sessionV2 || deps.experimentalSessionV2 || null,
    swarmV2Service: deps.swarmV2 || deps.experimentalSwarmV2 || null,
    sessionV2Label: 'Sessao v2',
    swarmV2Label: 'Swarm v2',
    isSessionV2Route,
    isSessionV2RecordingRoute,
    isSwarmV2Route,
  };
}
