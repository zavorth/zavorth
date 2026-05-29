#!/usr/bin/env node

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const deep = process.argv.includes('--deep');
const nodeBin = process.execPath;
const npmCli = resolveNpmCli();
const jestCli = 'node_modules/jest/bin/jest.js';

const rules = [
  publicDocsAreClean(),
  ...(deep ? [
    commandPasses('typescript', nodeBin, [npmCli, 'run', 'runtime:check', '--silent']),
    commandPasses('build', nodeBin, [npmCli, 'run', 'build', '--silent']),
    commandPasses('security ci', nodeBin, [npmCli, 'run', 'security:ci', '--silent']),
  ] : []),
  commandPasses('focused cli tests', nodeBin, [
    jestCli,
    'tests/cli/ZavorthSetupStudioService.test.ts',
    'tests/cli/ZavorthProviderChannelWizardService.test.ts',
    'tests/cli/ZavorthProviderLiveValidationService.test.ts',
    'tests/cli/ZavorthCliOnboardingStandardization.test.ts',
    'tests/services/ZavorthCliTuiPolishService.test.ts',
    'tests/docs/ZavorthControlProductDocs.test.ts',
    '--runInBand',
  ]),
  cliJsonPasses('provider wizard preview', ['bin/zavorth.js', 'providers', 'add', '--provider', 'gemini', '--model', 'gemini-2.5-flash', '--json'], validateProviderWizard),
  cliJsonPasses('channel wizard preview', ['bin/zavorth.js', 'channels', 'telegram', '--allowed-users', '123456', '--json'], validateChannelWizard),
  cliTextPasses('help command', ['bin/zavorth.js', 'help'], ['zavorth setup', 'zavorth start', 'zavorth providers']),
  noSecretLeakFromWizard(),
  commandPasses('diff whitespace', 'git', ['diff', '--check']),
];

const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  surface: 'zavorth-cli-public-surface-check',
  mode: deep ? 'deep' : 'quick',
  status: failed.length === 0 ? 'passed' : 'failed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-cli] public surface certification');
  for (const rule of rules) {
    console.log(`[zavorth-cli] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.label}: ${rule.observed}`);
    for (const detail of rule.details.slice(0, 12)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function publicDocsAreClean() {
  const files = [
    'README.md',
    'BOOTSTRAP.md',
    ...walk('docs').filter((file) => file.endsWith('.md')),
  ];
  const forbidden = [
    /npm run zavorth:/,
    /npx tsx/,
    /node scripts\//,
    /connectors setup/,
    /npm run go\b/,
    /npm run setup\b/,
    /npm run status\b/,
    /npm run doctor\b/,
    /provider-live-canary/,
    /universal-skill-intake/,
    /subagents:check/,
    /workspace:check/,
    /test:web/,
    /test:channels/,
    /test:nodes/,
    /test:transports/,
    /natural-setup/,
    /command:list/,
  ];
  const allowedMaintainer = new Set([
    'docs/zavorth-cli.md',
    'docs/operations.md',
    'docs/product/quickstart-developer.md',
    'docs/product/troubleshooting-guiado.md',
    'docs/README.md',
    'docs/apps-satellite-nodes.md',
    'docs/capability-absorption.md',
    'docs/channel-deepening.md',
    'docs/zavorth-control-advanced-interaction.md',
    'docs/extension-plugin-sdk.md',
    'docs/native-browser-computer-use.md',
    'docs/native-learning-loop.md',
    'docs/node-mesh-live-native.md',
    'docs/product-qa-live.md',
    'docs/terminal-backends.md',
  ]);
  const allowedMaintainerPatterns = [
    /npm run runtime:check/,
    /npm run security:ci/,
    /npm run build --silent/,
    /npm run daily:certify/,
  ];
  const violations = [];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const [index, line] of text.split(/\r?\n/).entries()) {
      const normalizedFile = file.replace(/\\/g, '/');
      const isMaintainerLine = allowedMaintainer.has(normalizedFile)
        && (allowedMaintainerPatterns.some((pattern) => pattern.test(line)) || /npm run zavorth:/i.test(line));
      if (isMaintainerLine) continue;
      for (const pattern of forbidden) {
        if (pattern.test(line)) violations.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    }
  }
  return rule(
    'public-docs-clean',
    'Public docs prefer simple commands',
    violations.length === 0,
    violations.length === 0 ? 'clean' : `${violations.length} violations`,
    violations,
  );
}

function cliJsonPasses(label, args, validator) {
  const result = spawnSync(nodeBin, args, { cwd: root, encoding: 'utf8', shell: false });
  if (result.status !== 0) {
    return rule(label, label, false, `exit=${result.status}`, [result.stderr || result.stdout || 'no output']);
  }
  const leaks = validateNoRawSecrets(result.stdout);
  const parsed = parseJson(result.stdout);
  const errors = [
    ...leaks,
    ...(parsed ? validator(parsed) : ['invalid json']),
  ];
  return rule(label, label, errors.length === 0, errors.length === 0 ? 'passed' : 'failed', errors);
}

function cliTextPasses(label, args, needles) {
  const result = spawnSync(nodeBin, args, { cwd: root, encoding: 'utf8', shell: false });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const missing = needles.filter((needle) => !output.includes(needle));
  const errors = [
    ...(result.status === 0 ? [] : [`exit=${result.status}`]),
    ...missing.map((needle) => `missing "${needle}"`),
    ...validateNoRawSecrets(output),
  ];
  return rule(label, label, errors.length === 0, errors.length === 0 ? 'passed' : 'failed', errors);
}

function commandPasses(id, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    encoding: 'utf8',
    shell: false,
    timeout: 240000,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const errors = [
    ...(result.status === 0 ? [] : [`exit=${result.status}`, output.slice(0, 4000)]),
    ...validateNoRawSecrets(output),
  ];
  return rule(id, id, errors.length === 0, errors.length === 0 ? 'passed' : 'failed', errors);
}

function noSecretLeakFromWizard() {
  const env = { ...process.env, ZAVORTH_TEST_WIZARD_SECRET: 'super-secret-value-987654' };
  const result = spawnSync(nodeBin, [
    'bin/zavorth.js',
    'providers',
    'add',
    '--provider',
    'openai',
    '--model',
    'gpt-4o-mini',
    '--secret-env',
    'ZAVORTH_TEST_WIZARD_SECRET',
    '--json',
  ], { cwd: root, env, encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  const errors = [];
  if (result.status !== 0) errors.push(`exit=${result.status}`);
  if (output.includes(env.ZAVORTH_TEST_WIZARD_SECRET)) errors.push('wizard printed raw secret');
  errors.push(...validateNoRawSecrets(output));
  return rule('wizard-secret-redaction', 'Wizard redacts secret env values', errors.length === 0, errors.length === 0 ? 'passed' : 'failed', errors);
}

function validateProviderWizard(data) {
  const errors = [];
  if (data.contractVersion !== 'zavorth-provider-channel-wizard/1') errors.push('wrong contract');
  if (data.kind !== 'provider') errors.push('wrong kind');
  if (data.status !== 'preview') errors.push('provider wizard should preview by default');
  if (data.safety?.noSecretInOutput !== true) errors.push('secret safety missing');
  if (data.safety?.noLiveProbe !== true) errors.push('live probe safety missing');
  if (!data.updates?.some((entry) => entry.key === 'ZAVORTH_DEFAULT_PROVIDER')) errors.push('provider env update missing');
  if (!data.updates?.some((entry) => entry.key === 'GEMINI_MODEL')) errors.push('model env update missing');
  return errors;
}

function validateChannelWizard(data) {
  const errors = [];
  if (data.contractVersion !== 'zavorth-provider-channel-wizard/1') errors.push('wrong contract');
  if (data.kind !== 'channel') errors.push('wrong kind');
  if (data.status !== 'preview') errors.push('channel wizard should preview by default');
  if (data.safety?.noRuntimeStart !== true) errors.push('runtime start safety missing');
  if (!data.updates?.some((entry) => entry.key === 'TELEGRAM_ALLOWED_USER_IDS')) errors.push('telegram allowlist missing');
  if (!data.updates?.some((entry) => entry.key === 'ZAVORTH_CHANNEL_POLICY_TELEGRAM_ALLOWED')) errors.push('telegram policy missing');
  return errors;
}

function validateNoRawSecrets(text) {
  const patterns = [
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bhf_[A-Za-z0-9]{20,}\b/,
    /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/,
    /\bAIza[0-9A-Za-z_-]{25,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\bya29\.[0-9A-Za-z_-]{20,}\b/,
    /\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\b/,
  ];
  return patterns.some((pattern) => pattern.test(text)) ? ['serialized a raw secret-like token'] : [];
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function rule(id, label, ok, observed, details = []) {
  return { id, label, status: ok ? 'passed' : 'failed', observed, details };
}

function resolveNpmCli() {
  const candidates = [
    'node_modules/npm/bin/npm-cli.js',
    process.env.ProgramFiles ? `${process.env.ProgramFiles}/nodejs/node_modules/npm/bin/npm-cli.js` : '',
    process.env['ProgramFiles(x86)'] ? `${process.env['ProgramFiles(x86)']}/nodejs/node_modules/npm/bin/npm-cli.js` : '',
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('npm CLI not found for certification subprocesses.');
  }
  return found;
}
