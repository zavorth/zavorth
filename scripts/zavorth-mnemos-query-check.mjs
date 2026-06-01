import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosQueryContract.ts',
  'src/services/ZavorthMnemosFtsIndexService.ts',
  'src/services/ZavorthMnemosQueryService.ts',
  'scripts/zavorth-mnemos-query.ts',
  'tests/services/ZavorthMnemosQueryService.test.ts',
  'tests/services/ZavorthMnemosFtsIndexService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) failures.push(`missing ${file}`);
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const ftsService = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const service = fs.existsSync(requiredFiles[2]) ? fs.readFileSync(requiredFiles[2], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

const markers = [
  ['rrf method', 'keyword-tag-graph-rrf'],
  ['sqlite fts rank', 'sqlite-fts5'],
  ['derived sqlite index', 'sqliteIndexIsDerived: true'],
  ['keyword rank', 'rankByKeyword'],
  ['tag rank', 'rankByTags'],
  ['graph rank', 'rankByGraph'],
  ['untrusted wrapper', 'untrusted_mnemos_wiki'],
  ['wiki root only', 'wikiRootOnly: true'],
  ['top k only', 'topKOnly: true'],
  ['no provider call', 'providerCall: false'],
  ['no network call', 'networkCall: false'],
  ['secret redaction', 'SECRET_PATTERNS'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker) && !ftsService.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('mnemos:query')) failures.push('package script mnemos:query missing');
if (!packageJson.includes('mnemos:query:check')) failures.push('package script mnemos:query:check missing');

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthMnemosQueryService.test.ts', 'tests/services/ZavorthMnemosFtsIndexService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) failures.push(`jest failed with exit code ${jest.status}`);
}

if (failures.length) {
  console.error('[zavorth-mnemos-query-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-query-check] ok');
