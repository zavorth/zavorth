import type { AccessSchedule, JsonRecord } from "./apiKeyTypes";
import { logger } from '@/shared/utils/logger';export function toRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

export function parseAllowedModels(value: unknown): string[] {
  return parseStringArrayJson(value);
}

export function parseAllowedConnections(value: unknown): string[] {
  return parseStringArrayJson(value);
}

export function parseNoLog(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function parseAutoResolve(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function parseIsActive(value: unknown): boolean {
  if (value === 0 || value === "0" || value === false) return false;
  return true;
}

export function parseAccessSchedule(value: unknown): AccessSchedule | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;
    const obj = parsed as Record<string, unknown>;
    if (
      typeof obj["enabled"] !== "boolean" ||
      typeof obj["from"] !== "string" ||
      typeof obj["until"] !== "string" ||
      !Array.isArray(obj["days"]) ||
      typeof obj["tz"] !== "string"
    ) {
      return null;
    }
    const days = (obj["days"] as unknown[]).filter(
      (day): day is number =>
        typeof day === "number" &&
        Number.isInteger(day) &&
        day >= 0 &&
        day <= 6,
    );
    return {
      enabled: obj["enabled"],
      from: obj["from"],
      until: obj["until"],
      days,
      tz: obj["tz"],
    };
  } catch (error: unknown) {logger.warn('[api Key Parsing] operation failed', error); return null; }
}

function parseStringArrayJson(value: unknown): string[] {
  if (!value || typeof value !== "string" || value.trim() === "") {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch (error: unknown) {logger.warn('[api Key Parsing] JSON parse failed', error); return []; }
}
