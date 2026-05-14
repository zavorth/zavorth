import type {
  RuntimeOfficialRemoteAccessCacheEntry,
  RuntimeOfficialRemoteAccessOptions,
  RuntimeOfficialRemoteAccessReport,
} from './RuntimeOfficialRemoteAccessTypes.js';

export class RuntimeOfficialRemoteAccessCache {
  private cachedInspectReport: RuntimeOfficialRemoteAccessCacheEntry | null = null;

  public get(cacheKey: string | null, nowMs: number): RuntimeOfficialRemoteAccessReport | null {
    if (!cacheKey || !this.cachedInspectReport) {
      return null;
    }

    if (this.cachedInspectReport.key !== cacheKey || this.cachedInspectReport.expiresAt <= nowMs) {
      return null;
    }

    return this.cachedInspectReport.report;
  }

  public set(cacheKey: string | null, nowMs: number, report: RuntimeOfficialRemoteAccessReport): void {
    if (!cacheKey) {
      return;
    }

    this.cachedInspectReport = {
      key: cacheKey,
      expiresAt: nowMs + 5_000,
      report,
    };
  }

  public clear(): void {
    this.cachedInspectReport = null;
  }

  public buildInspectCacheKey(options: RuntimeOfficialRemoteAccessOptions): string | null {
    if (options.dryRun !== true || options.autoTrustLocal === true) {
      return null;
    }

    return JSON.stringify({
      dryRun: true,
      requireMutableAccess: options.requireMutableAccess === true,
      timeoutMs: options.timeoutMs ?? null,
      pollIntervalMs: options.pollIntervalMs ?? null,
    });
  }
}
