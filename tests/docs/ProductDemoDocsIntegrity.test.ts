import * as fs from 'fs';
import * as path from 'path';

describe('ProductDemoDocsIntegrity Tests (Phase 21O)', () => {
  const docsDir = path.join(__dirname, '../../docs/product');
  
  const targetDocs = [
    'product-demo-flow-script-21O.md',
    'product-qa-report-21O.md',
    'product-demo-rehearsal-checklist-21O.md',
    'product-demo-known-issues-21O.md'
  ].map(name => path.join(docsDir, name));

  it('verifies that all demo docs exist and can be read', () => {
    expect(targetDocs.length).toBe(4);
    for (const file of targetDocs) {
      expect(fs.existsSync(file)).toBe(true);
    }
  });

  it('verifies that all demo docs declare no build delivery to testers', () => {
    for (const file of targetDocs) {
      const content = fs.readFileSync(file, 'utf-8');
      const lowerContent = content.toLowerCase();
      expect(lowerContent).toContain('esta fase não entrega build para testers');
      expect(lowerContent).toContain('não há installer publicado');
      expect(lowerContent).toContain('não há pacote público');
      expect(lowerContent).toContain('não há release público');
      expect(lowerContent).toContain('não há push remoto');
    }
  });

  it('verifies that all demo docs do not contain any references to Hermes', () => {
    for (const file of targetDocs) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('Hermes');
      expect(content).not.toContain('hermes');
    }
  });

  it('verifies that all demo docs do not leak raw API keys, secrets or Bearer tokens', () => {
    const forbiddenPatterns = [
      /sk-[A-Za-z0-9-_]{20,}/,
      /Authorization:\s*Bearer/i,
      /secretRef:\s*\S+/i,
    ];

    for (const file of targetDocs) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('verifies that all demo docs do not contain null, undefined, or [object Object] placeholders', () => {
    for (const file of targetDocs) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('undefined');
      expect(content).not.toContain('null');
      expect(content).not.toContain('[object Object]');
    }
  });
});
