import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const files = [
  'src/contracts/ZavorthProviderSelectionUxContract.ts',
  'src/services/ZavorthProviderSelectionUxService.ts',
  'scripts/zavorth-provider-selection-ux.ts',
  'tests/services/ZavorthProviderSelectionUxService.test.ts',
];

const missing = files.filter((file) => {
  try {
    readFileSync(join(root, file), 'utf8');
    return false;
  } catch {
    return true;
  }
});

if (missing.length > 0) {
  console.error(`[provider-selection-ux] missing files: ${missing.join(', ')}`);
  process.exit(1);
}

const markers = [
  ['src/contracts/ZavorthProviderSelectionUxContract.ts', ['provider-selection-ux', 'catalogIsNotLiveProof', 'selectionDoesNotWriteConfig']],
  ['src/services/ZavorthProviderSelectionUxService.ts', ['test_first', 'configure_first', 'choose_fallback', 'liveProbeRequiresExplicitCommand']],
  ['scripts/zavorth-provider-selection-ux.ts', ['--require-live', '--intent', '--provider']],
  ['package.json', ['zavorth:provider-selection', 'zavorth:provider-selection:check']],
  ['src/zavorth-cli.ts', ["action === 'select'", 'ZavorthProviderSelectionUxService']],
];

const failures = [];
for (const [file, needles] of markers) {
  const source = readFileSync(join(root, file), 'utf8');
  for (const needle of needles) {
    if (!source.includes(needle)) {
      failures.push(`${file}: missing ${needle}`);
    }
  }
}

const result = spawnSync(process.execPath, [
  join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
  join(root, 'scripts', 'zavorth-provider-selection-ux.ts'),
  '--json',
  '--provider',
  'openai',
  '--require-live',
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe',
});

if (result.status !== 0) {
  failures.push(`selection smoke exited ${result.status}: ${result.stderr || result.stdout}`);
} else {
  try {
    const snapshot = JSON.parse(result.stdout);
    if (snapshot.surface !== 'provider-selection-ux') failures.push('selection smoke surface mismatch');
    if (!snapshot.safety?.catalogIsNotLiveProof) failures.push('selection smoke lacks catalog/live invariant');
    if (snapshot.safety?.selectionDoesNotWriteConfig !== true) failures.push('selection smoke must not write config');
    if (!Array.isArray(snapshot.commands) || !snapshot.commands.some((entry) => entry.id === 'live-test-selected')) {
      failures.push('selection smoke lacks live-test command');
    }
    if (JSON.stringify(snapshot).match(/sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\s*=|ANTHROPIC_API_KEY\s*=/)) {
      failures.push('selection smoke leaked secret-looking value');
    }
  } catch (error) {
    failures.push(`selection smoke invalid JSON: ${error}`);
  }
}

if (failures.length > 0) {
  console.error('[provider-selection-ux] failed');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('[provider-selection-ux] ok');
