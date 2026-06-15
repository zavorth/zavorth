import fs from 'fs';
import path from 'path';

describe('SecurityReadinessDocsIntegrity', () => {
  const docsDir = path.resolve(__dirname, '../../docs/security');
  const expectedDocs = [
    'security-readiness-hardening-gate-21P.md',
    'whatsapp-tool-execution-boundary-21P.md',
    'temporary-directory-trust-threat-model-21P.md',
    'provider-runtime-audit-attribution-21P.md',
    'provider-secret-metadata-policy-21P.md',
    'control-core-route-inventory-21P.md',
    'security-readiness-known-issues-21P.md',
  ];

  it('deve garantir que todos os 7 documentos existem', () => {
    expectedDocs.forEach((doc) => {
      const filePath = path.join(docsDir, doc);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  it('deve verificar o conteudo dos documentos contra as diretrizes de conformidade da Fase 21P', () => {
    let combinedContent = '';
    
    expectedDocs.forEach((doc) => {
      const filePath = path.join(docsDir, doc);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Nao devem conter chaves de API reais, Authorization, Bearer, secretRef real, rawKey, ciphertext, authTag
      // (Basta validar que nao temos strings literais simuladas de segredos reais vazadas)
      expect(content).not.toMatch(/sk-[a-zA-Z0-9]{32,}/);
      expect(content).not.toMatch(/Bearer\s+[a-zA-Z0-9._-]{30,}/);
      expect(content).not.toMatch(/secretRef-[a-f0-9-]{36}/);
      expect(content).not.toMatch(/rawKey:[a-f0-9]{32,}/);
      expect(content).not.toMatch(/ciphertext:[a-f0-9]{32,}/);
      expect(content).not.toMatch(/authTag:[a-f0-9]{16,}/);

      combinedContent += '\n' + content;
    });

    // Validar termos obrigatorios no conjunto de docs
    expect(combinedContent).toContain('GO/NO-GO');
    expect(combinedContent).toMatch(/P0/);
    expect(combinedContent).toMatch(/P1/);
    expect(combinedContent).toMatch(/P2/);
    expect(combinedContent).toMatch(/P3/);
    
    // Nao ha entrega de tester nesta fase
    expect(combinedContent.toLowerCase()).toContain('não entrega build para testers');

    // Suffix como metadado de baixa intensidade / sensivel leve
    expect(combinedContent.toLowerCase()).toContain('sensível leve');
    
    // channelUserIdAllowed enforcement
    expect(combinedContent).toContain('channelUserIdAllowed');

    // TemporaryDirectoryTrust adversarial coverage
    expect(combinedContent).toContain('TemporaryDirectoryTrust');

    // provider workspaceId attribution
    expect(combinedContent).toContain('workspaceId');

    // ControlCore route inventory
    expect(combinedContent).toContain('ControlCore');
  });
});
