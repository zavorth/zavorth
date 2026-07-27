import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  '.zavorth/SCHEMA.md',
  '.zavorth/wiki/index.json',
  '.zavorth/wiki/architecture.md',
  '.zavorth/wiki/dependencies.md',
  '.zavorth/wiki/memory.md',
  '.zavorth/wiki/operations.md',
  '.zavorth/wiki/providers.md',
  '.zavorth/wiki/skills.md',
  '.zavorth/raw/.gitkeep',
  'scripts/zavorth-mnemos-wiki-baseline.ts',
  'tests/services/ZavorthMnemosWikiBaseline.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}`);
  }
}

if (!failures.length) {
  const index = JSON.parse(fs.readFileSync('.zavorth/wiki/index.json', 'utf8'));
  if (index.root !== '.zavorth/wiki') failures.push('index root mismatch');
  if (index.schema !== '.zavorth/SCHEMA.md') failures.push('index schema mismatch');
  if (!Array.isArray(index.pages) || index.pages.length < 6) failures.push('index has too few pages');
  if (!Array.isArray(index.edges) || index.edges.length < 5) failures.push('index has too few edges');

  const requiredSections = [
    '## Purpose',
    '## Current Facts',
    '## Decisions',
    '## Open Questions',
    '## Source Links',
    '## Maintenance Notes',
  ];
  for (const page of index.pages || []) {
    const pagePath = String(page.path || '');
    if (!pagePath.startsWith('.zavorth/wiki/')) {
      failures.push(`page outside wiki root: ${pagePath}`);
      continue;
    }
    const body = fs.readFileSync(path.normalize(pagePath), 'utf8');
    if (!body.trimStart().startsWith('---')) failures.push(`missing frontmatter: ${pagePath}`);
    for (const section of requiredSections) {
      if (!body.includes(section)) failures.push(`missing ${section} in ${pagePath}`);
    }
    if (/\b(sk-|hf_|AIza|api[_-]...key\s*[:=]|token\s*[:=]|password\s*[:=]|secret\s*[:=])/i.test(body)) {
      failures.push(`secret-like marker in ${pagePath}`);
    }
  }
}

const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
if (!packageJson.includes('zavorth:mnemos-wiki-baseline:check')) {
  failures.push('package script zavorth:mnemos-wiki-baseline:check missing');
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosWikiBaseline.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) {
    failures.push(`jest failed with exit code ${jest.status}`);
  }
}

if (failures.length) {
  console.error('[zavorth-mnemos-wiki-baseline-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-wiki-baseline-check] ok');
