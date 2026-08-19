import { EvidenceIntentPlanner, planEvidenceIntent } from '../../src/agents/EvidenceIntentPlanner';
import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceIntentPlanner', () => {
  const planner = new EvidenceIntentPlanner();

  it('keeps free-text-only plans neutral (general/hybrid)', () => {
    const plan = planner.plan('how to fix CORS error in Next.js? any issue or workaround on GitHub?');

    expect(plan).toMatchObject({
      mode: 'hybrid',
      domain: 'general',
      risk: 'low',
      answerStyle: 'balanced',
    });
    expect(plan.reason).toMatch(/free-text-only|neutral/i);
  });

  it('uses structured medical domain for verified-first routing without free-text inference', () => {
    const plan = planner.plan({
      query: 'what are flu symptoms and reliable sources?',
      domain: 'medical',
    });

    expect(plan).toMatchObject({
      mode: 'verified',
      domain: 'medical',
      risk: 'high',
      answerStyle: 'official-first',
    });
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['academic', 'official']));
  });

  it('uses structured consumer domain with hybrid mode by default', () => {
    const plan = planner.plan({
      query: 'review of Dell Inspiron notebook, worth it or reddit complaints?',
      domain: 'consumer',
    });

    expect(plan).toMatchObject({
      mode: 'hybrid',
      domain: 'consumer',
      answerStyle: 'balanced',
    });
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['official', 'community', 'benchmark']));
  });

  it('uses structured technical domain without free-text mode switching', () => {
    const plan = planner.plan({
      query: 'compare official React documentation with current community complaints',
      domain: 'technical',
    });

    expect(plan.domain).toBe('technical');
    expect(plan.mode).toBe('hybrid');
    expect(plan.sourceDiversity).toEqual(expect.arrayContaining(['community', 'repository']));
  });

  it('respects an explicit mode override with structured domain', () => {
    const plan = planEvidenceIntent({
      query: 'what are dengue symptoms?',
      domain: 'medical',
      userRequestedMode: 'community',
    });

    expect(plan).toMatchObject({
      mode: 'community',
      domain: 'medical',
      risk: 'high',
      answerStyle: 'official-first',
    });
  });

  it('attaches adaptive intent metadata from structured domain (not free-text product routing)', () => {
    const router = new EvidenceSearchRouter();
    const need = router.detect({
      text: 'search reddit reports about Playwright 2026 bug',
      domain: 'technical',
      reason: 'research',
      userRequestedMode: 'community',
    });

    expect(need).toMatchObject({
      domain: 'technical',
      intent: expect.objectContaining({
        mode: 'community',
        sourceDiversity: expect.arrayContaining(['community', 'issue-tracker']),
      }),
    });
  });

  it('does not activate evidence search from free text alone via the router', () => {
    const router = new EvidenceSearchRouter();
    expect(router.detect('search reddit reports about Playwright 2026 bug')).toBeNull();
  });

  it('annotates free-text signal hints without changing product mode', () => {
    const plan = planner.plan('reddit bug workaround stackoverflow');
    expect(plan.mode).toBe('hybrid');
    expect(plan.domain).toBe('general');
    expect(plan.signalHints).toEqual(expect.arrayContaining(['community-mention', 'troubleshooting-mention']));
  });
});
