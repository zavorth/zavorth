#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('src/services/ZavorthManagedConfigService.ts'),
  fileExists('src/cli/managed-config/ZavorthManagedConfigCommand.ts'),
  fileExists('tests/cli/managed-config/ZavorthManagedConfigCommand.test.ts'),
  contains('src/cli/ZavorthCliRegistry.ts', ['handleZavorthManagedConfigCommand']),
  contains('src/services/ZavorthManagedConfigService.ts', [
    'ZAVORTH_DEPLOYMENT_KEY',
    'ZAVORTH_MANAGED_CONFIG_URL',
    'checksumVerified',
    'Raw secret-like value is not allowed',
    'managed_config_receipts.jsonl',
  ]),
  contains('src/cli/managed-config/ZavorthManagedConfigCommand.ts', [
    'Managed Config Preview',
    'checksum',
    'deployment-key',
  ]),
  contains('package.json', [
    'managed-config:check',
    'zavorth:cli-managed-config:check',
  ]),
  contains('docs/install.md', [
    'Managed Config',
    'ZAVORTH_MANAGED_CONFIG_URL',
    'zavorth managed-config apply',
  ]),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[managed-config-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[managed-config-check] passed ${checks.length} checks`);

function fileExists(file) {
  return {
    name: `file:${file}`,
    passed: fs.existsSync(path.join(root, file)),
    detail: `${file} must exist`,
  };
}

function contains(file, needles) {
  const target = path.join(root, file);
  const content = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
  const missing = needles.filter((needle) => !content.includes(needle));
  return {
    name: `contains:${file}`,
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'ok' : `missing ${missing.join(', ')}`,
  };
}
