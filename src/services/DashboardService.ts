import * as http from 'http';
import type { Socket } from 'net';

import { config } from '../config/index.js';
import { LogRepository } from '../storage/LogRepository.js';
import type { BroadcastCapableGateway } from './ZavorthChannelActionService.js';
import type {
  SlackWebhookGatewayLike,
  InstagramWebhookGatewayLike,
  TeamsWebhookGatewayLike,
  WhatsAppWebhookGatewayLike,
} from './DashboardCoreRouteService.js';
import {
  type OperationsReportOverviewReaders,
} from '../observability/OperationsReportService.js';
import type { WebAppRuntime } from './WebAppService.js';
import {
  attachChatRuntime as attachChatRuntimeHelper,
  attachChannelBroadcastGateways as attachChannelBroadcastGatewaysHelper,
  attachChannelIngressGateways as attachChannelIngressGatewaysHelper,
  getClassicDashboardHtml as getClassicDashboardHtmlHelper,
  handleOperationsActionRequest as handleOperationsActionRequestHelper,
  routeRequest as routeRequestHelper,
} from '../domain/surface/presentation/dashboard/dashboard-service/DashboardServiceHelpers.js';
import { initializeDashboardService } from '../domain/surface/presentation/dashboard/dashboard-service/DashboardServiceComposition.js';
import {
  startDashboardService,
  stopDashboardService,
} from '../domain/surface/presentation/dashboard/dashboard-service/DashboardServiceServerLifecycle.js';

export type ChannelIngressGateways = {
  slack?: SlackWebhookGatewayLike | null;
  instagram?: InstagramWebhookGatewayLike | null;
  teams?: TeamsWebhookGatewayLike | null;
  whatsapp?: WhatsAppWebhookGatewayLike | null;
};

export class DashboardService {
  private server: http.Server | null = null;
  private readonly openSockets = new Set<Socket>();
  private stopping: Promise<void> | null = null;
  private host = config.zavorthWebHost;
  private port = config.zavorthWebPort;
  private readonly runtimeStateFile = config.dashboardRuntimeStateFile;
  private isRunning = false;

  constructor(
    private logRepo: LogRepository,
    deps: any = {},
  ) {
    initializeDashboardService(this as any, logRepo, deps);
  }

  public attachChatRuntime(runtime: WebAppRuntime): void {
    attachChatRuntimeHelper(this as any, runtime);
  }

  public attachChannelBroadcastGateways(
    gateways: Partial<Record<string, BroadcastCapableGateway | null | undefined>>,
  ): void {
    attachChannelBroadcastGatewaysHelper(this as any, gateways);
  }

  public attachChannelIngressGateways(gateways: ChannelIngressGateways): void {
    attachChannelIngressGatewaysHelper(this as any, gateways);
  }

  public getUrl(): string {
    const displayHost = this.host === '0.0.0.0' ? '127.0.0.1' : this.host;
    return `http://${displayHost}:${this.port}`;
  }

  public getPublicApiBaseUrl(): string | null {
    return this.getPublicBaseUrl();
  }

  public getPublicBaseUrl(): string | null {
    return (this as any).httpSupport.normalizeUrl(config.zavorthPublicBaseUrl || '');
  }

  public getOperationsOverviewReaders(): OperationsReportOverviewReaders {
    return (this as any).operationsOverviewBridge.buildReaders();
  }

  public async start(): Promise<string> {
    return startDashboardService(this as any);
  }

  public stop(): void {
    void this.stopAsync();
  }

  public async stopAsync(): Promise<void> {
    return stopDashboardService(this as any);
  }

  private async routeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    await routeRequestHelper(this as any, req, res);
  }

  private async handleOperationsActionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    await handleOperationsActionRequestHelper(this as any, req, res);
  }

  private getClassicDashboardHtml(): string {
    return getClassicDashboardHtmlHelper(this as any);
  }
}

