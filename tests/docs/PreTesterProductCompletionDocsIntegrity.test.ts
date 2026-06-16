import fs from 'fs';
import path from 'path';

describe('PreTesterProductCompletionDocsIntegrity — Fase 21R-A', () => {
  const docsDir = path.resolve(__dirname, '../../docs/product');
  const requiredFiles = [
    'pre-tester-product-completion-gate-21R-A.md',
    'pre-tester-product-gap-inventory-21R-A.md',
    'pre-tester-user-journey-review-21R-A.md',
    'pre-tester-known-blockers-21R-A.md',
    'pre-tester-completion-verdict-21R-A.md',
  ];

  it('deve possuir todos os 5 documentos de gate de produto da Fase 21R-A', () => {
    for (const file of requiredFiles) {
      const filePath = path.join(docsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('deve certificar que os documentos afirmam que nenhum tester recebeu o build e nao ha release publico', () => {
    for (const file of requiredFiles) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
      expect(content).toContain('PREPARAÇÃO LOCAL');
      expect(content).toContain('Nenhum tester recebeu este build ainda');
      expect(content).toContain('Nenhum upload público ou push remoto foi efetuado');
    }
  });

  it('deve conter as classificacoes de severidade reguladoras', () => {
    const blockersContent = fs.readFileSync(path.join(docsDir, 'pre-tester-known-blockers-21R-A.md'), 'utf8');
    expect(blockersContent).toContain('BLOCKER');
    expect(blockersContent).toContain('SHOULD_FIX');
    expect(blockersContent).toContain('ACCEPTABLE');
    expect(blockersContent).toContain('BACKLOG');
  });

  it('deve conter o veredito final e a declaracao de validade do artefato 21Q', () => {
    const verdictContent = fs.readFileSync(path.join(docsDir, 'pre-tester-completion-verdict-21R-A.md'), 'utf8');
    expect(verdictContent).toContain('READY_FOR_FIRST_CONTROLLED_TESTER_DELIVERY');
    expect(verdictContent).toContain('21Q artifact remains valid');
    expect(verdictContent).toContain('runtime/build changed in 21R-A');
    expect(verdictContent).toContain('desktop UI changed in 21R-A');
    expect(verdictContent).toContain('CLI changed in 21R-A');
  });

  it('nao deve conter chaves de API ou tokens reais', () => {
    for (const file of requiredFiles) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf8');
      expect(content).not.toMatch(/sk-proj-[A-Za-z0-9]{20,}/);
      expect(content).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{20,}/);
      expect(content).not.toMatch(/secretRef:[A-Za-z0-9._-]{5,}/);
    }
  });
});
