import type { OperationsReportOverviewReaders } from '../../../../observability/OperationsReportService.js';
import {
  ZavorthControlOperationsOverviewSnapshotService,
  type ZavorthControlOperationsOverviewSnapshotDeps,
} from './ZavorthControlOperationsOverviewSnapshotService.js';

export class ZavorthControlOperationsOverviewReaderBridgeService {
  constructor(
    private readonly getDeps: () => ZavorthControlOperationsOverviewSnapshotDeps,
    private readonly overviewSnapshots: ZavorthControlOperationsOverviewSnapshotService = new ZavorthControlOperationsOverviewSnapshotService(),
  ) {}

  public readOperationalOverviewSnapshot(): Promise<Record<string, unknown>> {
    return this.overviewSnapshots.readOperationalOverviewSnapshot(this.getDeps());
  }

  public readTrustOverviewSnapshot(): Promise<Record<string, unknown>> {
    return this.overviewSnapshots.readTrustOverviewSnapshot(this.getDeps());
  }

  public readProductOverviewSnapshot(): Promise<Record<string, unknown>> {
    return this.overviewSnapshots.readProductOverviewSnapshot(this.getDeps());
  }

  public readControlPlaneCatalogSnapshot(): Promise<Record<string, unknown>> {
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

