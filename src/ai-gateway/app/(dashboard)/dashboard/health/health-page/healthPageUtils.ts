"use client";

export type TranslateFn = (key: string, values?: Record<string, unknown>) => string;

export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CB_STYLES: Record<
  string,
  { bg: string; text: string; labelKey: string }
> = {
  CLOSED: { bg: "bg-green-500/10", text: "text-green-500", labelKey: "healthy" },
  OPEN: { bg: "bg-red-500/10", text: "text-red-500", labelKey: "down" },
  HALF_OPEN: { bg: "bg-amber-500/10", text: "text-amber-500", labelKey: "recovering" },
};
