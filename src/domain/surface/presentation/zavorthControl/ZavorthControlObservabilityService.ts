import { Database } from '../../../../storage/Database.js';
import { LogRepository } from '../../../../storage/LogRepository.js';

type SidecarSummaryReader = () => unknown;

export class ZavorthControlObservabilityService {
  constructor(
    private readonly logRepo: LogRepository,
    private readonly readSidecars: SidecarSummaryReader,
  ) {}

  public getStats(): any {
    const MonitorModule = require('../../../../monitoring/Monitor.js').Monitor;
    const monitor = new MonitorModule(this.logRepo);
    let stats = null;

    try {
      stats = monitor.getHealthStats();
    } catch {
      stats = { error: 'Nao foi possivel carregar metricas' };
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

  public async getAuditLogs(url: URL): Promise<any> {
    try {
      const db = await Database.getInstance();
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);
      const eventType = url.searchParams.get('event_type') || '';
      const policyDecision = url.searchParams.get('policy') || '';

      let sql = 'SELECT * FROM audit_log WHERE 1=1';
      const params: any[] = [];

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

      const rows = db.all(sql, params);
      const countRow = db.get<{ total: number }>('SELECT COUNT(*) as total FROM audit_log');
      return { logs: rows, total: countRow?.total || 0, limit, offset };
    } catch (error: any) {
      return { logs: [], total: 0, error: error?.message || String(error) };
    }
  }

  public async getAuditStats(): Promise<any> {
    try {
      const db = await Database.getInstance();
      const total = db.get<{ c: number }>('SELECT COUNT(*) as c FROM audit_log')?.c || 0;
      const allowed = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE policy_decision = 'ALLOWED'")?.c || 0;
      const blocked = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE policy_decision != 'ALLOWED'")?.c || 0;
      const byType = db.all<{ event_type: string; c: number }>('SELECT event_type, COUNT(*) as c FROM audit_log GROUP BY event_type ORDER BY c DESC LIMIT 10');
      const recent24h = db.get<{ c: number }>("SELECT COUNT(*) as c FROM audit_log WHERE timestamp >= datetime('now', '-1 day')")?.c || 0;
      return { total, allowed, blocked, recent24h, byType };
    } catch (error: any) {
      return { total: 0, error: error?.message || String(error) };
    }
  }
}

