import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceSearchRouter', () => {
  const router = new EvidenceSearchRouter();

  it('never forces external search from free text alone', () => {
    expect(router.detect('what are the latest medical discoveries worldwide?')).toBeNull();
    expect(router.detect('find court cases about moral damages for flight delays')).toBeNull();
    expect(router.detect('procure artigos cientificos sobre CRISPR e envie os links')).toBeNull();
    expect(router.detect('verifique a versao mais recente do pacote playwright e mande a documentacao')).toBeNull();
    expect(router.detect('consulte fontes oficiais sobre a nova regulacao de IA no Brasil')).toBeNull();
    expect(router.detect('tell me the latest weekly news on global politics')).toBeNull();
    expect(router.detect('qual melhor air fryer custo beneficio em 2026?')).toBeNull();
    expect(router.detect('faca um relatorio com fontes sobre impactos do home office')).toBeNull();
    expect(router.detect('teach me a simple pancake recipe')).toBeNull();
    expect(router.detect('procure relatos no reddit sobre bug no Playwright 2026')).toBeNull();
    expect(router.detect('quais sintomas de dengue e fontes confiaveis?')).toBeNull();
  });

  it('activates medical evidence search only from structured domain/reason', () => {
    const message = 'what are the latest medical discoveries worldwide?';
    const need = router.detect({
      text: message,
      domain: 'medical',
      reason: 'current',
      fresh: true,
    });

    expect(need).toMatchObject({
      domain: 'medical',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery(message, need)).toContain(
      'medical research clinical trials guideline PubMed WHO NIH CDC FDA ANVISA official sources links',
    );
  });

  it('activates legal evidence search from structured high-stakes need', () => {
    const message = 'find court cases about moral damages for flight delays';
    const need = router.detect({
      text: message,
      domain: 'legal',
      reason: 'high_stakes',
    });

    expect(need).toMatchObject({
      domain: 'legal',
      reason: 'high_stakes',
    });
    expect(router.buildQuery(message, need)).toContain(
      'jurisprudencia acordaos decisoes judiciais tribunal case law legislation official sources links',
    );
  });

  it('activates scientific evidence search from structured domain', () => {
    const message = 'procure artigos cientificos sobre CRISPR e envie os links';
    const need = router.detect({
      text: message,
      domain: 'scientific',
      reason: 'evidence',
    });

    expect(need).toMatchObject({
      domain: 'scientific',
      reason: 'evidence',
    });
    expect(router.buildQuery(message, need)).toContain(
      'scientific articles papers DOI PubMed SciELO arXiv journal university publisher links',
    );
  });

  it('activates technical search from structured domain without free-text product routing', () => {
    const message = 'verifique a versao mais recente do pacote playwright e mande a documentacao';
    const need = router.detect({
      text: message,
      domain: 'technical',
      reason: 'current',
      fresh: true,
    });

    expect(need).toMatchObject({
      domain: 'technical',
      fresh: true,
    });
    expect(router.buildQuery(message, need)).toContain(
      'official documentation changelog release notes GitHub issue PR versioned references',
    );
  });

  it('activates public policy search from structured domain', () => {
    const message = 'consulte fontes oficiais sobre a nova regulacao de IA no Brasil';
    const need = router.detect({
      text: message,
      domain: 'public_policy',
      reason: 'current',
      fresh: true,
    });

    expect(need).toMatchObject({
      domain: 'public_policy',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery(message, need)).toContain('official sources government data law regulation report links');
  });

  it('activates consumer decision search from structured domain', () => {
    const message = 'qual melhor air fryer custo beneficio em 2026?';
    const need = router.detect({
      text: message,
      domain: 'consumer',
      reason: 'current',
      fresh: true,
    });

    expect(need).toMatchObject({
      domain: 'consumer',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery(message, need)).toContain(
      'current reviews comparison buying guide official specs price warranty independent sources links',
    );
  });

  it('activates general evidence reports from structured reason', () => {
    const message = 'faca um relatorio com fontes sobre impactos do home office';
    const need = router.detect({
      text: message,
      domain: 'general',
      reason: 'evidence',
      fresh: false,
    });

    expect(need).toMatchObject({
      domain: 'general',
      reason: 'evidence',
      fresh: false,
    });
    expect(router.buildQuery(message, need)).toContain('reliable sources references official data guide links');
  });

  it('returns plain message from buildQuery when no structured need is provided', () => {
    const message = 'teach me a simple pancake recipe';
    expect(router.buildQuery(message)).toBe(message);
    expect(router.buildQuery(message, null)).toBe(message);
  });

  it('builds transparent answer policy for structured community technical evidence', () => {
    const need = router.detect({
      text: 'procure relatos no reddit sobre bug no Playwright 2026',
      domain: 'technical',
      reason: 'research',
      userRequestedMode: 'community',
    });

    expect(need).not.toBeNull();
    const policy = router.buildAnswerPolicyGuidance(need!);

    expect(policy).toContain('EVIDENCE_ANSWER_POLICY');
    expect(policy).toContain('Search mode: community');
    expect(policy).toContain('community/forum/social sources');
    expect(policy).toContain('Lead with practical community findings');
  });

  it('builds official-first answer policy for structured medical evidence', () => {
    const need = router.detect({
      text: 'quais sintomas de dengue e fontes confiaveis?',
      domain: 'medical',
      reason: 'high_stakes',
    });

    expect(need).not.toBeNull();
    const policy = router.buildAnswerPolicyGuidance(need!);

    expect(policy).toContain('EVIDENCE_ANSWER_POLICY');
    expect(policy).toContain('Search mode: verified');
    expect(policy).toContain('answer style: official-first');
  });

  it('accepts forceSearch with optional domain defaulting to general', () => {
    const need = router.detect({
      text: 'look this up please',
      forceSearch: true,
    });

    expect(need).toMatchObject({
      domain: 'general',
      reason: 'research',
    });
  });
});
