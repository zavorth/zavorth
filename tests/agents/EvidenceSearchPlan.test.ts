import {
  EvidenceSearchPlanBuilder,
  buildEvidenceTrackQueries,
  buildEvidenceSearchPlan,
  weighEvidenceSource,
} from '../../src/agents/EvidenceSearchPlan';
import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceSearchPlanBuilder', () => {
  const builder = new EvidenceSearchPlanBuilder();

  it('keeps free-text-only plans neutral (no community product activation)', () => {
    const plan = builder.build('como resolver erro de CORS no Next.js- tem workaround no Stack Overflow-');

    expect(plan.intent).toMatchObject({
      mode: 'hybrid',
      domain: 'general',
      answerStyle: 'balanced',
    });
  });

  it('builds community-first source requirements from structured mode+domain', () => {
    const plan = builder.build({
      query: 'como resolver erro de CORS no Next.js- tem workaround no Stack Overflow-',
      domain: 'technical',
      userRequestedMode: 'community',
    });

    expect(plan.intent).toMatchObject({
      mode: 'community',
      domain: 'technical',
      answerStyle: 'community-first',
    });
    expect(plan.mustHave).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'issue-tracker', role: 'primary' }),
        expect.objectContaining({ track: 'community', role: 'primary' }),
      ]),
    );
    expect(plan.useful).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'vendor', role: 'primary' }),
        expect.objectContaining({ track: 'repository', role: 'primary' }),
      ]),
    );
    expect(plan.answerPolicy).toMatchObject({
      style: 'community-first',
      separateFactsFromReports: true,
      requireCaveat: true,
    });
  });

  it('keeps structured medical searches verified and treats community sources as non-primary', () => {
    const plan = buildEvidenceSearchPlan({
      query: 'quais os sintomas da gripe e fontes confiaveis-',
      domain: 'medical',
    });

    expect(plan.intent).toMatchObject({
      mode: 'verified',
      domain: 'medical',
      risk: 'high',
    });
    expect(plan.mustHave).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'academic', role: 'primary' }),
        expect.objectContaining({ track: 'official', role: 'primary' }),
      ]),
    );
    expect(plan.avoidAsPrimary).toEqual(
      expect.arrayContaining([expect.objectContaining({ track: 'community', role: 'avoid-primary' })]),
    );
    expect(plan.answerPolicy).toMatchObject({
      style: 'official-first',
      requireCaveat: true,
    });
  });

  it('allows structured community mode in high-risk domains without free-text activation', () => {
    const plan = builder.build({
      query: 'reddit reports about side effects of medicine X',
      domain: 'medical',
      userRequestedMode: 'community',
    });

    expect(plan.intent).toMatchObject({
      mode: 'community',
      domain: 'medical',
      risk: 'high',
    });
    expect(plan.mustHave).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'academic', role: 'primary' }),
        expect.objectContaining({ track: 'official', role: 'primary' }),
      ]),
    );
    expect(plan.useful).toEqual(expect.arrayContaining([expect.objectContaining({ track: 'community' })]));
    expect(plan.answerPolicy).toMatchObject({
      style: 'official-first',
      separateFactsFromReports: true,
      requireCaveat: true,
    });
  });

  it('builds balanced plans for structured consumer domain without free-text inference', () => {
    const plan = builder.build({
      query: 'Dell Inspiron notebook review is it worth it-',
      domain: 'consumer',
    });

    expect(plan.intent).toMatchObject({
      mode: 'hybrid',
      domain: 'consumer',
    });
    expect(plan.mustHave).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'official', role: 'primary' }),
        expect.objectContaining({ track: 'benchmark', role: 'primary' }),
      ]),
    );
    expect(plan.useful).toEqual(
      expect.arrayContaining([expect.objectContaining({ track: 'community', role: 'primary' })]),
    );
    expect(plan.answerPolicy.style).toBe('balanced');
  });

  it('attaches search plans to structured router decisions for downstream search execution', () => {
    const router = new EvidenceSearchRouter();
    const need = router.detect({
      text: 'find relatos no reddit sobre bug no Playwright 2026',
      domain: 'technical',
      reason: 'research',
      userRequestedMode: 'community',
    });

    expect(need).toMatchObject({
      domain: 'technical',
      searchPlan: expect.objectContaining({
        intent: expect.objectContaining({ mode: 'community' }),
        mustHave: expect.arrayContaining([expect.objectContaining({ track: 'issue-tracker', role: 'primary' })]),
      }),
    });
    expect(router.buildContextGuidance(need!)).toContain('community sources');
  });

  it('expands a structured technical plan into multi-track search queries', () => {
    const queries = buildEvidenceTrackQueries(
      {
        query: 'como resolver bug no Playwright com relatos no GitHub',
        domain: 'technical',
        userRequestedMode: 'community',
      },
      6,
    );

    expect(queries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: 'profile', role: 'baseline' }),
        expect.objectContaining({ track: 'issue-tracker', role: 'primary' }),
        expect.objectContaining({ track: 'community', role: 'primary' }),
      ]),
    );
    expect(queries.map((entry) => entry.query).join('\n')).toContain('site:github.com/issues');
    expect(queries.map((entry) => entry.query).join('\n')).toContain('reddit forum');
  });

  it('boosts community evidence when the plan explicitly requests community mode', () => {
    const plan = buildEvidenceSearchPlan({
      query: 'como resolver bug no Playwright com relatos no Reddit',
      domain: 'technical',
      userRequestedMode: 'community',
    });

    const weighted = weighEvidenceSource({
      baseScore: -20,
      highSignal: false,
      track: 'community',
      role: 'primary',
      plan,
    });

    expect(weighted.score).toBeGreaterThan(50);
  });
});
