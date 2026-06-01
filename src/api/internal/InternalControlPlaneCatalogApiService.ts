import type { SnapshotRequest } from '../../contracts/InternalBoundaryContract.js';
import {
  ZavorthControlPlaneCatalogService,
  type ZavorthControlPlaneCatalogSnapshot,
} from '../../domain/observability/infrastructure/control-plane/ZavorthControlPlaneCatalogService.js';
import type { ZavorthOperationalOverviewService } from '../../services/ZavorthOperationalOverviewService.js';
import type { ZavorthTrustOverviewService } from '../../services/ZavorthTrustOverviewService.js';
import type { ZavorthProductOverviewService } from '../../services/ZavorthProductOverviewService.js';

type OperationalOverviewLike = Pick<ZavorthOperationalOverviewService, 'buildSnapshot'>;
type TrustOverviewLike = Pick<ZavorthTrustOverviewService, 'buildSnapshot'>;
type ProductOverviewLike = Pick<ZavorthProductOverviewService, 'buildSnapshot'>;

type InternalControlPlaneCatalogApiDeps = {
  workspaceRoot: string;
  operationalOverviewService: OperationalOverviewLike;
  trustOverviewService: TrustOverviewLike;
  productOverviewService: ProductOverviewLike;
};

export class InternalControlPlaneCatalogApiService {
  constructor(private readonly deps: InternalControlPlaneCatalogApiDeps) {}

  public readSnapshot(request: SnapshotRequest): Promise<ZavorthControlPlaneCatalogSnapshot> {
    const catalog = new ZavorthControlPlaneCatalogService({
      workspaceRoot: this.deps.workspaceRoot,
      operationalOverviewService: this.deps.operationalOverviewService,
      trustOverviewService: this.deps.trustOverviewService,
      productOverviewService: this.deps.productOverviewService,
    });
    return catalog.buildSnapshot({
      sessionId: this.readText(request.query?.sessionId),
      chatId: this.readText(request.query?.chatId),
      userId: this.readText(request.query?.userId) || request.requestedBy,
      platform: this.readText(request.query?.platform) || request.surface,
      workspace: this.readText(request.query?.workspace) || this.deps.workspaceRoot,
      profile: this.readText(request.query?.profile) || request.profile || null,
      rolloutScope: this.readText(request.query?.rolloutScope),
      limit: this.readNumber(request.query?.limit, 8),
    });
  }

  private readText(value: unknown): string | null {
    const normalized = String(value || '').trim();
    return normalized || null;
  }

  private readNumber(value: unknown, fallback: number): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.max(1, Math.floor(numeric));
  }
}
