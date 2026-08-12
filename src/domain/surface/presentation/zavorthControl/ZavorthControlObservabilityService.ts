import { Database } from '../../../../storage/Database.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { safeParseInt } from '../../../../ai-gateway/shared/utils/safeParseInt.js';
import { logger } from '../../../../logger';
import { asErrorLike } from '../../../../utils/errorLike.js';

type SidecarSummaryReader = () => unknown;

interface HealthStats {
  uptime_seconds?: number;
  ram_mb_rss?: number;
  ram_mb_heap?: number;
  cpu_arch?: string;
  [key: string]: unknown;
}

interface ServiceStats {
  uptime?: string;
  memoryUsage?: string;
  heapUsage?: string;
  cpuUsage?: string;
  sidecars?: unknown;
  error?: string;
}

interface AuditLogEntry {
  id: number;
  event_type: string;
  policy_decision: string;
  timestamp: string;
  [key: string]: unknown;
}

interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
}

interface AuditByType {
  event_type: string;
  c: number;
}

interface AuditStatsResponse {
  total: number;
  allowed: number;
  blocked: number;
  recent24h: number;
  byType: AuditByType[];
  error?: string;
}

interface AuditStatsError {
  total: 0;
  error: string;
}

export class ZavorthControlObservabilityService {
  constructor(
    private readonly logRepo: LogRepository,
    private readonly readSidecars: SidecarSummaryReader,
  ) {}

  public getStats(): ServiceStats {
    const MonitorModule = require('../../../../monitoring/Monitor.js').Monitor;
    const monitor = new MonitorModule(this.logRepo);
    let stats = null;

    try {
      stats = monitor.getHealthStats();
    } catch (error: unknown) {logger.warn('[Zavorth Control Observability] health check failed', error);
    stats = { error: 'Could not load metrics' };
  }

    if (stats.error) {
      return stats;
    }

    const uptimeSeconds = Number(stats.uptime_seconds || 0);
    const uptime =
      uptimeSeconds >= 3600
        ? `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`
        : `${Math.floor(uptimeSeconds / 60)}m ${uptimeSeconds % 60}s`;

    return {
      ...stats,
      uptime,
      memoryUsage: `${stats.ram_mb_rss} MB RSS`,
      heapUsage: `${stats.ram_mb_heap} MB heap`,
      cpuUsage: stats.cpu_arch,
      sidecars: this.readSidecars(),
    };
  }

  public getRecentLogs(limit: number): unknown[] {
    return this.logRepo.getRecentLogs(limit);
  }

  public async getAuditLogs(url: URL): Promise<AuditLogsResponse> {
    try {
      const db = await Database.getInstance();
      const limit = Math.min(safeParseInt(url.searchParams.get('limit'), 100), 500);
      const offset = safeParseInt(url.searchParams.get('offset'), 0);
      const eventType = url.searchParams.get('event_type') || '';
      const policyDecision = url.searchParams.get('policy') || '';

      let sql = 'SELECT * FROM audit_log WHERE 1=1';
      const params: (string | number)[] = [];

      if (eventType) {
        sql += ' AND event_type = ?';
        params.push(eventType);
      }
      if (policyDecision) {
        sql += ' AND policy_decision = ?';
        params.push(policyDecision);
      }

      sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = db.all<AuditLogEntry>(sql, params);
      const countRow = db.get<{ total: number }>('SELECT COUNT(*) as total FROM audit_log');
      return { logs: rows, total: countRow?.total || 0, limit, offset };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Control Observability] number operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return { logs: [], total: 0, limit: 0, offset: 0, error: message };
  }
  }

  public async getAuditStats(): Promise<AuditStatsResponse | AuditStatsError> {
    try {
      const db = await Database.getInstance();
      const total = db.get<{ c: number }>('SELECT COUNT(*) as c FROM audit_log')?.c || 0;
      const allowed = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE policy_decision = 'ALLOWED'")?.c || 0;
      const blocked = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE policy_decision != 'ALLOWED'")?.c || 0;
      const byType = db.all<{ event_type: string; c: number }>('SELECT event_type, COUNT(*) as c FROM audit_log GROUP BY event_type ORDER BY c DESC LIMIT 10');
      const recent24h = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE timestamp >= datetime('now', '-1 day')")?.c || 0;
      return { total, allowed, blocked, recent24h, byType };
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.warn('[Zavorth Control Observability] string operation failed', error);
    const message = error instanceof Error ? err.message : String(error);
      return { total: 0, error: message };
  }
  }
}

