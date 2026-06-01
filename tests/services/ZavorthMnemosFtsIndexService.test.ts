import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZavorthMnemosFtsIndexService } from '../../src/services/ZavorthMnemosFtsIndexService';
import { ZavorthMnemosQueryService } from '../../src/services/ZavorthMnemosQueryService';

function makeWiki(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-mnemos-fts-'));
  fs.mkdirSync(path.join(root, '.zavorth', 'wiki'), { recursive: true });
  fs.writeFileSync(path.join(root, '.zavorth', 'wiki', 'index.json'), JSON.stringify({
    root: '.zavorth/wiki',
    schema: '.zavorth/SCHEMA.md',
    pages: [
      { id: 'providers', path: '.zavorth/wiki/providers.md', title: 'Providers', tags: ['providers', 'routing'] },
      { id: 'memory', path: '.zavorth/wiki/memory.md', title: 'Memory', tags: ['mnemos'] },
    ],
    edges: [{ from: 'providers', to: 'memory', kind: 'mentions' }],
  }, null, 2));
  fs.writeFileSync(path.join(root, '.zavorth', 'wiki', 'providers.md'), [
    '---',
    'title: Providers',
    '---',
    '## Purpose',
    'Track provider routing decisions.',
    '## Current Facts',
    '- OpenRouter and OpenAI routing must be proven live before claims.',
  ].join('\n'));
  fs.writeFileSync(path.join(root, '.zavorth', 'wiki', 'memory.md'), [
    '---',
    'title: Memory',
    '---',
    '## Purpose',
    'Track Mnemos memory facts.',
    '## Current Facts',
    '- Mnemos uses markdown as source of truth.',
  ].join('\n'));
  return root;
}

describe('ZavorthMnemosFtsIndexService', () => {
  it('builds a derived SQLite FTS index and searches wiki pages', () => {
    const root = makeWiki();
    try {
      const service = new ZavorthMnemosFtsIndexService({
        projectRoot: root,
        now: () => new Date('2026-05-31T12:00:00.000Z'),
      });

      const snapshot = service.rebuild();
      expect(snapshot.status).toBe('indexed');
      expect(snapshot.fts5Available).toBe(true);
      expect(snapshot.pagesIndexed).toBe(2);
      expect(fs.existsSync(snapshot.dbPath)).toBe(true);

      const hits = service.search('provider routing', 5);
      expect(hits.available).toBe(true);
      expect(hits.hits[0].pageId).toBe('providers');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('feeds sqlite-fts5 rank source into Mnemos query when available', () => {
    const root = makeWiki();
    try {
      const service = new ZavorthMnemosQueryService({ projectRoot: root });
      const snapshot = service.query({ query: 'provider routing' });

      expect(snapshot.summary.sqliteFtsAvailable).toBe(true);
      expect(snapshot.ranking.method).toBe('sqlite-fts5-keyword-tag-graph-rrf');
      expect(snapshot.hits[0].rankSources).toContain('sqlite-fts5');
      expect(snapshot.safety.sqliteIndexIsDerived).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
