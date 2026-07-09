import { describe, expect, it } from 'vitest';
import {
  DOMAIN_WIZARDS,
  getWizard,
  nextWizardStep,
  prevWizardStep,
  wizardProgress,
  type WizardId,
} from '../src/command-center/domainWizards';

describe('DOMAIN_WIZARDS', () => {
  it('exposes exactly three wizards', () => {
    expect(DOMAIN_WIZARDS).toHaveLength(3);
    expect(DOMAIN_WIZARDS.map((w) => w.id).sort()).toEqual([
      'absorb-skill',
      'channel-doctor',
      'power-backend',
    ].sort());
  });

  it('each wizard has 3-4 steps with title/body keys', () => {
    for (const wizard of DOMAIN_WIZARDS) {
      expect(wizard.steps.length).toBeGreaterThanOrEqual(3);
      expect(wizard.steps.length).toBeLessThanOrEqual(4);
      expect(wizard.titleKey).toMatch(/^wizard\./);
      for (const step of wizard.steps) {
        expect(step.id).toBeTruthy();
        expect(step.titleKey).toMatch(/^wizard\./);
        expect(step.bodyKey).toMatch(/^wizard\./);
        expect(step.titleKey).toContain('.title');
        expect(step.bodyKey).toContain('.body');
      }
      expect(wizard.completeAction.type === 'panel' || wizard.completeAction.type === 'settings').toBe(
        true,
      );
    }
  });

  it('absorb-skill completes to skills panel', () => {
    const w = getWizard('absorb-skill');
    expect(w).not.toBeNull();
    expect(w!.completeAction).toEqual({ type: 'panel', panel: 'skills' });
    expect(w!.steps[0].titleKey).toBe('wizard.absorb.step1.title');
  });

  it('channel-doctor completes to channels panel', () => {
    const w = getWizard('channel-doctor');
    expect(w!.completeAction).toEqual({ type: 'panel', panel: 'channels' });
    expect(w!.titleKey).toBe('wizard.channelDoctor.title');
  });

  it('power-backend completes to settings providers', () => {
    const w = getWizard('power-backend');
    expect(w!.completeAction).toEqual({ type: 'settings', tab: 'providers' });
    expect(w!.titleKey).toBe('wizard.powerBackend.title');
  });

  it('marks optional steps where defined', () => {
    const absorb = getWizard('absorb-skill')!;
    expect(absorb.steps.some((s) => s.optional)).toBe(true);
  });
});

describe('getWizard', () => {
  it('returns wizard by id', () => {
    const ids: WizardId[] = ['absorb-skill', 'channel-doctor', 'power-backend'];
    for (const id of ids) {
      expect(getWizard(id)?.id).toBe(id);
    }
  });

  it('returns null for unknown id', () => {
    expect(getWizard('nope' as WizardId)).toBeNull();
  });
});

describe('wizardProgress', () => {
  it('computes ratio and flags', () => {
    expect(wizardProgress(0, 4)).toEqual({
      current: 0,
      total: 4,
      ratio: 0.25,
      isLast: false,
      isFirst: true,
    });
    expect(wizardProgress(3, 4)).toEqual({
      current: 3,
      total: 4,
      ratio: 1,
      isLast: true,
      isFirst: false,
    });
    expect(wizardProgress(1, 3)).toMatchObject({
      current: 1,
      total: 3,
      isLast: false,
      isFirst: false,
    });
    expect(wizardProgress(1, 3).ratio).toBeCloseTo(2 / 3);
  });

  it('clamps out-of-range step index', () => {
    expect(wizardProgress(-5, 3).current).toBe(0);
    expect(wizardProgress(99, 3).current).toBe(2);
    expect(wizardProgress(99, 3).isLast).toBe(true);
  });

  it('handles total zero', () => {
    expect(wizardProgress(0, 0)).toEqual({
      current: 0,
      total: 0,
      ratio: 0,
      isLast: true,
      isFirst: true,
    });
  });
});

describe('nextWizardStep / prevWizardStep', () => {
  it('advances and clamps at last', () => {
    expect(nextWizardStep(0, 4)).toBe(1);
    expect(nextWizardStep(2, 4)).toBe(3);
    expect(nextWizardStep(3, 4)).toBe(3);
    expect(nextWizardStep(10, 4)).toBe(3);
  });

  it('goes back and clamps at zero', () => {
    expect(prevWizardStep(2)).toBe(1);
    expect(prevWizardStep(0)).toBe(0);
    expect(prevWizardStep(-3)).toBe(0);
  });

  it('handles empty wizard total', () => {
    expect(nextWizardStep(0, 0)).toBe(0);
  });

  it('walks a full wizard sequence', () => {
    const total = getWizard('absorb-skill')!.steps.length;
    let step = 0;
    const seen: number[] = [step];
    while (!wizardProgress(step, total).isLast) {
      step = nextWizardStep(step, total);
      seen.push(step);
    }
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(total - 1);
    expect(new Set(seen).size).toBe(total);

    while (!wizardProgress(step, total).isFirst) {
      step = prevWizardStep(step);
    }
    expect(step).toBe(0);
  });
});
