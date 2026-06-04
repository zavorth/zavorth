import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbiddenRuntimeExperiment = path.join(root, 'src', 'cli', 'ink-test-env');
const expectedLabPackage = path.join(root, 'tools', 'cli', 'ink-test-env', 'package.json');

const failures = [];

if (fs.existsSync(forbiddenRuntimeExperiment)) {
  failures.push('src/cli/ink-test-env must stay out of the runtime source tree. Use tools/cli/ink-test-env instead.');
}

if (!fs.existsSync(expectedLabPackage)) {
  failures.push('tools/cli/ink-test-env/package.json was not found; the Ink preview lab should remain available outside src.');
}

if (failures.length > 0) {
  console.error('Zavorth CLI surface consolidation failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Zavorth CLI surface consolidation OK');
