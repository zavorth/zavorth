import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthMnemosMemoryOsContract.ts',
  'src/services/ContextCompactionService.ts',
  'scripts/zavorth-mnemos-memory-os.ts',
  'tests/services/ContextCompactionService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}`);
  }
}

const contract = fs.existsSync(requiredFiles[0]) ? fs.readFileSync(requiredFiles[0], 'utf8') : '';
const service = fs.existsSync(requiredFiles[1]) ? fs.readFileSync(requiredFiles[1], 'utf8') : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';

const markers = [
  ['four-tier memory', "tier: 'procedural'"],
  ['wiki root', "'.zavorth/wiki'"],
  ['idle microcompact threshold', 'ZAVORTH_MNEMOS_IDLE_MICROCOMPACT_MS'],
  ['reserved buffer', 'ZAVORTH_MNEMOS_RESERVED_TOKEN_BUFFER'],
  ['recent verbatim turns', 'ZAVORTH_MNEMOS_RECENT_VERBATIM_TURNS'],
  ['no durable mutation', 'durableMutation: false'],
  ['no provider call', 'providerCall: false'],
  ['tool authority not gated', 'gatesToolAuthority: false'],
  ['secret redaction', 'SECRET_PATTERNS'],
  ['anchored summary tag', '<zavorth-session-summary>'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('zavorth:mnemos-memory-os:check')) {
  failures.push('package script zavorth:mnemos-memory-os:check missing');
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ContextCompactionService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) {
    failures.push(`jest failed with exit code ${jest.status}`);
  }
}

if (failures.length) {
  console.error('[zavorth-mnemos-memory-os-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-mnemos-memory-os-check] ok');
