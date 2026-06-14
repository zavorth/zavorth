import * as fs from 'fs';
import * as path from 'path';

describe('InternalBetaDocsIntegrity Tests (Phase 21L)', () => {
  const docsDir = path.join(__dirname, '../../docs/beta');
  const docFiles = [
    'internal-beta-quickstart.md',
    'internal-beta-known-issues.md',
    'internal-beta-validation-matrix.md',
    'internal-beta-go-no-go.md',
  ];

  it('verifies that all beta documents exist in the docs/beta directory', () => {
    for (const file of docFiles) {
      const filePath = path.join(docsDir, file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });

  it('verifies that documents do not contain any raw secrets or leak markers', () => {
    const forbiddenPatterns = [
      /sk-[A-Za-z0-9-_]{20,}/, // Real-ish API key pattern
      /Authorization:\s*Bearer/i,
      /secretRef:\s*\S+/i,
      /sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A/i,
      /sk-zavorth-internal-beta-hardening-DO-NOT-LEAK-21K-B/i,
    ];

    for (const file of docFiles) {
      const filePath = path.join(docsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('verifies that documentation states HPM and PTY are blocked by default', () => {
    const quickstartPath = path.join(docsDir, 'internal-beta-quickstart.md');
    const content = fs.readFileSync(quickstartPath, 'utf-8');

    expect(content).toContain('**Developer Mode**: Bloqueado');
    expect(content).toContain('**Host Power Mode (HPM)**: Bloqueado');
    expect(content).toContain('**PTY (Interactive Sessions)**: Bloqueado');
  });

  it('verifies that documentation does not instruct dangerous automated execution', () => {
    for (const file of docFiles) {
      const filePath = path.join(docsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toContain('automatic execution');
      expect(content).not.toContain('execucao automatica');
      expect(content).not.toContain('shell:true automático');
    }
  });
});
