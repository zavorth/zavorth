export type JsonRecord = Record<string, unknown>;

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

export function getKeyValue(row: unknown): { key: string | null; value: string | null } {
  const record = asRecord(row);
  return {
    key: typeof record.key === "string" ? record.key : null,
    value: typeof record.value === "string" ? record.value : null,
  };
}
