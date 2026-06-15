import * as fs from 'fs';
import * as path from 'path';

describe('ProductPolishDocsIntegrity Tests (Phase 21N)', () => {
  const docsDir = path.join(__dirname, '../../docs/product');
  const betaDocsDir = path.join(__dirname, '../../docs/beta');

  const getFiles = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(dir, f));
  };

  const allDocFiles = [
    ...getFiles(docsDir),
    ...getFiles(betaDocsDir)
  ];

  it('verifies that docs exist and can be read', () => {
    expect(allDocFiles.length).toBeGreaterThan(0);
    for (const file of allDocFiles) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('verifies that docs do not contain any references to Hermes', () => {
    for (const file of allDocFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('Hermes');
      expect(content).not.toContain('hermes');
    }
  });

  it('verifies that docs do not leak raw API key patterns or secrets', () => {
    const forbiddenPatterns = [
      /sk-[A-Za-z0-9-_]{20,}/,
      /Authorization:\s*Bearer/i,
      /secretRef:\s*\S+/i,
    ];

    for (const file of allDocFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('verifies that docs do not contain null, undefined, or [object Object]', () => {
    for (const file of allDocFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('undefined');
      expect(content).not.toContain('null');
      expect(content).not.toContain('[object Object]');
    }
  });
});
