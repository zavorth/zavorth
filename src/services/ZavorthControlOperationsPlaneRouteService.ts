import * as http from 'http';
import { errorMessage } from '../utils/errorLike.js';
type OperationsPlaneDynamic = any;

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<Record<string, OperationsPlaneDynamic>>;

type SnapshotBuilder = {
  buildSnapshot: (input?: OperationsPlaneDynamic) => OperationsPlaneDynamic;
};

type AsyncActionExecutor = {
  execute: (input: OperationsPlaneDynamic) => Promise<OperationsPlaneDynamic>;
};

type PlatformCatalogSyncLike = {
  sync: () => Promise<OperationsPlaneDynamic>;
};

type PlatformPublisherLike = {
  publishDetailed: (input: {
    packagePath: string;
    authToken: string;
    signLocal: boolean;
  }) => Promise<OperationsPlaneDynamic>;
};

type WorkspaceExtensionRegistryLike = {
  buildSnapshot: (input?: OperationsPlaneDynamic) => OperationsPlaneDynamic;
};

type HookPipelineLike = {
  buildSnapshot: (workspaceHint?: string | null) => Promise<OperationsPlaneDynamic>;
  buildExecutionPlan: (input: { workspace: string; event: string }) => Promise<OperationsPlaneDynamic[]>;
  runEvent: (input: { workspace: string; event: string; dryRun?: boolean }) => Promise<OperationsPlaneDynamic>;
};

type RemoteTransportDoctorLike = {
  run: (input?: { selectedId?: string | null }) => Promise<OperationsPlaneDynamic>;
  readLastReport?: (input?: { selectedId?: string | null }) => OperationsPlaneDynamic;
};

type RemoteTransportActionPlaneLike = {
  execute: (input: {
    transportId: string;
    actionId: string;
    requestedBy?: string | null;
    workspace?: string | null;
  }) => Promise<OperationsPlaneDynamic>;
  readHistory?: (input?: {
    transportId?: string | null;
    limit?: number | null;
  }) => OperationsPlaneDynamic;
};

type MaybeAsyncActionExecutor = {
  execute: (input: OperationsPlaneDynamic) => OperationsPlaneDynamic | Promise<OperationsPlaneDynamic>;
};

export type ZavorthControlOperationsPlaneRouteDeps = {
  remoteTransports: SnapshotBuilder;
  remoteTransportActions: RemoteTransportActionPlaneLike;
  remoteTransportDoctor: RemoteTransportDoctorLike;
  pluginRegistry: SnapshotBuilder;
  pluginActions: AsyncActionExecutor;
  platformRegistry: SnapshotBuilder;
  platformActions: AsyncActionExecutor;
  platformCatalogSync: PlatformCatalogSyncLike;
  platformPublisher: PlatformPublisherLike;
  hookPlane: SnapshotBuilder;
  hookPipeline: HookPipelineLike;
  workspaceExtensions: WorkspaceExtensionRegistryLike;
  channelMesh: SnapshotBuilder;
  channelActions: MaybeAsyncActionExecutor;
  workspaceRoot: string;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
};

export class ZavorthControlOperationsPlaneRouteService {
  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlOperationsPlaneRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/operations/transports') {
      deps.writeJson(
        res,
        deps.remoteTransports.buildSnapshot({
          selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/transports/actions' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const transportId = String(body?.transportId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.remoteTransportActions.execute({
          transportId,
          actionId,
          requestedBy: 'zavorthControl',
        });
        deps.writeJson(
          res,
          {
            ok: true,
            result,
            transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
          },
          200,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao executar a acao do plano remoto.') },
          400,
        );
      }
      return true;
    }

    if (pathname.startsWith('/api/operations/transports/') && req.method === 'GET') {
      const transportId = this.extractTransportId(pathname);
      const operation = this.extractTransportOperation(pathname);
      if (!transportId || operation !== 'history') {
        return false;
      }
      deps.writeJson(
        res,
        {
          transport: deps.remoteTransports.buildSnapshot({ selectedId: transportId }).selected,
          transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
          history: deps.remoteTransportActions.readHistory
            ? deps.remoteTransportActions.readHistory({ transportId, limit: 10 })
            : null,
          doctor: deps.remoteTransportDoctor.readLastReport
            ? deps.remoteTransportDoctor.readLastReport({ selectedId: transportId })
            : null,
        },
        200,
      );
      return true;
    }

    if (pathname.startsWith('/api/operations/transports/') && req.method === 'POST') {
      const transportId = this.extractTransportId(pathname);
      const operation = this.extractTransportOperation(pathname);
      if (!transportId || !operation || !['doctor', 'recover'].includes(operation)) {
        return false;
      }

      if (operation === 'doctor') {
        try {
          const report = await deps.remoteTransportDoctor.run({ selectedId: transportId });
          deps.writeJson(
            res,
            {
              ok: report.status !== 'failed',
              report,
              transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
            },
            report.status === 'failed' ? 409 : 200,
          );
        } catch (error: unknown) {deps.writeJson(
            res,
            { ok: false, error: errorMessage(error, 'Falha ao rodar o doctor remoto.') },
            400,
          );
        }
        return true;
      }

      try {
        const result = await deps.remoteTransportActions.execute({
          transportId,
          actionId: 'repair',
          requestedBy: 'zavorthControl',
          workspace: deps.workspaceRoot,
        });
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            transports: deps.remoteTransports.buildSnapshot({ selectedId: transportId }),
            history: deps.remoteTransportActions.readHistory
              ? deps.remoteTransportActions.readHistory({ transportId, limit: 10 })
              : null,
          },
          result.ok ? 200 : 409,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao recuperar o transporte remoto.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/plugins') {
      deps.writeJson(
        res,
        deps.pluginRegistry.buildSnapshot({
          selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
          query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/plugins/actions' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const pluginId = String(body?.pluginId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.pluginActions.execute({
          pluginId,
          actionId,
          requestedBy: 'zavorthControl',
        });
        deps.writeJson(
          res,
          {
            ok: true,
            result,
            plugins: deps.pluginRegistry.buildSnapshot({ selectedId: pluginId }),
          },
          200,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao executar a acao do plugin plane.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/platform') {
      deps.writeJson(
        res,
        deps.platformRegistry.buildSnapshot({
          selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
          query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/platform/actions' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const entryId = String(body?.entryId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.platformActions.execute({
          entryId,
          actionId,
          requestedBy: 'zavorthControl',
        });
        deps.writeJson(
          res,
          {
            ok: true,
            result,
            platform: result.snapshot || deps.platformRegistry.buildSnapshot({ selectedId: entryId }),
            plugins: entryId.toLowerCase().startsWith('plugin:')
              ? deps.pluginRegistry.buildSnapshot({ selectedId: entryId.replace(/^plugin:/i, '') })
              : null,
          },
          200,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao executar a acao do platform plane.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/platform/sync' && req.method === 'POST') {
      try {
        const result = await deps.platformCatalogSync.sync();
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            platform: deps.platformRegistry.buildSnapshot(),
          },
          result.ok ? 200 : 400,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao sincronizar o platform plane.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/platform/publish' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const packagePath = String(body?.packagePath || '').trim();
        const authToken = String(body?.authToken || process.env.ZAVORTH_PLATFORM_PUBLISH_TOKEN || '').trim();
        const signLocal = body?.signLocal !== false;
        if (!packagePath) {
          deps.writeJson(res, { ok: false, error: 'packagePath obrigatorio.' }, 400);
          return true;
        }

        const result = await deps.platformPublisher.publishDetailed({
          packagePath,
          authToken,
          signLocal,
        });
        deps.writeJson(
          res,
          {
            ok: result.ok,
            result,
            platform: deps.platformRegistry.buildSnapshot(),
          },
          result.ok ? 200 : 400,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao publicar no platform plane.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/workspace/extensions') {
      deps.writeJson(
        res,
        deps.workspaceExtensions.buildSnapshot({
          selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
          query: String(url.searchParams.get('q') || url.searchParams.get('query') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/hooks/run' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const event = String(body?.event || '').trim();
        const workspace = String(body?.workspace || '').trim() || deps.workspaceRoot;
        const dryRun = body?.dryRun !== false;
        if (!event) {
          deps.writeJson(res, { ok: false, error: 'event obrigatorio.' }, 400);
          return true;
        }

        const [plan, run, pipeline] = await Promise.all([
          deps.hookPipeline.buildExecutionPlan({ workspace, event }),
          deps.hookPipeline.runEvent({ workspace, event, dryRun }),
          deps.hookPipeline.buildSnapshot(workspace),
        ]);
        deps.writeJson(
          res,
          {
            ok: run.ok,
            event,
            workspace,
            dryRun,
            plan,
            run,
            pipeline,
            hooks: deps.hookPlane.buildSnapshot(),
          },
          run.ok ? 200 : 409,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao executar o hook plane.') },
          400,
        );
      }
      return true;
    }

    if (pathname === '/api/operations/channels') {
      deps.writeJson(
        res,
        deps.channelMesh.buildSnapshot({
          selectedId: String(url.searchParams.get('selectedId') || '').trim() || null,
        }),
        200,
      );
      return true;
    }

    if (pathname === '/api/operations/channels/actions' && req.method === 'POST') {
      try {
        const body = await deps.readJsonBody(req);
        const channelId = String(body?.channelId || '').trim();
        const actionId = String(body?.actionId || '').trim();
        const result = await deps.channelActions.execute({
          channelId,
          actionId,
          requestedBy: 'zavorthControl',
        });
        deps.writeJson(
          res,
          {
            ok: true,
            result,
            channels: deps.channelMesh.buildSnapshot({ selectedId: channelId }),
          },
          200,
        );
      } catch (error: unknown) {deps.writeJson(
          res,
          { ok: false, error: errorMessage(error, 'Falha ao executar a acao do Channel Mesh.') },
          400,
        );
      }
      return true;
    }

    return false;
  }

  private extractTransportId(pathname: string): string | null {
    const prefix = '/api/operations/transports/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const [transportId] = suffix.split('/');
    const normalized = String(transportId || '').trim().toLowerCase();
    return normalized || null;
  }

  private extractTransportOperation(pathname: string): 'history' | 'doctor' | 'recover' | null {
    const prefix = '/api/operations/transports/';
    if (!pathname.startsWith(prefix)) {
      return null;
    }
    const suffix = pathname.slice(prefix.length);
    const parts = suffix.split('/').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }
    if (parts[1] === 'history' || parts[1] === 'doctor' || parts[1] === 'recover') {
      return parts[1];
    }
    return null;
  }
}
