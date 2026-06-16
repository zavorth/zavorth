import fs from 'fs';
import path from 'path';

describe('InternalTesterDeliveryDocsIntegrity — Fase 21Q', () => {
  const docsDir = path.resolve(__dirname, '../../docs/beta');
  const requiredFiles = [
    'internal-tester-delivery-plan-21Q.md',
    'internal-tester-kit-21Q.md',
    'internal-tester-artifact-manifest-21Q.md',
    'internal-tester-feedback-template-21Q.md',
    'internal-tester-safe-reporting-guide-21Q.md',
    'internal-tester-support-and-stop-criteria-21Q.md',
    'internal-tester-delivery-dry-run-checklist-21Q.md',
    'internal-tester-known-issues-21Q.md',
    'internal-tester-rollback-reset-guide-21Q.md',
  ];

  it('deve possuir todos os 9 documentos reguladores da Fase 21Q', () => {
    for (const file of requiredFiles) {
      const filePath = path.join(docsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('deve certificar que os documentos afirmam explicitamente que nao houve release publico, push ou entrega real', () => {
    for (const file of requiredFiles) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf8');

      // Enforce status warnings and restrictions
      expect(content).toContain('PREPARAÇÃO LOCAL');
      expect(content).toContain('Nenhum tester recebeu este build ainda');
      expect(content).toContain('Nenhum upload público ou push remoto foi efetuado');
      expect(content).toContain('Nenhum GitHub Release ou npm publish foi criado');
    }
  });

  it('deve conter as secoes mandatorias de seguranca, stop criteria, SHA256 e safe reporting', () => {
    const plan = fs.readFileSync(path.join(docsDir, 'internal-tester-delivery-plan-21Q.md'), 'utf8');
    expect(plan).toContain('SHA256');
    expect(plan).toContain('Guia de Relato Seguro');
    expect(plan).toContain('Rollback');

    const support = fs.readFileSync(path.join(docsDir, 'internal-tester-support-and-stop-criteria-21Q.md'), 'utf8');
    expect(support).toContain('Critérios de Parada Mandatórios');
    expect(support).toContain('Vazamento de Chave Real');

    const guide = fs.readFileSync(path.join(docsDir, 'internal-tester-safe-reporting-guide-21Q.md'), 'utf8');
    expect(guide).toContain('NÃO envie chaves de API reais');
    expect(guide).toContain('Redija as Capturas de Tela');

    const template = fs.readFileSync(path.join(docsDir, 'internal-tester-feedback-template-21Q.md'), 'utf8');
    expect(template).toContain('P0 - Bloqueador de Segurança');
    expect(template).toContain('P1');
    expect(template).toContain('P2');
    expect(template).toContain('P3');
  });

  it('nao deve conter chaves de API, tokens de autorizacao ou segredos estruturais reais', () => {
    for (const file of requiredFiles) {
      const content = fs.readFileSync(path.join(docsDir, file), 'utf8');

      expect(content).not.toMatch(/sk-proj-[A-Za-z0-9]{20,}/);
      expect(content).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{20,}/);
      expect(content).not.toMatch(/secretRef:[A-Za-z0-9._-]{5,}/);
    }
  });
});
