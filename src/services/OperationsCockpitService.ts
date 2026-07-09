import { Monitor } from '../monitoring/Monitor.js';
import { LogRepository } from '../storage/LogRepository.js';
import {
  OperationsHealthService,
  type OperationsHealthSnapshot,
} from '../observability/OperationsHealthService.js';
import { OperationsCockpitSnapshotComposer } from '../domain/observability/infrastructure/operations-cockpit/OperationsCockpitSnapshotComposer.js';

import type {
  OperationsCockpitRuntime,
  OperationsCockpitSnapshot,
  RuntimeStats,
} from '../domain/observability/infrastructure/operations-cockpit/OperationsCockpitTypes.js';

export type {
  CockpitAction,
  CockpitAlert,
  CockpitStatus,
  OperationsCockpitRuntime,
  OperationsCockpitSnapshot,
  RuntimeStats,
} from '../domain/observability/infrastructure/operations-cockpit/OperationsCockpitTypes.js';

export class OperationsCockpitService {
  private readonly now: () => Date;
  private readonly statsProvider: () => RuntimeStats;
  private readonly operationsHealth: OperationsHealthService;
  private readonly composer: OperationsCockpitSnapshotComposer;

  constructor(
    private readonly logRepo: LogRepository,
    deps: {
      operationsHealthService?: OperationsHealthService;
    } = {},
    runtime: OperationsCockpitRuntime = {},
  ) {
    this.now = runtime.now || (() => new Date());
    this.statsProvider =
      runtime.statsProvider ||
      (() => new Monitor(this.logRepo).getHealthStats() as RuntimeStats);
    this.operationsHealth = deps.operationsHealthService || new OperationsHealthService(this.logRepo);
    this.composer = new OperationsCockpitSnapshotComposer({ now: this.now });
  }

  public readSnapshot(): OperationsCockpitSnapshot {
    return this.readSnapshotLive();
  }

  public readSnapshotFast(): OperationsCockpitSnapshot {
    const operations =
      typeof this.operationsHealth.readSnapshotFast === 'function'
        ? this.operationsHealth.readSnapshotFast()
        : this.operationsHealth.readSnapshot();
    return this.composeSnapshot(operations);
  }

  public readSnapshotLive(): OperationsCockpitSnapshot {
    const operations =
      typeof this.operationsHealth.readSnapshotLive === 'function'
        ? this.operationsHealth.readSnapshotLive()
        : this.operationsHealth.readSnapshot();
    return this.composeSnapshot(operations);
  }

  private composeSnapshot(operations: OperationsHealthSnapshot): OperationsCockpitSnapshot {
    return this.composer.composeSnapshot(operations, this.statsProvider());
  }
}
