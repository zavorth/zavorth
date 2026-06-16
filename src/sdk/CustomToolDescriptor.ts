export type CustomToolRiskClass = 'safe' | 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export type CustomToolDescriptor = {
  namespace: string;
  name: string;
  description: string;
  inputSchema: unknown;
  capabilities: string[];
  riskClass?: CustomToolRiskClass;
  handler?: unknown;
  metadata?: Record<string, unknown>;
};
