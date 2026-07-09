import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { ZavorthBridgeAppLauncherService, type ZavorthBridgeAppLaunchResult } from './ZavorthBridgeAppLauncherService.js';
import {
  ZavorthBridgeRemoteNativeService,
  type ZavorthBridgeRemoteNativeStatus,
} from './ZavorthBridgeRemoteNativeService.js';
import {
  TerminalSidecarService,
  type TerminalSidecarSnapshot,
} from './TerminalSidecarService.js';
import { RemoteModeManager, type RemoteModeResult } from './RemoteModeManager.js';
import { ZavorthBridgeRemoteDoctorHistoryService } from './ZavorthBridgeRemoteDoctorHistoryService.js';
import {
  ZavorthBridgeRemoteIncidentService,
  type ZavorthBridgeRemoteIncidentSummary,
} from './ZavorthBridgeRemoteIncidentService.js';
import type { ZavorthBridgeRemoteDoctorRepairPolicy } from './ZavorthBridgeRemoteDoctorHistoryService.js';
import { logger } from '../logger.js';
import {
ZavorthBridgeRemotePlaybookService,
  type ZavorthBridgeRemotePlaybook,
} from './ZavorthBridgeRemotePlaybookService.js';

export type ZavorthBridgeRemoteDoctorActionKey =
  | 'launch-zavorth-bridge-app'
  | 'start-sidecar'
  | 'activate-remote-mode';

export type ZavorthBridgeRemoteDoctorAction = {
  key: ZavorthBridgeRemoteDoctorActionKey;
  attempted: boolean;
  changed: boolean;
  ok: boolean;
  message: string;
};

export type ZavorthBridgeRemoteDoctorReport = {
  checkedAt: string;
  repairRequested: boolean;
  initialStatus: ZavorthBridgeRemoteNativeStatus;
  finalStatus: ZavorthBridgeRemoteNativeStatus;
  initialIncidents: ZavorthBridgeRemoteIncidentSummary;
  finalIncidents: ZavorthBridgeRemoteIncidentSummary;
  repairPolicy: ZavorthBridgeRemoteDoctorRepairPolicy;
  forceRepair: boolean;
  playbook: ZavorthBridgeRemotePlaybook;
  actions: ZavorthBridgeRemoteDoctorAction[];
  readyBefore: boolean;
  readyAfter: boolean;
  repaired: boolean;
  remainingRecommendations: string[];
  summary: string;
};

type NativeLike = Pick<ZavorthBridgeRemoteNativeService, 'getStatus'>;
type SidecarLike = Pick<TerminalSidecarService, 'start'>;
type RemoteModeLike = Pick<RemoteModeManager, 'activate'>;
type LauncherLike = Pick<ZavorthBridgeAppLauncherService, 'launch'>;

type ZavorthBridgeRemoteDoctorServiceOptions = {
  nativeService?: NativeLike;
  sidecarService?: SidecarLike;
  remoteModeManager?: RemoteModeLike;
  appLauncher?: LauncherLike;
  reportFilePath?: string;
  historyFilePath?: string;
  historyService?: ZavorthBridgeRemoteDoctorHistoryService;
  historyLimit?: number;
  incidentService?: ZavorthBridgeRemoteIncidentService;
  playbookService?: ZavorthBridgeRemotePlaybookService;
};

export class ZavorthBridgeRemoteDoctorService {
  private readonly nativeService: NativeLike;
  private readonly sidecarService: SidecarLike;
  private readonly remoteModeManager: RemoteModeLike;
  private readonly appLauncher: LauncherLike;
  private readonly reportFilePath: string;
  private readonly historyFilePath: string;
  private readonly historyService: ZavorthBridgeRemoteDoctorHistoryService;
  private readonly historyLimit: number;
  private readonly incidentService: ZavorthBridgeRemoteIncidentService;
  private readonly playbookService: ZavorthBridgeRemotePlaybookService;

  constructor(options: ZavorthBridgeRemoteDoctorServiceOptions = {}) {
    this.nativeService = options.nativeService || new ZavorthBridgeRemoteNativeService();
    this.sidecarService = options.sidecarService || new TerminalSidecarService();
    this.remoteModeManager = options.remoteModeManager || new RemoteModeManager();
    this.appLauncher = options.appLauncher || new ZavorthBridgeAppLauncherService();
    this.reportFilePath = options.reportFilePath || config.zavorthBridgeRemoteDoctorReportFile;
    this.historyFilePath = options.historyFilePath || config.zavorthBridgeRemoteDoctorHistoryFile;
    this.historyService = options.historyService || new ZavorthBridgeRemoteDoctorHistoryService();
    this.historyLimit = options.historyLimit || 30;
    this.incidentService = options.incidentService || new ZavorthBridgeRemoteIncidentService();
    this.playbookService = options.playbookService || new ZavorthBridgeRemotePlaybookService();
  }

  public readLastReport(): ZavorthBridgeRemoteDoctorReport | null {
    try {
      if (!fs.existsSync(this.reportFilePath)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(this.reportFilePath, 'utf8')) as ZavorthBridgeRemoteDoctorReport;
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Doctor] JSON parse failed', error); return null; }
  }

  public async run(repairRequested = false, forceRepair = false): Promise<ZavorthBridgeRemoteDoctorReport> {
    const initialStatus = await this.nativeService.getStatus();
    const initialIncidents = this.incidentService.classify(initialStatus);
    const history = this.historyService.readHistory(this.historyFilePath);
    const repairPolicy = this.historyService.recommendRepairPolicy(history, initialIncidents, {
      cooldownMinutes: config.zavorthBridgeRemoteDoctorRepairCooldownMinutes,
      flappingWindowMinutes: config.zavorthBridgeRemoteDoctorFlappingWindowMinutes,
      flappingThreshold: config.zavorthBridgeRemoteDoctorFlappingThreshold,
    });
    const actions: ZavorthBridgeRemoteDoctorAction[] = [];

    if (repairRequested && (!repairPolicy.cooldownActive || forceRepair)) {
      for (const actionKey of initialIncidents.autoRepairableActions) {
        if (actionKey === 'launch-zavorth-bridge-app') {
          actions.push(await this.tryLaunchZavorthBridgeApp());
          continue;
        }
        if (actionKey === 'start-sidecar') {
          actions.push(await this.tryStartSidecar());
          continue;
        }
        if (actionKey === 'activate-remote-mode') {
          actions.push(await this.tryActivateRemoteMode());
        }
      }
    }

    const finalStatus =
      repairRequested && actions.length > 0
        ? await this.nativeService.getStatus()
        : initialStatus;
    const finalIncidents = this.incidentService.classify(finalStatus);

    const readyBefore = initialStatus.access.readyForRemoteUse;
    const readyAfter = finalStatus.access.readyForRemoteUse;
    const repaired = !readyBefore && readyAfter;
    const summary = this.buildSummary(
      repairRequested,
      readyBefore,
      readyAfter,
      actions,
      finalIncidents,
      repairPolicy,
      forceRepair,
    );

    const report: ZavorthBridgeRemoteDoctorReport = {
      checkedAt: new Date().toISOString(),
      repairRequested,
      initialStatus,
      finalStatus,
      initialIncidents,
      finalIncidents,
      repairPolicy,
      forceRepair,
      playbook: {
        title: '',
        urgency: 'info',
        automaticActions: [],
        manualSteps: [],
        retryGuidance: '',
        escalation: null,
      },
      actions,
      readyBefore,
      readyAfter,
      repaired,
      remainingRecommendations: finalStatus.access.recommendations,
      summary,
    };
    report.playbook = this.playbookService.build(report);

    await this.writeReport(report);
    await this.historyService.appendReport(this.historyFilePath, report, this.historyLimit);
    return report;
  }

  private async tryLaunchZavorthBridgeApp(): Promise<ZavorthBridgeRemoteDoctorAction> {
    try {
      const result: ZavorthBridgeAppLaunchResult = await this.appLauncher.launch();
      return {
        key: 'launch-zavorth-bridge-app',
        attempted: true,
        changed: Boolean(result.ok),
        ok: Boolean(result.ok),
        message: result.pid ? `${result.message} PID=${result.pid}` : result.message,
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Remote Doctor] operation failed', error);
    return {
        key: 'launch-zavorth-bridge-app',
        attempted: true,
        changed: false,
        ok: false,
        message: error?.message || String(error),
      };
  }
  }

  private async tryStartSidecar(): Promise<ZavorthBridgeRemoteDoctorAction> {
    try {
      const result: TerminalSidecarSnapshot = await this.sidecarService.start();
      return {
        key: 'start-sidecar',
        attempted: true,
        changed: Boolean(result.ready || result.running),
        ok: Boolean(result.ready),
        message: result.message,
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Remote Doctor] lifecycle operation failed', error);
    return {
        key: 'start-sidecar',
        attempted: true,
        changed: false,
        ok: false,
        message: error?.message || String(error),
      };
  }
  }

  private async tryActivateRemoteMode(): Promise<ZavorthBridgeRemoteDoctorAction> {
    try {
      const result: RemoteModeResult = await this.remoteModeManager.activate();
      return {
        key: 'activate-remote-mode',
        attempted: true,
        changed: Boolean(result.changed || result.active),
        ok: Boolean(result.ok && result.active),
        message: result.message,
      };
    } catch (error: unknown) {
      logger.warn('[Zavorth Bridge Remote Doctor] operation failed', error);
    return {
        key: 'activate-remote-mode',
        attempted: true,
        changed: false,
        ok: false,
        message: error?.message || String(error),
      };
  }
  }

  private buildSummary(
    repairRequested: boolean,
    readyBefore: boolean,
    readyAfter: boolean,
    actions: ZavorthBridgeRemoteDoctorAction[],
    finalIncidents: ZavorthBridgeRemoteIncidentSummary,
    repairPolicy: ZavorthBridgeRemoteDoctorRepairPolicy,
    forceRepair: boolean,
  ): string {
    if (!repairRequested) {
      return readyBefore
        ? 'ZavorthBridge remote is already ready; no repair needed.'
        : 'Diagnosis complete; there are pending items for ZavorthBridge remote.';
    }

    if (repairPolicy.cooldownActive && !forceRepair) {
      return repairPolicy.reason || 'Automatic repair suppressed by cooldown.';
    }

    if (actions.length === 0) {
      return readyAfter
        ? 'Repair requested, but nothing needed adjustment.'
        : 'Repair requested, but no safe automatic adjustment was available.';
    }

    if (readyAfter) {
      return readyBefore
        ? 'Repair complete; ZavorthBridge remote remained healthy.'
        : 'Automatic repair completed and ZavorthBridge remote became ready.';
    }

    const failed = actions.filter((action) => !action.ok);
    if (failed.length > 0) {
      return 'Partial automatic repair; pending items still require manual attention.';
    }

    if (repairPolicy.flappingLikely) {
      return `Automatic repair executed, but ZavorthBridge remote remains unstable (${finalIncidents.primaryCode}).`;
    }

    return `Automatic repair executed, but ZavorthBridge remote is still not fully ready (${finalIncidents.primaryCode}).`;
  }

  private async writeReport(report: ZavorthBridgeRemoteDoctorReport): Promise<void> {
    await fs.promises.mkdir(path.dirname(this.reportFilePath), { recursive: true });
    await fs.promises.writeFile(this.reportFilePath, JSON.stringify(report, null, 2), 'utf8');
  }
}
