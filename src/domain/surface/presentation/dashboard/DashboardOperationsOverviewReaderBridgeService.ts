import type { OperationsReportOverviewReaders } from '../../../../observability/OperationsReportService.js';
import {
  DashboardOperationsOverviewSnapshotService,
  type DashboardOperationsOverviewSnapshotDeps,
} from './DashboardOperationsOverviewSnapshotService.js';

export class DashboardOperationsOverviewReaderBridgeService {
  constructor(
    private readonly getDeps: () => DashboardOperationsOverviewSnapshotDeps,
    private readonly overviewSnapshots: DashboardOperationsOverviewSnapshotService = new DashboardOperationsOverviewSnapshotService(),
  ) {}

  public readOperationalOverviewSnapshot(): Promise<Record<string, any>> {
    return this.overviewSnapshots.readOperationalOverviewSnapshot(this.getDeps());
  }

  public readTrustOverviewSnapshot(): Promise<Record<string, any>> {
    return this.overviewSnapshots.readTrustOverviewSnapshot(this.getDeps());
  }

  public readProductOverviewSnapshot(): Promise<Record<string, any>> {
    return this.overviewSnapshots.readProductOverviewSnapshot(this.getDeps());
  }

  public readControlPlaneCatalogSnapshot(): Promise<Record<string, any>> {
    return this.overviewSnapshots.readControlPlaneCatalogSnapshot(this.getDeps());
  }

  public buildReaders(): OperationsReportOverviewReaders {
    return {
      readOperationalOverviewSnapshot: this.readOperationalOverviewSnapshot.bind(this),
      readTrustOverviewSnapshot: this.readTrustOverviewSnapshot.bind(this),
      readProductOverviewSnapshot: this.readProductOverviewSnapshot.bind(this),
    };
  }
}

