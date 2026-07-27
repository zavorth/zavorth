import {
  CHANGE_PREVIEW_CONTRACT_VERSION,
  type ChangePreviewCard,
} from '../../../src/contracts/preview/ChangePreviewContract.js';
import {
  ChangePreviewPresenter,
  attachChangePreviewToEffects,
  createChangePreviewDemoImpact,
  createChangePreviewDemoPlanSteps,
} from '../../../src/services/preview/ChangePreviewPresenter.js';

const FIXED_NOW = new Date('2026-07-11T12:00:00.000Z');

function createPresenter(): ChangePreviewPresenter {
  let counter = 0;
  return new ChangePreviewPresenter({
    now: () => FIXED_NOW,
    idFactory: (prefix) => `${prefix}-${++counter}`,
  });
}

describe('ChangePreviewPresenter', () => {
  test('empty → unavailable with honest reason and info bullet', () => {
    const presenter = createPresenter();
    const card = presenter.fromPlanSteps([]);

    expect(card.contractVersion).toBe(CHANGE_PREVIEW_CONTRACT_VERSION);
    expect(card.confidence).toBe('unavailable');
    expect(card.confidenceReason.toLowerCase()).toMatch(/no simulated|not a full world twin|no plan/i);
    expect(card.bullets).toHaveLength(1);
    expect(card.bullets[0].severity).toBe('info');
    expect(card.bullets[0].text).toMatch(/No simulated change available/i);
    expect(card.diffs).toEqual([]);
  });

  test('empty impact / loose actions → unavailable', () => {
    const presenter = createPresenter();
    expect(presenter.fromImpactSimulation(null).confidence).toBe('unavailable');
    expect(presenter.fromLooseActions([]).confidence).toBe('unavailable');
  });

  test('plan steps → ~3 bullets, partial/limited confidence (not full)', () => {
    const presenter = createPresenter();
    const steps = createChangePreviewDemoPlanSteps();
    const card = presenter.fromPlanSteps(steps);

    expect(card.bullets.length).toBeGreaterThanOrEqual(1);
    expect(card.bullets.length).toBeLessThanOrEqual(6);
    // Prefer ~3 for demo plan of 3 steps
    expect(card.bullets.length).toBeLessThanOrEqual(3 + 1);
    expect(card.confidence).not.toBe('full');
    expect(['partial', 'limited']).toContain(card.confidence);
    expect(card.sourceServices).toContain('UniversalPreviewModeService');
    expect(card.metadata?.hasImpactTwin).toBe(false);
    expect(card.requiresApproval).toBe(true);
    expect(card.requiresSandbox).toBe(true);
  });

  test('safe plan-only steps → partial confidence', () => {
    const presenter = createPresenter();
    const card = presenter.fromPlanSteps([
      {
        kind: 'read',
        label: 'Read README',
        risk: 'safe',
        requiresApproval: false,
        impact: 'Read-only',
      },
      {
        kind: 'memory',
        label: 'Recall context',
        risk: 'safe',
        requiresApproval: false,
      },
    ]);
    expect(card.confidence).toBe('partial');
    expect(card.confidenceReason.toLowerCase()).toMatch(/partial|plan steps only|not a full world twin/i);
  });

  test('impact blocked → limited confidence with risk/warning bullets', () => {
    const presenter = createPresenter();
    const card = presenter.fromImpactSimulation({
      id: 'impact-blocked',
      source: 'ImpactSimulatorService',
      status: 'blocked',
      affectedTargets: ['secrets.env'],
      blockers: ['secret-like target requires explicit approval'],
      warnings: ['project twin is not fresh'],
      requiresApproval: true,
      requiresSandbox: false,
      rollbackRequired: true,
      rollbackAvailable: false,
    });

    expect(card.confidence).toBe('limited');
    expect(card.bullets.some((b) => b.severity === 'risk')).toBe(true);
    expect(card.bullets.some((b) => /Blocked:|secret/i.test(b.text))).toBe(true);
    expect(card.requiresApproval).toBe(true);
    expect(card.sourceServices).toContain('ImpactSimulatorService');
  });

  test('impact warning → limited (not full)', () => {
    const presenter = createPresenter();
    const card = presenter.fromImpactSimulation(createChangePreviewDemoImpact());
    expect(card.confidence).toBe('limited');
    expect(card.confidence).not.toBe('full');
  });

  test('mergeSources combines bullets and sets full only when both plan + impact', () => {
    const presenter = createPresenter();
    const plan = presenter.fromPlanSteps([
      {
        kind: 'write',
        label: 'Write file',
        risk: 'attention',
        requiresApproval: true,
        impact: 'Edits workspace file',
      },
    ]);
    const impact = presenter.fromImpactSimulation({
      id: 'impact-ok',
      source: 'ImpactSimulatorService',
      status: 'passed',
      affectedTargets: ['src/a.ts'],
      blockers: [],
      warnings: [],
      requiresApproval: true,
      requiresSandbox: false,
      rollbackRequired: true,
      rollbackAvailable: true,
    });

    expect(plan.confidence).not.toBe('full');
    expect(impact.confidence).not.toBe('full');

    const merged = presenter.mergeSources(plan, impact);
    expect(merged.sourceServices).toEqual(
      expect.arrayContaining(['UniversalPreviewModeService', 'ImpactSimulatorService']),
    );
    expect(merged.bullets.length).toBeGreaterThanOrEqual(1);
    expect(merged.bullets.length).toBeLessThanOrEqual(6);
    // Both sources present and impact not blocked → full
    expect(merged.confidence).toBe('full');
    expect(merged.metadata?.hasPlanSteps).toBe(true);
    expect(merged.metadata?.hasImpactTwin).toBe(true);
  });

  test('honesty: full only when both sources; merge with blocked impact stays limited', () => {
    const presenter = createPresenter();
    const plan = presenter.fromPlanSteps(createChangePreviewDemoPlanSteps());
    const blocked = presenter.fromImpactSimulation({
      status: 'blocked',
      blockers: ['not reversible'],
      affectedTargets: ['x'],
      source: 'ImpactSimulatorService',
    });
    const merged = presenter.mergeSources(plan, blocked);
    expect(merged.confidence).toBe('limited');
    expect(merged.confidence).not.toBe('full');
  });

  test('mergeSources empty → unavailable', () => {
    const presenter = createPresenter();
    const card = presenter.mergeSources();
    expect(card.confidence).toBe('unavailable');
  });

  test('fromLooseActions → limited confidence', () => {
    const presenter = createPresenter();
    const card = presenter.fromLooseActions([
      { kind: 'write', target: 'a.ts', label: 'Write a.ts', risk: 'medium' },
      { kind: 'shell', target: 'npm test', risk: 'high' },
    ]);
    expect(card.confidence).toBe('limited');
    expect(card.bullets.length).toBe(2);
    expect(card.requiresSandbox).toBe(true);
  });

  test('toMarkdown contains title', () => {
    const presenter = createPresenter();
    const card = presenter.fromPlanSteps(createChangePreviewDemoPlanSteps());
    const md = presenter.toMarkdown(card);
    expect(md).toContain(card.title);
    expect(md).toMatch(/If you approve, what changes\-/);
    expect(md).toMatch(/Confidence/);
  });

  test('toApprovalEffectsSummary includes confidence line', () => {
    const presenter = createPresenter();
    const card = presenter.fromPlanSteps(createChangePreviewDemoPlanSteps());
    const lines = presenter.toApprovalEffectsSummary(card);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.some((l) => /Confidence:/i.test(l))).toBe(true);
  });

  test('attachChangePreviewToEffects pure helper', () => {
    const presenter = createPresenter();
    const preview = presenter.fromPlanSteps(createChangePreviewDemoPlanSteps());
    const base = {
      id: 'card-1',
      effectsSummary: ['old'],
      metadata: { foo: 1 },
    };
    const next = attachChangePreviewToEffects(base, preview);
    expect(next.effectsSummary).not.toEqual(['old']);
    expect(next.effectsSummary.length).toBeGreaterThan(0);
    expect(next.metadata?.changePreviewId).toBe(preview.id);
    expect(next.metadata?.foo).toBe(1);
    // original not mutated deeply for effects array replacement
    expect(base.effectsSummary).toEqual(['old']);
  });

  test('card title default and contract version', () => {
    const presenter = createPresenter();
    const card: ChangePreviewCard = presenter.fromLooseActions([
      { kind: 'read', label: 'peek' },
    ]);
    expect(card.title).toBe('If you approve, what changes-');
    expect(card.generatedAt).toBe(FIXED_NOW.toISOString());
  });
  test('honesty: merge plan + warning impact stays limited (not full)', () => {
    const presenter = createPresenter();
    const plan = presenter.fromPlanSteps([
      {
        kind: 'write',
        label: 'Write file',
        risk: 'attention',
        requiresApproval: true,
      },
    ]);
    const impact = presenter.fromImpactSimulation({
      status: 'warning',
      warnings: ['project twin is not fresh'],
      affectedTargets: ['src/a.ts'],
      blockers: [],
      source: 'ImpactSimulatorService',
      requiresApproval: true,
    });
    expect(impact.confidence).toBe('limited');
    const merged = presenter.mergeSources(plan, impact);
    expect(merged.confidence).toBe('limited');
    expect(merged.confidence).not.toBe('full');
    expect(merged.metadata?.hasPlanSteps).toBe(true);
    expect(merged.metadata?.hasImpactTwin).toBe(true);
  });
});
