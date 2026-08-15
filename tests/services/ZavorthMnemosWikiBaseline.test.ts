import fs from 'node:fs';
import path from 'node:path';


const root = path.resolve(__dirname, '../../');

describe('Zavorth Mnemos wiki baseline', () => {
  it('creates the governed wiki root, raw root and schema', () => {
    expect(fs.existsSync(path.join(root, '.zavorth', 'SCHEMA.md'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'wiki'))).toBe(true);
    expect(fs.existsSync(path.join(root, '.zavorth', 'raw', '.gitkeep'))).toBe(true);

    const schema = fs.readFileSync(path.join(root, '.zavorth', 'SCHEMA.md'), 'utf8');
    expect(schema).toContain('Never store raw credentials');
    expect(schema).toContain('Required Sections');
  });

  it('has a valid index with pages and graph edges inside the wiki root', () => {
    const index = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'wiki', 'index.json'), 'utf8'));

    expect(index).toEqual(expect.objectContaining({
      version: 'zavorth-mnemos-wiki-baseline-v1',
      root: '.zavorth/wiki',
      schema: '.zavorth/SCHEMA.md',
    }));
    expect(index.pages.map((page: { id: string }) => page.id)).toEqual([
      'architecture',
      'dependencies',
      'memory',
      'operations',
      'providers',
      'skills',
    ]);
    expect(index.edges.length).toBeGreaterThanOrEqual(5);
    for (const page of index.pages) {
      expect(page.path.startsWith('.zavorth/wiki/')).toBe(true);
    }
  });

  it('ensures every baseline page follows schema and avoids secret-like values', () => {
    const index = JSON.parse(fs.readFileSync(path.join(root, '.zavorth', 'wiki', 'index.json'), 'utf8'));
    const requiredSections = [
      '## Purpose',
      '## Current Facts',
      '## Decisions',
      '## Open Questions',
      '## Source Links',
      '## Maintenance Notes',
    ];

    for (const page of index.pages) {
      const body = fs.readFileSync(path.join(root, page.path), 'utf8');
      expect(body.trimStart().startsWith('---')).toBe(true);
      for (const section of requiredSections) {
        expect(body).toContain(section);
      }
      expect(body).not.toMatch(/\b(sk-|hf_|AIza|api[_-]?key\s*[:=]|token\s*[:=]|password\s*[:=]|secret\s*[:=])/i);
    }
  });
});
