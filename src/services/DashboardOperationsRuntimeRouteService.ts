import * as http from 'http';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

type SnapshotBuilder = {
  buildSnapshot: (input?: any) => any;
};

type AsyncSnapshotBuilder = {
  buildSnapshot: (input?: any) => Promise<any>;
};

type HydratedGatewayBuilder = {
  buildHydratedSnapshot: (input: any) => Promise<any>;
  buildDomainSummarySnapshot?: () => any;
  buildDomainSnapshot?: () => any;
};

export type DashboardOperationsRuntimeRouteDeps = {
  continuityUserId: string | null;
  gateway: HydratedGatewayBuilder;
  sessionTools: SnapshotBuilder;
  sessionPlane: AsyncSnapshotBuilder;
  toolSurface: SnapshotBuilder;
  writeJson: WriteJson;
};

type DashboardRuntimeContext = {
  sessionId: string;
  chatId: string;
  userId: string;
};

export class DashboardOperationsRuntimeRouteService {
  public async handleRequest(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: DashboardOperationsRuntimeRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/operations/gateway') {
      const gatewayContext = this.resolveGatewayContext(url, deps);
      const snapshot = await deps.gateway.buildHydratedSnapshot({
        sessionId: gatewayContext.sessionId,
        chatId: gatewayContext.chatId,
        userId: gatewayContext.userId,
      });
      deps.writeJson(res, snapshot, 200);
      return true;
    }

    if (pathname === '/api/operations/control-plane') {
      const gatewayContext = this.resolveGatewayContext(url, deps);
      const snapshot = await deps.gateway.buildHydratedSnapshot({
        sessionId: gatewayContext.sessionId,
        chatId: gatewayContext.chatId,
        userId: gatewayContext.userId,
      });
      deps.writeJson(res, snapshot.controlPlane, 200);
      return true;
    }

    if (pathname === '/api/operations/gateway/domains') {
      const detail = String(url.searchParams.get('detail') || '').trim().toLowerCase();
      if (detail === 'full' && typeof deps.gateway.buildDomainSnapshot === 'function') {
        deps.writeJson(res, deps.gateway.buildDomainSnapshot(), 200);
        return true;
      }

      if (typeof deps.gateway.buildDomainSummarySnapshot === 'function') {
        deps.writeJson(res, deps.gateway.buildDomainSummarySnapshot(), 200);
        return true;
      }

      const gatewayContext = this.resolveGatewayContext(url, deps);
      const snapshot = await deps.gateway.buildHydratedSnapshot({
        sessionId: gatewayContext.sessionId,
        chatId: gatewayContext.chatId,
        userId: gatewayContext.userId,
      });
      deps.writeJson(res, snapshot.domains || null, 200);
      return true;
    }

    if (pathname === '/api/operations/session-tools') {
      const sessionContext = this.resolveDashboardSessionContext(url, deps);
      deps.writeJson(
        res,
        deps.sessionTools.buildSnapshot({
          sessionId: sessionContext.sessionId,
          chatId: sessionContext.chatId,
          userId: sessionContext.userId,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/sessions') {
      const sessionContext = this.resolveDashboardSessionContext(url, deps);
      deps.writeJson(
        res,
        await deps.sessionPlane.buildSnapshot({
          userId: sessionContext.userId,
          platform: 'web',
          sessionId: sessionContext.sessionId,
          chatId: sessionContext.chatId,
          sourceUserId: sessionContext.sessionId,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/tools') {
      const selectedId = String(url.searchParams.get('selectedId') || '').trim() || null;
      const query = String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null;
      const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
      const requestedChatId = String(url.searchParams.get('chatId') || '').trim();

      deps.writeJson(
        res,
        deps.toolSurface.buildSnapshot(
          requestedSessionId
            ? {
                sessionId: requestedSessionId,
                chatId: requestedChatId || `web:${requestedSessionId}`,
                userId: this.resolveUserId(url, deps),
                selectedId,
                query,
              }
            : {
                selectedId,
                query,
              },
        ),
        200,
      );
      return true;
    }

    return false;
  }

  private resolveUserId(url: URL, deps: DashboardOperationsRuntimeRouteDeps): string {
    return String(url.searchParams.get('userId') || '').trim() || String(deps.continuityUserId || '').trim() || '1';
  }

  private resolveGatewayContext(url: URL, deps: DashboardOperationsRuntimeRouteDeps): DashboardRuntimeContext {
    const requestedSessionId = String(url.searchParams.get('sessionId') || '').trim();
    const requestedChatId = String(url.searchParams.get('chatId') || '').trim();
    return {
      sessionId: requestedSessionId || 'classic-dashboard',
      chatId: requestedChatId || (requestedSessionId ? `web:${requestedSessionId}` : 'dashboard:classic'),
      userId: this.resolveUserId(url, deps),
    };
  }

  private resolveDashboardSessionContext(url: URL, deps: DashboardOperationsRuntimeRouteDeps): DashboardRuntimeContext {
    const sessionId = String(url.searchParams.get('sessionId') || '').trim() || 'classic-dashboard';
    const chatId = String(url.searchParams.get('chatId') || '').trim() || `dashboard:${sessionId}`;
    return {
      sessionId,
      chatId,
      userId: this.resolveUserId(url, deps),
    };
  }
}
