export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const riskLabels: Record<RiskLevel, string> = {
  LOW: 'Risco baixo',
  MEDIUM: 'Risco medio',
  HIGH: 'Risco alto',
  CRITICAL: 'Risco critico',
};

export function riskLabel(level: RiskLevel): string {
  return riskLabels[level] || riskLabels.LOW;
}
