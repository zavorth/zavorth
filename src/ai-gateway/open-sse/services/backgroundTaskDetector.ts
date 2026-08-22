export interface BackgroundTaskInfo {
  id: string;
  type: string;
  startedAt: number;
  userId?: string;
}

const backgroundTasks = new Map<string, BackgroundTaskInfo>();

export function registerBackgroundTask(task: BackgroundTaskInfo): void {
  backgroundTasks.set(task.id, task);
}

export function removeBackgroundTask(taskId: string): void {
  backgroundTasks.delete(taskId);
}

export function getActiveBackgroundTasks(): BackgroundTaskInfo[] {
  const cutoff = Date.now() - 60 * 60 * 1000;
  const active: BackgroundTaskInfo[] = [];
  for (const [id, task] of backgroundTasks.entries()) {
    if (task.startedAt >= cutoff) {
      active.push(task);
    } else {
      backgroundTasks.delete(id);
    }
  }
  return active;
}

export function detectBackgroundTaskFromBody(body: Record<string, unknown>): boolean {
  return body.stream === false && body.background === true;
}

export interface BackgroundDegradationStats {
  totalChecks: number;
  degradedCount: number;
  lastDegradedAt: number | null;
  resetAt: number;
}

export interface BackgroundDegradationConfig {
  enabled: boolean;
  degradationMap: Record<string, number>;
  detectionPatterns: string[];
  stats: BackgroundDegradationStats;
}

const backgroundDegradationConfig: BackgroundDegradationConfig = {
  enabled: false,
  degradationMap: {},
  detectionPatterns: [],
  stats: { totalChecks: 0, degradedCount: 0, lastDegradedAt: null, resetAt: Date.now() },
};

export function getBackgroundDegradationConfig(): BackgroundDegradationConfig {
  return {
    ...backgroundDegradationConfig,
    degradationMap: { ...backgroundDegradationConfig.degradationMap },
    detectionPatterns: [...backgroundDegradationConfig.detectionPatterns],
    stats: { ...backgroundDegradationConfig.stats },
  };
}

export function setBackgroundDegradationConfig(config: Record<string, unknown>): void {
  if (typeof config.enabled === "boolean") {
    backgroundDegradationConfig.enabled = config.enabled;
  }
  if (
    config.degradationMap &&
    typeof config.degradationMap === "object" &&
    !Array.isArray(config.degradationMap)
  ) {
    const coerced: Record<string, number> = {};
    for (const [key, value] of Object.entries(config.degradationMap as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) coerced[key] = value;
    }
    backgroundDegradationConfig.degradationMap = coerced;
  }
  if (Array.isArray(config.detectionPatterns)) {
    backgroundDegradationConfig.detectionPatterns = config.detectionPatterns.filter(
      (pattern): pattern is string => typeof pattern === "string"
    );
  }
}

export function resetStats(): void {
  backgroundDegradationConfig.stats = {
    totalChecks: 0,
    degradedCount: 0,
    lastDegradedAt: null,
    resetAt: Date.now(),
  };
}
