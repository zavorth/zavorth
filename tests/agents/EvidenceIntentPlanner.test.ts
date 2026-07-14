import { EvidenceIntentPlanner, planEvidenceIntent } from '../../src/agents/EvidenceIntentPlanner';
import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceIntentPlanner', () => {
  const planner = new EvidenceIntentPlanner();

  it('routes technical troubleshooting toward community evidence', () => {
    const plan = planner.plan('como resolver erro de CORS no Next.js? tem issue ou workaround no GitHub?');

    expect(plan).toMatchObject({
      mode: 'community',
      domain: 'technical',
      risk: 'medium',
      answerStyle: 'community-first',
    });
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['community', 'issue-tracker', 'repository']));
    expect(plan.reason).toContain('community');
  });

  it('keeps medical evidence official-first unless the user asks for community reports', () => {
    const plan = planner.plan('quais os sintomas da gripe e fontes confiaveis?');

    expect(plan).toMatchObject({
      mode: 'verified',
      domain: 'medical',
      risk: 'high',
      answerStyle: 'official-first',
    });
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['academic', 'official']));
  });

  it('uses hybrid evidence for product reviews and practical buying decisions', () => {
    const plan = planner.plan('review do notebook Dell Inspiron, vale a pena ou o reddit reclama muito?');

    expect(plan).toMatchObject({
      mode: 'community',
      domain: 'consumer',
    });
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['community', 'benchmark']));
  });

  it('uses balanced routing when the request mixes official facts and public discussion', () => {
    const plan = planner.plan('compare a documentacao oficial do React com o que a comunidade esta reclamando agora');

    expect(plan.domain).toBe('technical');
    expect(['community', 'hybrid']).toContain(plan.mode);
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['community', 'repository']));
  });

  it('respects an explicit mode override without changing the inferred domain', () => {
    const plan = planEvidenceIntent({
      query: 'what are dengue symptoms?',
      userRequestedMode: 'community',
    });

    expect(plan).toMatchObject({
      mode: 'community',
      domain: 'medical',
      risk: 'high',
      answerStyle: 'official-first',
    });
  });

  it('attaches adaptive intent metadata to evidence router decisions', () => {
    const router = new EvidenceSearchRouter();
    const need = router.detect('procure relatos no reddit sobre bug no Playwright 2026');

    expect(need).toMatchObject({
      domain: 'technical',
      intent: expect.objectContaining({
        mode: 'community',
        sourceDiversity: expect.arrayContaining(['community', 'issue-tracker']),
      }),
    });
  });
});
