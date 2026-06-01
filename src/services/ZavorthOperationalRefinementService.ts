import fs from 'node:fs';
import path from 'node:path';

import { config } from '../config/index.js';
import {
  ZAVORTH_OPERATIONAL_REFINEMENT_CONTRACT_VERSION,
  type ZavorthOperationalA2UICanvas,
  type ZavorthOperationalRefinementEvidence,
  type ZavorthOperationalRefinementReceipt,
  type ZavorthOperationalRefinementSnapshot,
  type ZavorthOperationalRefinementStatus,
} from '../contracts/ZavorthOperationalRefinementContract.js';
import { ZavorthA2UIService } from './ZavorthA2UIService.js';
import { ZavorthMnemosUnifiedMemoryService } from './ZavorthMnemosUnifiedMemoryService.js';
import { ZavorthSatelliteApprovalDailyService } from './ZavorthSatelliteApprovalDailyService.js';
import { VoiceWakeDetectorSetupService } from './VoiceWakeDetectorSetupService.js';
import { SkillQuarantinePipelineService } from './SkillQuarantinePipelineService.js';

export type ZavorthOperationalRefinementInput = {
  applyMemory?: boolean;
  applySatelliteReceipt?: boolean;
  applyWakeSetup?: boolean;
  wakeChoice?: 'disabled' | 'default-local' | 'custom-command' | null;
  wakeCommand?: string | null;
  wakeArgs?: string[] | string | null;
  applySkillDraft?: boolean;
  promoteSkill?: boolean;
  approvalId?: string | null;
};

type OperationalRefinementRuntime = {
  projectRoot?: string;
  now?: () => Date;
};

export class ZavorthOperationalRefinementService {
  private readonly projectRoot: string;
  private readonly now: () => Date;

  constructor(runtime: OperationalRefinementRuntime = {}) {
    this.projectRoot = path.resolve(runtime.projectRoot || config.projectRoot || process.cwd());
    this.now = runtime.now || (() => new Date());
  }

  public async buildSnapshot(input: ZavorthOperationalRefinementInput = {}): Promise<ZavorthOperationalRefinementSnapshot> {
    const generatedAt = this.now().toISOString();
    const a2uiCanvas = await this.proveA2UI(generatedAt);
    const mnemosUnifiedMemory = new ZavorthMnemosUnifiedMemoryService({
      projectRoot: this.projectRoot,
      now: this.now,
    }).buildSnapshot({ apply: input.applyMemory === true });
    const satelliteApprovals = new ZavorthSatelliteApprovalDailyService({
      projectRoot: this.projectRoot,
      now: this.now,
    }).buildSnapshot({ applyReceipt: input.applySatelliteReceipt === true });
    const wakeDetectorSetup = new VoiceWakeDetectorSetupService({
      projectRoot: this.projectRoot,
    }).buildPlan({
      choice: input.wakeChoice || 'default-local',
      command: input.wakeCommand || undefined,
      args: input.wakeArgs || undefined,
      apply: input.applyWakeSetup === true,
    });
    const skillQuarantine = new SkillQuarantinePipelineService({
      projectRoot: this.projectRoot,
      now: this.now,
    }).buildSnapshot({
      skillId: 'learned-daily-procedure',
      title: 'Learned Daily Procedure',
      summary: 'A quarantined draft produced by the learning loop before sandbox and approval.',
      applyDraft: input.applySkillDraft === true,
      promote: input.promoteSkill === true,
      approvalId: input.approvalId,
    });

    const receipts: ZavorthOperationalRefinementReceipt[] = [
      receipt('a2ui-canvas', a2uiCanvas.status, 'A2UI/Z-Canvas snapshot, stream and action bridge are connected.', generatedAt),
      receipt('mnemos-unified-memory', mnemosUnifiedMemory.status, 'Mnemos can unify wiki, sessions, receipts, transactions and chat artifacts.', generatedAt),
      receipt('satellite-approval', satelliteApprovals.status, 'Satellite approval companion has cards, queue, pairing and push plan.', generatedAt),
      receipt('wake-detector-setup', wakeDetectorSetup.status, 'Wake detector setup can choose default local, custom command or disabled mode.', generatedAt),
      ...skillQuarantine.receipts,
    ];
    const statuses = [
      a2uiCanvas.status,
      mnemosUnifiedMemory.status,
      satelliteApprovals.status,
      wakeDetectorSetup.status,
      skillQuarantine.status,
    ];
    const summary = {
      ready: statuses.filter((status) => status === 'ready').length,
      partial: statuses.filter((status) => status === 'partial').length,
      attention: statuses.filter((status) => status === 'attention').length,
      blocked: statuses.filter((status) => status === 'blocked').length,
    };

    return {
      contractVersion: ZAVORTH_OPERATIONAL_REFINEMENT_CONTRACT_VERSION,
      generatedAt,
      status: summary.blocked > 0 ? 'blocked' : summary.attention > 0 ? 'attention' : summary.partial > 0 ? 'partial' : 'ready',
      summary,
      a2uiCanvas,
      mnemosUnifiedMemory,
      satelliteApprovals,
      wakeDetectorSetup,
      skillQuarantine,
      receipts,
      commands: {
        inspect: 'npm run zavorth:operational-refinement -- --json',
        applyMemory: 'npm run zavorth:operational-refinement -- --apply-memory --json',
        wakeSetup: 'zavorth echo wake setup --default-local --apply',
        skillDraft: 'zavorth skills quarantine draft learned-daily-procedure --apply',
        qa: 'npm run qa:zavorth-operational-refinement --silent',
      },
      safety: {
        noSilentMutation: true,
        secretsRedacted: true,
        approvalsForRiskyPromotion: true,
        a2uiCannotAccessHost: true,
        satelliteCannotExecuteActions: true,
      },
    };
  }

  public renderText(snapshot: ZavorthOperationalRefinementSnapshot): string {
    return [
      '[zavorth-operational-refinement]',
      `status=${snapshot.status} ready=${snapshot.summary.ready} partial=${snapshot.summary.partial} attention=${snapshot.summary.attention} blocked=${snapshot.summary.blocked}`,
      `a2ui=${snapshot.a2uiCanvas.status} actionBridge=${snapshot.a2uiCanvas.actionBridgeReady ? 'yes' : 'no'}`,
      `mnemos=${snapshot.mnemosUnifiedMemory.status} documents=${snapshot.mnemosUnifiedMemory.documentsIndexed}`,
      `satellite=${snapshot.satelliteApprovals.status} cards=${snapshot.satelliteApprovals.approvalCards}`,
      `wake=${snapshot.wakeDetectorSetup.status} selected=${snapshot.wakeDetectorSetup.selected}`,
      `skillQuarantine=${snapshot.skillQuarantine.status} draft=${snapshot.skillQuarantine.draftWritten ? 'yes' : 'no'}`,
      `qa=${snapshot.commands.qa}`,
      '',
    ].join('\n');
  }

  private async proveA2UI(generatedAt: string): Promise<ZavorthOperationalA2UICanvas> {
    const service = new ZavorthA2UIService({
      now: () => new Date(generatedAt),
    });
    const surfaceId = 'z-canvas.operational-refinement';
    service.beginRendering(surfaceId, {
      state: 'ready',
      purpose: 'risk simulation surface',
    }, {
      owner: 'Z-Canvas',
      isolation: 'transaction-plane',
    });
    service.updateSurface(surfaceId, [
      {
        type: 'panel',
        id: 'risk-preview',
        props: {
          title: 'Risk simulation',
          tone: 'operational',
        },
        children: [
          {
            type: 'text',
            id: 'risk-summary',
            props: {
              value: 'A2UI renders isolated previews and dispatches actions back to Zavorth.',
            },
          },
          {
            type: 'button',
            id: 'dispatch-preview',
            props: {
              label: 'Dispatch',
              actionId: 'transaction.preview',
            },
          },
        ],
      },
    ]);
    service.registerActionHandler(surfaceId, 'transaction.preview', () => ({
      acceptedBy: 'transaction-plane',
      mutationPerformed: false,
    }));
    const action = await service.dispatchAction({
      surfaceId,
      actionId: 'transaction.preview',
      requestedBy: 'operational-refinement-check',
      payload: { dryRun: true },
    });
    const snapshot = service.readSnapshot(surfaceId);
    const stream = service.readStream(surfaceId, 10);
    const routeReady = this.hasAllMarkers('src/services/ZavorthControlCoreRouteService.ts', [
      '/api/v2/a2ui/snapshot',
      '/api/v2/a2ui/action',
      '/api/v2/a2ui/stream',
    ]) || this.hasAllMarkers('src/services/DashboardCoreRouteService.ts', [
      '/api/v2/a2ui/snapshot',
      '/api/v2/a2ui/action',
      '/api/v2/a2ui/stream',
    ]);
    const dashboardHandlersReady = this.hasAllMarkers('apps/zavorth-control-vite-shell/src/runtime-engines-ui.ts', [
      'data-a2ui-refresh',
      'data-a2ui-action',
      '/api/v2/a2ui/action',
    ]);
    const evidenceItems: ZavorthOperationalRefinementEvidence[] = [
      evidence('snapshot', snapshot.surfaces.length > 0 ? 'ready' : 'blocked', `surfaces=${snapshot.surfaces.length}`),
      evidence('stream', stream.items.length >= 2 ? 'ready' : 'partial', `events=${stream.items.length}`),
      evidence('action', action.ok ? 'ready' : 'blocked', action.summary),
      evidence('routes', routeReady ? 'ready' : 'blocked', 'Dashboard core exposes /api/v2/a2ui routes.'),
      evidence('dashboard-handlers', dashboardHandlersReady ? 'ready' : 'blocked', 'Dashboard binds A2UI refresh, surface and action handlers.'),
    ];
    const status = evidenceItems.some((item) => item.status === 'blocked')
      ? 'blocked'
      : evidenceItems.some((item) => item.status === 'partial')
        ? 'partial'
        : 'ready';

    return {
      status,
      surfaceId,
      routeReady,
      dashboardHandlersReady,
      actionBridgeReady: action.ok,
      riskSimulationReady: snapshot.capabilities.includes('risk-simulation'),
      security: {
        hostAccess: snapshot.security.hostAccess,
        tokenAccess: snapshot.security.tokenAccess,
        filesystemAccess: snapshot.security.filesystemAccess,
        actionDispatch: snapshot.security.actionDispatch,
      },
      evidence: evidenceItems,
    };
  }

  private hasAllMarkers(relativeFile: string, markers: string[]): boolean {
    const file = path.resolve(this.projectRoot, relativeFile);
    if (!fs.existsSync(file)) return false;
    const body = fs.readFileSync(file, 'utf8');
    return markers.every((marker) => body.includes(marker));
  }
}

function evidence(
  id: string,
  status: ZavorthOperationalRefinementStatus,
  summary: string,
): ZavorthOperationalRefinementEvidence {
  return { id, status, summary };
}

function receipt(
  kind: ZavorthOperationalRefinementReceipt['kind'],
  status: ZavorthOperationalRefinementReceipt['status'],
  summary: string,
  createdAt: string,
): ZavorthOperationalRefinementReceipt {
  return {
    id: `${kind}-${createdAt.replace(/[^0-9]/g, '').slice(0, 14)}`,
    kind,
    status,
    summary,
    createdAt,
  };
}
