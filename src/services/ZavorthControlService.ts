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
} from './ZavorthControlCoreRouteService.js';
import {
  type OperationsReportOverviewReaders,
} from '../observability/OperationsReportService.js';
import type { WebAppRuntime } from './WebAppService.js';
import {
  attachChatRuntime as attachChatRuntimeHelper,
  attachChannelBroadcastGateways as attachChannelBroadcastGatewaysHelper,
  attachChannelIngressGateways as attachChannelIngressGatewaysHelper,
  getClassicZavorthControlHtml as getClassicZavorthControlHtmlHelper,
  handleOperationsActionRequest as handleOperationsActionRequestHelper,
  routeRequest as routeRequestHelper,
} from '../domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceHelpers.js';
import { initializeZavorthControlService } from '../domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceComposition.js';
import {
  startZavorthControlService,
  stopZavorthControlService,
} from '../domain/surface/presentation/zavorthControl/zavorthControl-service/ZavorthControlServiceServerLifecycle.js';

export type ChannelIngressGateways = {
  slack?: SlackWebhookGatewayLike | null;
  instagram?: InstagramWebhookGatewayLike | null;
  teams?: TeamsWebhookGatewayLike | null;
  whatsapp?: WhatsAppWebhookGatewayLike | null;
};

export class ZavorthControlService {
  private server: http.Server | null = null;
  private readonly openSockets = new Set<Socket>();
  private stopping: Promise<void> | null = null;
  private host = config.zavorthWebHost;
  private port = config.zavorthWebPort;
  private readonly runtimeStateFile = config.zavorthControlRuntimeStateFile;
  private isRunning = false;

  constructor(
    private logRepo: LogRepository,
    deps: any = {},
  ) {
    initializeZavorthControlService(this as any, logRepo, deps);
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
    return startZavorthControlService(this as any);
  }

  public stop(): void {
    void this.stopAsync();
  }

  public async stopAsync(): Promise<void> {
    return stopZavorthControlService(this as any);
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

  private getClassicZavorthControlHtml(): string {
    return getClassicZavorthControlHtmlHelper(this as any);
  }
}

