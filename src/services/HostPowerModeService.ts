import { logger } from '../logger.js';
import { Database } from '../storage/Database.js';
import { SecurityAuditLogger } from './SecurityAuditLogger.js';
import { LogRepository } from '../storage/LogRepository.js';
import { HostCommandPayloadCache } from './HostCommandPayloadCache.js';
import { asErrorLike } from '../utils/errorLike';

export interface HostPowerModeState {
  enabled: boolean;
  expiresAt: string | null;
  workspaceId: string | null;
}

export class HostPowerModeService {
  private static instance: HostPowerModeService | null = null;
  private state: {
    enabled: boolean;
    expiresAt: string | null;
    workspaceId: string | null;
  } = {
    enabled: false,
    expiresAt: null,
    workspaceId: null
  };

  private expiryTimer: NodeJS.Timeout | null = null;
  private readonly MAX_DURATION_MINUTES = 30;
  private onDisableCallbacks: Array<(workspaceId: string) => Promise<void>> = [];
  private db: Database | null = null;
  private readonly auditLogger: SecurityAuditLogger;
  private readonly payloadCache: HostCommandPayloadCache;

  private constructor(db?: Database, auditLogger?: SecurityAuditLogger, payloadCache?: HostCommandPayloadCache) {
    this.db = db || Database.getActiveInstance() || null;
    this.auditLogger = auditLogger || new SecurityAuditLogger(new LogRepository());
    this.payloadCache = payloadCache || HostCommandPayloadCache.getInstance();
  }

  public registerOnDisableCallback(cb: (workspaceId: string) => Promise<void>): void {
    this.onDisableCallbacks.push(cb);
  }

  public setDb(db: Database) {
    this.db = db;
  }

  private async getDb(): Promise<Database> {
    if (this.db) {
      return this.db;
    }
    return Database.getInstance();
  }

  public static getInstance(): HostPowerModeService {
    if (!HostPowerModeService.instance) {
      HostPowerModeService.instance = new HostPowerModeService();
    }
    return HostPowerModeService.instance;
  }

  public async enable(workspaceId: string, durationMinutes: number): Promise<void> {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
    }

    const cappedMinutes = Math.min(Math.max(durationMinutes, 1), this.MAX_DURATION_MINUTES);
    const ms = cappedMinutes * 60 * 1000;
    const expiresAt = new Date(Date.now() + ms).toISOString();

    this.state = {
      enabled: true,
      expiresAt,
      workspaceId
    };

    this.expiryTimer = setTimeout(() => {
      this.handleExpiration(workspaceId);
    }, ms);
    if (this.expiryTimer && typeof this.expiryTimer.unref === 'function') {
      this.expiryTimer.unref();
    }

    this.auditLogger.logWorkspaceEvent({
      event: 'host_power_mode_enabled',
      workspaceId,
      toolName: 'host_power_mode',
      operation: 'enable',
      reason: `Enabled for ${cappedMinutes} minutes`,
      metadata: { expiresAt }
    });
  }

  public async disable(workspaceId: string): Promise<void> {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    if (this.state.enabled) {
      this.state = {
        enabled: false,
        expiresAt: null,
        workspaceId: null
      };

      await this.cleanup(workspaceId);

      this.auditLogger.logWorkspaceEvent({
        event: 'host_power_mode_disabled',
        workspaceId,
        toolName: 'host_power_mode',
        operation: 'disable',
        reason: 'Manually disabled via UI'
      });
    }
  }

  public getState(workspaceId: string): { enabled: boolean; timeLeftSeconds: number } {
    if (!this.state.enabled || this.state.workspaceId !== workspaceId) {
      return { enabled: false, timeLeftSeconds: 0 };
    }

    const expiresAtTime = new Date(this.state.expiresAt!).getTime();
    const timeLeftMs = expiresAtTime - Date.now();

    if (timeLeftMs <= 0) {
      // Expiration check on query
      this.handleExpiration(workspaceId);
      return { enabled: false, timeLeftSeconds: 0 };
    }

    return {
      enabled: true,
      timeLeftSeconds: Math.floor(timeLeftMs / 1000)
    };
  }

  public isHostPowerModeEnabled(workspaceId: string): boolean {
    return this.getState(workspaceId).enabled;
  }

  private async handleExpiration(workspaceId: string): Promise<void> {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }

    if (this.state.enabled) {
      this.state = {
        enabled: false,
        expiresAt: null,
        workspaceId: null
      };

      await this.cleanup(workspaceId);

      this.auditLogger.logWorkspaceEvent({
        event: 'host_power_mode_expired',
        workspaceId,
        toolName: 'host_power_mode',
        operation: 'expired',
        reason: 'TTL expired'
      });
    }
  }

  private async cleanup(workspaceId: string): Promise<void> {
    const db = await this.getDb();

    // Revoke/Delete all proposals for this workspace
    db.run(
      'DELETE FROM workspace_host_command_proposals WHERE workspace_id = ?',
      [workspaceId]
    );

    // Clear transit cache
    this.payloadCache.clear();

    for (const cb of this.onDisableCallbacks) {
      try {
        await cb(workspaceId);
      } catch (error: unknown) { const err = asErrorLike(error); logger.error('Error in HostPowerMode disable callback:', err);
      }
    }
  }

  // Helper for tests to clean up state/timers
  public destroy(): void {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    this.state = {
      enabled: false,
      expiresAt: null,
      workspaceId: null
    };
    HostPowerModeService.instance = null;
  }
}
