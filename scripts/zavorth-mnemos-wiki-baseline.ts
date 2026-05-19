import fs from 'node:fs';
import path from 'node:path';

const json = process.argv.includes('--json');
const root = process.cwd();
const wikiRoot = path.join(root, '.zavorth', 'wiki');
const schemaPath = path.join(root, '.zavorth', 'SCHEMA.md');
const indexPath = path.join(wikiRoot, 'index.json');

type WikiIndex = {
  version: string;
  updated_at: string;
  root: string;
  schema: string;
  pages: Array<{ id: string; path: string; title: string; tags: string[] }>;
  edges: Array<{ from: string; to: string; kind: string }>;
};

function readIndex(): WikiIndex {
  return JSON.parse(fs.readFileSync(indexPath, 'utf8')) as WikiIndex;
}

function pageStatus(pagePath: string) {
  const fullPath = path.join(root, pagePath);
  const body = fs.readFileSync(fullPath, 'utf8');
  const requiredSections = [
    '## Purpose',
    '## Current Facts',
    '## Decisions',
    '## Open Questions',
    '## Source Links',
    '## Maintenance Notes',
  ];
  return {
    path: pagePath,
    bytes: Buffer.byteLength(body, 'utf8'),
    hasFrontmatter: body.trimStart().startsWith('---'),
    requiredSectionsPresent: requiredSections.every((section) => body.includes(section)),
    secretMarkers: /\b(sk-|hf_|AIza|api[_-]?key\s*[:=]|token\s*[:=]|password\s*[:=]|secret\s*[:=])/i.test(body),
  };
}

function main(): void {
  const index = readIndex();
  const pages = index.pages.map((page) => pageStatus(page.path));
  const snapshot = {
    generatedAt: new Date().toISOString(),
    status: pages.every((page) => page.hasFrontmatter && page.requiredSectionsPresent && !page.secretMarkers)
      ? 'ready'
      : 'attention',
    schema: {
      path: '.zavorth/SCHEMA.md',
      exists: fs.existsSync(schemaPath),
    },
    index: {
      version: index.version,
      pageCount: index.pages.length,
      edgeCount: index.edges.length,
      root: index.root,
    },
    pages,
    next: 'Phase 4: mnemos:ingest',
  };

  if (json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  console.log('Zavorth Mnemos Wiki Baseline');
  console.log(`status: ${snapshot.status}`);
  console.log(`schema: ${snapshot.schema.exists ? 'present' : 'missing'} (${snapshot.schema.path})`);
  console.log(`pages: ${snapshot.index.pageCount}`);
  console.log(`edges: ${snapshot.index.edgeCount}`);
  console.log(`next: ${snapshot.next}`);
}

main();
