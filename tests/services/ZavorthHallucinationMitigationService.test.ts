import { ZavorthHallucinationMitigationService } from '../../src/services/ZavorthHallucinationMitigationService';

const NOW = new Date('2026-05-10T12:00:00.000Z');

describe('ZavorthHallucinationMitigationService', () => {
  it('mitigates current factual claims without evidence', () => {
    const service = new ZavorthHallucinationMitigationService({ now: () => NOW });

    const review = service.reviewResponse({
      requestText: 'Quem e o CEO atual da empresa X?',
      responseText: 'O CEO atual da empresa X e Maria Silva.',
      channel: 'telegram',
    });

    expect(review.status).toBe('mitigated');
    expect(review.groundedness).toBe('unsupported');
    expect(review.currentOrUnstable).toBe(true);
    expect(review.outputText).toContain('Nota de confiabilidade');
    expect(review.outputText).toContain('Preciso verificar antes de tratar como fato');
  });

  it('mitigates execution claims without receipts', () => {
    const service = new ZavorthHallucinationMitigationService({ now: () => NOW });

    const review = service.reviewResponse({
      requestText: 'rode os testes',
      responseText: 'Rodei os testes e tudo passou.',
      toolReceiptCount: 0,
    });

    expect(review.status).toBe('mitigated');
    expect(review.executionClaimWithoutReceipt).toBe(true);
    expect(review.outputText).toContain('nao tenho recibo de execucao');
  });

  it('allows grounded evidence-sensitive answers', () => {
    const service = new ZavorthHallucinationMitigationService({ now: () => NOW });

    const review = service.reviewResponse({
      requestText: 'resuma as noticias de hoje com fontes',
      responseText: 'Segundo as fontes, houve novos anuncios.',
      evidenceTexts: ['web_search QUALITY_GATE: fresh_news_results_ok\nFonte: https://example.test/news'],
      toolReceiptCount: 1,
    });

    expect(review.status).toBe('allow');
    expect(review.groundedness).toBe('grounded');
    expect(review.outputText).toBe('Segundo as fontes, houve novos anuncios.');
  });

  it('does not burden stable everyday answers', () => {
    const service = new ZavorthHallucinationMitigationService({ now: () => NOW });

    const review = service.reviewResponse({
      requestText: 'me ensine uma receita simples de panqueca',
      responseText: 'Misture leite, ovo e farinha, depois doure em uma frigideira.',
    });

    expect(review.status).toBe('allow');
    expect(review.groundedness).toBe('not-applicable');
    expect(review.outputText).toBe('Misture leite, ovo e farinha, depois doure em uma frigideira.');
  });

  it('exposes prompt guidance for model-side discipline', () => {
    const service = new ZavorthHallucinationMitigationService();

    expect(service.buildInstruction()).toContain('DISCIPLINA ANTI-ALUCINACAO');
    expect(service.buildInstruction()).toContain('Nao invente citacoes');
  });
});
