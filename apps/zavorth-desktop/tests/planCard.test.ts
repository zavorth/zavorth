import { describe, expect, it } from 'vitest';
import {
  advancePlanStep,
  markPlanComplete,
  parsePlanFromText,
  planFromApproval,
  type PlanCardModel,
} from '../src/thread/planCard';

describe('parsePlanFromText', () => {
  it('returns null for empty or non-plan text', () => {
    expect(parsePlanFromText('')).toBeNull();
    expect(parsePlanFromText('   ')).toBeNull();
    expect(parsePlanFromText('Just a regular reply with no structure.')).toBeNull();
    expect(parsePlanFromText('I plan to help you later.')).toBeNull();
  });

  it('parses ## Plan with numbered steps', () => {
    const text = `
Here is what I will do:

## Plan
Risk: medium

1. Read the config
2. Update the handler — touch only desktop
3. Run tests
`;
    const plan = parsePlanFromText(text, 'p1');
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('p1');
    expect(plan!.title.toLowerCase()).toContain('plan');
    expect(plan!.steps).toHaveLength(3);
    expect(plan!.steps[0]).toMatchObject({
      id: 'step-1',
      title: 'Read the config',
      status: 'pending',
    });
    expect(plan!.steps[1].title).toBe('Update the handler');
    expect(plan!.steps[1].detail).toMatch(/desktop/i);
    expect(plan!.risk).toBe('medium');
    expect(plan!.canApprove).toBe(true);
    expect(plan!.canReject).toBe(true);
  });

  it('parses ### Proposed plan with dash steps', () => {
    const text = `### Proposed plan
- Scaffold module
- Add vitest coverage
- Wire into ThreadView`;
    const plan = parsePlanFromText(text);
    expect(plan).not.toBeNull();
    expect(plan!.steps.map((s) => s.title)).toEqual([
      'Scaffold module',
      'Add vitest coverage',
      'Wire into ThreadView',
    ]);
    expect(plan!.canApprove).toBe(true);
  });

  it('parses Plan: line with following bullets', () => {
    const text = `Plan: implement open targets
- extract paths
- prefer file over folder`;
    const plan = parsePlanFromText(text, 'open-plan');
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('open-plan');
    expect(plan!.summary).toMatch(/implement open targets/i);
    expect(plan!.steps).toHaveLength(2);
    expect(plan!.canApprove).toBe(true);
  });

  it('parses Plan: with summary only and no steps (canApprove false)', () => {
    const plan = parsePlanFromText('Plan: wait for user confirmation before edits');
    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(plan!.canApprove).toBe(false);
    expect(plan!.canReject).toBe(true);
    expect(plan!.summary).toMatch(/wait for user/i);
  });

  it('parses bare ## Plan heading with empty body', () => {
    const plan = parsePlanFromText('## Plan\n\n');
    expect(plan).not.toBeNull();
    expect(plan!.steps).toHaveLength(0);
    expect(plan!.canApprove).toBe(false);
  });

  it('parses risk critical and high', () => {
    expect(parsePlanFromText('## Plan\nrisk: critical\n1. wipe db')!.risk).toBe('critical');
    expect(parsePlanFromText('## Plan\nRisk: HIGH\n1. deploy')!.risk).toBe('high');
    expect(parsePlanFromText('## Plan\n1. safe read')!.risk).toBeNull();
  });

  it('stops collecting steps at next heading', () => {
    const text = `## Plan
1. First
2. Second

## Notes
3. Not a plan step`;
    const plan = parsePlanFromText(text);
    expect(plan!.steps).toHaveLength(2);
  });

  it('supports 1) style numbering and * bullets', () => {
    const text = `## Plan
1) Alpha
* Beta
+ Gamma`;
    const plan = parsePlanFromText(text);
    expect(plan!.steps.map((s) => s.title)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });

  it('generates id when omitted', () => {
    const plan = parsePlanFromText('## Plan\n- a');
    expect(plan!.id).toMatch(/^plan-/);
  });
});

describe('planFromApproval', () => {
  it('builds model from approval payload', () => {
    const plan = planFromApproval({
      id: 'appr-1',
      title: 'Apply patch',
      summary: 'Touch three files',
      risk: 'low',
      steps: ['Open diff', 'Apply', 'Verify'],
    });
    expect(plan).toEqual({
      id: 'appr-1',
      title: 'Apply patch',
      summary: 'Touch three files',
      risk: 'low',
      canApprove: true,
      canReject: true,
      steps: [
        { id: 'step-1', title: 'Open diff', status: 'pending' },
        { id: 'step-2', title: 'Apply', status: 'pending' },
        { id: 'step-3', title: 'Verify', status: 'pending' },
      ],
    } satisfies PlanCardModel);
  });

  it('defaults title and empty steps', () => {
    const plan = planFromApproval({ id: 'x' });
    expect(plan.title).toBe('Plan');
    expect(plan.summary).toBe('');
    expect(plan.steps).toEqual([]);
    expect(plan.canApprove).toBe(false);
    expect(plan.risk).toBeNull();
  });

  it('normalizes invalid risk to null', () => {
    expect(planFromApproval({ id: '1', risk: 'extreme' }).risk).toBeNull();
    expect(planFromApproval({ id: '1', risk: null }).risk).toBeNull();
    expect(planFromApproval({ id: '1', risk: 'MEDIUM' }).risk).toBe('medium');
  });

  it('fills blank step titles', () => {
    const plan = planFromApproval({ id: '1', steps: ['  ', 'ok'] });
    expect(plan.steps[0].title).toBe('Step 1');
    expect(plan.steps[1].title).toBe('ok');
  });
});

describe('advancePlanStep', () => {
  const base = planFromApproval({
    id: 'p',
    steps: ['A', 'B', 'C'],
  });

  it('updates a single step status immutably', () => {
    const next = advancePlanStep(base, 'step-2', 'active');
    expect(next).not.toBe(base);
    expect(next.steps[1].status).toBe('active');
    expect(base.steps[1].status).toBe('pending');
    expect(next.steps[0].status).toBe('pending');
  });

  it('marks done and keeps canApprove while work remains', () => {
    const next = advancePlanStep(base, 'step-1', 'done');
    expect(next.canApprove).toBe(true);
    expect(next.canReject).toBe(true);
  });

  it('disables approve/reject when all steps terminal', () => {
    let p = advancePlanStep(base, 'step-1', 'done');
    p = advancePlanStep(p, 'step-2', 'skipped');
    p = advancePlanStep(p, 'step-3', 'done');
    expect(p.canApprove).toBe(false);
    expect(p.canReject).toBe(false);
  });

  it('no-ops unknown step id but returns new shell with same statuses', () => {
    const next = advancePlanStep(base, 'missing', 'done');
    expect(next.steps.every((s) => s.status === 'pending')).toBe(true);
  });
});

describe('markPlanComplete', () => {
  it('marks non-skipped steps done and locks actions', () => {
    let p = planFromApproval({ id: 'p', steps: ['A', 'B', 'C'] });
    p = advancePlanStep(p, 'step-2', 'skipped');
    p = advancePlanStep(p, 'step-1', 'active');
    const done = markPlanComplete(p);
    expect(done.steps.map((s) => s.status)).toEqual(['done', 'skipped', 'done']);
    expect(done.canApprove).toBe(false);
    expect(done.canReject).toBe(false);
  });

  it('handles empty steps', () => {
    const done = markPlanComplete(planFromApproval({ id: 'p' }));
    expect(done.steps).toEqual([]);
    expect(done.canApprove).toBe(false);
  });
});
