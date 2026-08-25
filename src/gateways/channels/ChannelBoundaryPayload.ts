export type BoundaryRecord = Record<string, unknown>;

export function asBoundaryRecord(value: unknown): BoundaryRecord {
  return typeof value === 'object' && value !== null ? (value as BoundaryRecord) : {};
}
