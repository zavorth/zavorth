import fs from 'fs';

const requiredFiles = [
  'src/contracts/ZavorthMemoryLearningLoopContract.ts',
  'src/services/ZavorthMemoryLearningLoopService.ts',
  'scripts/zavorth-memory-learning-loop.ts',
  'tests/services/ZavorthMemoryLearningLoopService.test.ts',
];

const failures = [];
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}`);
  }
}

const service = fs.existsSync('src/services/ZavorthMemoryLearningLoopService.ts')
  ? fs.readFileSync('src/services/ZavorthMemoryLearningLoopService.ts', 'utf8')
  : '';
const packageJson = fs.existsSync('package.json') ? fs.readFileSync('package.json', 'utf8') : '';
const skillEvolution = fs.existsSync('src/skills/ZavorthSkillEvolutionService.ts')
  ? fs.readFileSync('src/skills/ZavorthSkillEvolutionService.ts', 'utf8')
  : '';

const markers = [
  ['session layer', "ZavorthLearningMemoryLayer = 'session'"],
  ['persistent layer', "'persistent'"],
  ['skill layer', "'skill'"],
  ['fts5 index', 'USING fts5'],
  ['top-k receipt', 'topKOnly: true'],
  ['untrusted recall', 'buildUntrustedContextBlock'],
  ['forget API', 'public async forget'],
  ['correct API', 'public async correct'],
  ['high-risk skill block', 'high-risk-tasks-stay-missions-not-skills'],
  ['explicit skill persistence', 'persistCandidate === true'],
  ['bounded session ttl', 'MAX_SESSION_TTL_MS'],
];

for (const [label, marker] of markers) {
  if (!service.includes(marker) && !fs.readFileSync('src/contracts/ZavorthMemoryLearningLoopContract.ts', 'utf8').includes(marker)) {
    failures.push(`missing marker: ${label}`);
  }
}

if (!skillEvolution.includes('evaluateSkillMemoryGate')) {
  failures.push('skill evolution is not gated by Skill Memory policy');
}
if (!packageJson.includes('zavorth:memory-learning-loop:check')) {
  failures.push('package script zavorth:memory-learning-loop:check missing');
}
if (!packageJson.includes('zavorth:memory-learning-loop:check --silent')) {
  failures.push('workspace:check is not wired to memory learning loop check');
}

if (failures.length) {
  console.error('[zavorth-memory-learning-loop-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-memory-learning-loop-check] ok');
