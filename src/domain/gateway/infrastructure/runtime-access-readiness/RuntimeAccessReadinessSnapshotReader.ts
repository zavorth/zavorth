import fs from "fs";
import { config } from "../../../../config/index.js";
import {
  HostIdentityService,
  type HostIdentityStatus,
} from "../../../../services/HostIdentityService.js";
import type { ProviderDoctorReport } from "../../../../services/ProviderDoctorService.js";
import { TenantRegistryService } from "../../../../services/TenantRegistryService.js";
import {
  buildRuntimeAccessLayeredMemorySnapshot,
  buildRuntimeAccessLearningSnapshot,
  buildRuntimeAccessPlatformSnapshot,
} from "./RuntimeAccessReadinessDataSnapshotBuilders.js";
import type { RuntimeAccessReadinessSnapshotReaderOptions } from "./RuntimeAccessReadinessSnapshotReaderTypes.js";
import { RuntimeAccessReadinessSmokeSnapshotReader } from "./RuntimeAccessReadinessSmokeSnapshotReader.js";
import { isWeakZavorthControlToken } from "../../../../services/ZavorthControlTokenService.js";
import { logger } from '../../../../logger';
import type {
  RuntimeAccessAuthStatus,
  RuntimeAccessChannelProviderDoctorSnapshot,
  RuntimeAccessZavorthControlSnapshot,
  RuntimeAccessDiscordBridgeSnapshot,
  RuntimeAccessLayeredMemorySnapshot,
  RuntimeAccessLearningSnapshot,
  RuntimeAccessLockSnapshot,
  RuntimeAccessMcpSnapshot,
  RuntimeAccessNodeMeshSmokeSnapshot,
  RuntimeAccessPlatformSnapshot,
  RuntimeAccessProviderSnapshot,
  RuntimeAccessRemoteTransportDoctorSnapshot,
  RuntimeAccessSystemOverlordSmokeSnapshot,
  RuntimeAccessTenantSnapshot,
} from "./RuntimeAccessReadinessTypes.js";
import { asErrorLike } from '../../../../utils/errorLike.js';

export type { RuntimeAccessReadinessSnapshotReaderOptions } from "./RuntimeAccessReadinessSnapshotReaderTypes.js";

export class RuntimeAccessReadinessSnapshotReader {
  private readonly smokeSnapshotReader: RuntimeAccessReadinessSmokeSnapshotReader;

  public constructor(
    private readonly options: RuntimeAccessReadinessSnapshotReaderOptions,
  ) {
    this.smokeSnapshotReader = new RuntimeAccessReadinessSmokeSnapshotReader(
      options,
    );
  }

  public buildLearningSnapshot(
    input: Partial<RuntimeAccessLearningSnapshot> | null | undefined,
  ): RuntimeAccessLearningSnapshot {
    return buildRuntimeAccessLearningSnapshot(input);
  }

  public buildLayeredMemorySnapshot(
    input: Partial<RuntimeAccessLayeredMemorySnapshot> | null | undefined,
  ): RuntimeAccessLayeredMemorySnapshot {
    return buildRuntimeAccessLayeredMemorySnapshot(input);
  }

  public buildPlatformSnapshot(
    input: Partial<RuntimeAccessPlatformSnapshot> | null | undefined,
  ): RuntimeAccessPlatformSnapshot {
    return buildRuntimeAccessPlatformSnapshot(input);
  }

  public readTenantSnapshot(): RuntimeAccessTenantSnapshot {
    const registry = new TenantRegistryService({
      filePath: this.options.tenantRegistryFile,
      now: this.options.now,
      existsSync: this.options.existsSync,
      readFileSync: this.options.readFileSync,
      writeFileSync: fs.writeFileSync.bind(fs),
      mkdirSync: fs.mkdirSync.bind(fs),
    });

    return {
      ...registry.summarize(),
      file: this.options.tenantRegistryFile,
    };
  }

  public readProviderSnapshot(): RuntimeAccessProviderSnapshot {
    const report = this.options.providerDoctorService.inspect({
      taskKind: "code",
      taskSubtype: "general",
      preferredZavorthBridgeModel: config.AIGatewayModel,
    });
    return this.mapProviderReport(report);
  }

  public readMcpSnapshot(): RuntimeAccessMcpSnapshot {
    try {
      const snapshot =
        this.options.mcpCapabilityControlPlaneService.buildSnapshot();
      return {
        manifestPath: snapshot.manifestPath,
        summary: this.normalizeMcpSummary(snapshot),
        capabilities: [...snapshot.capabilities],
        recommendations: [...snapshot.recommendations],
      };
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] creation failed', error);
    return {
        manifestPath: config.mcpServersManifestPath,
        summary: {
          total: 0,
          enabled: 0,
          connected: 0,
          failed: 0,
          disabled: 0,
          stopped: 0,
          toolCount: 0,
          capabilityCount: 0,
        },
        capabilities: [],
        recommendations: [],
      };
  }
  }

  public normalizeMcpSummary(
    snapshot: Pick<RuntimeAccessMcpSnapshot, "summary"> | null | undefined,
  ): RuntimeAccessMcpSnapshot["summary"] {
    const summary = snapshot?.summary;
    return {
      total: Number(summary?.total || 0),
      enabled: Number(summary?.enabled || 0),
      connected: Number(summary?.connected || 0),
      failed: Number(summary?.failed || 0),
      disabled: Number(summary?.disabled || 0),
      stopped: Number(summary?.stopped || 0),
      toolCount: Number(summary?.toolCount || 0),
      capabilityCount: Number(summary?.capabilityCount || 0),
    };
  }

  public readAuthStatus(): RuntimeAccessAuthStatus {
    // Explicit options/env tokens are treated as present even when short (local/test overrides).
    if (this.options.webAuthToken && String(this.options.webAuthToken).trim()) {
      return {
        enabled: true,
        source: "env",
        tokenFile: this.options.webAuthTokenFile,
      };
    }

    const tokenFromFile = this.readTokenFile(this.options.webAuthTokenFile);
    if (tokenFromFile && !isWeakZavorthControlToken(tokenFromFile)) {
      return {
        enabled: true,
        source: "runtime-file",
        tokenFile: this.options.webAuthTokenFile,
      };
    }

    // File tokens that exist but are weak still count as present for readiness diagnostics;
    // operators can rotate them, but remote auth is not considered "missing".
    if (tokenFromFile) {
      return {
        enabled: true,
        source: "runtime-file",
        tokenFile: this.options.webAuthTokenFile,
      };
    }

    return {
      enabled: false,
      source: "missing",
      tokenFile: this.options.webAuthTokenFile,
    };
  }

  public readDiscordBridgeSnapshot(): RuntimeAccessDiscordBridgeSnapshot {
    const fallback: RuntimeAccessDiscordBridgeSnapshot = {
      mode: config.discordBotToken
        ? "native"
        : config.discordBridgeEnabled
          ? "bridge"
          : "unknown",
      enabled: config.discordBridgeEnabled || Boolean(config.discordBotToken),
      started: false,
      allowDirectMessages: config.discordAllowDms,
      allowedGuildIds: [...config.discordAllowedGuildIds],
      pendingInbox: 0,
      pendingOutbox: 0,
      lastError: null,
      updatedAt: null,
    };

    try {
      if (
        !this.options.discordBridgeStatusFile ||
        !this.options.existsSync(this.options.discordBridgeStatusFile)
      ) {
        return fallback;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(this.options.discordBridgeStatusFile, "utf8"),
      ) as Record<string, unknown>;
      const mode =
        parsed.mode === "native" || parsed.mode === "bridge"
          ? parsed.mode
          : fallback.mode;
      const expectedMode = config.discordBotToken
        ? "native"
        : config.discordBridgeEnabled
          ? "bridge"
          : mode;
      const modeMismatch = expectedMode !== "unknown" && mode !== expectedMode;
      return {
        mode: expectedMode,
        enabled: parsed.enabled === true,
        started: !modeMismatch && parsed.started === true,
        allowDirectMessages: parsed.allowDirectMessages === true,
        allowedGuildIds: Array.isArray(parsed.allowedGuildIds)
          ? parsed.allowedGuildIds
              .map((entry) => String(entry || "").trim())
              .filter(Boolean)
          : [],
        pendingInbox: Number(parsed.pendingInbox || 0) || 0,
        pendingOutbox: Number(parsed.pendingOutbox || 0) || 0,
        lastError: modeMismatch
          ? `Discord status snapshot belongs to ${mode} mode, but ${expectedMode} mode is configured.`
          : typeof parsed.lastError === "string"
            ? parsed.lastError
            : null,
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      };
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] parsing failed', error); return fallback; }
  }

  public readZavorthControlSnapshot(
    workerLock: RuntimeAccessLockSnapshot | null = null,
  ): RuntimeAccessZavorthControlSnapshot | null {
    try {
      if (
        !this.options.zavorthControlRuntimeFile ||
        !this.options.existsSync(this.options.zavorthControlRuntimeFile)
      ) {
        return null;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(this.options.zavorthControlRuntimeFile, "utf8"),
      ) as Record<string, unknown>;
      const pid = Number(parsed.pid || 0) || null;
      const active = pid ? this.isProcessAlive(pid) : true;
      const host = String(parsed.host || "").trim();
      const port = Number(parsed.port || 0) || this.options.webPort;
      const url = String(parsed.url || "").trim();
      if (!host || !port || !url) {
        return null;
      }
      if (
        workerLock?.alive &&
        workerLock.pid &&
        pid &&
        pid !== workerLock.pid
      ) {
        return null;
      }

      return {
        active,
        pid,
        host,
        port,
        url,
        startedAt:
          typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      };
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] parsing failed', error); return null; }
  }

  public readNodeMeshSmokeSnapshot(): RuntimeAccessNodeMeshSmokeSnapshot {
    return this.smokeSnapshotReader.readNodeMeshSmokeSnapshot();
  }

  public readSystemOverlordSmokeSnapshot(): RuntimeAccessSystemOverlordSmokeSnapshot {
    return this.smokeSnapshotReader.readSystemOverlordSmokeSnapshot();
  }

  public readChannelProviderDoctorSnapshot(): RuntimeAccessChannelProviderDoctorSnapshot {
    return this.smokeSnapshotReader.readChannelProviderDoctorSnapshot();
  }

  public readRemoteTransportDoctorSnapshot(): RuntimeAccessRemoteTransportDoctorSnapshot {
    return this.smokeSnapshotReader.readRemoteTransportDoctorSnapshot();
  }

  public readHostIdentityStatus(): HostIdentityStatus | null {
    try {
      const identityService = new HostIdentityService(
        this.options.hostIdentityFile,
      );
      const currentFingerprint = identityService.getCurrentFingerprint();
      const storedFingerprint = this.readStoredHostFingerprint(
        this.options.hostIdentityFile,
      );
      return {
        authorized:
          Boolean(storedFingerprint) &&
          storedFingerprint === currentFingerprint,
        firstRun: !storedFingerprint,
        currentFingerprint,
        storedFingerprint,
      };
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] operation failed', error); return null; }
  }

  public readLockSnapshot(filePath: string): RuntimeAccessLockSnapshot {
    if (!this.options.existsSync(filePath)) {
      return {
        active: false,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
      };
    }

    try {
      const parsed = JSON.parse(
        this.options.readFileSync(filePath, "utf8"),
      ) as Record<string, unknown>;
      const pid = Number(parsed.pid || 0) || null;
      return {
        active: true,
        pid,
        owner: typeof parsed.owner === "string" ? parsed.owner : null,
        startedAt:
          typeof parsed.startedAt === "string" ? parsed.startedAt : null,
        alive: pid ? this.isProcessAlive(pid) : false,
      };
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] parsing failed', error);
    return {
        active: true,
        pid: null,
        owner: null,
        startedAt: null,
        alive: false,
      };
  }
  }

  private mapProviderReport(
    report: ProviderDoctorReport,
  ): RuntimeAccessProviderSnapshot {
    return {
      activeProviderName: report.activeProviderName,
      activeModelName: report.activeModelName,
      preferredZavorthBridgeModel: report.preferredZavorthBridgeModel,
      readyCount: report.readyProviders.length,
      needsConfigurationCount: report.pendingConfigProviders.length,
      needsProbeCount: report.probeProviders.length,
      recommendedProfile: report.recommendedProfile.profile.label,
      readyProviders: report.readyProviders.map((entry) => entry.id),
      pendingConfigProviders: report.pendingConfigProviders.map(
        (entry) => entry.id,
      ),
      probeProviders: report.probeProviders.map((entry) => entry.id),
      recommendations: [...report.recommendations],
      modelPicker: report.modelPicker || null,
    };
  }

  private readStoredHostFingerprint(filePath: string): string | null {
    try {
      if (!filePath || !this.options.existsSync(filePath)) {
        return null;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(filePath, "utf8"),
      ) as Record<string, unknown>;
      return typeof parsed.fingerprint === "string" && parsed.fingerprint.trim()
        ? parsed.fingerprint.trim()
        : null;
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] JSON parse failed', error); return null; }
  }

  private readTokenFile(filePath: string): string | null {
    try {
      if (!filePath || !this.options.existsSync(filePath)) {
        return null;
      }

      const token = this.options.readFileSync(filePath, "utf8").trim();
      return token || null;
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] filesystem operation failed', error); return null; }
  }

  private isProcessAlive(pid: number): boolean {
    try {
      this.options.kill(pid, 0);
      return true;
    } catch (error: unknown) {logger.warn('[Runtime Access Readiness Snapshot Reader] filesystem operation failed', error); return asErrorLike(error).code !== "ESRCH"; }
  }
}
