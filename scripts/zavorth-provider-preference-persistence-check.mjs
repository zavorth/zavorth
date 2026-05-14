import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const requiredFiles = [
  'src/contracts/ZavorthProviderPreferencePersistenceContract.ts',
  'src/services/ZavorthProviderPreferencePersistenceService.ts',
  'scripts/zavorth-provider-preference-persistence.ts',
  'tests/services/ZavorthProviderPreferencePersistenceService.test.ts',
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    throw new Error(`missing required provider preference file: ${file}`);
  }
}

const markers = [
  ['src/services/ZavorthProviderPreferencePersistenceService.ts', [
    'requiresExplicitApproval: true',
    'mutatesEnvFile: false',
    'rawSecretsSerialized: false',
    'provider-selection-preferences.json',
    'provider-selection-receipts.jsonl',
  ]],
  ['src/config/sections/providerConfig.ts', [
    'readPersistedProviderPreference',
    'provider-selection-preferences.json',
    'persistedPreference?.providerId',
  ]],
  ['src/zavorth-cli.ts', [
    "action === 'apply'",
    "action === 'rollback'",
    'ZavorthProviderPreferencePersistenceService',
  ]],
  ['package.json', [
    'zavorth:provider-preference:check',
    'zavorth-provider-preference-persistence-check.mjs',
  ]],
];

for (const [file, expectedMarkers] of markers) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const marker of expectedMarkers) {
    if (!content.includes(marker)) {
      throw new Error(`${file} missing marker ${marker}`);
    }
  }
}

const output = execFileSync(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'scripts/zavorth-provider-preference-persistence.ts', 'preview', 'openai', '--json'],
  { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
const parsed = JSON.parse(output);
if (parsed.surface !== 'provider-preference-persistence') {
  throw new Error('provider preference script did not return the expected surface');
}
if (parsed.receipt?.safety?.rawSecretsSerialized !== false || parsed.receipt?.safety?.mutatesEnvFile !== false) {
  throw new Error('provider preference receipt safety invariant failed');
}
if (!parsed.commands?.some((command) => command.id === 'approved-apply' && command.mutatesConfig === true)) {
  throw new Error('provider preference approved apply command missing');
}
if (/sk-[A-Za-z0-9]/.test(output)) {
  throw new Error('provider preference output appears to contain a raw secret');
}

console.log('[provider-preference-persistence] ok');
