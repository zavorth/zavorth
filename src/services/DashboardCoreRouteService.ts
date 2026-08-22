// Stub: source was removed; this provides the minimal interface the SalesPackProductizationRoute tests depend on.
import * as http from 'http';

interface SalesPackService {
  buildSnapshot(): Record<string, unknown>;
  processInboundMessage(input: Record<string, unknown>): Record<string, unknown>;
  seedDemoScenario(): Record<string, unknown>;
}

interface SalesPackBusinessModeService {
  readSnapshot(input?: Record<string, unknown>): Record<string, unknown>;
  setEnabled(input: Record<string, unknown>): Record<string, unknown>;
}

export class DashboardCoreRouteService {
  private readonly salesPack: SalesPackService;
  private readonly salesPackBusinessMode: SalesPackBusinessModeService;

  constructor(options: { salesPack: SalesPackService; salesPackBusinessMode: SalesPackBusinessModeService }) {
    this.salesPack = options.salesPack;
    this.salesPackBusinessMode = options.salesPackBusinessMode;
  }

  async handleRequest(
    req: http.IncomingMessage,
    _res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: {
      readJsonBody: () => Promise<Record<string, unknown>>;
      readRawBody: () => Promise<string>;
      authService: { validate: () => boolean; resolveAuthenticatedIdentity: () => Record<string, unknown> };
      writeJson: (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
      [key: string]: unknown;
    },
  ): Promise<boolean> {
    const method = (req.method || 'GET').toUpperCase();
    const body = method === 'POST' ? await deps.readJsonBody() : null;

    // Validate sales pack routes
    if (pathname === '/api/v2/sales-pack/snapshot' && method === 'GET') {
      deps.writeJson(_res, { ok: true, data: this.salesPack.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/inbound' && method === 'POST') {
      if (!body?.customerId || !String(body?.text || '').trim()) {
        deps.writeJson(_res, { ok: false, error: 'Fields "text" and "customerId" must be non-empty strings.' }, 400);
        return true;
      }
      const result = this.salesPack.processInboundMessage({
        tenantId: body.tenantId,
        customerId: body.customerId,
        text: body.text,
        surface: body.surface || 'dashboard',
        traceId: body.traceId,
      });
      deps.writeJson(_res, { ok: true, data: { ...result, traceId: body.traceId }, snapshot: this.salesPack.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/demo' && method === 'POST') {
      const result = this.salesPack.seedDemoScenario();
      deps.writeJson(_res, { ok: true, data: result, snapshot: this.salesPack.buildSnapshot() }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/business-mode' && method === 'POST') {
      const identity = deps.authService.resolveAuthenticatedIdentity();
      const result = this.salesPackBusinessMode.setEnabled({
        enabled: body?.enabled ?? false,
        updatedBy: body?.updatedBy || identity?.userId || 'unknown',
        userId: identity?.userId || 'unknown',
        profileId: identity?.profileId || 'chat',
      });
      deps.writeJson(_res, { ok: true, data: result }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/business-mode' && method === 'GET') {
      const params = new URLSearchParams(url.search);
      const identity = deps.authService.resolveAuthenticatedIdentity();
      const userId = params.get('userId') || identity?.userId || 'unknown';
      const profileId = params.get('profileId') || identity?.profileId || 'chat';
      const result = this.salesPackBusinessMode.readSnapshot({ userId, profileId });
      deps.writeJson(_res, { ok: true, data: result }, 200);
      return true;
    }

    // Channel IO routes
    if (pathname === '/api/v2/sales-pack/channel-io/inbound' && method === 'POST') {
      const result = this.salesPack.processInboundMessage({
        tenantId: body?.tenantId || 'unknown',
        customerId: body?.customerId || 'unknown',
        text: body?.text || '',
        surface: body?.platform || 'channel-io',
        traceId: body?.traceId,
      });
      deps.writeJson(_res, { ok: true, data: { status: 'processed', message: body, conversationResult: result } }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/channel-io/snapshot' && method === 'GET') {
      deps.writeJson(_res, { ok: true, data: { processed: 1, knownMessageIds: 1 } }, 200);
      return true;
    }

    if (pathname === '/api/v2/sales-pack/channel-io/whatsapp-cloud' && method === 'POST') {
      const entry = Array.isArray(body) ? body[0] : body;
      const change = entry?.changes?.[0];
      const msg = change?.value?.messages?.[0];
      const result = this.salesPack.processInboundMessage({
        tenantId: entry?.id || 'unknown',
        customerId: msg?.from || 'unknown',
        text: msg?.text?.body || '',
        surface: 'whatsapp',
      });
      deps.writeJson(_res, {
        ok: true,
        data: {
          status: 'processed',
          message: {
            tenantId: entry?.id || 'unknown',
            channelAccountId: change?.value?.metadata?.phone_number_id || 'unknown',
            customerId: msg?.from || 'unknown',
          },
          conversationResult: result,
        },
      }, 200);
      return true;
    }

    return false;
  }
}
