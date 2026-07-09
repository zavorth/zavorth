import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { config } from '../../../../config/index.js';
import { McpCapabilityControlPlaneService } from '../../../../services/McpCapabilityControlPlaneService.js';
import { ProviderDoctorService } from '../../../../services/ProviderDoctorService.js';
import { DiscordGatewayRepairFlowService } from '../../../../services/DiscordGatewayRepairFlowService.js';
import { GatewayHealthRenewalService } from '../../../../services/GatewayHealthRenewalService.js';
import { RuntimeAccessReadinessReportService } from '../../infrastructure/runtime-access-readiness/RuntimeAccessReadinessReportService.js';
import { RuntimeAccessReadinessSnapshotReader } from '../../infrastructure/runtime-access-readiness/RuntimeAccessReadinessSnapshotReader.js';
import { logger } from '../../../../logger';
import type {
RuntimeAccessZavorthControlSnapshot,
  RuntimeAccessReadinessInput,
  RuntimeAccessReadinessReport,
  RuntimeAccessResolvedInput,
} from '../../infrastructure/runtime-access-readiness/RuntimeAccessReadinessTypes.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

export type { RuntimeAccessAuthStatus, RuntimeAccessChannelProviderDoctorSnapshot, RuntimeAccessZavorthControlSnapshot, RuntimeAccessDiscordBridgeSnapshot, RuntimeAccessLayeredMemorySnapshot, RuntimeAccessLearningSnapshot, RuntimeAccessLockSnapshot, RuntimeAccessMcpSnapshot, RuntimeAccessNodeMeshSmokeSnapshot, RuntimeAccessPlatformSnapshot, RuntimeAccessProviderSnapshot, RuntimeAccessReadinessInput, RuntimeAccessReadinessReport, RuntimeAccessReadinessStep, RuntimeAccessRemoteTransportDoctorSnapshot, RuntimeAccessResolvedInput, RuntimeAccessSystemOverlordSmokeSnapshot, RuntimeAccessTenantSnapshot } from '../../infrastructure/runtime-access-readiness/RuntimeAccessReadinessTypes.js';

type RuntimeAccessSurfaceProbe = { ok: boolean; targetUrl: string; statusCode: number | null; error: string | null };

type RuntimeAccessReadinessOptions = {
  now?: () => Date;
  existsSync?: typeof fs.existsSync;
  readFileSync?: typeof fs.readFileSync;
  kill?: (pid: number, signal?: number | NodeJS.Signals) => void;
  fetchImpl?: typeof fetch;
  liveProbeTimeoutMs?: number;
  hostLockFilePath?: string;
  workerLockFilePath?: string;
  discordBridgeStatusFile?: string;
  tenantRegistryFile?: string;
  zavorthControlRuntimeFile?: string;
  nodeMeshSmokeReportFile?: string;
  nodeMeshSmokeMaxAgeMs?: number;
  systemOverlordSmokeReportFile?: string;
  systemOverlordSmokeMaxAgeMs?: number;
  channelProviderDoctorReportFile?: string;
  channelProviderDoctorMaxAgeMs?: number;
  remoteTransportDoctorReportFile?: string;
  remoteTransportDoctorMaxAgeMs?: number;
  hostIdentityFile?: string;
  webHost?: string;
  webPort?: number;
  publicBaseUrl?: string;
  webAuthToken?: string;
  highRiskApprovalPin?: string;
  webAuthTokenFile?: string;
  capabilityLifecycleStateFile?: string;
  discordRequiredOnBoot?: boolean;
  providerDoctorService?: Pick<ProviderDoctorService, 'inspect'>;
  mcpCapabilityControlPlaneService?: Pick<McpCapabilityControlPlaneService, 'buildSnapshot'>;
};

export class RuntimeAccessReadinessService {
  private readonly now: () => Date;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly killFn: (pid: number, signal?: number | NodeJS.Signals) => void;
  private readonly fetchImpl: typeof fetch | null;
  private readonly liveProbeTimeoutMs: number;
  private readonly hostLockFilePath: string;
  private readonly workerLockFilePath: string;
  private readonly discordBridgeStatusFile: string;
  private readonly tenantRegistryFile: string;
  private readonly zavorthControlRuntimeFile: string;
  private readonly nodeMeshSmokeReportFile: string;
  private readonly nodeMeshSmokeMaxAgeMs: number;
  private readonly systemOverlordSmokeReportFile: string;
  private readonly systemOverlordSmokeMaxAgeMs: number;
  private readonly channelProviderDoctorReportFile: string;
  private readonly channelProviderDoctorMaxAgeMs: number;
  private readonly remoteTransportDoctorReportFile: string;
  private readonly remoteTransportDoctorMaxAgeMs: number;
  private readonly hostIdentityFile: string;
  private readonly webHost: string;
  private readonly webPort: number;
  private readonly publicBaseUrl: string;
  private readonly webAuthToken: string;
  private readonly highRiskApprovalPin: string;
  private readonly webAuthTokenFile: string;
  private readonly providerDoctorService: Pick<ProviderDoctorService, 'inspect'>;
  private readonly mcpCapabilityControlPlaneService: Pick<McpCapabilityControlPlaneService, 'buildSnapshot'>;
  private readonly discordGatewayRepairFlowService: DiscordGatewayRepairFlowService;
  private readonly gatewayHealthRenewalService: GatewayHealthRenewalService;
  private readonly reportService: RuntimeAccessReadinessReportService;
  private readonly snapshotReader: RuntimeAccessReadinessSnapshotReader;

  constructor(options: RuntimeAccessReadinessOptions = {}) {
    this.now = options.now || (() => new Date());
    this.existsSync = options.existsSync || fs.existsSync.bind(fs);
    this.readFileSync = options.readFileSync || fs.readFileSync.bind(fs);
    this.killFn = options.kill || process.kill.bind(process);
    this.fetchImpl = options.fetchImpl || globalThis.fetch || null;
    this.liveProbeTimeoutMs = Number(options.liveProbeTimeoutMs || 10_000) || 10_000;
    this.hostLockFilePath = options.hostLockFilePath || config.hostSupervisorLockFile;
    this.workerLockFilePath = options.workerLockFilePath || config.telegramProcessLockFile;
    this.discordBridgeStatusFile = options.discordBridgeStatusFile || config.discordBridgeStatusFile;
    this.tenantRegistryFile = options.tenantRegistryFile || config.tenantRegistryStateFile;
    this.zavorthControlRuntimeFile = this.resolveRuntimeArtifactPath(
      options.zavorthControlRuntimeFile,
      config.zavorthControlRuntimeStateFile,
    );
    this.nodeMeshSmokeReportFile = this.resolveRuntimeArtifactPath(
      options.nodeMeshSmokeReportFile,
      config.nodeMeshSmokeReportFile,
    );
    this.nodeMeshSmokeMaxAgeMs = Number(options.nodeMeshSmokeMaxAgeMs || config.nodeMeshSmokeMaxAgeMs) || 43_200_000;
    this.systemOverlordSmokeReportFile =
      this.resolveRuntimeArtifactPath(
        options.systemOverlordSmokeReportFile,
        config.systemOverlordSmokeReportFile
          || path.resolve(config.dataDir, 'runtime', 'system-overlord-smoke-last.json'),
      );
    this.systemOverlordSmokeMaxAgeMs =
      Number(options.systemOverlordSmokeMaxAgeMs || config.systemOverlordSmokeMaxAgeMs) || 43_200_000;
    this.channelProviderDoctorReportFile =
      this.resolveRuntimeArtifactPath(
        options.channelProviderDoctorReportFile,
        config.channelProviderDoctorReportFile,
      );
    this.channelProviderDoctorMaxAgeMs =
      Number(options.channelProviderDoctorMaxAgeMs || config.channelProviderDoctorMaxAgeMs) || 43_200_000;
    this.remoteTransportDoctorReportFile =
      this.resolveRuntimeArtifactPath(
        options.remoteTransportDoctorReportFile,
        config.remoteTransportDoctorReportFile
          || path.resolve(config.dataDir, 'runtime', 'remote-transport-doctor-last.json'),
      );
    this.remoteTransportDoctorMaxAgeMs =
      Number(options.remoteTransportDoctorMaxAgeMs || config.remoteTransportDoctorMaxAgeMs) || 43_200_000;
    this.hostIdentityFile = options.hostIdentityFile || config.hostIdentityFile;
    this.webHost = String(options.webHost ?? config.zavorthWebHost ?? '127.0.0.1').trim() || '127.0.0.1';
    const defaultWebPort =
      process.env.ZAVORTH_WEB_PORT || process.env.PORT
        ? config.zavorthWebPort
        : 33333;
    this.webPort = Number(options.webPort ?? defaultWebPort) || 33333;
    this.publicBaseUrl = this.normalizeUrl(options.publicBaseUrl ?? config.zavorthPublicBaseUrl ?? '');
    this.webAuthToken = String(options.webAuthToken ?? config.zavorthWebAuthToken ?? '').trim();
    this.highRiskApprovalPin = String(options.highRiskApprovalPin ?? config.highRiskApprovalPin ?? '').trim();
    this.webAuthTokenFile = String(options.webAuthTokenFile ?? config.zavorthWebAuthTokenFile ?? '').trim();
    this.providerDoctorService = options.providerDoctorService || new ProviderDoctorService();
    this.mcpCapabilityControlPlaneService =
      options.mcpCapabilityControlPlaneService
      || new McpCapabilityControlPlaneService();
    this.discordGatewayRepairFlowService = new DiscordGatewayRepairFlowService({
      capabilityLifecycleStateFile: options.capabilityLifecycleStateFile ?? config.capabilityLifecycleStateFile,
      discordRequiredOnBoot: options.discordRequiredOnBoot ?? config.discordRequiredOnBoot,
    });
    this.gatewayHealthRenewalService = new GatewayHealthRenewalService();
    this.snapshotReader = new RuntimeAccessReadinessSnapshotReader({
      now: this.now,
      existsSync: this.existsSync,
      readFileSync: this.readFileSync,
      kill: this.killFn,
      tenantRegistryFile: this.tenantRegistryFile,
      zavorthControlRuntimeFile: this.zavorthControlRuntimeFile,
      nodeMeshSmokeReportFile: this.nodeMeshSmokeReportFile,
      nodeMeshSmokeMaxAgeMs: this.nodeMeshSmokeMaxAgeMs,
      systemOverlordSmokeReportFile: this.systemOverlordSmokeReportFile,
      systemOverlordSmokeMaxAgeMs: this.systemOverlordSmokeMaxAgeMs,
      channelProviderDoctorReportFile: this.channelProviderDoctorReportFile,
      channelProviderDoctorMaxAgeMs: this.channelProviderDoctorMaxAgeMs,
      remoteTransportDoctorReportFile: this.remoteTransportDoctorReportFile,
      remoteTransportDoctorMaxAgeMs: this.remoteTransportDoctorMaxAgeMs,
      hostIdentityFile: this.hostIdentityFile,
      webPort: this.webPort,
      webAuthToken: this.webAuthToken,
      webAuthTokenFile: this.webAuthTokenFile,
      discordBridgeStatusFile: this.discordBridgeStatusFile,
      providerDoctorService: this.providerDoctorService,
      mcpCapabilityControlPlaneService: this.mcpCapabilityControlPlaneService,
    });
    this.reportService = new RuntimeAccessReadinessReportService({
      now: this.now,
      publicBaseUrl: this.publicBaseUrl,
      highRiskApprovalPin: this.highRiskApprovalPin,
      buildLocalBaseUrl: this.buildLocalBaseUrl.bind(this),
      discordGatewayRepairFlowService: this.discordGatewayRepairFlowService,
      gatewayHealthRenewalService: this.gatewayHealthRenewalService,
    });
  }

  public inspect(input: RuntimeAccessReadinessInput = {}): RuntimeAccessReadinessReport {
    return this.reportService.buildReport(this.resolveInput(input));
  }

  public async inspectLive(input: RuntimeAccessReadinessInput = {}): Promise<RuntimeAccessReadinessReport> {
    const resolved = this.resolveInput(input);
    const localProbe = await this.probeLocalSurface(this.buildLocalBaseUrl(resolved.zavorthControl));
    return this.reportService.buildReport(resolved, localProbe);
  }

  private buildLocalBaseUrl(zavorthControl: RuntimeAccessZavorthControlSnapshot | null): string {
    if (zavorthControl?.active && zavorthControl.url) {
      return zavorthControl.url;
    }

    const normalizedHost = ['0.0.0.0', '::', '[::]'].includes(this.webHost) ? '127.0.0.1' : this.webHost;
    return `http://${normalizedHost}:${this.webPort}`;
  }

  private resolveInput(input: RuntimeAccessReadinessInput): RuntimeAccessResolvedInput {
    const hostSupervisor = input.hostSupervisor || this.snapshotReader.readLockSnapshot(this.hostLockFilePath);
    const telegramWorker = input.telegramWorker || this.snapshotReader.readLockSnapshot(this.workerLockFilePath);
    return {
      hostSupervisor,
      telegramWorker,
      discordBridge: input.discordBridge || this.snapshotReader.readDiscordBridgeSnapshot(),
      providers: input.providers || this.snapshotReader.readProviderSnapshot(),
      mcp: input.mcp
        ? {
            manifestPath: input.mcp.manifestPath,
            summary: this.snapshotReader.normalizeMcpSummary(input.mcp),
            capabilities: [...(input.mcp.capabilities || [])],
            recommendations: [...(input.mcp.recommendations || [])],
          }
        : this.snapshotReader.readMcpSnapshot(),
      tenants: input.tenants || this.snapshotReader.readTenantSnapshot(),
      zavorthControl: input.zavorthControl === undefined
        ? this.snapshotReader.readZavorthControlSnapshot(telegramWorker)
        : input.zavorthControl,
      nodeMeshSmoke: input.nodeMeshSmoke || this.snapshotReader.readNodeMeshSmokeSnapshot(),
      systemOverlordSmoke: input.systemOverlordSmoke || this.snapshotReader.readSystemOverlordSmokeSnapshot(),
      channelProviderDoctor: input.channelProviderDoctor || this.snapshotReader.readChannelProviderDoctorSnapshot(),
      remoteTransportDoctor: input.remoteTransportDoctor || this.snapshotReader.readRemoteTransportDoctorSnapshot(),
      learning: this.snapshotReader.buildLearningSnapshot(input.learning),
      layeredMemory: this.snapshotReader.buildLayeredMemorySnapshot(input.layeredMemory),
      platform: this.snapshotReader.buildPlatformSnapshot(input.platform),
      auth: input.authStatus || this.snapshotReader.readAuthStatus(),
      hostIdentity: input.hostIdentityStatus === undefined
        ? this.snapshotReader.readHostIdentityStatus()
        : input.hostIdentityStatus,
    };
  }

  // report logic moved to RuntimeAccessReadinessReportService.

  private async probeLocalSurface(baseUrl: string): Promise<RuntimeAccessSurfaceProbe | null> {
    if (!this.fetchImpl || !baseUrl) {
      return null;
    }

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/api/auth/status`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.liveProbeTimeoutMs);

    try {
      const response = await this.fetchImpl(targetUrl, {
        method: 'GET',
        signal: controller.signal,
      });
      return {
        ok: response.ok,
        targetUrl,
        statusCode: response.status,
        error: response.ok ? null : `status ${response.status}`,
      };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const fallbackProbe = await this.probeLocalSurfaceViaNodeHttp(targetUrl);
      if (fallbackProbe) {
        return fallbackProbe;
      }
      const isAbort = error instanceof Error && err.name === 'AbortError';
      const message = error instanceof Error ? err.message : String(error || 'network failure');
      return {
        ok: false,
        targetUrl,
        statusCode: null,
        error: isAbort ? `timeout ${this.liveProbeTimeoutMs}ms` : message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async probeLocalSurfaceViaNodeHttp(targetUrl: string): Promise<RuntimeAccessSurfaceProbe | null> {
    try {
      const url = new URL(targetUrl);
      const transport = url.protocol === 'https:' ? https : http;

      return await new Promise<RuntimeAccessSurfaceProbe>((resolve) => {
        const request = transport.request(
          url,
          {
            method: 'GET',
            timeout: this.liveProbeTimeoutMs,
          },
          (response) => {
            response.resume();
            resolve({
              ok: Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 400,
              targetUrl,
              statusCode: Number(response.statusCode || 0) || null,
              error:
                Number(response.statusCode || 0) >= 200 && Number(response.statusCode || 0) < 400
                  ? null
                  : `status ${response.statusCode || 0}`,
            });
          },
        );

        request.on('timeout', () => {
          request.destroy(new Error(`timeout ${this.liveProbeTimeoutMs}ms`));
        });
        request.on('error', (error: Error) => {
          resolve({
            ok: false,
            targetUrl,
            statusCode: null,
            error: String(error?.message || 'falha de rede'),
          });
        });
        request.end();
      });
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness] resource cleanup failed', error); return null; }
  }

  private normalizeUrl(rawValue: string): string {
    return String(rawValue || '').trim().replace(/\/+$/, '');
  }

  private resolveRuntimeArtifactPath(explicitPath: string | undefined, defaultPath: string): string {
    if (explicitPath !== undefined) {
      return explicitPath;
    }
    return process.env.NODE_ENV === 'test' ? '' : defaultPath;
  }

}

