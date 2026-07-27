export type ControlPlaneOverviewPosture = 'healthy' | 'attention' | 'critical';
export type ControlPlaneOverviewActionSeverity = 'info' | 'warn' | 'critical';

export type ControlPlaneOverviewCard = {
  id: string;
  label: string;
  posture: ControlPlaneOverviewPosture;
  summary: string;
  nextAction: string;
  command: string | null;
  source: string;
};

export type ControlPlaneOverviewAction = {
  id: string;
  label: string;
  severity: ControlPlaneOverviewActionSeverity;
  reason: string;
  command: string | null;
  source: string;
};

export type ControlPlaneOverviewNarrative = {
  headline: string;
  operatorSummary: string;
  nextAction: string;
};

export type ControlPlaneSnapshotMinimum<
  TSummary extends object = Record<string, unknown>,
  TSourceSnapshots extends object = Record<string, unknown>,
> = {
  generatedAt: string;
  summary: TSummary & {
    posture: ControlPlaneOverviewPosture;
  };
  narrative: ControlPlaneOverviewNarrative;
  actions: ControlPlaneOverviewAction[];
  sourceSnapshots: TSourceSnapshots;
};

const POSTURE_WEIGHT: Record<ControlPlaneOverviewPosture, number> = {
  healthy: 0,
  attention: 1,
  critical: 2,
};

const ACTION_WEIGHT: Record<ControlPlaneOverviewActionSeverity, number> = {
  info: 0,
  warn: 1,
  critical: 2,
};

export function normalizeOverviewPosture(value: unknown): ControlPlaneOverviewPosture {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'failed' || normalized === 'blocked') {
    return 'critical';
  }
  if (
    normalized === 'healthy'
    || normalized === 'passed'
    || normalized === 'ready'
    || normalized === 'active'
    || normalized === 'connected'
  ) {
    return 'healthy';
  }
  return 'attention';
}

export function resolveOverviewPosture(values: unknown[]): ControlPlaneOverviewPosture {
  return values.reduce<ControlPlaneOverviewPosture>((current, candidate) => {
    const posture = normalizeOverviewPosture(candidate);
    return POSTURE_WEIGHT[posture] > POSTURE_WEIGHT[current] ? posture : current;
  }, 'healthy');
}

export function buildOverviewCard(input: {
  id: string;
  label: string;
  posture: unknown;
  summary: unknown;
  nextAction: unknown;
  command?: unknown;
  source: string;
}): ControlPlaneOverviewCard {
  return {
    id: text(input.id, 'overview-card'),
    label: text(input.label, 'Overview'),
    posture: normalizeOverviewPosture(input.posture),
    summary: text(input.summary, 'Sem summary operational.'),
    nextAction: text(input.nextAction, 'Revisar o control plane correspondente.'),
    command: nullableText(input.command),
    source: text(input.source, 'unknown'),
  };
}

export function normalizeOverviewAction(
  input: Record<string, any>,
  source: string,
): ControlPlaneOverviewAction | null {
  const id = text(input?.id, '');
  const label = text(input?.label, '');
  if (!id || !label) {
    return null;
  }
  return {
    id,
    label,
    severity: normalizeActionSeverity(input?.severity),
    reason: text(input?.reason || input?.rationale || input?.summary, 'Sem justificativa operational.'),
    command: nullableText(input?.command),
    source: text(source, 'unknown'),
  };
}

export function collectOverviewActions(
  groups: Array<{ source: string; actions: any[] | null | undefined }>,
  limit = 8,
): ControlPlaneOverviewAction[] {
  const deduped = new Map<string, ControlPlaneOverviewAction>();
  groups.forEach((group) => {
    const actions = Array.isArray(group.actions) ? group.actions : [];
    actions.forEach((entry) => {
      const normalized = normalizeOverviewAction(entry, group.source);
      if (!normalized) {
        return;
      }
      const key = `${normalized.source}:${normalized.id}`;
      if (!deduped.has(key)) {
        deduped.set(key, normalized);
      }
    });
  });
  return Array.from(deduped.values())
    .sort((left, right) => {
      const bySeverity = ACTION_WEIGHT[right.severity] - ACTION_WEIGHT[left.severity];
      if (bySeverity !== 0) {
        return bySeverity;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, Math.max(1, Math.min(24, Math.floor(limit) || 8)));
}

export function countOverviewPostures(cards: ControlPlaneOverviewCard[]): {
  healthy: number;
  attention: number;
  critical: number;
} {
  return cards.reduce((counts, card) => {
    counts[card.posture] += 1;
    return counts;
  }, {
    healthy: 0,
    attention: 0,
    critical: 0,
  });
}

export function buildOverviewNarrative(input: {
  headline: string;
  operatorSummary: string;
  actions: ControlPlaneOverviewAction[];
  fallbackNextAction: string;
}): ControlPlaneOverviewNarrative {
  return {
    headline: text(input.headline, 'Overview operational'),
    operatorSummary: text(input.operatorSummary, 'Resumo operational unavailable.'),
    nextAction: input.actions[0]?.label || text(input.fallbackNextAction, 'Revisar os planes agregados.'),
  };
}

export function buildControlPlaneSnapshot<
  TSummary extends object,
  TSourceSnapshots extends object,
>(input: {
  generatedAt: unknown;
  summary: TSummary;
  narrative: Partial<ControlPlaneOverviewNarrative> | null | undefined;
  actions?: ControlPlaneOverviewAction[] | null;
  sourceSnapshots: TSourceSnapshots;
}): ControlPlaneSnapshotMinimum<TSummary, TSourceSnapshots> {
  const summary = input.summary as TSummary & { posture?: unknown };
  return {
    generatedAt: text(input.generatedAt, new Date().toISOString()),
    summary: {
      ...summary,
      posture: normalizeOverviewPosture(summary.posture),
    },
    narrative: normalizeOverviewNarrative(input.narrative),
    actions: Array.isArray(input.actions) ? input.actions : [],
    sourceSnapshots: input.sourceSnapshots,
  };
}

export function normalizeOverviewNarrative(
  input: Partial<ControlPlaneOverviewNarrative> | null | undefined,
): ControlPlaneOverviewNarrative {
  return {
    headline: text(input?.headline, 'Control plane overview'),
    operatorSummary: text(input?.operatorSummary, 'Resumo operational unavailable.'),
    nextAction: text(input?.nextAction, 'Revisar o control plane correspondente.'),
  };
}

export function renderControlPlaneReport(input: {
  title: unknown;
  narrative: Partial<ControlPlaneOverviewNarrative> | null | undefined;
  posture: unknown;
  summaryLines?: unknown[] | null;
  actions?: ControlPlaneOverviewAction[] | null;
}): string {
  const narrative = normalizeOverviewNarrative(input.narrative);
  const lines = [
    text(input.title, narrative.headline),
    '',
    narrative.operatorSummary,
    `Postura: ${normalizeOverviewPosture(input.posture)}.`,
    ...((Array.isArray(input.summaryLines) ? input.summaryLines : [])
      .map((line) => text(line, ''))
      .filter(Boolean)),
  ];
  const actions = Array.isArray(input.actions) ? input.actions : [];
  if (actions.length > 0) {
    lines.push(
      '',
      'Actions sugeridas:',
      ...actions.map((entry) =>
        `- [${entry.source}] ${entry.label}: ${entry.reason}${entry.command ? ` | ${entry.command}` : ''}`),
    );
  }
  return lines.join('\n');
}

export function text(value: unknown, fallback: string): string {
  const normalized = String(value || '').trim();
  return normalized || fallback;
}

export function nullableText(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeActionSeverity(value: unknown): ControlPlaneOverviewActionSeverity {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'failed') {
    return 'critical';
  }
  if (normalized === 'warn' || normalized === 'warning' || normalized === 'medium' || normalized === 'attention') {
    return 'warn';
  }
  return 'info';
}
