import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';
import type {
  ZavorthBridgeRemoteDoctorAction,
  ZavorthBridgeRemoteDoctorReport,
} from './ZavorthBridgeRemoteDoctorService.js';

import type {
ZavorthBridgeRemoteIncidentCode,
  ZavorthBridgeRemoteIncidentSeverity,
  ZavorthBridgeRemoteIncidentSummary,
} from './ZavorthBridgeRemoteIncidentService.js';

export type ZavorthBridgeRemoteDoctorHistoryEntry = {
  checkedAt: string;
  repairRequested: boolean;
  readyBefore: boolean;
  readyAfter: boolean;
  repaired: boolean;
  summary: string;
  actions: ZavorthBridgeRemoteDoctorAction[];
  remainingRecommendations: string[];
  sidecarReady: boolean;
  sidecarHealthOk: boolean;
  bridgeOnline: boolean;
  remoteModeActive: boolean | null;
  sessionAccessible: boolean | null;
  incidentSeverity: ZavorthBridgeRemoteIncidentSeverity;
  primaryIncidentCode: ZavorthBridgeRemoteIncidentCode;
  flappingLikely?: boolean;
  cooldownActive?: boolean;
};

export type ZavorthBridgeRemoteDoctorRepairPolicy = {
  cooldownActive: boolean;
  cooldownUntil: string | null;
  flappingLikely: boolean;
  matchingRecentFailures: number;
  reason: string | null;
};

export type ZavorthBridgeRemoteDoctorHistorySummary = {
  recent: ZavorthBridgeRemoteDoctorHistoryEntry[];
  totalRuns: number;
  repairedRuns: number;
  readyRuns: number;
  degradedRuns: number;
  latest: ZavorthBridgeRemoteDoctorHistoryEntry | null;
  stability: {
    flappingLikely: boolean;
    matchingRecentFailures: number;
    dominantIncidentCode: ZavorthBridgeRemoteIncidentCode | null;
  };
};

export class ZavorthBridgeRemoteDoctorHistoryService {
  private static readonly SUMMARY_FLAPPING_WINDOW_MS = 20 * 60 * 1000;

  public readHistory(historyFilePath: string): ZavorthBridgeRemoteDoctorHistoryEntry[] {
    if (!fs.existsSync(historyFilePath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(historyFilePath, 'utf8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error: unknown) {logger.warn('[Zavorth Bridge Remote Doctor History] JSON parse failed', error); return []; }
  }

  public async appendReport(
    historyFilePath: string,
    report: ZavorthBridgeRemoteDoctorReport,
    limit = 30,
  ): Promise<ZavorthBridgeRemoteDoctorHistoryEntry[]> {
    const history = this.readHistory(historyFilePath);
    const next = [this.toEntry(report), ...history].slice(0, Math.max(1, limit));
    await fs.promises.mkdir(path.dirname(historyFilePath), { recursive: true });
    await fs.promises.writeFile(historyFilePath, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  public summarize(
    history: ZavorthBridgeRemoteDoctorHistoryEntry[],
    limit = 8,
  ): ZavorthBridgeRemoteDoctorHistorySummary {
    const normalizedHistory = history.map((entry) => this.normalizeLegacyEntry(entry));
    const recent = normalizedHistory.slice(0, limit);
    const degradedRecent = recent.filter((entry) => !entry.readyAfter);
    const dominantIncidentCode = this.getDominantIncidentCode(degradedRecent);
    const referenceMs = Date.parse(normalizedHistory[0]?.checkedAt || '');
    const matchingRecentFailures = dominantIncidentCode
      ? degradedRecent.filter((entry) => {
          const checkedAtMs = Date.parse(entry.checkedAt);
          return (
            entry.primaryIncidentCode === dominantIncidentCode
            && Number.isFinite(referenceMs)
            && Number.isFinite(checkedAtMs)
            && referenceMs - checkedAtMs <= ZavorthBridgeRemoteDoctorHistoryService.SUMMARY_FLAPPING_WINDOW_MS
          );
        }).length
      : 0;
    return {
      recent,
      totalRuns: normalizedHistory.length,
      repairedRuns: normalizedHistory.filter((entry) => entry.repaired).length,
      readyRuns: normalizedHistory.filter((entry) => entry.readyAfter).length,
      degradedRuns: normalizedHistory.filter((entry) => !entry.readyAfter).length,
      latest: normalizedHistory[0] || null,
      stability: {
        flappingLikely: matchingRecentFailures >= 3,
        matchingRecentFailures,
        dominantIncidentCode,
      },
    };
  }

  public recommendRepairPolicy(
    history: ZavorthBridgeRemoteDoctorHistoryEntry[],
    incidents: ZavorthBridgeRemoteIncidentSummary,
    options: {
      now?: Date;
      cooldownMinutes?: number;
      flappingWindowMinutes?: number;
      flappingThreshold?: number;
    } = {},
  ): ZavorthBridgeRemoteDoctorRepairPolicy {
    const now = options.now || new Date();
    const cooldownMinutes = options.cooldownMinutes ?? 10;
    const flappingWindowMinutes = options.flappingWindowMinutes ?? 20;
    const flappingThreshold = options.flappingThreshold ?? 3;
    const normalizedHistory = history.map((entry) => this.normalizeLegacyEntry(entry));
    const incidentCodes = new Set<ZavorthBridgeRemoteIncidentCode>(incidents.codes);
    const windowStartMs = now.getTime() - flappingWindowMinutes * 60 * 1000;

    const matchingRecentFailures = normalizedHistory.filter((entry) => {
      const checkedAtMs = Date.parse(entry.checkedAt);
      return (
        !entry.readyAfter &&
        Number.isFinite(checkedAtMs) &&
        checkedAtMs >= windowStartMs &&
        incidentCodes.has(entry.primaryIncidentCode)
      );
    }).length;

    const flappingLikely = matchingRecentFailures >= flappingThreshold;
    const latestRepairFailure = normalizedHistory.find((entry) => (
      entry.repairRequested &&
      !entry.readyAfter &&
      incidentCodes.has(entry.primaryIncidentCode)
    ));

    let cooldownUntil: string | null = null;
    let cooldownActive = false;
    if (latestRepairFailure) {
      const failureMs = Date.parse(latestRepairFailure.checkedAt);
      if (Number.isFinite(failureMs)) {
        const untilMs = failureMs + cooldownMinutes * 60 * 1000;
        cooldownUntil = new Date(untilMs).toISOString();
        cooldownActive = now.getTime() < untilMs;
      }
    }

    let reason: string | null = null;
    if (cooldownActive) {
      reason = `Cooldown active until ${cooldownUntil}; automatic repair was suppressed to avoid a loop.`;
    } else if (flappingLikely) {
      reason = `Flapping detectado para ${incidents.primaryCode}; o remote failed ${matchingRecentFailures} vez(es) na window recente.`;
    }

    return {
      cooldownActive,
      cooldownUntil,
      flappingLikely,
      matchingRecentFailures,
      reason,
    };
  }

  private toEntry(report: ZavorthBridgeRemoteDoctorReport): ZavorthBridgeRemoteDoctorHistoryEntry {
    return {
      checkedAt: report.checkedAt,
      repairRequested: report.repairRequested,
      readyBefore: report.readyBefore,
      readyAfter: report.readyAfter,
      repaired: report.repaired,
      summary: report.summary,
      actions: report.actions,
      remainingRecommendations: report.remainingRecommendations,
      sidecarReady: Boolean(report.finalStatus.sidecar?.ready),
      sidecarHealthOk: Boolean(report.finalStatus.sidecarHealth.ok),
      bridgeOnline: Boolean(report.finalStatus.bridge.online),
      remoteModeActive: report.finalStatus.remoteMode.active,
      sessionAccessible: report.finalStatus.session.accessible,
      incidentSeverity: report.finalIncidents.severity,
      primaryIncidentCode: report.finalIncidents.primaryCode,
      flappingLikely: report.repairPolicy.flappingLikely,
      cooldownActive: report.repairPolicy.cooldownActive,
    };
  }

  private normalizeLegacyEntry(entry: ZavorthBridgeRemoteDoctorHistoryEntry): ZavorthBridgeRemoteDoctorHistoryEntry {
    if (entry.primaryIncidentCode && entry.incidentSeverity) {
      return entry;
    }

    if (entry.sessionAccessible === false) {
      return {
        ...entry,
        primaryIncidentCode: 'session_blocked',
        incidentSeverity: 'critical',
      };
    }

    if (!entry.bridgeOnline) {
      return {
        ...entry,
        primaryIncidentCode: 'bridge_offline',
        incidentSeverity: 'error',
      };
    }

    if (!entry.sidecarHealthOk) {
      return {
        ...entry,
        primaryIncidentCode: 'sidecar_http_unhealthy',
        incidentSeverity: 'error',
      };
    }

    if (!entry.sidecarReady) {
      return {
        ...entry,
        primaryIncidentCode: 'sidecar_unready',
        incidentSeverity: 'warning',
      };
    }

    if (entry.remoteModeActive === false) {
      return {
        ...entry,
        primaryIncidentCode: 'remote_mode_inactive',
        incidentSeverity: 'warning',
      };
    }

    return {
      ...entry,
      primaryIncidentCode: 'healthy',
      incidentSeverity: 'info',
    };
  }

  private getDominantIncidentCode(
    entries: ZavorthBridgeRemoteDoctorHistoryEntry[],
  ): ZavorthBridgeRemoteIncidentCode | null {
    const counts = new Map<ZavorthBridgeRemoteIncidentCode, number>();
    for (const entry of entries) {
      counts.set(entry.primaryIncidentCode, (counts.get(entry.primaryIncidentCode) || 0) + 1);
    }

    let dominant: ZavorthBridgeRemoteIncidentCode | null = null;
    let dominantCount = -1;
    for (const [code, count] of counts.entries()) {
      if (count > dominantCount) {
        dominant = code;
        dominantCount = count;
      }
    }

    return dominant;
  }
}
