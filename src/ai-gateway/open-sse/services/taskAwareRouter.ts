export type TaskType =
  | "coding"
  | "creative"
  | "analysis"
  | "vision"
  | "summarization"
  | "background"
  | "chat"
  | "translation"
  | "default";

export type TaskModelMap = Partial<Record<TaskType, string>>;

export interface TaskRoutingConfig {
  enabled: boolean;
  detectionEnabled: boolean;
  taskModelMap: TaskModelMap;
  rules: TaskRoutingRule[];
  stats: TaskRoutingStats;
}

export interface TaskRoutingStats {
  checks: number;
  overrides: number;
  lastOverrideAt: number | null;
  resetAt: number;
}

export interface TaskRoutingRule {
  taskType: string;
  model: string;
  pattern?: string;
}

export interface TaskRoutingResult {
  taskType: string;
  model?: string;
  wasRouted: boolean;
}

const DEFAULT_TASK_MODEL_MAP: TaskModelMap = {
  coding: "claude-sonnet-4-6",
  creative: "claude-sonnet-4-6",
  analysis: "deepseek-r1",
  vision: "gemini-3-flash",
  summarization: "claude-sonnet-4-6",
  background: "claude-sonnet-4-6",
  chat: "claude-sonnet-4-6",
};

const taskRoutingConfig: TaskRoutingConfig = {
  enabled: false,
  detectionEnabled: true,
  taskModelMap: {},
  rules: [],
  stats: { checks: 0, overrides: 0, lastOverrideAt: null, resetAt: Date.now() },
};

export function getTaskRoutingConfig(): TaskRoutingConfig {
  return {
    ...taskRoutingConfig,
    taskModelMap: { ...taskRoutingConfig.taskModelMap },
    stats: { ...taskRoutingConfig.stats },
  };
}

export function setTaskRoutingConfig(config: Partial<TaskRoutingConfig>): void {
  if (typeof config.enabled === "boolean") {
    taskRoutingConfig.enabled = config.enabled;
  }
  if (typeof config.detectionEnabled === "boolean") {
    taskRoutingConfig.detectionEnabled = config.detectionEnabled;
  }
  if (config.taskModelMap) {
    taskRoutingConfig.taskModelMap = { ...config.taskModelMap };
  }
  if (config.rules) {
    taskRoutingConfig.rules = [...config.rules];
  }
}

export function getDefaultTaskModelMap(): TaskModelMap {
  return { ...DEFAULT_TASK_MODEL_MAP };
}

export function resetTaskRoutingStats(): void {
  taskRoutingConfig.stats = {
    checks: 0,
    overrides: 0,
    lastOverrideAt: null,
    resetAt: Date.now(),
  };
}

function recordRoutingStat(overrode: boolean): void {
  const stats = taskRoutingConfig.stats;
  stats.checks += 1;
  if (overrode) {
    stats.overrides += 1;
    stats.lastOverrideAt = Date.now();
  }
}

export function detectTaskType(body: Record<string, unknown>): TaskType {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const lastMessage = messages[messages.length - 1] as Record<string, unknown> | undefined;
  const content = typeof lastMessage?.content === "string" ? lastMessage.content : "";
  const haystack = content.toLowerCase();

  if (haystack.includes("translate")) return "translation";
  if (haystack.includes("summarize") || haystack.includes("summary")) return "summarization";
  if (haystack.includes("analy") || haystack.includes("explain")) return "analysis";
  if (haystack.includes("vision") || haystack.includes("image")) return "vision";
  if (haystack.includes("creative") || haystack.includes("write") || haystack.includes("draft")) {
    return "creative";
  }
  if (body.background === true || haystack.includes("background")) return "background";
  if (
    haystack.includes("code") ||
    haystack.includes("implement") ||
    haystack.includes("debug") ||
    haystack.includes("function")
  ) {
    return "coding";
  }
  return "default";
}

export function applyTaskAwareRouting(
  defaultModel: string,
  body: Record<string, unknown>
): TaskRoutingResult {
  if (!taskRoutingConfig.enabled) {
    return { taskType: "default", wasRouted: false };
  }

  const taskType = detectTaskType(body);
  const override =
    taskRoutingConfig.taskModelMap[taskType] ||
    taskRoutingConfig.rules.find((rule) => rule.taskType === taskType)?.model ||
    DEFAULT_TASK_MODEL_MAP[taskType];

  if (override) {
    recordRoutingStat(true);
    return { taskType, model: override, wasRouted: true };
  }

  recordRoutingStat(false);
  return { taskType, model: defaultModel, wasRouted: false };
}
