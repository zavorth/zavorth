import fs from 'node:fs';

const scannedFiles = [
  'src/contracts/ConvergenceReadinessContract.ts',
  'src/services/ZavorthNativeConvergenceService.ts',
  'scripts/zavorth-native-convergence.ts',
  'scripts/zavorth-native-convergence-check.mjs',
  'scripts/zavorth-native-convergence-hygiene-check.mjs',
  'tests/services/ZavorthNativeConvergenceService.test.ts',
];

const forbiddenPublicTerms = [
  new RegExp(`\\b${'open'}${'claw'}\\b`, 'i'),
  new RegExp(`\\b${'her'}${'mes'}\\b`, 'i'),
  /\bk2\b/i,
  /\bmoonshot\s+ai\b/i,
];

const requiredOwnedTerms = [
  'Action Harness',
  'Provider Mesh',
  'Channel Mesh',
  'Mnemos',
  'Curator Plane',
  'Swarm Scale Plane',
  'Sandbox Control Plane',
  'Satellite',
];

const failures = [];

for (const file of scannedFiles) {
  if (!fs.existsSync(file)) {
    failures.push(`missing ${file}`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenPublicTerms) {
    if (pattern.test(text)) {
      failures.push(`forbidden public term ${pattern} in ${file}`);
    }
  }
}

const serviceText = fs.existsSync('src/services/ZavorthNativeConvergenceService.ts')
  ? fs.readFileSync('src/services/ZavorthNativeConvergenceService.ts', 'utf8')
  : '';

for (const term of requiredOwnedTerms) {
  if (!serviceText.includes(term)) {
    failures.push(`missing Zavorth-owned public term: ${term}`);
  }
}

if (failures.length) {
  console.error('[zavorth-native-convergence-hygiene-check] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[zavorth-native-convergence-hygiene-check] ok');
