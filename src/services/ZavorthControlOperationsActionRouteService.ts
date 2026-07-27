
import * as http from 'http';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';
type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, any>>;
type EnsureAuthorized = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  errorMessage: string,
  statusCode: number,
) => boolean;

type OperationsActionExecutor = {
  execute: (actionId: string) => any;
};

export type ZavorthControlOperationsActionRouteDeps = {
  operationsActions: OperationsActionExecutor;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
  ensureAuthorized: EnsureAuthorized;
};

export class ZavorthControlOperationsActionRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    deps: ZavorthControlOperationsActionRouteDeps,
  ): Promise<boolean> {
    if (pathname !== '/api/operations/actions' || req.method !== 'POST') {
      return false;
    }

    if (
      !deps.ensureAuthorized(
        req,
        res,
        'Operational action allowed only locally or with a valid token.',
        403,
      )
    ) {
      return true;
    }

    const body = await deps.readJsonBody(req);
    const actionId = String(body?.actionId || '').trim();
    if (!actionId) {
      deps.writeJson(res, { ok: false, error: 'actionId required.' }, 400);
      return true;
    }

    try {
      const execution = deps.operationsActions.execute(actionId);
      deps.writeJson(
        res,
        {
          ok: true,
          action: execution,
          accepted: execution.status === 'started',
        },
        execution.status === 'started' ? 202 : 500,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      deps.writeJson(res, { ok: false, error: errorMessage(error) }, 400);
    }

    return true;
  }
}
