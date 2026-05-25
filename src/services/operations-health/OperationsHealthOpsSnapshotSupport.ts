import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import type { SystemLog } from '../../storage/LogRepository.js';
import { isWeakDashboardToken } from '../DashboardTokenService.js';

type OperationsHealthOpsSnapshotSupportOptions = {
  now: () => Date;
  statfsSync: typeof fs.statfsSync;
  existsSync: typeof fs.existsSync;
  readFileSync: typeof fs.readFileSync;
  logRepo: { getRecentLogs: (limit: number) => SystemLog[] };
};

export class OperationsHealthOpsSnapshotSupport {
  private readonly now: () => Date;
  private readonly statfsSync: typeof fs.statfsSync;
  private readonly existsSync: typeof fs.existsSync;
  private readonly readFileSync: typeof fs.readFileSync;
  private readonly logRepo: { getRecentLogs: (limit: number) => SystemLog[] };
  private sizeCache: { generatedAt: number; hotspots: Array<{ id: string; label: string; path: string; bytes: number }> } | null = null;

  constructor(options: OperationsHealthOpsSnapshotSupportOptions) {
    this.now = options.now;
    this.statfsSync = options.statfsSync;
    this.existsSync = options.existsSync;
    this.readFileSync = options.readFileSync;
    this.logRepo = options.logRepo;
  }

  public readMaintenanceSnapshot(): any {
    try {
      if (!this.existsSync(config.maintenanceStatusFile)) {
        return {
          available: false,
          startedAt: null,
          finishedAt: null,
          stepCount: 0,
          completedSteps: 0,
          dryRun: false,
          withSoak: false,
          withPublish: false,
        };
      }

      const parsed = JSON.parse(this.readFileSync(config.maintenanceStatusFile, 'utf8')) as any;
      const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
      return {
        available: true,
        startedAt: typeof parsed.startedAt === 'string' ? parsed.startedAt : null,
        finishedAt: typeof parsed.finishedAt === 'string' ? parsed.finishedAt : null,
        stepCount: steps.length,
        completedSteps: steps.filter((step: any) => step?.status === 'completed').length,
        dryRun: parsed.dryRun === true,
        withSoak: parsed.withSoak === true,
        withPublish: parsed.withPublish === true,
      };
    } catch {
      return {
        available: false,
        startedAt: null,
        finishedAt: null,
        stepCount: 0,
        completedSteps: 0,
        dryRun: false,
        withSoak: false,
        withPublish: false,
      };
    }
  }

  public readStorageSnapshot(cachedHotspotsOnly = false): any {
    const rootPath = config.dataDir;
    let totalBytes = 0;
    let freeBytes = 0;

    try {
      const stats = this.statfsSync(rootPath, { bigint: false } as any);
      const blockSize = Number((stats as any).bsize || 0);
      totalBytes = Number((stats as any).blocks || 0) * blockSize;
      freeBytes = Number((stats as any).bavail || 0) * blockSize;
    } catch {
      totalBytes = 0;
      freeBytes = 0;
    }

    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 1000) / 10 : 0;

    return {
      rootPath,
      totalBytes,
      freeBytes,
      usedBytes,
      freePercent,
      hotspots: this.readHotspots(cachedHotspotsOnly),
    };
  }

  public readRecentErrors(): any {
    const recentLogs = this.logRepo
      .getRecentLogs(150)
      .filter((entry) => entry.level === 'error' || entry.level === 'security' || entry.level === 'warn')
      .filter((entry) => !this.shouldIgnoreOperationalWarning(entry));

    const mapped = recentLogs.slice(0, 5).map((entry) => this.mapLog(entry));
    return {
      lastError: mapped[0] || null,
      recent: mapped,
    };
  }

  public buildEstimatedSecuritySnapshot(cachedSecurity?: any): any {
    if (cachedSecurity) {
      return cachedSecurity;
    }

    const dashboardAuthSource =
      String(config.zavorthWebAuthToken || '').trim() &&
      !isWeakDashboardToken(config.zavorthWebAuthToken)
        ? ('env' as const)
        : (this.existsSync(config.zavorthWebAuthTokenFile) ? ('runtime-file' as const) : ('missing' as const));
    const mailboxSource =
      String(process.env.ZAVORTH_MAILBOX_SECRET || '').trim()
        ? ('env' as const)
        : (this.existsSync(config.mailboxSecretFile) ? ('runtime-file' as const) : ('missing' as const));
    const dbSource =
      String(config.dbEncryptionKey || '').trim()
        ? ('env' as const)
        : (this.existsSync(config.dbEncryptionKeyFile) ? ('runtime-file' as const) : ('missing' as const));
    const hostIdentityExists = this.existsSync(config.hostIdentityFile);
    const lastAudit = this.readEstimatedSecurityCheck(config.securityAuditStatusFile);
    const lastPreflight = this.readEstimatedSecurityCheck(config.securityPreflightStatusFile);

    return {
      dashboardAuth: {
        enabled: dashboardAuthSource !== 'missing',
        source: dashboardAuthSource,
        tokenFile: config.zavorthWebAuthTokenFile,
        tokenFileExists: this.existsSync(config.zavorthWebAuthTokenFile),
        note: 'Fast snapshot reutilizou verificacoes basicas. Use --live para auditar a trilha completa.',
      },
      mailboxSecret: {
        source: mailboxSource,
        filePath: config.mailboxSecretFile,
        fileExists: this.existsSync(config.mailboxSecretFile),
      },
      dbEncryption: {
        enabled: dbSource !== 'missing',
        source: dbSource,
        filePath: config.dbEncryptionKeyFile,
        fileExists: this.existsSync(config.dbEncryptionKeyFile),
      },
      hostIdentity: {
        filePath: config.hostIdentityFile,
        exists: hostIdentityExists,
      },
      lastAudit: {
        ...lastAudit,
        trailAvailable: false,
        trailDir: config.securityAuditTrailDir,
        eventsFile: path.join(config.securityAuditTrailDir, 'events.ndjson'),
        ledgerFile: path.join(config.securityAuditTrailDir, 'ledger.json'),
        totalEvents: 0,
        latestEventId: null,
        latestEventType: null,
        latestTaskId: null,
        latestTimestamp: null,
        latestChainHash: null,
        recentChain: [],
      },
      lastPreflight,
      needsAttention:
        dashboardAuthSource === 'missing'
        || mailboxSource === 'missing'
        || dbSource === 'missing'
        || !hostIdentityExists
        || lastAudit.ok === false
        || lastPreflight.ok === false,
    };
  }

  public buildEstimatedErrors(cachedErrors?: any): any {
    if (cachedErrors) {
      return cachedErrors;
    }

    return {
      lastError: null,
      recent: [],
    };
  }

  public readPublishSnapshot(): any {
    try {
      if (!this.existsSync(config.lastPublishStatusFile)) {
        return {
          available: false,
          publishedAt: null,
          branch: null,
          commit: null,
          sourceArchiveId: null,
          docsUrl: null,
          remoteConsoleUrl: null,
          gitPush: null,
          smokeTest: null,
          history: this.readPublishHistory(),
        };
      }

      const parsed = JSON.parse(this.readFileSync(config.lastPublishStatusFile, 'utf8')) as any;
      return {
        available: true,
        publishedAt: typeof parsed.publishedAt === 'string' ? parsed.publishedAt : null,
        branch: typeof parsed.branch === 'string' ? parsed.branch : null,
        commit: typeof parsed.commit === 'string' ? parsed.commit : null,
        sourceArchiveId: typeof parsed.sourceArchiveId === 'string' ? parsed.sourceArchiveId : null,
        docsUrl:
          typeof parsed.targets?.docs?.productionUrl === 'string'
            ? parsed.targets.docs.productionUrl
            : typeof parsed.targets?.docs?.deploymentUrl === 'string'
              ? parsed.targets.docs.deploymentUrl
              : null,
        remoteConsoleUrl:
          typeof parsed.targets?.remoteConsole?.productionUrl === 'string'
            ? parsed.targets.remoteConsole.productionUrl
            : typeof parsed.targets?.remoteConsole?.deploymentUrl === 'string'
              ? parsed.targets.remoteConsole.deploymentUrl
              : null,
        gitPush: typeof parsed.gitPush === 'string' ? parsed.gitPush : null,
        smokeTest: typeof parsed.smokeTest === 'string' ? parsed.smokeTest : null,
        history: this.readPublishHistory(),
      };
    } catch {
      return {
        available: false,
        publishedAt: null,
        branch: null,
        commit: null,
        sourceArchiveId: null,
        docsUrl: null,
        remoteConsoleUrl: null,
        gitPush: null,
        smokeTest: null,
        history: this.readPublishHistory(),
      };
    }
  }

  public readPublishHistory(): any {
    try {
      if (!this.existsSync(config.publishHistoryFile)) {
        return [];
      }

      const parsed = JSON.parse(this.readFileSync(config.publishHistoryFile, 'utf8'));
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.slice(0, 4).map((entry: any) => ({
        publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt : null,
        branch: typeof entry.branch === 'string' ? entry.branch : null,
        commit: typeof entry.commit === 'string' ? entry.commit : null,
        docsUrl:
          typeof entry.targets?.docs?.productionUrl === 'string'
            ? entry.targets.docs.productionUrl
            : typeof entry.targets?.docs?.deploymentUrl === 'string'
              ? entry.targets.docs.deploymentUrl
              : null,
        remoteConsoleUrl:
          typeof entry.targets?.remoteConsole?.productionUrl === 'string'
            ? entry.targets.remoteConsole.productionUrl
            : typeof entry.targets?.remoteConsole?.deploymentUrl === 'string'
              ? entry.targets.remoteConsole.deploymentUrl
              : null,
        archiveId: typeof entry.archive?.id === 'string' ? entry.archive.id : null,
        sourceArchiveId: typeof entry.sourceArchiveId === 'string' ? entry.sourceArchiveId : null,
      }));
    } catch {
      return [];
    }
  }

  public readMaintenanceAutomationSnapshot(): any {
    const fallback: any = {
      enabled: config.maintenanceAutomationEnabled,
      running: false,
      lastTriggeredAt: null,
      lastTriggerSource: null,
      lastPriorityReason: null,
      nextPlannedAt: null,
      updatedAt: null,
      updatedBy: null,
      note: null,
      lastActionId: null,
      lastActionLogFile: null,
      lastReportFinishedAt: null,
      lastReportStepCount: 0,
    };

    let state: any = fallback;
    try {
      if (this.existsSync(config.maintenanceAutomationStateFile)) {
        const parsed = JSON.parse(this.readFileSync(config.maintenanceAutomationStateFile, 'utf8')) as any;
        const nextPlannedAt = this.computeNextMaintenanceAutomationAt(
          parsed.enabled !== false,
          this.now(),
          config.maintenanceAutomationHour,
          config.maintenanceAutomationMinute,
        );
        state = {
          enabled: parsed.enabled !== false,
          running: parsed.running === true,
          lastTriggeredAt: typeof parsed.lastTriggeredAt === 'string' ? parsed.lastTriggeredAt : null,
          lastTriggerSource:
            parsed.lastTriggerSource === 'automation' || parsed.lastTriggerSource === 'manual' || parsed.lastTriggerSource === 'priority'
              ? parsed.lastTriggerSource
              : null,
          lastPriorityReason: typeof parsed.lastPriorityReason === 'string' ? parsed.lastPriorityReason : null,
          nextPlannedAt,
          updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null,
          updatedBy: typeof parsed.updatedBy === 'string' ? parsed.updatedBy : null,
          note: typeof parsed.note === 'string' ? parsed.note : null,
          lastActionId: typeof parsed.lastActionId === 'string' ? parsed.lastActionId : null,
          lastActionLogFile: typeof parsed.lastActionLogFile === 'string' ? parsed.lastActionLogFile : null,
          lastReportFinishedAt: null,
          lastReportStepCount: 0,
        };
      } else {
        state.nextPlannedAt = this.computeNextMaintenanceAutomationAt(
          state.enabled,
          this.now(),
          config.maintenanceAutomationHour,
          config.maintenanceAutomationMinute,
        );
      }
    } catch {
      state = {
        ...fallback,
        nextPlannedAt: this.computeNextMaintenanceAutomationAt(
          fallback.enabled,
          this.now(),
          config.maintenanceAutomationHour,
          config.maintenanceAutomationMinute,
        ),
      };
    }

    try {
      if (this.existsSync(config.maintenanceAutomationReportFile)) {
        const report = JSON.parse(this.readFileSync(config.maintenanceAutomationReportFile, 'utf8')) as any;
        state = {
          ...state,
          lastReportFinishedAt: typeof report.finishedAt === 'string' ? report.finishedAt : null,
          lastReportStepCount: Array.isArray(report.steps) ? report.steps.length : 0,
        };
      }
    } catch {
      // Ignore report parsing failures and preserve state snapshot.
    }

    return state;
  }

  public computeNextMaintenanceAutomationAt(enabled: boolean, now: Date, hour: number, minute: number): string | null {
    if (!enabled) {
      return null;
    }

    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next.toISOString();
  }

  public readHotspots(cachedOnly = false): any[] {
    const nowMs = this.now().getTime();
    if (this.sizeCache && nowMs - this.sizeCache.generatedAt < 5 * 60 * 1000) {
      return this.sizeCache.hotspots;
    }

    if (cachedOnly) {
      return this.sizeCache?.hotspots || [];
    }

    const targets: Array<{ id: string; label: string; path: string }> = [
      { id: 'vendor-worktrees', label: 'Vendor worktrees', path: path.resolve(config.vendorWorktreeDir) },
      { id: 'root-node-modules', label: 'Node modules', path: path.resolve(config.defaultWorkspace, 'node_modules') },
      { id: 'docs-site', label: 'Docs repo', path: path.resolve(config.zavorthDocsRepoRoot) },
    ];

    const hotspots = targets.map((target) => ({
      ...target,
      bytes: this.safeDirectorySize(target.path),
    }));

    this.sizeCache = {
      generatedAt: nowMs,
      hotspots,
    };

    return hotspots;
  }

  public safeDirectorySize(targetPath: string): number {
    try {
      if (!this.existsSync(targetPath)) {
        return 0;
      }

      const stats = fs.lstatSync(targetPath);
      if (!stats.isDirectory()) {
        return stats.size;
      }

      let total = 0;
      for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
        total += this.safeDirectorySize(path.join(targetPath, entry.name));
      }
      return total;
    } catch {
      return 0;
    }
  }

  public shouldIgnoreOperationalWarning(entry: SystemLog): boolean {
    if (entry.level !== 'warn') {
      return false;
    }

    const category = String(entry.category || '').trim();
    const message = String(entry.message || '').trim().toLowerCase();
    if (!message) {
      return false;
    }

    if (
      category === 'AIGatewayGateway'
      && message.includes('nao estava online durante o bootstrap principal')
      && message.includes('iniciado sob demanda')
    ) {
      return true;
    }

    if (
      category === 'Bootstrap'
      && (
        message.includes('planned/stub via stub')
        || message.includes('discord native gateway is present')
        || message.includes('native discord client is preferred')
      )
    ) {
      return true;
    }

    return false;
  }

  public mapLog(entry: SystemLog): any {
    return {
      timestamp: entry.timestamp || null,
      level: entry.level,
      category: entry.category,
      message: entry.message,
    };
  }

  public readEstimatedSecurityCheck(filePath: string): any {
    try {
      if (!this.existsSync(filePath)) {
        return {
          available: false,
          generatedAt: null,
          ok: null,
          summary: null,
        };
      }

      const parsed = JSON.parse(this.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
      return {
        available: true,
        generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : null,
        ok: typeof parsed.ok === 'boolean' ? parsed.ok : null,
        summary: typeof parsed.summary === 'string' ? parsed.summary : null,
      };
    } catch {
      return {
        available: false,
        generatedAt: null,
        ok: null,
        summary: null,
      };
    }
  }
}
