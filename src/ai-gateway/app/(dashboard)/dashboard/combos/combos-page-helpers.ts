import { ROUTING_STRATEGIES } from "@/shared/constants/routingStrategies";
// Validate combo name: letters, numbers, -, _, /, .
export const VALID_NAME_REGEX = /^[a-zA-Z0-9_/.-]+$/;

export const STRATEGY_OPTIONS = ROUTING_STRATEGIES.map((strategy) => ({
  value: strategy.value,
  labelKey: strategy.labelKey,
  descKey: strategy.combosDescKey,
  icon: strategy.icon,
}));

export const STRATEGY_LABEL_FALLBACK = {
  "context-relay": "Context Relay",
};

export const STRATEGY_DESC_FALLBACK = {
  "context-relay":
    "Priority-style routing with automatic context handoffs when account rotation happens.",
};

export const STRATEGY_GUIDANCE_FALLBACK = {
  priority: {
    when: "Use when you have one preferred model and only want fallback on failure.",
    avoid: "Avoid when you need balanced load between models.",
    example: "Example: Primary coding model with cheaper backup for outages.",
  },
  weighted: {
    when: "Use when you need controlled traffic split across models.",
    avoid: "Avoid when weights are not maintained or you need strict fairness.",
    example: "Example: 80% stable model and 20% canary model for safe rollout.",
  },
  "round-robin": {
    when: "Use when you need predictable, even request distribution.",
    avoid: "Avoid when model latency/cost differs significantly.",
    example: "Example: Same model across multiple accounts to spread throughput.",
  },
  "context-relay": {
    when: "Use when long sessions must survive account rotation without losing the working context.",
    avoid:
      "Avoid when account switching is rare or when you do not want extra summarization requests.",
    example: "Example: Codex sessions that rotate across multiple accounts near quota exhaustion.",
  },
  random: {
    when: "Use when you want a simple spread with low configuration effort.",
    avoid: "Avoid when requests must be distributed with strict guarantees.",
    example: "Example: Prototyping with equivalent models and no traffic policy.",
  },
  "least-used": {
    when: "Use when you want adaptive balancing based on recent demand.",
    avoid: "Avoid when your traffic is too low to benefit from usage balancing.",
    example: "Example: Mixed workloads where one model tends to get overloaded.",
  },
  "cost-optimized": {
    when: "Use when minimizing cost is the top priority.",
    avoid: "Avoid when pricing data is missing or outdated.",
    example: "Example: Batch or background jobs where lower cost matters most.",
  },
  "fill-first": {
    when: "Use when you want to drain one provider's quota fully before moving to the next.",
    avoid: "Avoid when you need request-level load balancing across providers.",
    example: "Example: Use all $200 Deepgram credits before falling to Groq.",
  },
  p2c: {
    when: "Use when you want low-latency selection using Power-of-Two-Choices algorithm.",
    avoid: "Avoid for small combos with 2 or fewer models â€” no benefit over round-robin.",
    example: "Example: High-throughput inference across 4+ equivalent model endpoints.",
  },
  "strict-random": {
    when: "Use when you want perfectly even spread â€” each model used once before repeating.",
    avoid: "Avoid when models have different quality or latency and order matters.",
    example: "Example: Multiple accounts of the same model to distribute usage evenly.",
  },
};

export const ADVANCED_FIELD_HELP_FALLBACK = {
  maxRetries: "How many retries are attempted before failing the request.",
  retryDelay: "Initial delay between retries. Higher values reduce burst pressure.",
  timeout: "Maximum request time before aborting. Set higher for long generations.",
  healthcheck: "Skips unhealthy models/providers from routing decisions when enabled.",
  concurrencyPerModel: "Max simultaneous requests sent to each model in round-robin.",
  queueTimeout: "How long a request can wait in queue before timeout in round-robin.",
};

export const STRATEGY_RECOMMENDATIONS_FALLBACK = {
  priority: {
    title: "Fail-safe baseline",
    description: "Use one primary model and keep fallback chain short and reliable.",
    tips: [
      "Put your most reliable model first.",
      "Keep 1-2 backup models with similar quality.",
      "Use safe retries to absorb transient provider failures.",
    ],
  },
  weighted: {
    title: "Controlled traffic split",
    description: "Great for canary rollouts and gradual migration between models.",
    tips: [
      "Start with conservative split like 90/10.",
      "Keep the total at 100% and auto-balance after changes.",
      "Monitor success and latency before increasing canary weight.",
    ],
  },
  "round-robin": {
    title: "Predictable load sharing",
    description: "Best when models are equivalent and you need smooth distribution.",
    tips: [
      "Use at least 2 models.",
      "Set concurrency limits to avoid burst overload.",
      "Use queue timeout to fail fast under saturation.",
    ],
  },
  "context-relay": {
    title: "Session continuity first",
    description:
      "Best when account rotation is expected and the next account must inherit a condensed task summary.",
    tips: [
      "Use with providers that rotate accounts for the same model family.",
      "Keep the handoff threshold below the hard quota cutoff to give the summary time to generate.",
      "Set a dedicated summary model only when the primary model is too expensive or unstable.",
    ],
  },
  random: {
    title: "Quick spread with low setup",
    description: "Use when you need simple distribution without strict guarantees.",
    tips: [
      "Use models with similar latency profiles.",
      "Keep retries enabled to absorb random misses.",
      "Prefer this for experimentation, not strict SLAs.",
    ],
  },
  "least-used": {
    title: "Adaptive balancing",
    description: "Routes to less-used models to reduce hotspots over time.",
    tips: [
      "Works better under continuous traffic.",
      "Combine with health checks for safer balancing.",
      "Track per-model usage to validate distribution gains.",
    ],
  },
  "cost-optimized": {
    title: "Budget-first routing",
    description: "Routes to lower-cost models when pricing metadata is available.",
    tips: [
      "Ensure pricing coverage for all selected models.",
      "Keep a quality fallback for hard prompts.",
      "Use for batch/background jobs where cost is the main KPI.",
    ],
  },
  "fill-first": {
    title: "Quota drain strategy",
    description: "Exhausts one provider's quota before moving to the next in chain.",
    tips: [
      "Order models by free quota size â€” biggest first.",
      "Enable health checks to skip drained providers.",
      "Ideal for free-tier stacking (Deepgram â†’ Groq â†’ NIM).",
    ],
  },
  p2c: {
    title: "Power-of-Two-Choices",
    description:
      "Picks the less-loaded of two random candidates per request â€” low latency at scale.",
    tips: [
      "Use with 4+ models for best effect.",
      "Requires latency telemetry enabled in Settings.",
      "Great replacement for round-robin in high-throughput combos.",
    ],
  },
  "strict-random": {
    title: "Shuffle deck distribution",
    description: "Each model is used exactly once per cycle before reshuffling.",
    tips: [
      "Use at least 2 models for meaningful distribution.",
      "Ideal for same-model accounts to evenly spread quota.",
      "Guarantees no model is skipped or repeated within a cycle.",
    ],
  },
};

export const COMBO_USAGE_GUIDE_STORAGE_KEY = "ZavorthGateway:combos:hide-usage-guide";

export const COMBO_TEMPLATE_FALLBACK = {
  title: "Quick templates",
  description: "Apply a starting profile, then adjust models and config.",
  apply: "Apply template",
  highAvailabilityTitle: "High availability",
  highAvailabilityDesc: "Priority routing with health checks and safe retries.",
  costSaverTitle: "Cost saver",
  costSaverDesc: "Cost-optimized routing for budget-first workloads.",
  balancedTitle: "Balanced load",
  balancedDesc: "Least-used routing to spread demand over time.",
  freeStackTitle: "Free Stack ($0)",
  freeStackDesc:
    "Round-robin across all free providers: Kiro, iFlow, Qwen, Gemini CLI. Zero cost, never stops.",
  paidPremiumTitle: "Paid Premium",
  paidPremiumDesc:
    "Round-robin across paid subscriptions: Cursor, ZavorthBridge. Top-tier models, distributed load.",
};

export const COMBO_TEMPLATES = [
  {
    id: "free-stack",
    icon: "volunteer_activism",
    titleKey: "templateFreeStack",
    descKey: "templateFreeStackDesc",
    fallbackTitle: COMBO_TEMPLATE_FALLBACK.freeStackTitle,
    fallbackDesc: COMBO_TEMPLATE_FALLBACK.freeStackDesc,
    strategy: "round-robin",
    suggestedName: "free-stack",
    isFeatured: true,
    config: {
      maxRetries: 3,
      retryDelayMs: 500,
      healthCheckEnabled: true,
    },
  },
  {
    id: "high-availability",
    icon: "shield",
    titleKey: "templateHighAvailability",
    descKey: "templateHighAvailabilityDesc",
    fallbackTitle: COMBO_TEMPLATE_FALLBACK.highAvailabilityTitle,
    fallbackDesc: COMBO_TEMPLATE_FALLBACK.highAvailabilityDesc,
    strategy: "priority",
    suggestedName: "high-availability",
    config: {
      maxRetries: 2,
      retryDelayMs: 1500,
      healthCheckEnabled: true,
    },
  },
  {
    id: "cost-saver",
    icon: "savings",
    titleKey: "templateCostSaver",
    descKey: "templateCostSaverDesc",
    fallbackTitle: COMBO_TEMPLATE_FALLBACK.costSaverTitle,
    fallbackDesc: COMBO_TEMPLATE_FALLBACK.costSaverDesc,
    strategy: "cost-optimized",
    suggestedName: "cost-saver",
    config: {
      maxRetries: 1,
      retryDelayMs: 500,
      healthCheckEnabled: true,
    },
  },
  {
    id: "balanced",
    icon: "balance",
    titleKey: "templateBalanced",
    descKey: "templateBalancedDesc",
    fallbackTitle: COMBO_TEMPLATE_FALLBACK.balancedTitle,
    fallbackDesc: COMBO_TEMPLATE_FALLBACK.balancedDesc,
    strategy: "least-used",
    suggestedName: "balanced-load",
    config: {
      maxRetries: 1,
      retryDelayMs: 1000,
      healthCheckEnabled: true,
    },
  },
  {
    id: "paid-premium",
    icon: "workspace_premium",
    titleKey: "templatePaidPremium",
    descKey: "templatePaidPremiumDesc",
    fallbackTitle: COMBO_TEMPLATE_FALLBACK.paidPremiumTitle,
    fallbackDesc: COMBO_TEMPLATE_FALLBACK.paidPremiumDesc,
    strategy: "round-robin",
    suggestedName: "paid-premium",
    config: {
      maxRetries: 2,
      retryDelayMs: 1000,
      healthCheckEnabled: true,
    },
  },
];

export function getStrategyMeta(strategy) {
  return STRATEGY_OPTIONS.find((s) => s.value === strategy) || STRATEGY_OPTIONS[0];
}

export function getStrategyLabel(t, strategy) {
  const key = getStrategyMeta(strategy).labelKey;
  return getI18nOrFallback(t, key, STRATEGY_LABEL_FALLBACK[strategy] || strategy);
}

export function getStrategyDescription(t, strategy) {
  const key = getStrategyMeta(strategy).descKey;
  return getI18nOrFallback(
    t,
    key,
    STRATEGY_DESC_FALLBACK[strategy] || STRATEGY_DESC_FALLBACK.priority || strategy
  );
}

export function getStrategyBadgeClass(strategy) {
  if (strategy === "weighted") return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (strategy === "round-robin") return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (strategy === "context-relay")
    return "bg-fuchsia-500/15 text-fuchsia-600 dark:text-fuchsia-400";
  if (strategy === "random") return "bg-purple-500/15 text-purple-600 dark:text-purple-400";
  if (strategy === "least-used") return "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400";
  if (strategy === "cost-optimized") return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  if (strategy === "fill-first") return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  if (strategy === "p2c") return "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400";
  return "bg-blue-500/15 text-blue-600 dark:text-blue-400";
}

export function getI18nOrFallback(t, key, fallback) {
  if (typeof t.has === "function" && t.has(key)) return t(key);
  return fallback;
}

export function moveArrayItem(items, fromIndex, toIndex) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, movedItem);
  return nextItems;
}

export function getStrategyGuideText(t, strategy, field) {
  const strategyFallback =
    STRATEGY_GUIDANCE_FALLBACK[strategy] || STRATEGY_GUIDANCE_FALLBACK.priority;
  const key = `strategyGuide.${strategy}.${field}`;
  return getI18nOrFallback(t, key, strategyFallback[field]);
}

export function getStrategyRecommendationText(t, strategy, field) {
  const strategyFallback =
    STRATEGY_RECOMMENDATIONS_FALLBACK[strategy] || STRATEGY_RECOMMENDATIONS_FALLBACK.priority;

  if (field === "tips") {
    return strategyFallback.tips.map((tip, index) =>
      getI18nOrFallback(t, `strategyRecommendations.${strategy}.tip${index + 1}`, tip)
    );
  }

  return getI18nOrFallback(
    t,
    `strategyRecommendations.${strategy}.${field}`,
    strategyFallback[field]
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helper: normalize model entry (legacy string â†” new object)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function normalizeModelEntry(entry) {
  if (typeof entry === "string") return { model: entry, weight: 0 };
  return { model: entry.model, weight: entry.weight || 0 };
}

export function getModelString(entry) {
  return typeof entry === "string" ? entry : entry.model;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Page

