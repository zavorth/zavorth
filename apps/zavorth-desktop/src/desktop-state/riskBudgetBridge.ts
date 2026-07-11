/**
 * Desktop bridge for Risk Budget OS.
 *
 * Pure formatters / type mirrors for a future Settings strip.
 * Does not perform Node filesystem I/O (main process can load state later).
 */

export type DesktopRiskBudgetMode = 'observer' | 'operator' | 'autopilot';

export type DesktopRiskBudgetDimension =
  | 'diskMutations'
  | 'shellCommands'
  | 'networkSends'
  | 'modelCostUnits';

export type DesktopRiskBudgetLimits = Record<DesktopRiskBudgetDimension, number>;
export type DesktopRiskBudgetCounters = Record<DesktopRiskBudgetDimension, number>;

/** Mirrors monorepo RiskBudgetState for Settings UI consumption. */
export type DesktopRiskBudgetState = {
  contractVersion: string;
  mode: DesktopRiskBudgetMode | string;
  dayKey: string;
  counters: DesktopRiskBudgetCounters | Record<string, number>;
  limits: DesktopRiskBudgetLimits | Record<string, number>;
  frozen: boolean;
  updatedAt: string;
  notes: string | null;
};

const MODE_LABELS: Record<string, string> = {
  observer: 'Observer',
  operator: 'Operator',
  autopilot: 'Autopilot',
};

const SHORT_DIM: Record<string, string> = {
  diskMutations: 'disk',
  shellCommands: 'shell',
  networkSends: 'network',
  modelCostUnits: 'model',
};

export function riskBudgetModeLabel(mode: string | null | undefined): string {
  const key = String(mode || '').trim().toLowerCase();
  return MODE_LABELS[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Operator');
}

/**
 * Compact status line for Settings / chrome strip.
 * Example: `Operator · disk 3/50 · shell 1/30`
 */
export function formatRiskBudgetStatusLine(
  state: DesktopRiskBudgetState | null | undefined,
): string {
  if (!state) return 'Risk budget · unavailable';
  const mode = riskBudgetModeLabel(state.mode);
  const frozen = state.frozen ? ' · FROZEN' : '';
  const counters = state.counters || {};
  const limits = state.limits || {};
  const parts = ['diskMutations', 'shellCommands', 'networkSends'].map((dim) => {
    const short = SHORT_DIM[dim] || dim;
    const used = Number((counters as Record<string, number>)[dim] ?? 0) || 0;
    const limit = Number((limits as Record<string, number>)[dim] ?? 0) || 0;
    return `${short} ${used}/${limit}`;
  });
  return `${mode} · ${parts.join(' · ')}${frozen}`;
}

export function formatRiskBudgetMarkdown(
  state: DesktopRiskBudgetState | null | undefined,
): string {
  if (!state) return '# Risk Budget\n\nUnavailable.\n';
  const lines = [
    '# Risk Budget',
    '',
    `- mode: ${riskBudgetModeLabel(state.mode)} (\`${state.mode}\`)`,
    `- day: ${state.dayKey}`,
    `- frozen: ${state.frozen ? 'yes' : 'no'}`,
    '',
    '## Counters',
  ];
  for (const dim of ['diskMutations', 'shellCommands', 'networkSends', 'modelCostUnits']) {
    const used = Number((state.counters as Record<string, number>)?.[dim] ?? 0) || 0;
    const limit = Number((state.limits as Record<string, number>)?.[dim] ?? 0) || 0;
    lines.push(`- ${dim}: ${used} / ${limit}`);
  }
  if (state.notes) {
    lines.push('', `Notes: ${state.notes}`);
  }
  lines.push('');
  return lines.join('\n');
}
