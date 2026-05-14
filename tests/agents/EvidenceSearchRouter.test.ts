import { EvidenceSearchRouter } from '../../src/agents/EvidenceSearchRouter';

describe('EvidenceSearchRouter', () => {
  const router = new EvidenceSearchRouter();

  it('detects medical requests as high-stakes or current evidence search', () => {
    const need = router.detect('quais sao as ultimas descobertas de medicina no mundo?');

    expect(need).toMatchObject({
      domain: 'medical',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery('quais sao as ultimas descobertas de medicina no mundo?', need))
      .toContain('medical research clinical trials guideline PubMed WHO NIH CDC FDA ANVISA official sources links');
  });

  it('detects legal case research as evidence search', () => {
    const need = router.detect('procure casos na internet sobre dano moral por atraso de voo');

    expect(need).toMatchObject({
      domain: 'legal',
      reason: 'high_stakes',
    });
    expect(router.buildQuery('procure casos na internet sobre dano moral por atraso de voo', need))
      .toContain('jurisprudencia acordaos decisoes judiciais tribunal case law legislation official sources links');
  });

  it('detects scientific article requests and enriches for papers and DOI links', () => {
    const need = router.detect('procure artigos cientificos sobre CRISPR e envie os links');

    expect(need).toMatchObject({
      domain: 'scientific',
      reason: 'evidence',
    });
    expect(router.buildQuery('procure artigos cientificos sobre CRISPR e envie os links', need))
      .toContain('scientific articles papers DOI PubMed SciELO arXiv journal university publisher links');
  });

  it('detects technical/versioned requests without needing a news-specific trigger', () => {
    const need = router.detect('verifique a versao mais recente do pacote playwright e mande a documentacao');

    expect(need).toMatchObject({
      domain: 'technical',
      fresh: true,
    });
    expect(router.buildQuery('verifique a versao mais recente do pacote playwright e mande a documentacao', need))
      .toContain('official documentation changelog release notes GitHub issue PR versioned references');
  });

  it('detects public policy and official source requests', () => {
    const need = router.detect('consulte fontes oficiais sobre a nova regulacao de IA no Brasil');

    expect(need).toMatchObject({
      domain: 'public_policy',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery('consulte fontes oficiais sobre a nova regulacao de IA no Brasil', need))
      .toContain('official sources government data law regulation report links');
  });

  it('detects weekly global politics news as current public-policy research', () => {
    const need = router.detect('me diga as ultimas noticias da semana na politica global');

    expect(need).toMatchObject({
      domain: 'public_policy',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery('me diga as ultimas noticias da semana na politica global', need))
      .toContain('official sources government data law regulation report links');
  });

  it('detects consumer decision requests without relying on a news keyword', () => {
    const need = router.detect('qual melhor air fryer custo beneficio em 2026?');

    expect(need).toMatchObject({
      domain: 'consumer',
      reason: 'current',
      fresh: true,
    });
    expect(router.buildQuery('qual melhor air fryer custo beneficio em 2026?', need))
      .toContain('current reviews comparison buying guide official specs price warranty independent sources links');
  });

  it('detects general reports with sources as evidence-backed research', () => {
    const need = router.detect('faca um relatorio com fontes sobre impactos do home office');

    expect(need).toMatchObject({
      domain: 'general',
      reason: 'evidence',
      fresh: false,
    });
    expect(router.buildQuery('faca um relatorio com fontes sobre impactos do home office', need))
      .toContain('reliable sources references official data guide links');
  });

  it('keeps stable everyday knowledge as no-search conversation', () => {
    expect(router.detect('me ensine uma receita simples de panqueca')).toBeNull();
  });
});
