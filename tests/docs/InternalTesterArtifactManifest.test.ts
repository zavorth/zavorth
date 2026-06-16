import fs from 'fs';
import path from 'path';

describe('InternalTesterArtifactManifest — Fase 21Q', () => {
  const manifestPath = path.resolve(__dirname, '../../docs/beta/internal-tester-artifact-manifest-21Q.md');

  it('deve possuir todas as declaracoes de metadados reais e corretas do manifesto', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf8');

    // Artifact name exists
    expect(content).toContain('zavorth-internal-tester-candidate-21q-2026-06-15.zip');

    // Local relative path
    expect(content).toContain('tmp/internal-tester/zavorth-internal-tester-candidate-21q-2026-06-15.zip');

    // Artifact size (Length) is present
    expect(content).toMatch(/Tamanho do Arquivo \(Bytes\).+108401/i);

    // SHA256 exists and has valid 64-character hex format
    const hashMatch = content.match(/SHA256 Real.*([A-Fa-f0-9]{64})/i);
    expect(hashMatch).not.toBeNull();
    expect(hashMatch![1]).toBe('012099B2700E12EB0143D73EA68728114803CFAF0C214EF73ACE71DB10BD1E3E');

    // Source HEAD is a 40-character sha1 commit hash
    const headMatch = content.match(/Commit HEAD de Origem.*([A-Fa-f0-9]{40})/i);
    expect(headMatch).not.toBeNull();
    // Accept either the pre-21Q HEAD or any 40-char SHA1 hex
    expect(headMatch![1]).toMatch(/^[a-f0-9]{40}$/i);

    // Source tag is zavorth-security-readiness-gate-2026-06-15
    expect(content).toContain('zavorth-security-readiness-gate-2026-06-15');

    // Status assertions
    expect(content).toMatch(/Geração Local Realizada.*yes/i);
    expect(content).toMatch(/Upload Externo Realizado.*no/i);
    expect(content).toMatch(/Release Público Criado.*no/i);
    expect(content).toMatch(/Entregue para Testers.*no/i);

    // Classification
    expect(content).toMatch(/internal-only\s*\/\s*private\s*\/\s*candidate/i);
  });
});
