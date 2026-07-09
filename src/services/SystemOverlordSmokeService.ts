import { asErrorLike } from '../utils/errorLike';
﻿import fs from 'fs';
import { config } from '../config/index.js';
import { SupervisedBrowserControlAdapter } from '../adapters/overlord/SupervisedBrowserControlAdapter.js';
import { SupervisedDockerExecAdapter } from '../adapters/overlord/SupervisedDockerExecAdapter.js';
import { SupervisedNetworkTunnelAdapter } from '../adapters/overlord/SupervisedNetworkTunnelAdapter.js';
import { SupervisedWslExecAdapter } from '../adapters/overlord/SupervisedWslExecAdapter.js';
import { AutomaticBrowserTool } from '../mcp/tools/AutomaticBrowserTool.js';
import { ZavorthPublicTunnelService } from './ZavorthPublicTunnelService.js';
import { CompanionControlService } from './CompanionControlService.js';
import { SupervisedExecutionGatewayService } from './SupervisedExecutionGatewayService.js';
import { SupervisedRuntimeAdapterRegistryService } from './SupervisedRuntimeAdapterRegistryService.js';
import { runBrowserSmoke } from './system-overlord-smoke/browserSmoke.js';
import { runDockerSmoke } from './system-overlord-smoke/dockerSmoke.js';
import { createSmokeActionExecutor } from './system-overlord-smoke/smokeActions.js';
import { createLocalSmokeProbeServer } from './system-overlord-smoke/smokeProbeServer.js';
import {
  buildFinalSmokeReport,
  buildRunningSmokeReport,
  buildUnexpectedFailureSmokeReport,
  writeSmokeReport,
} from './system-overlord-smoke/smokeReport.js';
import { runTunnelSmoke } from './system-overlord-smoke/tunnelSmoke.js';
import type {
  BrowserToolLike,
  ProbeServer,
  SmokeGatewayLike,
  SystemOverlordSmokeItem,
  SystemOverlordSmokeReport,
  TunnelServiceLike,
} from './system-overlord-smoke/smokeTypes.js';
import { runWslSmoke } from './system-overlord-smoke/wslSmoke.js';
import { logger } from '../logger.js';

export type {
  SystemOverlordSmokeItem,
  SystemOverlordSmokeItemStatus,
  SystemOverlordSmokeReport,
  SystemOverlordSmokeStatus,
} from './system-overlord-smoke/smokeTypes.js';

type SystemOverlordSmokeOptions = {
  gatewayService?: SmokeGatewayLike;
  browserTool?: BrowserToolLike;
  publicTunnelService?: TunnelServiceLike;
  reportFile?: string;
  companionControlService?: Pick<CompanionControlService, 'executeAction'>;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  writeFileSync?: typeof fs.writeFileSync;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  platform?: NodeJS.Platform;
  webPort?: number;
  createProbeServer?: () => Promise<ProbeServer>;
};

export class SystemOverlordSmokeService {
  private readonly gateway: SmokeGatewayLike;
  private readonly browserTool: BrowserToolLike;
  private readonly publicTunnelService: TunnelServiceLike;
  private readonly companionControlService: Pick<CompanionControlService, 'executeAction'>;
  private readonly reportFile: string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly mkdirSync: typeof fs.mkdirSync;
  private readonly writeFileSync: typeof fs.writeFileSync;
  private readonly now: () => Date;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly platform: NodeJS.Platform;
  private readonly createProbeServer: () => Promise<ProbeServer>;

  constructor(options: SystemOverlordSmokeOptions = {}) {
    this.browserTool = options.browserTool || new AutomaticBrowserTool();
    this.publicTunnelService = options.publicTunnelService || new ZavorthPublicTunnelService();
    this.companionControlService = options.companionControlService || new CompanionControlService();
    this.reportFile = String(options.reportFile || config.systemOverlordSmokeReportFile || '').trim();
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.mkdirSync = options.mkdirSync || fs.mkdirSync.bind(fs);
    this.writeFileSync = options.writeFileSync || fs.writeFileSync.bind(fs);
    this.now = options.now || (() => new Date());
    this.sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.platform = options.platform || process.platform;
    const webPort = Number(options.webPort || config.zavorthWebPort || 33333) || 33333;
    this.createProbeServer = options.createProbeServer || (() => createLocalSmokeProbeServer(webPort));
    this.gateway = options.gatewayService || this.createDefaultGateway();
  }

  public async run(): Promise<SystemOverlordSmokeReport> {
    const startedAt = this.now().toISOString();
    let probeServer: ProbeServer | null = null;
    let tunnelStartedBySmoke = false;
    const items: SystemOverlordSmokeItem[] = [];
    const executeSmokeAction = createSmokeActionExecutor(this.gateway);

    this.writeReport(buildRunningSmokeReport({
      startedAt,
      items,
      reportFile: this.reportFile,
      platform: this.platform,
    }));

    try {
      probeServer = await this.createProbeServer();
      items.push(await runBrowserSmoke(probeServer.url, {
        browserTool: this.browserTool,
        executeSmokeAction,
      }));

      const tunnel = await runTunnelSmoke(probeServer.url, {
        publicTunnelService: this.publicTunnelService,
        gateway: this.gateway,
        existsSync: this.existsSync,
        executeSmokeAction,
      });
      items.push(tunnel.item);
      tunnelStartedBySmoke = tunnel.startedBySmoke;

      items.push(await runWslSmoke({
        platform: this.platform,
        executeSmokeAction,
      }));
      items.push(await runDockerSmoke({
        executeSmokeAction,
        ensureDockerDesktop: this.platform === 'win32'
          ? async () => this.resumeDockerDesktop()
          : null,
        stopDockerDesktop: this.platform === 'win32'
          ? async () => this.stopDockerDesktopIfIdle()
          : null,
        sleep: this.sleep,
      }));

      const report = buildFinalSmokeReport({
        startedAt,
        probeUrl: probeServer.url,
        items,
        reportFile: this.reportFile,
        now: this.now,
        platform: this.platform,
      });
      this.writeReport(report);
      return report;
    } catch (error: unknown) {const report = buildUnexpectedFailureSmokeReport({
        startedAt,
        probeUrl: probeServer?.url || null,
        items,
        error,
        reportFile: this.reportFile,
        now: this.now,
        platform: this.platform,
      });
      this.writeReport(report);
      return report;
    } finally {
      if (tunnelStartedBySmoke) {
        try {
          await this.publicTunnelService.stop();
        } catch (error: unknown) {
          const err = asErrorLike(error);
          logger.warn("[auto-fix] Empty catch block", err); }
      }
      try {
        await probeServer?.close();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn("[auto-fix] Empty catch block", err); }
      try {
        await this.browserTool.shutdown();
      } catch (error: unknown) {
        const err = asErrorLike(error);
        logger.warn("[auto-fix] Empty catch block", err); }
    }
  }

  private createDefaultGateway(): SmokeGatewayLike {
    const adapterRegistry = new SupervisedRuntimeAdapterRegistryService({
      adapters: [
        new SupervisedDockerExecAdapter(),
        new SupervisedWslExecAdapter({ platform: this.platform }),
        new SupervisedNetworkTunnelAdapter({ tunnelService: this.publicTunnelService }),
        new SupervisedBrowserControlAdapter({ browserTool: this.browserTool }),
      ],
    });
    return new SupervisedExecutionGatewayService({
      adapterRegistry,
    });
  }

  private async resumeDockerDesktop(): Promise<boolean> {
    const result = await this.companionControlService.executeAction({
      companionId: 'docker-desktop',
      actionId: 'resume',
      requestedBy: 'system-overlord-smoke',
      force: true,
    });
    return result.ok && result.executed === true;
  }

  private async stopDockerDesktopIfIdle(): Promise<void> {
    await this.companionControlService.executeAction({
      companionId: 'docker-desktop',
      actionId: 'stop-idle',
      requestedBy: 'system-overlord-smoke',
      force: true,
    });
  }

  private writeReport(report: SystemOverlordSmokeReport): void {
    writeSmokeReport(report, {
      reportFile: this.reportFile,
      mkdirSync: this.mkdirSync,
      writeFileSync: this.writeFileSync,
    });
  }
}
