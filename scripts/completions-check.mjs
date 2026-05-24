#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('src/cli/completions/ZavorthCompletionsCommand.ts'),
  fileExists('src/cli/completions/ZavorthCompletionData.ts'),
  fileExists('src/cli/completions/templates/README.md'),
  contains('src/cli/ZavorthCliRegistry.ts', ['handleZavorthCompletionsCommand']),
  contains('src/cli/completions/ZavorthCompletionsCommand.ts', [
    'zavorth completions bash',
    '--approval-mode',
    'approval_modes',
    'Register-ArgumentCompleter',
    'complete -F _zavorth_complete zavorth',
    'complete -c zavorth',
    'compdef _zavorth zavorth',
    '--install',
  ]),
  contains('scripts/install.sh', ['--completions', 'zavorth completions bash --install']),
  contains('scripts/install.ps1', ['Completions', 'zavorth completions powershell --install']),
  contains('docs/install.md', ['Shell Completions', 'zavorth completions powershell']),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[completions-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[completions-check] passed ${checks.length} checks`);

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
