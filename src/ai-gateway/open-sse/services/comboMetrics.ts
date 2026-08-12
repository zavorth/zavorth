export interface ComboMetricEntry {
  comboName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  modelUsage: Record<string, number>;
}

const comboMetrics = new Map<string, ComboMetricEntry>();

export function recordComboRequest(
  comboName: string,
  model: string,
  success: boolean
): void {
  const entry = comboMetrics.get(comboName) ?? {
    comboName,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    modelUsage: {},
  };
  entry.totalRequests++;
  if (success) entry.successfulRequests++;
  else entry.failedRequests++;
  entry.modelUsage[model] = (entry.modelUsage[model] ?? 0) + 1;
  comboMetrics.set(comboName, entry);
}

export function getComboMetrics(comboName: string): ComboMetricEntry | undefined {
  return comboMetrics.get(comboName);
}

export function getAllComboMetrics(): Record<string, ComboMetricEntry> {
  return Object.fromEntries(comboMetrics.entries());
}

export function resetComboMetrics(comboName: string): void {
  comboMetrics.delete(comboName);
}

export function resetAllComboMetrics(): void {
  comboMetrics.clear();
}
