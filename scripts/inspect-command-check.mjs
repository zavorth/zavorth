#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('src/services/ZavorthInspectService.ts'),
  fileExists('src/cli/inspect/ZavorthInspectCommand.ts'),
  fileExists('tests/cli/inspect/ZavorthInspectCommand.test.ts'),
  contains('src/cli/ZavorthCliRegistry.ts', [
    'handleZavorthInspectCommand',
    "commandName === 'inspect'",
  ]),
  contains('src/services/ZavorthInspectService.ts', [
    'Mnemos memory layer',
    'raw secret values are never serialized',
    'pendingApprovals',
    'credentialRefs',
  ]),
  contains('src/cli/inspect/ZavorthInspectCommand.ts', [
    'Zavorth Inspect',
    'static workspace scan',
    'live runtime enriched',
  ]),
  contains('package.json', [
    'inspect-command:check',
    'zavorth:cli-inspect:check',
  ]),
  contains('docs/install.md', [
    'Inspect Command',
    'zavorth inspect --json',
  ]),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[inspect-command-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[inspect-command-check] passed ${checks.length} checks`);

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
