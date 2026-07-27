#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const checks = [
  fileExists('src/cli/presentation/TerminalTheme.ts'),
  fileExists('src/cli/presentation/TerminalPanel.ts'),
  fileExists('src/cli/presentation/TerminalSpinner.ts'),
  fileExists('src/cli/presentation/TerminalMarkdown.ts'),
  fileExists('src/cli/presentation/TerminalDiff.ts'),
  fileExists('src/cli/presentation/TerminalPrompt.ts'),
  fileExists('src/cli/presentation/TerminalTimeline.ts'),
  contains('src/cli/ZavorthCliChatRenderers.ts', ['TerminalMarkdown.render']),
  contains('src/cli/ZavorthCliEventCards.ts', ['TerminalMarkdown.render']),
  contains('src/cli/ZavorthCli.ts', ['globalSpinner.start', 'globalSpinner.succeed', 'globalSpinner.fail']),
  contains('src/cli/ZavorthCliRegistry.ts', ['globalSpinner.start', 'globalSpinner.succeed', 'globalSpinner.fail']),
  contains('src/cli/approval-diff/ZavorthCliApprovalDiffRenderer.ts', ['TerminalDiff.render']),
  noMojibake('src/cli/presentation/TerminalTheme.ts'),
  noMojibake('src/cli/presentation/TerminalDiff.ts'),
  noMojibake('scripts/install.sh'),
  noMojibake('scripts/install.ps1'),
];

const failed = checks.filter((check) => !check.passed);
if (failed.length > 0) {
  console.error('[terminal-presentation-check] failed');
  for (const check of failed) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  process.exit(1);
}

console.log(`[terminal-presentation-check] passed ${checks.length} checks`);

function fileExists(file) {
  return {
    name: `file:${file}`,
    passed: existsSync(join(root, file)),
    detail: `${file} must exist`,
  };
}

function contains(file, needles) {
  const target = join(root, file);
  const content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const missing = needles.filter((needle) => !content.includes(needle));
  return {
    name: `contains:${file}`,
    passed: missing.length === 0,
    detail: missing.length === 0 ? 'ok' : `missing ${missing.join(', ')}`,
  };
}

function noMojibake(file) {
  const target = join(root, file);
  const content = existsSync(target) ? readFileSync(target, 'utf8') : '';
  const suspicious = [String.fromCharCode(195), String.fromCharCode(194), String.fromCharCode(226,156), String.fromCharCode(226,154), String.fromCharCode(226,132), String.fromCharCode(226,157)];
  const found = suspicious.filter((needle) => content.includes(needle));
  return {
    name: `encoding:${file}`,
    passed: found.length === 0,
    detail: found.length === 0 ? 'ok' : `suspicious sequences ${found.join(', ')}`,
  };
}
