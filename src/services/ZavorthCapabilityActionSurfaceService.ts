import {
  ZAVORTH_CAPABILITY_ACTION_SURFACE_CONTRACT_VERSION,
  type ZavorthCapabilityActionSurfaceSnapshot,
} from '../contracts/ZavorthCapabilityActionSurfaceContract.js';
import { ZavorthCapabilityActionExposureService } from './ZavorthCapabilityActionExposureService.js';

type Runtime = {
  projectRoot?: string;
  env?: Record<string, string | undefined>;
  now?: () => Date;
  exposures?: Pick<ZavorthCapabilityActionExposureService, 'snapshot'>;
};

export class ZavorthCapabilityActionSurfaceService {
  private readonly now: () => Date;
  private readonly exposures: Pick<ZavorthCapabilityActionExposureService, 'snapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.exposures = runtime.exposures || new ZavorthCapabilityActionExposureService({
      projectRoot: runtime.projectRoot,
      env: runtime.env,
      now: this.now,
    });
  }

  public buildSnapshot(): ZavorthCapabilityActionSurfaceSnapshot {
    const exposures = this.exposures.snapshot();
    const items = exposures.exposures
      .filter((entry) => entry.status === 'exposed')
      .map((entry) => ({
        id: entry.id,
        actionId: entry.actionId,
        title: entry.title,
        status: 'available' as const,
        verificationId: entry.verificationId,
        detail: 'Verified adapter available through the Action Harness. Preview and owner approval remain required before any live activation.',
        previewCommand: `zavorth actions preview ${entry.actionId}`,
        receiptsCommand: `zavorth actions receipts --action ${entry.actionId}`,
        nextSafeAction: entry.nextSafeAction,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
    const receipts = exposures.receipts.slice(-12);
    const status = exposures.summary.blocked > 0
      ? 'attention'
      : items.length > 0
        ? 'ready'
        : 'available';

    return {
      contractVersion: ZAVORTH_CAPABILITY_ACTION_SURFACE_CONTRACT_VERSION,
      generatedAt: this.now().toISOString(),
      surface: 'capability-action-surface',
      status,
      summary: {
        exposed: items.length,
        blocked: exposures.summary.blocked,
        receipts: exposures.summary.receipts,
        visibleSurfaces: 3,
      },
      items,
      receipts,
      placement: {
        dashboard: {
          visible: true,
          sectionId: 'operations-capabilities',
          apiPath: '/api/operations/capabilities',
        },
        tui: {
          visible: true,
          panelTitle: 'Capability actions',
        },
        setup: {
          visible: true,
          sectionTitle: 'Capability actions',
        },
      },
      commands: {
        status: 'npm run zavorth:capability-action-surface --silent -- --list',
        preview: 'zavorth actions preview <action-id>',
        receipts: 'zavorth actions receipts --action <action-id>',
        nextStage: 'Publish clear public usage documentation for verified capabilities.',
      },
      safety: {
        readOnlyProjection: true,
        verifiedAdaptersOnly: true,
        previewRequired: true,
        approvalRequired: true,
        noToolExecution: true,
        noLiveActivation: true,
        secretsRedacted: true,
      },
    };
  }

  public renderText(snapshot = this.buildSnapshot()): string {
    const lines = [
      'Zavorth Capability Actions',
      '',
      `status=${snapshot.status}`,
      `exposed=${snapshot.summary.exposed} blocked=${snapshot.summary.blocked} receipts=${snapshot.summary.receipts}`,
      '',
      'Available through Action Harness:',
    ];
    if (snapshot.items.length === 0) lines.push('- none yet');
    for (const item of snapshot.items) {
      lines.push(`- ${item.actionId} [${item.status}] ${item.title}`);
      lines.push(`  preview=${item.previewCommand}`);
    }
    lines.push('', 'Safety: read-only projection; preview and owner approval remain required before live activation.');
    return lines.join('\n');
  }
}
