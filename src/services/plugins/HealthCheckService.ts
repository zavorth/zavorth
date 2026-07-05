import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface HealthCheck {
  id: string;
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  last_check: string;
  response_time_ms: number;
  consecutive_failures: number;
}

export class HealthCheckService {
  private readonly storageDir: string;
  private checks: Map<string, HealthCheck> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'health-check');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadChecks();
  }

  private loadChecks(): void {
    const p = path.join(this.storageDir, 'checks.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) for (const c of data) this.checks.set(c.id, c);
    } catch (error) { /* ignore */ logger.warn('[Check] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.dirty) {
        this.dirty = false;
        fs.writeFileSync(path.join(this.storageDir, 'checks.json'), JSON.stringify(Array.from(this.checks.values()), null, 2), 'utf-8');
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public reportHealth(component: string, status: HealthCheck['status'], message: string, responseTimeMs: number = 0): string {
    const id = component.toLowerCase().replace(/\s+/g, '_');
    let check = this.checks.get(id);
    if (!check) {
      check = { id, component, status, message, last_check: '', response_time_ms: 0, consecutive_failures: 0 };
      this.checks.set(id, check);
    }

    check.status = status;
    check.message = message;
    check.last_check = new Date().toISOString();
    check.response_time_ms = responseTimeMs;

    if (status === 'unhealthy') {
      check.consecutive_failures++;
    } else {
      check.consecutive_failures = 0;
    }

    this.scheduleFlush();
    return `${component}: ${status} (${message})`;
  }

  public getComponentHealth(component: string): HealthCheck | null {
    const id = component.toLowerCase().replace(/\s+/g, '_');
    return this.checks.get(id) || null;
  }

  public getOverallHealth(): string {
    const checks = Array.from(this.checks.values());
    if (checks.length === 0) return 'No health checks configured.';

    const healthy = checks.filter((c) => c.status === 'healthy').length;
    const degraded = checks.filter((c) => c.status === 'degraded').length;
    const unhealthy = checks.filter((c) => c.status === 'unhealthy').length;

    let overall: HealthCheck['status'] = 'healthy';
    if (unhealthy > 0) overall = 'unhealthy';
    else if (degraded > 0) overall = 'degraded';

    return [
      `Overall Health: ${overall}`,
      `  Healthy: ${healthy}`,
      `  Degraded: ${degraded}`,
      `  Unhealthy: ${unhealthy}`,
    ].join('\n');
  }

  public listChecks(): string {
    if (this.checks.size === 0) return 'No health checks configured.';
    const lines: string[] = ['Health Checks:'];
    for (const [, c] of this.checks) {
      const icon = { healthy: '🟢', degraded: '🟡', unhealthy: '🔴' }[c.status];
      lines.push(`  ${icon} ${c.component}: ${c.status} - ${c.message} (${c.response_time_ms}ms)`);
    }
    return lines.join('\n');
  }

  public getUnhealthyComponents(): string {
    const unhealthy = Array.from(this.checks.values()).filter((c) => c.status === 'unhealthy');
    if (unhealthy.length === 0) return 'No unhealthy components.';
    return ['Unhealthy Components:', ...unhealthy.map((c) => `  🔴 ${c.component}: ${c.message} (${c.consecutive_failures} consecutive failures)`)].join('\n');
  }

  public getStats(): string {
    const checks = Array.from(this.checks.values());
    const avgResponseTime = checks.length > 0 ? checks.reduce((s, c) => s + c.response_time_ms, 0) / checks.length : 0;
    return [
      'Health Check Stats:',
      `  Components: ${checks.length}`,
      `  Avg response time: ${avgResponseTime.toFixed(0)}ms`,
      `  Unhealthy: ${checks.filter((c) => c.status === 'unhealthy').length}`,
    ].join('\n');
  }
}
