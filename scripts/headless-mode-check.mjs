#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('src/cli/headless/ZavorthHeadlessCommand.ts'),
  contains('src/cli/ZavorthCliCommandHelpers.ts', ['normalizeZavorthHeadlessArgs', 'headless.enabled', 'approvalMode']),
  contains('src/cli/ZavorthCli.ts', ['Headless mode requires a prompt', 'flags.headless']),
  contains('src/cli/ZavorthCliRegistry.ts', ['headless: effectiveFlags.headless', 'approvalMode: effectiveFlags.approvalMode']),
  contains('docs/install.md', ['zavorth -p "explain this repo"', '--approval-mode governed']),
  contains('package.json', ['headless-mode:check', 'zavorth:cli-headless:check']),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[headless-mode-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[headless-mode-check] passed ${checks.length} checks`);

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
