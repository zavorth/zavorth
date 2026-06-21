import fs from 'fs';
import path from 'path';

describe('ZavorthControlCoreRoutePolicyInventory', () => {
  const inventoryPath = path.resolve(__dirname, '../../docs/security/control-core-route-inventory-21P.md');

  it('deve garantir que o arquivo de inventario existe', () => {
    expect(fs.existsSync(inventoryPath)).toBe(true);
  });

  it('deve garantir que o inventario lista todos os grupos de rotas de alto/critico risco com metadados obrigatorios', () => {
    const content = fs.readFileSync(inventoryPath, 'utf-8');
    
    // Deve incluir grupos de rotas principais
    expect(content).toContain('Workspace Approvals and Configuration');
    expect(content).toContain('Temporary Directory Trusts');
    expect(content).toContain('Host Commands & PTY Sessions');
    expect(content).toContain('Provider & Secret Configuration');

    // Cada um dos grupos de alta/critica relevancia deve especificar Owner, Risk Class, Enforcement e Testes/Gaps
    const expectedHeaders = [
      'Dono do Domínio',
      'Classe de Risco',
      'Enforcement Obrigatório',
      'Testes / Gaps Cobertos',
    ];

    expectedHeaders.forEach((header) => {
      expect(content).toContain(header);
    });
  });
});
