import { asErrorLike } from '../utils/errorLike';
import { SalesPackBusinessModeService } from './SalesPackBusinessModeService.js';

import * as http from 'http';
import path from 'path';
import fs from 'fs';
import { safeParseInt } from '../ai-gateway/shared/utils/safeParseInt.js';
import { NodeMeshTransportRouteService } from './NodeMeshTransportRouteService.js';
import { WorkspaceWriteApprovalPayloadCache } from './WorkspaceWriteApprovalPayloadCache.js';
import { WorkspaceWriteApprovalService } from './WorkspaceWriteApprovalService.js';
import { WorkspaceSessionGrantCache } from './WorkspaceSessionGrantCache.js';
import { WorkspaceCommandApprovalService } from './WorkspaceCommandApprovalService.js';
import { WorkspaceTaskMandateService } from './WorkspaceTaskMandateService.js';
import { TemporaryDirectoryTrustService } from './TemporaryDirectoryTrustService.js';
import { WorkspacePathGuard } from '../mcp/workspace/WorkspacePathGuard.js';
import { AgentWorkspaceConfigService } from './AgentWorkspaceConfigService.js';
import { WorkspaceRuntimeReadinessService } from './WorkspaceRuntimeReadinessService.js';
import { WorkspacePolicyPreviewService } from './WorkspacePolicyPreviewService.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { InternalBetaDiagnosticsService } from './InternalBetaDiagnosticsService.js';
import { InternalBetaChecklistService } from './InternalBetaChecklistService.js';
import { ErrorNormalizationService } from './ErrorNormalizationService.js';
import { logger } from '../logger.js';

import { PtySessionService } from './PtySessionService.js';
import { PtySessionApprovalService } from './PtySessionApprovalService.js';
import { PtyInputApprovalService } from './PtyInputApprovalService.js';

import { HostCommandApprovalService } from './HostCommandApprovalService.js';
import { HostCommandRunnerService } from './HostCommandRunnerService.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';
import { HostPowerModeService } from './HostPowerModeService.js';
import { Database } from '../storage/Database.js';
import { config } from '../config/index.js';
import { OperationalMaturityService } from '../domain/platform-ecosystem/application/OperationalMaturityService.js';
import { SalesPackMvpService } from '../domain/platform-ecosystem/application/sales-pack/index.js';

import { SalesPackChannelIoService } from './SalesPackChannelIoService.js';
import type { ZavorthControlAuthenticatedIdentity, ZavorthControlAuthService } from './ZavorthControlAuthService.js';
import type { SalesPackInboundMessageInput } from '../contracts/SalesPackContract.js';
import type { SalesPackChannelIoEnvelope } from '../contracts/SalesPackChannelIoContract.js';
import type { ExperienceCommand, ExperienceSurface } from './experience/ExperienceContracts.js';
import { ExperienceCoreService } from './experience/ExperienceCoreService.js';
import type { ZavorthRuntimeStateActionType } from '../contracts/ZavorthRuntimeStateBusContract.js';
import { globalLiveNodeRegistry } from './LiveNodeRegistryService.js';
import { TrustedDeviceAccessService } from './TrustedDeviceAccessService.js';
import { TrustedDeviceAccessRouteService } from './TrustedDeviceAccessRouteService.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { TrustedWorkspaceService } from './TrustedWorkspaceService.js';
import { ProviderConfigService } from './ProviderConfigService.js';
import { LocalEncryptedProviderSecretStore } from './ProviderSecretStore.js';
import { ProviderConnectionTestService } from './ProviderConnectionTestService.js';
import * as schemas from '../domain/validation/controlSchemas.js';

import type { ZavorthControlCoreRouteDeps } from './ZavorthControlCoreRouteService.js';

export type ZavorthControlRouteInput = {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  pathname: string;
  deps: ZavorthControlCoreRouteDeps;
};

type CommandApprovalRow = {
  operation_id: string;
  workspace_id: string;
  command: string;
  created_at: string;
  expires_at: string;
};

type HostCommandProposalRow = {
  operation_id: string;
  workspace_id: string;
  command_preview_redacted: string;
  args_preview_redacted: string;
  cwd_suffix: string;
  shell: number;
  risk_level: string;
  reason_redacted: string;
  created_at: string;
  expires_at: string;
  requires_strong_confirmation: number;
  strong_confirmation_phrase: string;
};

type PlatformRouteContext = {
  transportRoutes: NodeMeshTransportRouteService;
  operationalMaturity: OperationalMaturityService;
  salesPack: SalesPackMvpService;
  salesPackBusinessMode: SalesPackBusinessModeService;
  salesPackChannelIo: SalesPackChannelIoService;
  localAccessRoutes: TrustedDeviceAccessRouteService;
  handleExperienceRequest: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlCoreRouteDeps,
  ) => Promise<boolean>;
  handleNodeMeshLiveEvents: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  isNodeMeshLiveAuthorized: (
    req: http.IncomingMessage,
    url: URL,
    deps: ZavorthControlCoreRouteDeps,
    body?: Record<string, unknown>,
  ) => boolean;
  parseBoolean: (value: unknown) => boolean | null;
  readBusinessModeIdentity: (
    req: http.IncomingMessage,
    url: URL,
    body: Record<string, unknown>,
    deps: ZavorthControlCoreRouteDeps,
  ) => { userId: string | null; profileId: string | null; authorized: boolean };
  readOptionalString: (value: unknown) => string | null;
  readSalesPackChannelIoEnvelope: (
    body: Record<string, unknown>,
    headers: http.IncomingHttpHeaders,
  ) => SalesPackChannelIoEnvelope;
  readSalesPackInboundMessage: (body: Record<string, unknown>) => SalesPackInboundMessageInput | null;
};

export async function handleControlPlatformRoutes(
  input: ZavorthControlRouteInput,
  context: PlatformRouteContext,
): Promise<boolean | null> {
  const { req, res, url, pathname, deps } = input;
  if (pathname === '/') {
    deps.writeRedirect(res, '/control');
    return true;
  }

  if (pathname.startsWith('/api/v2/local-access')) {
    return context.localAccessRoutes.handleRequest(req, res, pathname, deps);
  }

  if (pathname === '/api/runtime/capabilities' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    await deps.experienceCore?.syncRuntimeOperationalState?.({
      userId: String(url.searchParams.get('userId') || 'desktop-user'),
      sessionId: String(url.searchParams.get('sessionId') || 'desktop-main'),
      workspacePath: url.searchParams.get('workspacePath'),
    });
    const snapshot = deps.experienceCore?.buildRuntimeCapabilities?.() || null;
    deps.writeJson(
      res,
      snapshot || { ok: false, error: 'Runtime capabilities are not attached.' },
      snapshot ? 200 : 503,
    );
    return true;
  }

  if (pathname.startsWith('/api/experience')) {
    return context.handleExperienceRequest(req, res, url, pathname, deps);
  }

  if (pathname === '/api/v2/cost-savings' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const { CostSavingsDashboardService } =
        require('./CostSavingsDashboardService.js') as typeof import('./CostSavingsDashboardService.js');
      const snap = new CostSavingsDashboardService().buildSnapshot();
      deps.writeJson(res, { ok: true, data: snap });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/memory-graph' && req.method === 'GET') {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const { MemoryGraphSnapshotService } =
        require('./MemoryGraphSnapshotService.js') as typeof import('./MemoryGraphSnapshotService.js');
      const snap = new MemoryGraphSnapshotService().buildSnapshot();
      deps.writeJson(res, {
        ok: true,
        data: {
          ...snap,
          stats: {
            nodeCount: snap.nodeCount,
            edgeCount: snap.edgeCount,
            byType: snap.byType,
          },
        },
      });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/session-export' && (req.method === 'GET' || req.method === 'POST')) {
    if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    try {
      const { ZavorthSessionTranscriptExportService } =
        require('./ZavorthSessionTranscriptExportService.js') as typeof import('./ZavorthSessionTranscriptExportService.js');
      const query = url.searchParams;
      let body: Record<string, unknown> = {};
      if (
        req.method === 'POST' &&
        typeof (req as { body?: unknown }).body === 'object' &&
        (req as { body?: unknown }).body
      ) {
        body = (req as { body?: Record<string, unknown> }).body || {};
      }
      const redactRaw = body.redact ?? query.get('redact');
      const redact = redactRaw === false || redactRaw === 'false' || redactRaw === '0' ? false : true;
      const service = new ZavorthSessionTranscriptExportService();
      const snap = service.export({
        sessionId: String(body.sessionId || query.get('session') || query.get('sessionId') || '').trim() || undefined,
        format: String(body.format || query.get('format') || 'markdown').trim() as 'markdown' | 'html' | 'prompt',
        title: String(body.title || query.get('title') || '').trim() || undefined,
        exportPath: String(body.exportPath || query.get('exportPath') || '').trim() || undefined,
        approvalId: String(body.approvalId || query.get('approvalId') || '').trim() || undefined,
        redact,
        includeSystem: body.includeSystem === true || query.get('includeSystem') === 'true',
        messages: Array.isArray(body.messages) ? (body.messages as never) : undefined,
      });
      deps.writeJson(res, { ok: true, data: snap });
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: (err as Error).message }, 500);
    }
    return true;
  }

  if (pathname === '/api/v2/maturity/snapshot' && req.method === 'GET') {
    deps.writeJson(res, {
      ok: true,
      data: context.operationalMaturity.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/snapshot' && req.method === 'GET') {
    deps.writeJson(res, {
      ok: true,
      data: context.salesPack.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/business-mode' && req.method === 'GET') {
    const identity = context.readBusinessModeIdentity(req, url, {}, deps);
    if (!identity.authorized) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      data: context.salesPackBusinessMode.readSnapshot(identity),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/business-mode' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const identity = context.readBusinessModeIdentity(req, url, body, deps);
    if (!identity.authorized) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    const enabled = context.parseBoolean(body.enabled);
    if (enabled === null) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'Campo "enabled" needs ser booleano.',
        },
        400,
      );
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      data: context.salesPackBusinessMode.setEnabled({
        userId: identity.userId,
        profileId: identity.profileId,
        enabled,
        updatedBy: context.readOptionalString(body.updatedBy) || 'zavorthControl',
      }),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/demo' && req.method === 'POST') {
    const result = context.salesPack.seedDemoScenario();
    deps.writeJson(res, {
      ok: true,
      data: result,
      snapshot: context.salesPack.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/inbound' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const input = context.readSalesPackInboundMessage(body);
    if (!input) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'Campos "text" e "customerId" need ser strings not emptys.',
        },
        400,
      );
      return true;
    }

    const result = context.salesPack.processInboundMessage(input);
    deps.writeJson(res, {
      ok: true,
      data: result,
      snapshot: context.salesPack.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/channel-io/snapshot' && req.method === 'GET') {
    deps.writeJson(res, {
      ok: true,
      data: context.salesPackChannelIo.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/v2/sales-pack/channel-io/inbound' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const result = context.salesPackChannelIo.receiveInbound(context.readSalesPackChannelIoEnvelope(body, req.headers));
    deps.writeJson(
      res,
      {
        ok: result.ok,
        data: result,
        snapshot: context.salesPack.buildSnapshot(),
        channelIo: context.salesPackChannelIo.buildSnapshot(),
      },
      result.status === 'rejected' ? 400 : 200,
    );
    return true;
  }

  if (pathname === '/api/v2/sales-pack/channel-io/whatsapp-cloud' && req.method === 'POST') {
    const rawBody = await deps.readRawBody(req);
    let body: Record<string, unknown> = {};
    try {
      body = rawBody.trim() ? (JSON.parse(rawBody) as unknown as Record<string, unknown>) : {};
    } catch (error: unknown) {
      deps.writeJson(res, { ok: false, error: 'Payload JSON invalid to WhatsApp Cloud API.' }, 400);
      return true;
    }
    const result = context.salesPackChannelIo.receiveInbound({
      provider: 'whatsapp-cloud-api',
      platform: 'whatsapp',
      headers: req.headers,
      rawBody,
      body,
    });
    deps.writeJson(
      res,
      {
        ok: result.ok,
        data: result,
        snapshot: context.salesPack.buildSnapshot(),
        channelIo: context.salesPackChannelIo.buildSnapshot(),
      },
      result.status === 'rejected' ? 400 : 200,
    );
    return true;
  }

  if (pathname === '/api/node-mesh/pairing/claim' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const result = context.transportRoutes.handleClaim(body, {
      nodeHeartbeat: deps.nodeHeartbeat,
      nodeMesh: deps.nodeMesh,
    });
    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/node-mesh/heartbeat' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    const result = context.transportRoutes.handleHeartbeat(body, {
      nodeHeartbeat: deps.nodeHeartbeat,
      nodeMesh: deps.nodeMesh,
    });
    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/node-mesh/live/snapshot' && req.method === 'GET') {
    if (!context.isNodeMeshLiveAuthorized(req, url, deps)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    deps.writeJson(res, {
      ok: true,
      live: globalLiveNodeRegistry.buildSnapshot(),
      nodeMesh: deps.nodeMesh?.buildSnapshot({}) || null,
    });
    return true;
  }

  if (pathname === '/api/node-mesh/live/events' && req.method === 'GET') {
    if (!context.isNodeMeshLiveAuthorized(req, url, deps)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    context.handleNodeMeshLiveEvents(req, res);
    return true;
  }

  if (pathname === '/api/node-mesh/live/disconnect' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    if (!context.isNodeMeshLiveAuthorized(req, url, deps, body)) {
      deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
      return true;
    }
    globalLiveNodeRegistry.markDisconnected(
      String(body.nodeId || '').trim(),
      String(body.reason || 'Disconnected through zavorthControl live endpoint.').trim(),
    );
    deps.writeJson(res, {
      ok: true,
      live: globalLiveNodeRegistry.buildSnapshot(),
    });
    return true;
  }

  if (pathname === '/api/webhooks/slack' && req.method === 'POST') {
    if (!deps.slackIngressGateway) {
      deps.writeJson(res, { ok: false, error: 'Slack webhook unavailable.' }, 503);
      return true;
    }

    const rawBody = await deps.readRawBody(req);
    let body: Record<string, unknown> = {};
    try {
      body = rawBody.trim() ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch (error: unknown) {
      deps.writeJson(res, { ok: false, error: 'Payload JSON invalid to webhook do Slack.' }, 400);
      return true;
    }

    const result = await deps.slackIngressGateway.handleWebhookEvent({
      headers: req.headers,
      rawBody,
      body,
    });
    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/webhooks/whatsapp' && req.method === 'GET') {
    if (!deps.whatsappIngressGateway) {
      deps.writeText(res, 'WhatsApp webhook unavailable.', 503);
      return true;
    }

    const verification = deps.whatsappIngressGateway.handleWebhookVerification(url);
    deps.writeText(res, verification.textBody, verification.statusCode);
    return true;
  }

  if (pathname === '/api/webhooks/whatsapp' && req.method === 'POST') {
    if (!deps.whatsappIngressGateway) {
      deps.writeJson(res, { ok: false, error: 'WhatsApp webhook unavailable.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const result = await deps.whatsappIngressGateway.handleWebhookEvent({ body });
    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/webhooks/instagram' && req.method === 'GET') {
    if (!deps.instagramIngressGateway) {
      deps.writeText(res, 'Instagram webhook unavailable.', 503);
      return true;
    }

    const verification = deps.instagramIngressGateway.handleWebhookVerification(url);
    deps.writeText(res, verification.textBody, verification.statusCode);
    return true;
  }

  if (pathname === '/api/webhooks/instagram' && req.method === 'POST') {
    if (!deps.instagramIngressGateway) {
      deps.writeJson(res, { ok: false, error: 'Instagram webhook unavailable.' }, 503);
      return true;
    }

    const body = await deps.readJsonBody(req);
    const result = await deps.instagramIngressGateway.handleWebhookEvent({ body });
    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/webhooks/teams' && req.method === 'POST') {
    if (!deps.teamsIngressGateway) {
      deps.writeJson(res, { ok: false, error: 'Teams webhook unavailable.' }, 503);
      return true;
    }

    const rawBody = await deps.readRawBody(req);
    let body: Record<string, unknown> = {};
    try {
      body = rawBody.trim() ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch (error: unknown) {
      deps.writeJson(res, { ok: false, error: 'Payload JSON invalid to webhook do Teams.' }, 400);
      return true;
    }
    const result = await deps.teamsIngressGateway.handleWebhookEvent({
      headers: req.headers,
      rawBody,
      body,
    });

    deps.writeJson(res, result.body, result.statusCode);
    return true;
  }

  if (pathname === '/api/v2/a2ui/snapshot' && req.method === 'GET') {
    const surfaceId = url.searchParams.get('surfaceId') || undefined;
    const snapshot =
      typeof deps.a2ui.readSnapshot === 'function'
        ? deps.a2ui.readSnapshot(surfaceId)
        : {
            generatedAt: new Date().toISOString(),
            protocolVersion: 'a2ui.v1',
            capabilities: ['snapshot'],
            allowedComponents: [],
            surfaceId: surfaceId || null,
            surfaces: typeof deps.a2ui.listSurfaces === 'function' ? deps.a2ui.listSurfaces() : [],
            commands: {
              snapshot: '/api/v2/a2ui/snapshot',
              action: '/api/v2/a2ui/action',
              events: '/api/v2/a2ui/events',
              stream: '/api/v2/a2ui/stream',
              assets: '/api/v2/a2ui/assets',
            },
          };
    deps.writeJson(res, { ok: true, data: snapshot });
    return true;
  }

  if (pathname === '/api/v2/a2ui/events' && req.method === 'GET') {
    const surfaceId = url.searchParams.get('surfaceId') || undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? safeParseInt(limitRaw, 20) : 20;
    const events =
      typeof deps.a2ui.listEvents === 'function'
        ? deps.a2ui.listEvents(surfaceId, Number.isFinite(limit) ? limit : 20)
        : [];
    deps.writeJson(res, { ok: true, data: events });
    return true;
  }

  if (pathname === '/api/v2/a2ui/stream' && req.method === 'GET') {
    const surfaceId = url.searchParams.get('surfaceId') || undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? safeParseInt(limitRaw, 20) : 20;
    const stream =
      typeof deps.a2ui.readStream === 'function'
        ? deps.a2ui.readStream(surfaceId, Number.isFinite(limit) ? limit : 20)
        : {
            generatedAt: new Date().toISOString(),
            protocolVersion: 'a2ui.v1',
            surfaceId: surfaceId || null,
            items: [],
            commands: {
              events: '/api/v2/a2ui/events',
              action: '/api/v2/a2ui/action',
            },
          };
    deps.writeJson(res, { ok: true, data: stream });
    return true;
  }

  if (pathname === '/api/v2/a2ui/assets' && req.method === 'GET') {
    const surfaceId = url.searchParams.get('surfaceId') || undefined;
    const assets = typeof deps.a2ui.listAssets === 'function' ? deps.a2ui.listAssets(surfaceId) : [];
    deps.writeJson(res, { ok: true, data: assets });
    return true;
  }

  if (pathname === '/api/v2/a2ui/action' && req.method === 'POST') {
    const body = await deps.readJsonBody(req);
    if (
      !body['surfaceId'] ||
      typeof body['surfaceId'] !== 'string' ||
      !body.actionId ||
      typeof body.actionId !== 'string'
    ) {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'Campos "surfaceId" (string) e "actionId" (string) obrigatorios.',
        },
        400,
      );
      return true;
    }

    if (typeof deps.a2ui.dispatchAction !== 'function') {
      deps.writeJson(
        res,
        {
          ok: false,
          error: 'A2UI action dispatch unavailable nesta surface.',
        },
        503,
      );
      return true;
    }

    const result = await deps.a2ui.dispatchAction({
      surfaceId: body['surfaceId'] as string,
      actionId: body.actionId,
      requestedBy: typeof body['requestedBy'] === 'string' ? body['requestedBy'] : 'zavorthControl',
      payload: body.payload && typeof body.payload === 'object' ? (body.payload as Record<string, unknown>) : {},
      correlation:
        body.correlation && typeof body.correlation === 'object' ? (body.correlation as Record<string, unknown>) : null,
    });
    deps.writeJson(res, result, result.ok ? 200 : result.status === 'not_found' ? 404 : 409);
    return true;
  }

  if (pathname === '/api/v2/a2ui/surfaces' && req.method === 'GET') {
    deps.writeJson(res, {
      ok: true,
      deprecated: true,
      canonical: '/api/v2/a2ui/snapshot',
      data: deps.a2ui?.listSurfaces ? deps.a2ui.listSurfaces() : [],
    });
    return true;
  }

  if (pathname.startsWith('/api/v2/a2ui/surface/') && req.method === 'GET') {
    const surfaceId = pathname.split('/').pop() || '';
    const state = deps.a2ui?.getSurfaceState ? deps.a2ui.getSurfaceState(surfaceId) : null;
    deps.writeJson(res, {
      ok: !!state,
      deprecated: true,
      canonical: `/api/v2/a2ui/snapshot?surfaceId=${encodeURIComponent(surfaceId)}`,
      data: state,
    });
    return true;
  }

  return null;
}
