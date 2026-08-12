import { formatKnowledgeHomeReport } from '../../../src/services/learned-knowledge/index.js';

describe('formatKnowledgeHomeReport', () => {
  it('returns a pretty home card with pillars and shortcuts (English-canonical)', () => {
    const report = formatKnowledgeHomeReport({
      userId: 'report-user',
      projectRoot: process.cwd(),
      maxEvents: 4,
    });
    expect(report).toMatch(/Learned knowledge/i);
    expect(report).toMatch(/Pillars|Workflows|Conversation|About you|Knowledge/i);
    expect(report).toMatch(/\/knowledge story/);
    expect(report).toMatch(/\/learn promote 1/);
    expect(report.length).toBeGreaterThan(80);
    expect(report.length).toBeLessThanOrEqual(4000);
    // Must not be a PT-primary bilingual report
    expect(report).not.toMatch(/Memória aprendida|Pilares|Atalhos/);
  });

  it('ignores legacy binary locale switches and stays English', () => {
    const report = formatKnowledgeHomeReport({
      userId: 'report-user',
      projectRoot: process.cwd(),
      locale: 'pt-BR',
      maxEvents: 2,
    });
    expect(report).toMatch(/Learned knowledge/i);
    expect(report).toMatch(/Status:/);
    expect(report).not.toMatch(/Estado:|Memória aprendida/);
  });
});
