import {
  EvidenceSearchPlanBuilder,
  buildEvidenceTrackQueries,
  buildEvidenceSearchPlan,
  weighEvidenceSource,
} from '../../src/agents/EvidenceSearchPlan';
import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceSearchPlanBuilder', () => {
  const builder = new EvidenceSearchPlanBuilder();

  it('turns technical troubleshooting into community-first source requirements', () => {
    const plan = builder.build('como resolver erro de CORS no Next.js? tem workaround no Stack Overflow?');

    expect(plan.intent).toMatchObject({
      mode: 'community',
      domain: 'technical',
      answerStyle: 'community-first',
    });
    expect(plan.mustHave).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'issue-tracker', role: 'primary' }),
      expect.objectContaining({ track: 'community', role: 'primary' }),
    ]));
    expect(plan.useful).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'vendor', role: 'primary' }),
      expect.objectContaining({ track: 'repository', role: 'primary' }),
    ]));
    expect(plan.answerPolicy).toMatchObject({
      style: 'community-first',
      separateFactsFromReports: true,
      requireCaveat: true,
    });
  });

  it('keeps medical searches verified and treats community sources as non-primary', () => {
    const plan = buildEvidenceSearchPlan('quais os sintomas da gripe e fontes confiaveis?');

    expect(plan.intent).toMatchObject({
      mode: 'verified',
      domain: 'medical',
      risk: 'high',
    });
    expect(plan.mustHave).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'academic', role: 'primary' }),
      expect.objectContaining({ track: 'official', role: 'primary' }),
    ]));
    expect(plan.avoidAsPrimary).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'community', role: 'avoid-primary' }),
    ]));
    expect(plan.answerPolicy).toMatchObject({
      style: 'official-first',
      requireCaveat: true,
    });
  });

  it('allows community reports in high-risk domains without letting them anchor the answer', () => {
    const plan = builder.build('relatos no reddit sobre efeitos colaterais de remedio X');

    expect(plan.intent).toMatchObject({
      mode: 'community',
      domain: 'medical',
      risk: 'high',
    });
    expect(plan.mustHave).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'academic', role: 'primary' }),
      expect.objectContaining({ track: 'official', role: 'primary' }),
    ]));
    expect(plan.useful).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'community' }),
    ]));
    expect(plan.answerPolicy).toMatchObject({
      style: 'official-first',
      separateFactsFromReports: true,
      requireCaveat: true,
    });
  });

  it('builds balanced plans for consumer reviews without forcing a single source family', () => {
    const plan = builder.build('review do notebook Dell Inspiron vale a pena?');

    expect(plan.intent).toMatchObject({
      mode: 'hybrid',
      domain: 'consumer',
    });
    expect(plan.mustHave).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'official', role: 'primary' }),
      expect.objectContaining({ track: 'benchmark', role: 'primary' }),
    ]));
    expect(plan.useful).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'community', role: 'primary' }),
    ]));
    expect(plan.answerPolicy.style).toBe('balanced');
  });

  it('attaches search plans to router decisions for downstream search execution', () => {
    const router = new EvidenceSearchRouter();
    const need = router.detect('procure relatos no reddit sobre bug no Playwright 2026');

    expect(need).toMatchObject({
      domain: 'technical',
      searchPlan: expect.objectContaining({
        intent: expect.objectContaining({ mode: 'community' }),
        mustHave: expect.arrayContaining([
          expect.objectContaining({ track: 'issue-tracker', role: 'primary' }),
        ]),
      }),
    });
    expect(router.buildContextGuidance(need!)).toContain('community sources');
  });

  it('expands a plan into multi-track search queries', () => {
    const queries = buildEvidenceTrackQueries({
      query: 'como resolver bug no Playwright com relatos no GitHub',
      domain: 'technical',
    }, 6);

    expect(queries).toEqual(expect.arrayContaining([
      expect.objectContaining({ track: 'profile', role: 'baseline' }),
      expect.objectContaining({ track: 'issue-tracker', role: 'primary' }),
      expect.objectContaining({ track: 'community', role: 'primary' }),
    ]));
    expect(queries.map((entry) => entry.query).join('\n')).toContain('site:github.com/issues');
    expect(queries.map((entry) => entry.query).join('\n')).toContain('reddit forum');
  });

  it('boosts community evidence when the plan explicitly needs community signals', () => {
    const plan = buildEvidenceSearchPlan({
      query: 'como resolver bug no Playwright com relatos no Reddit',
      domain: 'technical',
    });

    const weighted = weighEvidenceSource({
      baseScore: -20,
      highSignal: false,
      track: 'community',
      role: 'primary',
      plan,
    });

    expect(weighted.score).toBeGreaterThan(50);
    expect(weighted.highSignal).toBe(true);
    expect(weighted.reasons).toEqual(expect.arrayContaining([
      'plan-role:primary',
      'plan-must-have:community',
      'intent-community-fit',
    ]));
  });

  it('limits community evidence in high-risk domains even when users ask for reports', () => {
    const plan = buildEvidenceSearchPlan({
      query: 'relatos no reddit sobre efeitos colaterais de remedio X',
      domain: 'medical',
    });

    const weighted = weighEvidenceSource({
      baseScore: 60,
      highSignal: true,
      track: 'community',
      role: 'community-signal',
      plan,
    });

    expect(weighted.highSignal).toBe(false);
    expect(weighted.score).toBeLessThan(60);
    expect(weighted.reasons).toEqual(expect.arrayContaining(['high-risk-community-limited']));
  });
});
