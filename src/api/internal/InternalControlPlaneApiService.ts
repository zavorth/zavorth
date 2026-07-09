import {
  createBoundaryCorrelation,
  createBoundaryError,
  type ActionRequest,
  type ActionResult,
  type SnapshotRequest,
  type SnapshotResult,
} from '../../contracts/InternalBoundaryContract.js';
import { asErrorLike } from '../../utils/errorLike.js';

export type InternalControlPlaneDescriptor = {
  id: string;
  label: string;
  buildSnapshot: (request: SnapshotRequest) => unknown | Promise<unknown>;
  renderReport?: (request: SnapshotRequest) => string | Promise<string>;
  executeAction?: (request: ActionRequest) => ControlPlaneActionExecution | Promise<ControlPlaneActionExecution>;
};

export type ControlPlaneActionExecution = {
  ok?: boolean;
  status?: 'ok' | 'blocked' | 'error';
  summary: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
};

type InternalControlPlaneApiDeps = {
  planes?: InternalControlPlaneDescriptor[];
};

export class InternalControlPlaneApiService {
  private readonly planes = new Map<string, InternalControlPlaneDescriptor>();

  constructor(deps: InternalControlPlaneApiDeps = {}) {
    for (const plane of deps.planes || []) {
      this.registerPlane(plane);
    }
  }

  public registerPlane(plane: InternalControlPlaneDescriptor): void {
    this.planes.set(plane.id, plane);
  }

  public listPlanes(): Array<{ id: string; label: string }> {
    return Array.from(this.planes.values()).map((plane) => ({
      id: plane.id,
      label: plane.label,
    }));
  }

  public async readSnapshot<TData = unknown>(request: SnapshotRequest): Promise<SnapshotResult<TData>> {
    const correlation = createBoundaryCorrelation(request.correlation);
    const plane = this.planes.get(request.planeId);
    if (!plane) {
      return {
        ok: false,
        planeId: request.planeId,
        status: 'error',
        summary: `Control plane "${request.planeId}" is not registered.`,
        data: null,
        correlation,
        error: createBoundaryError(
          'capability_unavailable',
          `Control plane "${request.planeId}" is not registered.`,
        ),
        metadata: {
          registeredPlanes: this.listPlanes().map((entry) => entry.id),
        },
      };
    }

    try {
      const data = await plane.buildSnapshot(request);
      return {
        ok: true,
        planeId: request.planeId,
        status: 'ok',
        summary: `Snapshot for "${plane.label}" generated successfully.`,
        data: data as TData,
        correlation,
        error: null,
        metadata: {
          label: plane.label,
        },
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        ok: false,
        planeId: request.planeId,
        status: 'error',
        summary: message,
        data: null,
        correlation,
        error: createBoundaryError('execution_failed', message, [], true),
        metadata: {
          label: plane.label,
        },
      };
    }
  }

  public async executeAction<TData = unknown>(request: ActionRequest): Promise<ActionResult<TData>> {
    const correlation = createBoundaryCorrelation(request.correlation);
    const plane = this.planes.get(request.planeId);
    if (!plane) {
      return {
        ok: false,
        planeId: request.planeId,
        actionId: request.actionId,
        status: 'error',
        summary: `Control plane "${request.planeId}" is not registered.`,
        data: null,
        correlation,
        error: createBoundaryError(
          'capability_unavailable',
          `Control plane "${request.planeId}" is not registered.`,
        ),
        metadata: {},
      };
    }
    if (!plane.executeAction) {
      return {
        ok: false,
        planeId: request.planeId,
        actionId: request.actionId,
        status: 'blocked',
        summary: `Control plane "${plane.label}" does not expose mutable actions yet.`,
        data: null,
        correlation,
        error: createBoundaryError(
          'policy_blocked',
          `Control plane "${plane.label}" does not expose mutable actions yet.`,
        ),
        metadata: {
          label: plane.label,
        },
      };
    }

    try {
      const result = await plane.executeAction(request);
      return {
        ok: result.ok !== false,
        planeId: request.planeId,
        actionId: request.actionId,
        status: result.status || 'ok',
        summary: result.summary,
        data: (result.data ?? null) as TData | null,
        correlation,
        error: result.ok === false
          ? createBoundaryError('execution_failed', result.summary, [], true)
          : null,
        metadata: {
          label: plane.label,
          ...(result.metadata || {}),
        },
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      return {
        ok: false,
        planeId: request.planeId,
        actionId: request.actionId,
        status: 'error',
        summary: message,
        data: null,
        correlation,
        error: createBoundaryError('execution_failed', message, [], true),
        metadata: {
          label: plane.label,
        },
      };
    }
  }

  public async renderReport(request: SnapshotRequest): Promise<string | null> {
    const plane = this.planes.get(request.planeId);
    if (!plane || !plane.renderReport) {
      return null;
    }
    return plane.renderReport(request);
  }
}
