import * as http from 'http';
type OperationsSnapshotDynamic = any;

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

type SnapshotReader = {
  readSnapshot: () => OperationsSnapshotDynamic;
};

type SnapshotBuilder = {
  buildSnapshot: (input?: OperationsSnapshotDynamic) => OperationsSnapshotDynamic;
};

type AsyncSnapshotBuilder = {
  buildSnapshot: (input?: OperationsSnapshotDynamic) => Promise<OperationsSnapshotDynamic>;
};

type OperationsReportBuilder = {
  buildSnapshot: (
    referenceDate?: Date,
    overviewReaders?: {
      readOperationalOverviewSnapshot?: () => Promise<Record<string, OperationsSnapshotDynamic>>;
      readTrustOverviewSnapshot?: () => Promise<Record<string, OperationsSnapshotDynamic>>;
      readProductOverviewSnapshot?: () => Promise<Record<string, OperationsSnapshotDynamic>>;
    },
  ) => Promise<OperationsSnapshotDynamic>;
};

type ManifestBuilder = {
  buildManifest: () => Promise<OperationsSnapshotDynamic>;
};

export type ZavorthControlOperationsSnapshotRouteDeps = {
  operationsHealth: SnapshotReader;
  operationsCockpit: SnapshotReader;
  operatorBrief: SnapshotReader;
  productObservability: AsyncSnapshotBuilder;
  accessManifest: ManifestBuilder;
  capabilityCatalog: SnapshotBuilder;
  hookPlane: SnapshotBuilder;
  runtimeModes: SnapshotBuilder;
  securityMesh: SnapshotBuilder;
  teamCatalog: SnapshotBuilder;
  operationsReport: OperationsReportBuilder;
  readOperationsOverviewSnapshot: () => Promise<Record<string, OperationsSnapshotDynamic>>;
  readOperationsTrustOverviewSnapshot: () => Promise<Record<string, OperationsSnapshotDynamic>>;
  readOperationsProductOverviewSnapshot: () => Promise<Record<string, OperationsSnapshotDynamic>>;
  readOperationsControlPlaneCatalogSnapshot: () => Promise<Record<string, OperationsSnapshotDynamic>>;
  readOperationsContinuitySnapshot: () => Record<string, OperationsSnapshotDynamic>;
  readOperationsMemoryPlaneSnapshot: () => Promise<Record<string, OperationsSnapshotDynamic>>;
  readOperationsReplaySnapshot: () => Record<string, OperationsSnapshotDynamic>;
  readOperationsLifecycleSnapshot: () => Record<string, OperationsSnapshotDynamic>;
  readOperationsHandoffSnapshot: () => Record<string, OperationsSnapshotDynamic>;
  writeJson: WriteJson;
};

export class ZavorthControlOperationsSnapshotRouteService {
  public async handleRequest(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: ZavorthControlOperationsSnapshotRouteDeps,
  ): Promise<boolean> {
    if (pathname === '/api/operations/health') {
      deps.writeJson(res, deps.operationsHealth.readSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/cockpit') {
      deps.writeJson(res, deps.operationsCockpit.readSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/brief') {
      deps.writeJson(res, deps.operatorBrief.readSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/product-observability') {
      deps.writeJson(res, await deps.productObservability.buildSnapshot(this.resolveProductObservabilityInput(url)), 200);
      return true;
    }

    if (pathname === '/api/operations/access-manifest') {
      deps.writeJson(res, await deps.accessManifest.buildManifest(), 200);
      return true;
    }

    if (pathname === '/api/operations/overview') {
      deps.writeJson(res, await deps.readOperationsOverviewSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/trust-overview') {
      deps.writeJson(res, await deps.readOperationsTrustOverviewSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/product-overview') {
      deps.writeJson(res, await deps.readOperationsProductOverviewSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/control-plane-catalog') {
      deps.writeJson(res, await deps.readOperationsControlPlaneCatalogSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/continuity') {
      deps.writeJson(res, deps.readOperationsContinuitySnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/memory-plane') {
      deps.writeJson(res, await deps.readOperationsMemoryPlaneSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/replay') {
      deps.writeJson(res, deps.readOperationsReplaySnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/lifecycle') {
      deps.writeJson(res, deps.readOperationsLifecycleSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/handoff') {
      deps.writeJson(res, deps.readOperationsHandoffSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/capabilities') {
      deps.writeJson(res, deps.capabilityCatalog.buildSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/hooks') {
      deps.writeJson(res, deps.hookPlane.buildSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/runtime-modes') {
      deps.writeJson(res, deps.runtimeModes.buildSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/security-mesh') {
      deps.writeJson(res, deps.securityMesh.buildSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/teams') {
      deps.writeJson(res, deps.teamCatalog.buildSnapshot(), 200);
      return true;
    }

    if (pathname === '/api/operations/report') {
      deps.writeJson(
        res,
        await deps.operationsReport.buildSnapshot(undefined, {
          readOperationalOverviewSnapshot: deps.readOperationsOverviewSnapshot,
          readTrustOverviewSnapshot: deps.readOperationsTrustOverviewSnapshot,
          readProductOverviewSnapshot: deps.readOperationsProductOverviewSnapshot,
        }),
        200,
      );
      return true;
    }

    return false;
  }

  private resolveProductObservabilityInput(url: URL): {
    workspace: string | null;
    sourceSurface: string | null;
    executor: string | null;
    workflow: string | null;
  } {
    return {
      workspace: String(url.searchParams.get('workspace') || '').trim() || null,
      sourceSurface:
        String(url.searchParams.get('surface') || url.searchParams.get('sourceSurface') || '').trim() || null,
      executor: String(url.searchParams.get('executor') || '').trim() || null,
      workflow: String(url.searchParams.get('workflow') || '').trim() || null,
    };
  }
}
