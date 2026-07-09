import type { JsonRecord } from "./coreTypes";

export function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, "_$1").toLowerCase();
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_: string, char: string) => char.toUpperCase());
}

export function objToSnake(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(obj as JsonRecord)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

export function rowToCamel(row: unknown): JsonRecord | null {
  if (!row) {
    return null;
  }

  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(row as JsonRecord)) {
    const camelKey = toCamelCase(key);
    if (camelKey === "isActive" || camelKey === "rateLimitProtection") {
      result[camelKey] = value === 1 || value === true;
      continue;
    }

    if (camelKey === "providerSpecificData" && typeof value === "string") {
      try {
        result[camelKey] = JSON.parse(value);
      } catch (error: any) { const err = error; const e = error;
        result[camelKey] = value;
      }
      continue;
    }

    result[camelKey] = value;
  }

  return result;
}

export function cleanNulls(obj: unknown): JsonRecord {
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries((obj as JsonRecord) || {})) {
    if (value !== null && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
