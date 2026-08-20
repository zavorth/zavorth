import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import type { ZavorthOperationalSatelliteDaily } from '../contracts/ZavorthOperationalRefinementContract.js';
import { ZavorthAppsSatelliteNodesService } from './ZavorthAppsSatelliteNodesService.js';
import { ZavorthWebRemoteApprovalCompanionService, ZavorthSatelliteApprovalCompanionService } from './ZavorthWebRemoteApprovalCompanionService.js';

export type ZavorthSatelliteApprovalDailyInput = {
  applyReceipt?: boolean;
  missionId?: string | null;
};

export type ZavorthSatelliteApprovalDailySnapshot = ZavorthOperationalSatelliteDaily & {
  generatedAt: string;
  receiptPath: string;
  companionStatus: string;
  nodeStatus: string;
};

type SatelliteDailyRuntime = {
  projectRoot?: string;
  now?: () => Date;
  companion?: Pick<ZavorthSatelliteApprovalCompanionService, 'buildSnapshot'>;
  nodes?: Pick<ZavorthAppsSatelliteNodesService, 'execute'>;
};

export class ZavorthSatelliteApprovalDailyService {
  private readonly projectRoot: string;
  private readonly now: () => Date;
  private readonly companion: Pick<ZavorthSatelliteApprovalCompanionService, 'buildSnapshot'>;
  private readonly nodes: Pick<ZavorthAppsSatelliteNodesService, 'execute'>;

  constructor(runtime: SatelliteDailyRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
    this.companion = runtime.companion || new ZavorthSatelliteApprovalCompanionService();
    this.nodes = runtime.nodes || new ZavorthAppsSatelliteNodesService({ cwd: this.projectRoot, now: this.now });
  }

  public buildSnapshot(input: ZavorthSatelliteApprovalDailyInput = {}): ZavorthSatelliteApprovalDailySnapshot {
    const generatedAt = this.now().toISOString();
    const companion = this.companion.buildSnapshot({
      missionId: input.missionId || 'daily-approval-check',
      user: 'local-operator',
    });
    const nodes = this.nodes.execute({
      action: 'push.plan',
      nodeKind: 'mobile-companion',
      workspace: this.projectRoot,
      actorId: 'operator',
    });
    const snapshot: ZavorthSatelliteApprovalDailySnapshot = {
      generatedAt,
      status: companion.summary.pending > 0 ? 'ready' : 'partial',
      route: '/satellite',
      approvalCards: companion.summary.totalCards,
      offlineQueueSupported: companion.transport.offlineQueueSupported === true && nodes.offlineQueue.available === true,
      pushPlanReady: nodes.push.status === 'ready' || nodes.push.status === 'needs-configuration' || nodes.push.status === 'approval-required',
      pairingPreviewReady: nodes.pairing.status === 'preview' || nodes.pairing.status === 'materialized',
      executionAuthority: false,
      nextAction: companion.nextAction,
      receiptPath: this.receiptPath(),
      companionStatus: companion.status,
      nodeStatus: nodes.status,
    };

    if (input.applyReceipt === true) {
      this.appendReceipt(snapshot);
    }

    return snapshot;
  }

  public renderText(snapshot: ZavorthSatelliteApprovalDailySnapshot): string {
    return [
      '[zavorth-satellite-approvals]',
      `status=${snapshot.status} route=${snapshot.route} cards=${snapshot.approvalCards}`,
      `offlineQueue=${snapshot.offlineQueueSupported ? 'yes' : 'no'} pushPlan=${snapshot.pushPlanReady ? 'yes' : 'no'} pairing=${snapshot.pairingPreviewReady ? 'yes' : 'no'}`,
      `receipt=${snapshot.receiptPath}`,
      `next=${snapshot.nextAction}`,
      '',
    ].join('\n');
  }

  private appendReceipt(snapshot: ZavorthSatelliteApprovalDailySnapshot): void {
    fs.mkdirSync(path.dirname(snapshot.receiptPath), { recursive: true });
    fs.appendFileSync(snapshot.receiptPath, `${JSON.stringify({
      id: `satellite-approval-${Date.parse(snapshot.generatedAt) || Date.now()}`,
      kind: 'satellite-approval-daily',
      createdAt: snapshot.generatedAt,
      status: snapshot.status,
      approvalCards: snapshot.approvalCards,
      offlineQueueSupported: snapshot.offlineQueueSupported,
      executionAuthority: false,
      rawSecretsSerialized: false,
    })}\n`, 'utf8');
  }

  private receiptPath(): string {
    return path.join(this.projectRoot, '.zavorth', 'receipts', 'satellite-approvals.jsonl');
  }
}
