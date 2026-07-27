import * as http from 'http';
import { errorMessage } from '../utils/errorLike.js';
type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;
type EnsureAuthorized = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  errorMessage: string,
  statusCode: number,
) => boolean;

type IntegrationHubLike = {
  buildCatalogSnapshot: (selectedId?: string | null) => any;
  executeGuidedAction: (integrationId: string, actionId: string, context: any) => Promise<any>;
};

export type ZavorthControlOperationsIntegrationRouteDeps = {
  integrationHub: IntegrationHubLike;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  ensureAuthorized: EnsureAuthorized;
};

export class ZavorthControlOperationsIntegrationRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlOperationsIntegrationRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/operations/integrations') {
      deps.writeJson(res, deps.integrationHub.buildCatalogSnapshot(url.searchParams.get('selectedId')), 200);
      return true;
    }

    if (pathname === '/api/operations/integrations/actions' && req.method === 'POST') {
      if (
        !deps.ensureAuthorized(
          req,
          res,
          'Integration Hub action allowed only locally or with a valid token.',
          403,
        )
      ) {
        return true;
      }

      try {
        const body = await deps.readJsonBody(req);
        const integrationId = String(body?.integrationId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        if (!integrationId || !actionId) {
          deps.writeJson(res, { ok: false, error: 'integrationId e actionId sao requireds.' }, 400);
          return true;
        }

        const action = await deps.integrationHub.executeGuidedAction(integrationId, actionId, {
          requestedBy: 'zavorthControl',
          workspace: process.cwd(),
        });
        deps.writeJson(
          res,
          {
            ok: true,
            action,
            hub: deps.integrationHub.buildCatalogSnapshot(integrationId),
            accepted: action.status === 'started',
          },
          action.status === 'started' ? 202 : 200,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Failure ao run a action do Integration Hub.') },
          400,
        );
      }
      return true;
    }

    return false;
  }
}
