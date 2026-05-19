import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredFiles = [
  'src/contracts/ZavorthHandoffEnvelopeContract.ts',
  'src/services/ZavorthHandoffEnvelopeService.ts',
  'scripts/zavorth-handoff-envelope.ts',
  'tests/services/ZavorthHandoffEnvelopeService.test.ts',
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

const requiredSections = [
  'active-mandate',
  'current-architecture-decisions',
  'modified-paths',
  'tool-failure-log',
  'security-approvals-granted',
  'verbatim-user-directives',
  'remaining-todo-checklist',
  'simulated-state-preview',
  'next-prescribed-action',
];

for (const section of requiredSections) {
  if (!contract.includes(section)) {
    failures.push(`missing handoff section: ${section}`);
  }
}

const markers = [
  ['preview status', "status: 'preview-ready'"],
  ['no provider call', 'providerCall: false'],
  ['no durable mutation', 'durableMutation: false'],
  ['no tool execution', 'toolExecution: false'],
  ['approval required', 'approvalRequiredToPersist: true'],
  ['markdown renderer', '# Zavorth Handoff Envelope'],
  ['compaction integration', 'ContextCompactionService'],
];

for (const [label, marker] of markers) {
  if (!contract.includes(marker) && !service.includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!packageJson.includes('zavorth:handoff-envelope:check')) {
  failures.push('package script zavorth:handoff-envelope:check missing');
}

if (!failures.length) {
  const jest = spawnSync(
    process.execPath,
    ['node_modules/jest/bin/jest.js', 'tests/services/ZavorthHandoffEnvelopeService.test.ts', '--runInBand'],
    { stdio: 'inherit' },
  );
  if (jest.status !== 0) {
    failures.push(`jest failed with exit code ${jest.status}`);
  }
}

if (failures.length) {
  console.error('[zavorth-handoff-envelope-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-handoff-envelope-check] ok');
