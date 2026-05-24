#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const nodeBin = process.execPath;
const runAudit = process.argv.includes('--audit');
const results = [];

runStep('installer parity', nodeBin, ['scripts/installer-parity-check.mjs']);
runStep('installer release manifest', nodeBin, ['scripts/installer-release-manifest.mjs', '--check']);
runStep('release channels', nodeBin, ['scripts/release-channels-check.mjs']);
runStep('standalone launcher', nodeBin, ['scripts/standalone-launcher-check.mjs']);
runStep('release artifacts', nodeBin, tsxArgs('scripts/release-artifacts.ts', '--check'));
runStep('terminal presentation', nodeBin, ['scripts/terminal-presentation-check.mjs']);
runStep('completions structure', nodeBin, ['scripts/completions-check.mjs']);
runStep('headless mode structure', nodeBin, ['scripts/headless-mode-check.mjs']);
runStep('inspect structure', nodeBin, ['scripts/inspect-command-check.mjs']);
runStep('managed config structure', nodeBin, ['scripts/managed-config-check.mjs']);
runStep('update tests', nodeBin, jestArgs('tests/cli/update/ZavorthReleaseChannelService.test.ts'));
runStep('completions tests', nodeBin, jestArgs('tests/cli/completions/ZavorthCompletionsCommand.test.ts'));
runStep('headless tests', nodeBin, jestArgs('tests/cli/headless/ZavorthHeadlessCommand.test.ts'));
runStep('inspect tests', nodeBin, jestArgs('tests/cli/inspect/ZavorthInspectCommand.test.ts'));
runStep('managed config tests', nodeBin, jestArgs('tests/cli/managed-config/ZavorthManagedConfigCommand.test.ts'));
runStep('approval diff tests', nodeBin, jestArgs('tests/cli/approval-diff/ZavorthCliApprovalDiffCommand.test.ts'));
runStep('no secret leakage tests', nodeBin, jestArgs('tests/security/PremiumDistributionNoSecretLeak.test.ts'));
runStep('headless missing prompt smoke', nodeBin, tsxArgs('src/zavorth-cli.ts', '-p', '--json'), {
  expectFailure: true,
  mustContain: ['Headless mode requires a prompt'],
});
runStep('inspect no secret leakage smoke', nodeBin, tsxArgs('src/zavorth-cli.ts', 'inspect', '--json'), {
  env: { ...process.env, OPENAI_API_KEY: 'zavorth_should_not_leak_secret_value' },
  mustNotContain: ['zavorth_should_not_leak_secret_value'],
  mustContain: ['ZavorthInspectService'],
});
runManagedConfigSmoke();

if (runAudit) {
  runStep('npm audit production critical', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--omit=dev', '--audit-level=critical']);
}

const failed = results.filter((result) => !result.ok);
if (failed.length > 0) {
  console.error('[premium-distribution-qa] failed');
  for (const result of failed) {
    console.error(`- ${result.name}: ${result.detail}`);
  }
  process.exit(1);
}

console.log(`[premium-distribution-qa] passed ${results.length} gates`);

function runManagedConfigSmoke() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-managed-config-qa-'));
  const source = path.join(tmp, 'managed_config.json');
  const payload = JSON.stringify({
    schemaVersion: 1,
    managedConfig: { providerPolicy: 'balanced' },
    requirements: { node: '>=18' },
    secretRefs: { gemini: 'GEMINI_API_KEY' },
  });
  fs.writeFileSync(source, payload, 'utf8');
  const checksum = crypto.createHash('sha256').update(payload).digest('hex');
  runStep('managed config preview smoke', nodeBin, [
    ...tsxArgs(
    'src/zavorth-cli.ts',
    'managed-config',
    '--source',
    source,
    '--checksum',
    checksum,
    '--json'),
  ], {
    mustContain: ['"status": "ready"', '"checksumVerified": true'],
    mustNotContain: ['raw-secret'],
  });
  runStep('managed config apply smoke', nodeBin, [
    ...tsxArgs(
    'src/zavorth-cli.ts',
    'managed-config',
    'apply',
    '--source',
    source,
    '--checksum',
    checksum,
    '--yes',
    '--json'),
  ], {
    mustContain: ['"status": "applied"', '"applied": true'],
    mustNotContain: ['raw-secret'],
  });
}

function jestArgs(testPath) {
  return [path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'), testPath, '--runInBand'];
}

function tsxArgs(entry, ...args) {
  return ['--import', 'tsx', entry, ...args];
}

function runStep(name, command, args, options = {}) {
  try {
    const invocation = buildInvocation(command, args);
    const output = execFileSync(invocation.command, invocation.args, {
      cwd: root,
      env: options.env || process.env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (options.expectFailure) {
      results.push({ name, ok: false, detail: 'expected failure but command succeeded' });
      return;
    }
    const assertion = assertOutput(output, options);
    results.push({ name, ok: assertion.ok, detail: assertion.detail });
  } catch (error) {
    const output = `${error?.stdout || ''}${error?.stderr || ''}`;
    if (options.expectFailure) {
      const assertion = assertOutput(output, options);
      results.push({ name, ok: assertion.ok, detail: assertion.detail });
      return;
    }
    results.push({
      name,
      ok: false,
      detail: summarizeOutput(output || error?.message || String(error)),
    });
  }
}

function buildInvocation(command, args) {
  if (process.platform === 'win32' && /\.cmd$/i.test(command)) {
    return {
      command: 'cmd.exe',
      args: ['/d', '/c', [command, ...args].join(' ')],
    };
  }
  return { command, args };
}

function assertOutput(output, options) {
  for (const needle of options.mustContain || []) {
    if (!output.includes(needle)) {
      return { ok: false, detail: `missing output marker ${needle}` };
    }
  }
  for (const needle of options.mustNotContain || []) {
    if (output.includes(needle)) {
      return { ok: false, detail: `forbidden output marker leaked ${needle}` };
    }
  }
  return { ok: true, detail: 'ok' };
}

function summarizeOutput(output) {
  return String(output || '').split(/\r?\n/).filter(Boolean).slice(-8).join(' | ') || 'command failed';
}
