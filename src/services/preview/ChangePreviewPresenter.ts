/**
 * Change Preview presenter — product UX over existing simulators.
 *
 * Sources (not replaced):
 * - UniversalPreviewModeService plan steps
 * - ImpactSimulatorService impact fields
 * - Loose action lists
 *
 * Honesty: never set confidence `full` unless both plan-like steps
 * AND impact-like data are present. Never claim a full world twin
 * when data is insufficient.
 */

import {
  CHANGE_PREVIEW_CONTRACT_VERSION,
  type ChangePreviewBullet,
  type ChangePreviewCard,
  type ChangePreviewConfidence,
  type ChangePreviewDiffLine,
} from '../../contracts/preview/ChangePreviewContract.js';

export type ChangePreviewPlanStepInput = {
  kind?: string | null;
  label?: string | null;
  risk?: string | null;
  requiresApproval?: boolean | null;
  impact?: string | null;
  action?: string | null;
  toolId?: string | null;
  id?: string | null;
  previewRequired?: boolean | null;
  [key: string]: unknown;
};

/** Loose object matching ImpactSimulatorService / AgentOsImpactDryRun fields. */
export type ChangePreviewImpactLike = {
  id?: string | null;
  source?: string | null;
  status?: string | null;
  sideEffectsApplied?: boolean | null;
  affectedTargets?: string[] | null;
  recommendedTests?: string[] | null;
  rollbackRequired?: boolean | null;
  rollbackAvailable?: boolean | null;
  requiresApproval?: boolean | null;
  requiresSandbox?: boolean | null;
  blockers?: string[] | null;
  warnings?: string[] | null;
  receipts?: string[] | null;
  [key: string]: unknown;
};

export type ChangePreviewLooseAction = {
  kind?: string | null;
  target?: string | null;
  label?: string | null;
  risk?: string | null;
  action?: string | null;
  [key: string]: unknown;
};

export type ChangePreviewPresenterOptions = {
  now?: () => Date;
  idFactory?: (prefix: string) => string;
  runId?: string | null;
  approvalCardId?: string | null;
  title?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_TITLE = 'If you approve, what changes?';
const MAX_BULLETS = 6;

const SEVERITY_RANK: Record<ChangePreviewBullet['severity'], number> = {
  risk: 3,
  warning: 2,
  info: 1,
};

/** Lower rank = more cautious / "highest risk" for merge. */
const CONFIDENCE_CAUTION_RANK: Record<ChangePreviewConfidence, number> = {
  unavailable: 0,
  limited: 1,
  partial: 2,
  full: 3,
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => normalizeText(v)).filter(Boolean);
}

function riskToSeverity(risk: string | null | undefined): ChangePreviewBullet['severity'] {
  const text = normalizeText(risk).toLowerCase();
  if (!text) return 'info';
  if (
    text === 'danger'
    || text === 'critical'
    || text === 'high'
    || text === 'severe'
    || text.includes('danger')
    || text.includes('critical')
  ) {
    return 'risk';
  }
  if (
    text === 'attention'
    || text === 'warning'
    || text === 'medium'
    || text === 'med'
    || text === 'unknown'
    || text.includes('warn')
  ) {
    return 'warning';
  }
  return 'info';
}

function kindToDimension(
  kind: string | null | undefined,
): ChangePreviewBullet['dimension'] {
  const text = normalizeText(kind).toLowerCase();
  if (!text) return 'other';
  if (
    text === 'write'
    || text === 'edit'
    || text === 'delete'
    || text === 'create'
    || text === 'disk'
    || text === 'file'
    || text === 'fs'
  ) {
    return 'disk';
  }
  if (text === 'shell' || text === 'exec' || text === 'command') return 'shell';
  if (text === 'network' || text === 'http' || text === 'send' || text === 'fetch') return 'network';
  if (text === 'memory' || text === 'recall' || text === 'remember') return 'memory';
  return 'other';
}

function kindToDiffKind(kind: string | null | undefined): ChangePreviewDiffLine['kind'] {
  const text = normalizeText(kind).toLowerCase();
  if (text === 'create' || text === 'write' || text === 'install') return 'create';
  if (text === 'edit' || text === 'patch' || text === 'update') return 'edit';
  if (text === 'delete' || text === 'remove' || text === 'rm') return 'delete';
  if (text === 'shell' || text === 'exec' || text === 'command') return 'exec';
  if (text === 'network' || text === 'http' || text === 'send' || text === 'fetch') return 'network';
  return 'unknown';
}

function capBullets(bullets: ChangePreviewBullet[]): ChangePreviewBullet[] {
  if (bullets.length <= MAX_BULLETS) return bullets;
  return bullets.slice(0, MAX_BULLETS);
}

function sortBulletsBySeverity(bullets: ChangePreviewBullet[]): ChangePreviewBullet[] {
  return [...bullets].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
}

function uniqueSourceServices(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => normalizeText(v)).filter(Boolean)));
}

function emptyUnavailableCard(
  options: ChangePreviewPresenterOptions,
  sequence: number,
): ChangePreviewCard {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory
    ?? ((prefix: string) => `${prefix}-${now().getTime().toString(36)}-${sequence}`);
  return {
    contractVersion: CHANGE_PREVIEW_CONTRACT_VERSION,
    id: idFactory('change-preview'),
    title: normalizeText(options.title, DEFAULT_TITLE),
    confidence: 'unavailable',
    confidenceReason:
      'No plan steps, impact simulation, or actions were provided. '
      + 'This is not a full world twin — no simulated change is available.',
    bullets: [
      {
        id: 'bullet-none',
        text: 'No simulated change available',
        severity: 'info',
        dimension: 'other',
      },
    ],
    diffs: [],
    requiresApproval: false,
    requiresSandbox: false,
    rollbackAvailable: null,
    sourceServices: [],
    generatedAt: now().toISOString(),
    runId: options.runId ?? null,
    approvalCardId: options.approvalCardId ?? null,
    ...(options.metadata ? { metadata: { ...options.metadata } } : {}),
  };
}

export class ChangePreviewPresenter {
  private readonly now: () => Date;
  private readonly idFactory: (prefix: string) => string;
  private sequence = 0;

  constructor(options: ChangePreviewPresenterOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.idFactory = options.idFactory
      ?? ((prefix) => `${prefix}-${this.now().getTime().toString(36)}-${++this.sequence}`);
  }

  public fromPlanSteps(
    steps: ChangePreviewPlanStepInput[] | null | undefined,
    opts: ChangePreviewPresenterOptions = {},
  ): ChangePreviewCard {
    const list = Array.isArray(steps) ? steps : [];
    if (list.length === 0) {
      return emptyUnavailableCard({ ...opts, now: this.now, idFactory: this.idFactory }, ++this.sequence);
    }

    const bullets: ChangePreviewBullet[] = [];
    const diffs: ChangePreviewDiffLine[] = [];
    let requiresApproval = false;
    let requiresSandbox = false;
    let highestSeverity: ChangePreviewBullet['severity'] = 'info';

    for (let i = 0; i < list.length; i += 1) {
      const step = list[i] || {};
      const kind = normalizeText(step.kind, 'unknown');
      const label = normalizeText(step.label)
        || normalizeText(step.action)
        || normalizeText(step.toolId)
        || `Step ${i + 1}`;
      const impact = normalizeText(step.impact);
      const risk = normalizeText(step.risk, 'safe');
      const severity = riskToSeverity(risk);
      if (SEVERITY_RANK[severity] > SEVERITY_RANK[highestSeverity]) {
        highestSeverity = severity;
      }
      if (step.requiresApproval) requiresApproval = true;
      if (kind === 'shell' || kind === 'network' || kind === 'exec' || kind === 'computer-use') {
        requiresSandbox = true;
      }
      if (severity === 'risk') requiresApproval = true;

      const text = impact ? `${label} — ${impact}`
        : label;

      bullets.push({
        id: normalizeText(step.id, `bullet-plan-${i + 1}`),
        text,
        severity,
        dimension: kindToDimension(kind),
      });

      const pathHint = normalizeText(step.toolId)
        || normalizeText(step.action)
        || kind;
      diffs.push({
        path: pathHint,
        kind: kindToDiffKind(kind),
        note: impact || label,
      });
    }

    // Plan-only without impact twin → partial (or limited if high risk / approval heavy)
    const approvalHeavy = requiresApproval || highestSeverity === 'risk';
    const confidence: ChangePreviewConfidence = approvalHeavy ? 'limited' : 'partial';
    const confidenceReason = approvalHeavy ? 'Preview built from plan steps only (no impact twin / dryRun). '
        + 'High-risk or approval-gated steps present — confidence limited, not a full world twin.'
      : 'Preview built from plan steps only. No impact dry-run or project twin was attached — confidence is partial, not a full world twin.';

    return {
      contractVersion: CHANGE_PREVIEW_CONTRACT_VERSION,
      id: this.idFactory('change-preview'),
      title: normalizeText(opts.title, DEFAULT_TITLE),
      confidence,
      confidenceReason,
      bullets: capBullets(sortBulletsBySeverity(bullets)),
      diffs: diffs.slice(0, MAX_BULLETS),
      requiresApproval,
      requiresSandbox,
      rollbackAvailable: null,
      sourceServices: uniqueSourceServices(['UniversalPreviewModeService']),
      generatedAt: this.now().toISOString(),
      runId: opts.runId ?? null,
      approvalCardId: opts.approvalCardId ?? null,
      metadata: {
        ...(opts.metadata || {}),
        planStepCount: list.length,
        hasPlanSteps: true,
        hasImpactTwin: false,
      },
    };
  }

  public fromImpactSimulation(
    sim: ChangePreviewImpactLike | null | undefined,
    opts: ChangePreviewPresenterOptions = {},
  ): ChangePreviewCard {
    if (!sim || typeof sim !== 'object') {
      return emptyUnavailableCard({ ...opts, now: this.now, idFactory: this.idFactory }, ++this.sequence);
    }

    const status = normalizeText(sim.status, 'unknown').toLowerCase();
    const blockers = asStringList(sim.blockers);
    const warnings = asStringList(sim.warnings);
    const targets = asStringList(sim.affectedTargets);
    const tests = asStringList(sim.recommendedTests);
    const bullets: ChangePreviewBullet[] = [];
    const diffs: ChangePreviewDiffLine[] = [];

    for (let i = 0; i < blockers.length; i += 1) {
      bullets.push({
        id: `bullet-blocker-${i + 1}`,
        text: `Blocked: ${blockers[i]}`,
        severity: 'risk',
        dimension: 'other',
      });
    }
    for (let i = 0; i < warnings.length; i += 1) {
      bullets.push({
        id: `bullet-warn-${i + 1}`,
        text: warnings[i],
        severity: 'warning',
        dimension: this.inferDimensionFromText(warnings[i]),
      });
    }
    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      bullets.push({
        id: `bullet-target-${i + 1}`,
        text: `Affects: ${target}`,
        severity: status === 'blocked' ? 'risk' : 'info',
        dimension: kindToDimension(this.inferKindFromPath(target)),
      });
      diffs.push({
        path: target,
        kind: kindToDiffKind(this.inferKindFromPath(target)),
        note: status === 'blocked' ? 'blocked impact target' : 'affected target',
      });
    }
    if (tests.length > 0 && bullets.length < MAX_BULLETS) {
      bullets.push({
        id: 'bullet-tests',
        text: `Recommended tests: ${tests.slice(0, 3).join(', ')}`,
        severity: 'info',
        dimension: 'other',
      });
    }
    if (sim.rollbackRequired && sim.rollbackAvailable === false) {
      bullets.push({
        id: 'bullet-rollback-missing',
        text: 'Rollback path missing or incomplete',
        severity: 'risk',
        dimension: 'disk',
      });
    } else if (sim.rollbackAvailable === true) {
      bullets.push({
        id: 'bullet-rollback-ok',
        text: 'Rollback path available',
        severity: 'info',
        dimension: 'disk',
      });
    }

    if (bullets.length === 0) {
      bullets.push({
        id: 'bullet-impact-empty',
        text: status === 'passed'
          ? 'Impact dry-run passed with no listed side effects'
          : `Impact dry-run status: ${status || 'unknown'}`,
        severity: status === 'blocked' ? 'risk' : status === 'warning' ? 'warning' : 'info',
        dimension: 'other',
      });
    }

    // Impact-only (no plan steps) → limited when blocked, else partial
    let confidence: ChangePreviewConfidence = 'partial';
    let confidenceReason =
      'Preview built from impact dry-run only (no plan steps). '
      + 'Not a full world twin — twin freshness and plan context may be incomplete.';

    if (status === 'blocked' || blockers.length > 0) {
      confidence = 'limited';
      confidenceReason =
        'Impact dry-run is blocked or has blockers. Confidence limited; '
        + 'not a full world twin. Resolve blockers before treating this as an executable preview.';
    } else if (status === 'warning' || warnings.length > 0) {
      confidence = 'limited';
      confidenceReason =
        'Impact dry-run reported warnings (e.g. non-fresh twin or sandbox needs). '
        + 'Confidence limited — not a full world twin.';
    }

    const source = normalizeText(sim.source, 'ImpactSimulatorService');

    return {
      contractVersion: CHANGE_PREVIEW_CONTRACT_VERSION,
      id: normalizeText(sim.id) || this.idFactory('change-preview'),
      title: normalizeText(opts.title, DEFAULT_TITLE),
      confidence,
      confidenceReason,
      bullets: capBullets(sortBulletsBySeverity(bullets)),
      diffs: diffs.slice(0, MAX_BULLETS),
      requiresApproval: Boolean(sim.requiresApproval) || status === 'blocked' || blockers.length > 0,
      requiresSandbox: Boolean(sim.requiresSandbox),
      rollbackAvailable: typeof sim.rollbackAvailable === 'boolean' ? sim.rollbackAvailable : null,
      sourceServices: uniqueSourceServices([source, 'ImpactSimulatorService']),
      generatedAt: this.now().toISOString(),
      runId: opts.runId ?? null,
      approvalCardId: opts.approvalCardId ?? null,
      metadata: {
        ...(opts.metadata || {}),
        impactStatus: status,
        hasPlanSteps: false,
        hasImpactTwin: true,
        sideEffectsApplied: sim.sideEffectsApplied === true,
      },
    };
  }

  public fromLooseActions(
    actions: ChangePreviewLooseAction[] | null | undefined,
    opts: ChangePreviewPresenterOptions = {},
  ): ChangePreviewCard {
    const list = Array.isArray(actions) ? actions : [];
    if (list.length === 0) {
      return emptyUnavailableCard({ ...opts, now: this.now, idFactory: this.idFactory }, ++this.sequence);
    }

    const bullets: ChangePreviewBullet[] = [];
    const diffs: ChangePreviewDiffLine[] = [];
    let requiresApproval = false;
    let requiresSandbox = false;

    for (let i = 0; i < list.length; i += 1) {
      const action = list[i] || {};
      const kind = normalizeText(action.kind, 'unknown');
      const target = normalizeText(action.target);
      const label = normalizeText(action.label)
        || normalizeText(action.action)
        || (target ? `${kind} ${target}` : kind);
      const severity = riskToSeverity(action.risk);
      if (severity === 'risk' || severity === 'warning') requiresApproval = true;
      if (kind === 'shell' || kind === 'exec' || kind === 'network') requiresSandbox = true;

      bullets.push({
        id: `bullet-action-${i + 1}`,
        text: label,
        severity,
        dimension: kindToDimension(kind),
      });
      diffs.push({
        path: target || kind,
        kind: kindToDiffKind(kind),
        note: label,
      });
    }

    return {
      contractVersion: CHANGE_PREVIEW_CONTRACT_VERSION,
      id: this.idFactory('change-preview'),
      title: normalizeText(opts.title, DEFAULT_TITLE),
      confidence: 'limited',
      confidenceReason:
        'Preview built from loose action labels only. No plan twin and no impact dry-run — '
        + 'confidence limited; not a full world twin.',
      bullets: capBullets(sortBulletsBySeverity(bullets)),
      diffs: diffs.slice(0, MAX_BULLETS),
      requiresApproval,
      requiresSandbox,
      rollbackAvailable: null,
      sourceServices: uniqueSourceServices(['loose-actions']),
      generatedAt: this.now().toISOString(),
      runId: opts.runId ?? null,
      approvalCardId: opts.approvalCardId ?? null,
      metadata: {
        ...(opts.metadata || {}),
        actionCount: list.length,
        hasPlanSteps: false,
        hasImpactTwin: false,
      },
    };
  }

  /**
   * Merge multiple preview cards: union bullets/diffs/sources,
   * take most cautious confidence, OR approval/sandbox flags.
   */
  public mergeSources(...cards: Array<ChangePreviewCard | null | undefined>): ChangePreviewCard {
    const present = cards.filter((c): c is ChangePreviewCard => Boolean(c && typeof c === 'object'));
    if (present.length === 0) {
      return emptyUnavailableCard({ now: this.now, idFactory: this.idFactory }, ++this.sequence);
    }
    if (present.length === 1) {
      return { ...present[0], bullets: [...present[0].bullets], diffs: [...present[0].diffs] };
    }

    const bulletMap = new Map<string, ChangePreviewBullet>();
    const diffs: ChangePreviewDiffLine[] = [];
    const sources: string[] = [];
    let requiresApproval = false;
    let requiresSandbox = false;
    let rollbackAvailable: boolean | null = null;
    let confidence: ChangePreviewConfidence = 'full';
    const reasons: string[] = [];
    let runId: string | null = null;
    let approvalCardId: string | null = null;
    const metadata: Record<string, unknown> = { mergedFrom: present.map((c) => c.id) };

    let hasPlan = false;
    let hasImpact = false;

    for (const card of present) {
      for (const b of card.bullets) {
        const key = `${b.severity}|${b.text}`;
        const existing = bulletMap.get(key);
        if (!existing || SEVERITY_RANK[b.severity] > SEVERITY_RANK[existing.severity]) {
          bulletMap.set(key, b);
        }
      }
      for (const d of card.diffs) {
        diffs.push(d);
      }
      sources.push(...card.sourceServices);
      if (card.requiresApproval) requiresApproval = true;
      if (card.requiresSandbox) requiresSandbox = true;
      if (card.rollbackAvailable === false) rollbackAvailable = false;
      else if (card.rollbackAvailable === true && rollbackAvailable !== false) {
        rollbackAvailable = true;
      }
      if (CONFIDENCE_CAUTION_RANK[card.confidence] < CONFIDENCE_CAUTION_RANK[confidence]) {
        confidence = card.confidence;
      }
      if (card.confidenceReason) reasons.push(card.confidenceReason);
      if (!runId && card.runId) runId = card.runId;
      if (!approvalCardId && card.approvalCardId) approvalCardId = card.approvalCardId;
      Object.assign(metadata, card.metadata || {});
      if (card.metadata?.hasPlanSteps === true
        || card.sourceServices.some((s) => /preview|plan/i.test(s))) {
        hasPlan = true;
      }
      if (card.metadata?.hasImpactTwin === true
        || card.sourceServices.some((s) => /impact/i.test(s))) {
        hasImpact = true;
      }
      // Heuristic: UniversalPreviewModeService → plan; ImpactSimulator → impact
      if (card.sourceServices.includes('UniversalPreviewModeService')) hasPlan = true;
      if (card.sourceServices.includes('ImpactSimulatorService')) hasImpact = true;
    }

    // Honesty: full only when both plan-like and impact-like sources present.
    // Do not upgrade to full when impact data quality is limited (blockers/warnings).
    // Plan-only limited (approval-heavy steps) may still become full once a clean impact twin is merged.
    if (hasPlan && hasImpact && confidence !== 'unavailable') {
      const impactDataQualityLimited = present.some((c) => {
        if (c.confidence === 'unavailable') return true;
        if (c.confidence !== 'limited') return false;
        const reason = c.confidenceReason || '';
        return /block/i.test(reason) || /warning/i.test(reason);
      });
      confidence = impactDataQualityLimited ? 'limited' : 'full';
    } else if (hasPlan || hasImpact) {
      if (confidence === 'full') confidence = 'partial';
    } else if (confidence === 'full') {
      confidence = 'limited';
    }

    let confidenceReason: string;
    if (confidence === 'full') {
      confidenceReason =
        'Merged plan steps and impact dry-run. Best available preview — still not a live world twin.';
    } else if (confidence === 'unavailable') {
      confidenceReason = reasons[0]
        || 'No simulated change available from merged sources.';
    } else {
      confidenceReason = [
        hasPlan && hasImpact ? 'Merged sources include plan and impact, but confidence remains cautious.'
          : hasPlan ? 'Merged preview includes plan steps without a complete impact twin.'
            : hasImpact ? 'Merged preview includes impact data without plan steps.'
              : 'Merged loose previews only.',
        ...reasons.slice(0, 2),
      ].filter(Boolean).join(' ');
    }

    const bullets = capBullets(sortBulletsBySeverity(Array.from(bulletMap.values())));
    if (bullets.length === 0) {
      bullets.push({
        id: 'bullet-none',
        text: 'No simulated change available',
        severity: 'info',
        dimension: 'other',
      });
    }

    return {
      contractVersion: CHANGE_PREVIEW_CONTRACT_VERSION,
      id: this.idFactory('change-preview-merged'),
      title: present[0].title || DEFAULT_TITLE,
      confidence,
      confidenceReason,
      bullets,
      diffs: diffs.slice(0, MAX_BULLETS * 2),
      requiresApproval,
      requiresSandbox,
      rollbackAvailable,
      sourceServices: uniqueSourceServices(sources),
      generatedAt: this.now().toISOString(),
      runId,
      approvalCardId,
      metadata: {
        ...metadata,
        hasPlanSteps: hasPlan,
        hasImpactTwin: hasImpact,
      },
    };
  }

  /** Lines suitable for ApprovalPresentationCard.effectsSummary */
  public toApprovalEffectsSummary(card: ChangePreviewCard): string[] {
    if (!card || card.confidence === 'unavailable') {
      return ['No simulated change available'];
    }
    const lines = card.bullets.map((b) => {
      const prefix = b.severity === 'risk'
        ? '⚠ '
        : b.severity === 'warning'
          ? '• '
          : '· ';
      return `${prefix}${b.text}`;
    });
    lines.push(`Confidence: ${card.confidence} — ${card.confidenceReason}`);
    return lines.slice(0, MAX_BULLETS + 1);
  }

  public toMarkdown(card: ChangePreviewCard): string {
    const lines = [
      `# ${card.title}`,
      '',
      `**Confidence:** \`${card.confidence}\``,
      '',
      card.confidenceReason,
      '',
      '## What changes',
    ];
    if (card.bullets.length === 0) {
      lines.push('- No simulated change available');
    } else {
      for (const b of card.bullets) {
        const mark = b.severity === 'risk' ? 'RISK' : b.severity === 'warning' ? 'WARN' : 'INFO';
        lines.push(`- **[${mark}]** ${b.text}`);
      }
    }
    if (card.diffs.length > 0) {
      lines.push('', '## Diffs');
      for (const d of card.diffs) {
        lines.push(`- \`${d.kind}\` ${d.path}${d.note ? ` — ${d.note}` : ''}`);
      }
    }
    lines.push(
      '',
      '## Gates',
      `- requiresApproval: ${card.requiresApproval ? 'yes' : 'no'}`,
      `- requiresSandbox: ${card.requiresSandbox ? 'yes' : 'no'}`,
      `- rollbackAvailable: ${card.rollbackAvailable === null ? 'unknown' : card.rollbackAvailable ? 'yes' : 'no'}`,
      '',
      `Sources: ${card.sourceServices.join(', ') || 'none'}`,
      `Contract: ${card.contractVersion}`,
      '',
    );
    return lines.join('\n');
  }

  private inferDimensionFromText(text: string): ChangePreviewBullet['dimension'] {
    const t = text.toLowerCase();
    if (t.includes('shell') || t.includes('exec')) return 'shell';
    if (t.includes('network') || t.includes('http')) return 'network';
    if (t.includes('memory')) return 'memory';
    if (t.includes('file') || t.includes('disk') || t.includes('write') || t.includes('path')) return 'disk';
    return 'other';
  }

  private inferKindFromPath(path: string): string {
    const t = path.toLowerCase();
    if (/\.(ts|tsx|js|jsx|json|md|yml|yaml|css|html)$/.test(t)) return 'edit';
    if (t.includes('http') || t.includes('://')) return 'network';
    return 'unknown';
  }
}

/**
 * Pure helper: attach change-preview effects onto an approval-like card
 * without deep-coupling ApprovalPresentationService.
 */
export function attachChangePreviewToEffects<T extends { effectsSummary?: string[]; metadata?: Record<string, unknown> }>(
  card: T,
  preview: ChangePreviewCard | null | undefined,
): T {
  if (!preview) return card;
  const presenter = new ChangePreviewPresenter();
  const summary = presenter.toApprovalEffectsSummary(preview);
  return {
    ...card,
    effectsSummary: summary,
    metadata: {
      ...(card.metadata || {}),
      changePreviewId: preview.id,
      changePreviewConfidence: preview.confidence,
      changePreviewContractVersion: preview.contractVersion,
    },
  };
}

/** Demo plan used by CLI and tests. */
export function createChangePreviewDemoPlanSteps(): ChangePreviewPlanStepInput[] {
  return [
    {
      id: 'step-write',
      kind: 'write',
      label: 'Write config file',
      toolId: 'fs.write',
      risk: 'attention',
      requiresApproval: true,
      previewRequired: true,
      action: 'write src/config/demo.json',
      impact: 'Creates or overwrites a workspace config file',
    },
    {
      id: 'step-shell',
      kind: 'shell',
      label: 'Run validation shell command',
      toolId: 'shell.exec',
      risk: 'danger',
      requiresApproval: true,
      previewRequired: true,
      action: 'npm test -- --testPathPattern=demo',
      impact: 'Executes shell in workspace; may need sandbox',
    },
    {
      id: 'step-read',
      kind: 'read',
      label: 'Read package manifest',
      toolId: 'fs.read',
      risk: 'safe',
      requiresApproval: false,
      previewRequired: false,
      action: 'read package.json',
      impact: 'Read-only inspection',
    },
  ];
}

export function createChangePreviewDemoImpact(): ChangePreviewImpactLike {
  return {
    id: 'impact-demo-1',
    source: 'ImpactSimulatorService',
    status: 'warning',
    sideEffectsApplied: false,
    affectedTargets: ['src/config/demo.json', 'package.json'],
    recommendedTests: ['npm test'],
    rollbackRequired: true,
    rollbackAvailable: true,
    requiresApproval: true,
    requiresSandbox: true,
    blockers: [],
    warnings: ['shell/network/install/deploy impact needs sandbox or approval'],
    receipts: ['impact-dry-run-no-side-effects'],
  };
}
