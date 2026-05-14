export type ProviderPricingTable = Record<string, Record<string, unknown>>;
export type PricingRow = {
  input: number;
  output: number;
  cached?: number;
  reasoning?: number;
  cache_creation?: number;
};
export type TokenUsage = Record<string, number | undefined>;
