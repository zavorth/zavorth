import type { RuntimeAccessReadinessSnapshotReaderOptions } from "./RuntimeAccessReadinessSnapshotReaderTypes.js";
import { logger } from '../../../../logger';
import type {
RuntimeAccessChannelProviderDoctorSnapshot,
  RuntimeAccessNodeMeshSmokeSnapshot,
  RuntimeAccessRemoteTransportDoctorSnapshot,
  RuntimeAccessSystemOverlordSmokeSnapshot,
} from "./RuntimeAccessReadinessTypes.js";

export class RuntimeAccessReadinessSmokeSnapshotReader {
  public constructor(
    private readonly options: RuntimeAccessReadinessSnapshotReaderOptions,
  ) {}

  public readNodeMeshSmokeSnapshot(): RuntimeAccessNodeMeshSmokeSnapshot {
    const fallback: RuntimeAccessNodeMeshSmokeSnapshot = {
      available: false,
      status: "missing",
      checkedAt: null,
      summary: null,
      command: "npm run test:nodes:smoke",
      file: this.options.nodeMeshSmokeReportFile,
      nodeId: null,
      finalNodeStatus: null,
      recentCapabilityId: null,
      error: null,
      stale: false,
      ageMs: null,
      maxAgeMs: this.options.nodeMeshSmokeMaxAgeMs,
    };

    try {
      if (
        !this.options.nodeMeshSmokeReportFile ||
        !this.options.existsSync(this.options.nodeMeshSmokeReportFile)
      ) {
        return fallback;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(this.options.nodeMeshSmokeReportFile, "utf8"),
      ) as Record<string, unknown>;
      const rawStatus = String(parsed.status || "")
        .trim()
        .toLowerCase();
      const status: RuntimeAccessNodeMeshSmokeSnapshot["status"] =
        rawStatus === "passed"
          ? "passed"
          : rawStatus === "failed"
            ? "failed"
            : rawStatus === "running"
              ? "running"
              : "missing";
      const checkedAt =
        String(parsed.finishedAt || parsed.startedAt || "").trim() || null;
      const ageMs = this.calculateAgeMs(checkedAt);
      const stale =
        status === "passed" &&
        ageMs !== null &&
        ageMs > this.options.nodeMeshSmokeMaxAgeMs;

      return {
        available: status !== "missing",
        status,
        checkedAt,
        summary: String(parsed.summary || "").trim() || null,
        command:
          String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.options.nodeMeshSmokeReportFile,
        nodeId: String(parsed.nodeId || "").trim() || null,
        finalNodeStatus: String(parsed.finalNodeStatus || "").trim() || null,
        recentCapabilityId:
          String(parsed.recentCapabilityId || "").trim() || null,
        error: String(parsed.error || "").trim() || null,
        stale,
        ageMs,
        maxAgeMs: this.options.nodeMeshSmokeMaxAgeMs,
      };
    } catch (error) { logger.warn('[Runtime Access Readiness Smoke Snapshot Reader] parsing failed', error); return fallback; }
  }

  public readSystemOverlordSmokeSnapshot(): RuntimeAccessSystemOverlordSmokeSnapshot {
    const fallback: RuntimeAccessSystemOverlordSmokeSnapshot = {
      available: false,
      status: "missing",
      checkedAt: null,
      summary: null,
      command: "npm run test:overlord:smoke",
      file: this.options.systemOverlordSmokeReportFile,
      stale: false,
      ageMs: null,
      maxAgeMs: this.options.systemOverlordSmokeMaxAgeMs,
      items: [],
    };

    try {
      if (
        !this.options.systemOverlordSmokeReportFile ||
        !this.options.existsSync(this.options.systemOverlordSmokeReportFile)
      ) {
        return fallback;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(
          this.options.systemOverlordSmokeReportFile,
          "utf8",
        ),
      ) as Record<string, unknown>;
      const rawStatus = String(parsed.status || "")
        .trim()
        .toLowerCase();
      const status: RuntimeAccessSystemOverlordSmokeSnapshot["status"] =
        rawStatus === "passed"
          ? "passed"
          : rawStatus === "failed"
            ? "failed"
            : rawStatus === "running"
              ? "running"
              : rawStatus === "skipped"
                ? "skipped"
                : "missing";
      const checkedAt =
        String(parsed.finishedAt || parsed.startedAt || "").trim() || null;
      const ageMs = this.calculateAgeMs(checkedAt);
      const stale =
        status === "passed" &&
        ageMs !== null &&
        ageMs > this.options.systemOverlordSmokeMaxAgeMs;
      const items: RuntimeAccessSystemOverlordSmokeSnapshot["items"] =
        Array.isArray(parsed.items)
          ? parsed.items
              .filter((entry) => entry && typeof entry === "object")
              .map((entry) => {
                const item = entry as Record<string, unknown>;
                const capability = String(item.capability || "")
                  .trim()
                  .toLowerCase();
                return {
                  capability:
                    capability === "network.tunnel" ||
                    capability === "wsl.exec" ||
                    capability === "docker.exec"
                      ? capability
                      : "browser.control",
                  status:
                    item.status === "passed" ||
                    item.status === "failed" ||
                    item.status === "skipped"
                      ? item.status
                      : "failed",
                  runtimeTarget:
                    String(item.runtimeTarget || "").trim() || null,
                  summary: String(item.summary || "").trim(),
                  error: String(item.error || "").trim() || null,
                  operatorNextStep:
                    String(item.operatorNextStep || "").trim() || null,
                };
              })
          : [];

      return {
        available: status !== "missing",
        status,
        checkedAt,
        summary: String(parsed.summary || "").trim() || null,
        command:
          String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.options.systemOverlordSmokeReportFile,
        stale,
        ageMs,
        maxAgeMs: this.options.systemOverlordSmokeMaxAgeMs,
        items,
      };
    } catch (error) { logger.warn('[Runtime Access Readiness Smoke Snapshot Reader] parsing failed', error); return fallback; }
  }

  public readChannelProviderDoctorSnapshot(): RuntimeAccessChannelProviderDoctorSnapshot {
    const fallback: RuntimeAccessChannelProviderDoctorSnapshot = {
      available: false,
      status: "missing",
      checkedAt: null,
      summary: null,
      command: "npm run test:channels:smoke",
      file: this.options.channelProviderDoctorReportFile,
      stale: false,
      ageMs: null,
      maxAgeMs: this.options.channelProviderDoctorMaxAgeMs,
      items: [],
    };

    try {
      if (
        !this.options.channelProviderDoctorReportFile ||
        !this.options.existsSync(this.options.channelProviderDoctorReportFile)
      ) {
        return fallback;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(
          this.options.channelProviderDoctorReportFile,
          "utf8",
        ),
      ) as Record<string, unknown>;
      const rawStatus = String(parsed.status || "")
        .trim()
        .toLowerCase();
      const status: RuntimeAccessChannelProviderDoctorSnapshot["status"] =
        rawStatus === "passed"
          ? "passed"
          : rawStatus === "failed"
            ? "failed"
            : rawStatus === "skipped"
              ? "skipped"
              : "missing";
      const checkedAt = String(parsed.checkedAt || "").trim() || null;
      const ageMs = this.calculateAgeMs(checkedAt);
      const stale =
        status === "passed" &&
        ageMs !== null &&
        ageMs > this.options.channelProviderDoctorMaxAgeMs;
      const items: RuntimeAccessChannelProviderDoctorSnapshot["items"] =
        Array.isArray(parsed.items)
          ? parsed.items
              .filter((entry) => entry && typeof entry === "object")
              .map((entry) => {
                const item = entry as Record<string, unknown>;
                const normalizedChannelId = String(item.channelId || "")
                  .trim()
                  .toLowerCase();
                const normalizedMode = String(item.mode || "")
                  .trim()
                  .toLowerCase();
                return {
                  channelId:
                    normalizedChannelId === "telegram" ||
                    normalizedChannelId === "discord" ||
                    normalizedChannelId === "whatsapp" ||
                    normalizedChannelId === "signal" ||
                    normalizedChannelId === "imessage" ||
                    normalizedChannelId === "teams" ||
                    normalizedChannelId === "email"
                      ? normalizedChannelId
                      : "slack",
                  mode:
                    normalizedMode === "native" ||
                    normalizedMode === "cloud-api" ||
                    normalizedMode === "stub" ||
                    normalizedMode === "local-outbox" ||
                    normalizedMode === "baileys" ||
                    normalizedMode === "bridge" ||
                    normalizedMode === "signal-cli" ||
                    normalizedMode === "mac-bridge" ||
                    normalizedMode === "graph-bot" ||
                    normalizedMode === "smtp-imap"
                      ? (normalizedMode as RuntimeAccessChannelProviderDoctorSnapshot["items"][number]["mode"])
                      : "unknown",
                  status:
                    item.status === "passed" ||
                    item.status === "failed" ||
                    item.status === "skipped"
                      ? item.status
                      : "failed",
                  configured: item.configured === true,
                  summary: String(item.summary || "").trim(),
                  error: String(item.error || "").trim() || null,
                };
              })
          : [];

      return {
        available: status !== "missing",
        status,
        checkedAt,
        summary: String(parsed.summary || "").trim() || null,
        command:
          String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.options.channelProviderDoctorReportFile,
        stale,
        ageMs,
        maxAgeMs: this.options.channelProviderDoctorMaxAgeMs,
        items,
      };
    } catch (error) { logger.warn('[Runtime Access Readiness Smoke Snapshot Reader] parsing failed', error); return fallback; }
  }

  public readRemoteTransportDoctorSnapshot(): RuntimeAccessRemoteTransportDoctorSnapshot {
    const fallback: RuntimeAccessRemoteTransportDoctorSnapshot = {
      available: false,
      status: "missing",
      checkedAt: null,
      summary: null,
      command: "npm run test:transports:smoke",
      file: this.options.remoteTransportDoctorReportFile,
      stale: false,
      ageMs: null,
      maxAgeMs: this.options.remoteTransportDoctorMaxAgeMs,
      recommendedAction: "npm run test:transports:smoke",
      items: [],
    };

    try {
      if (
        !this.options.remoteTransportDoctorReportFile ||
        !this.options.existsSync(this.options.remoteTransportDoctorReportFile)
      ) {
        return fallback;
      }

      const parsed = JSON.parse(
        this.options.readFileSync(
          this.options.remoteTransportDoctorReportFile,
          "utf8",
        ),
      ) as Record<string, unknown>;
      const rawStatus = String(parsed.status || "")
        .trim()
        .toLowerCase();
      const status: RuntimeAccessRemoteTransportDoctorSnapshot["status"] =
        rawStatus === "passed"
          ? "passed"
          : rawStatus === "failed"
            ? "failed"
            : rawStatus === "running"
              ? "running"
              : rawStatus === "skipped"
                ? "skipped"
                : "missing";
      const checkedAt =
        String(
          parsed.checkedAt || parsed.finishedAt || parsed.startedAt || "",
        ).trim() || null;
      const ageMs = this.calculateAgeMs(checkedAt);
      const stale =
        status === "passed" &&
        ageMs !== null &&
        ageMs > this.options.remoteTransportDoctorMaxAgeMs;
      const items: RuntimeAccessRemoteTransportDoctorSnapshot["items"] =
        Array.isArray(parsed.items)
          ? parsed.items
              .filter((entry) => entry && typeof entry === "object")
              .map((entry) => {
                const item = entry as Record<string, unknown>;
                return {
                  transportId:
                    String(item.transportId || item.id || "").trim() ||
                    "unknown",
                  mode:
                    item.mode === "native" ||
                    item.mode === "remote" ||
                    item.mode === "local" ||
                    item.mode === "stub"
                      ? item.mode
                      : "unknown",
                  status:
                    item.status === "passed" ||
                    item.status === "failed" ||
                    item.status === "running" ||
                    item.status === "skipped"
                      ? item.status
                      : "failed",
                  configured: item.configured === true,
                  summary: String(item.summary || "").trim(),
                  error: String(item.error || "").trim() || null,
                };
              })
          : [];

      return {
        available: status !== "missing",
        status,
        checkedAt,
        summary: String(parsed.summary || "").trim() || null,
        command:
          String(parsed.command || fallback.command).trim() || fallback.command,
        file: this.options.remoteTransportDoctorReportFile,
        stale,
        ageMs,
        maxAgeMs: this.options.remoteTransportDoctorMaxAgeMs,
        recommendedAction:
          status === "passed" && !stale
            ? null
            : String(parsed.command || fallback.command).trim() ||
              fallback.command,
        items,
      };
    } catch (error) { logger.warn('[Runtime Access Readiness Smoke Snapshot Reader] parsing failed', error); return fallback; }
  }

  private calculateAgeMs(checkedAt: string | null): number | null {
    const checkedAtMs = checkedAt ? Date.parse(checkedAt) : Number.NaN;
    return Number.isFinite(checkedAtMs)
      ? Math.max(0, this.options.now().getTime() - checkedAtMs)
      : null;
  }
}
