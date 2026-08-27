import {
  getLastProviderLimitsAutoSyncTime,
  getProviderLimitsSyncIntervalMinutes,
  getProviderLimitsSyncIntervalMs,
  syncAllProviderLimits,
} from "@/lib/usage/providerLimits";
import { logger } from "@/shared/utils/logger";const STARTUP_DELAY_MS = 5_000;

let schedulerTimer: NodeJS.Timeout | null = null;
let startupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

async function runProviderLimitsSyncCycle(): Promise<void> {
  if (isRunning) {
    logger.info("[ProviderLimitsSync] Skipping cycle — previous run still in progress");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    const result = await syncAllProviderLimits({ source: "scheduled" });
    logger.info(
      `[ProviderLimitsSync] Cycle complete: ${result.succeeded}/${result.total} synced in ${Date.now() - start}ms`
    );
  } catch (error: unknown) {logger.warn("[ProviderLimitsSync] Cycle failed:", (error as Error).message);
  } finally {
    isRunning = false;
  }
}

export function startProviderLimitsSyncScheduler(): void {
  if (schedulerTimer || startupTimer) {
    logger.info("[ProviderLimitsSync] Scheduler already running — skipping start");
    return;
  }

  const intervalMs = getProviderLimitsSyncIntervalMs();
  const intervalMinutes = getProviderLimitsSyncIntervalMinutes();

  logger.info(`[ProviderLimitsSync] Scheduler started — interval: ${intervalMinutes}m`);

  void (async () => {
    let initialDelayMs = STARTUP_DELAY_MS;
    const lastAutoSyncAt = await getLastProviderLimitsAutoSyncTime();

    if (lastAutoSyncAt) {
      const lastRunMs = Date.parse(lastAutoSyncAt);
      if (Number.isFinite(lastRunMs)) {
        const elapsedMs = Date.now() - lastRunMs;
        if (elapsedMs < intervalMs) {
          initialDelayMs = Math.max(intervalMs - elapsedMs, STARTUP_DELAY_MS);
        }
      }
    }

    startupTimer = setTimeout(() => {
      startupTimer = null;
      void runProviderLimitsSyncCycle();

      schedulerTimer = setInterval(() => {
        void runProviderLimitsSyncCycle();
      }, intervalMs);
      schedulerTimer.unref?.();
    }, initialDelayMs);

    startupTimer.unref?.();
  })();
}

export function stopProviderLimitsSyncScheduler(): void {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }

  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("[ProviderLimitsSync] Scheduler stopped");
  }
}
