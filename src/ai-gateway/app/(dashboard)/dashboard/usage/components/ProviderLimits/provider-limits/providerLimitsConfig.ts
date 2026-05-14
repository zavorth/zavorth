"use client";

export const LS_GROUP_BY = "ZavorthGateway:limits:groupBy";
export const LS_EXPANDED_GROUPS = "ZavorthGateway:limits:expandedGroups";

export const MIN_FETCH_INTERVAL_MS = 30000;
const QUOTA_BAR_GREEN_THRESHOLD = 50;
const QUOTA_BAR_YELLOW_THRESHOLD = 20;

export const PROVIDER_CONFIG = {
  zavorthBridge: { label: "ZavorthBridge", color: "#F59E0B" },
  "gemini-cli": { label: "Gemini CLI", color: "#4285F4" },
  github: { label: "GitHub Copilot", color: "#333" },
  kiro: { label: "Kiro AI", color: "#FF6B35" },
  codex: { label: "OpenAI Codex", color: "#10A37F" },
  claude: { label: "Claude Code", color: "#D97757" },
  glm: { label: "GLM (Z.AI)", color: "#4A90D9" },
  "kimi-coding": { label: "Kimi Coding", color: "#1E3A8A" },
};

export const TIER_FILTERS = [
  { key: "all", labelKey: "tierAll" },
  { key: "enterprise", labelKey: "tierEnterprise" },
  { key: "team", labelKey: "tierTeam" },
  { key: "business", labelKey: "tierBusiness" },
  { key: "ultra", labelKey: "tierUltra" },
  { key: "pro", labelKey: "tierPro" },
  { key: "plus", labelKey: "tierPlus" },
  { key: "free", labelKey: "tierFree" },
  { key: "unknown", labelKey: "tierUnknown" },
];

export function getBarColor(remainingPercentage) {
  if (remainingPercentage > QUOTA_BAR_GREEN_THRESHOLD) {
    return { bar: "#22c55e", text: "#22c55e", bg: "rgba(34,197,94,0.12)" };
  }
  if (remainingPercentage > QUOTA_BAR_YELLOW_THRESHOLD) {
    return { bar: "#eab308", text: "#eab308", bg: "rgba(234,179,8,0.12)" };
  }
  return { bar: "#ef4444", text: "#ef4444", bg: "rgba(239,68,68,0.12)" };
}

export function formatCountdown(resetAt) {
  if (!resetAt) return null;
  try {
    const diff = new Date(resetAt).getTime() - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) {
      const d = Math.floor(h / 24);
      return `${d}d ${h % 24}h`;
    }
    return `${h}h ${m}m`;
  } catch {
    return null;
  }
}
