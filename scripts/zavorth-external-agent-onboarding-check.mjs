#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const tsxCli = path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const rules = [
  ruleFilesExist(),
  ruleContainsMarkers(),
  runPromptFixture(),
  runConsentPathFixture(),
  runMaterializeFixture(),
  runNoConsentFixture(),
];
const failed = rules.filter((rule) => rule.status === 'failed');
const snapshot = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: { rules: rules.length, passed: rules.length - failed.length, failed: failed.length },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(snapshot, null, 2));
} else {
  console.log('[zavorth-external-agent-onboarding] checking consent-first onboarding');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-agent-onboarding] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalAgentOnboardingContract.ts',
    'src/services/ZavorthExternalAgentOnboardingService.ts',
    'scripts/zavorth-external-agent-onboarding.ts',
    'scripts/zavorth-external-agent-onboarding-check.mjs',
    'tests/services/ZavorthExternalAgentOnboardingService.test.ts',
    'docs/37-external-agent-onboarding.md',
    'src/zavorth-cli.ts',
    'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
    'src/telegram/TelegramCommandRoutingService.ts',
    'src/telegram/controllers/TelegramOpsController.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Onboarding files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package script are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalAgentOnboardingContract.ts', [
      'zavorth-external-agent-onboarding/1',
      'automaticDiscoveryEnabled: false',
      'noFilesystemScanWithoutConsent: true',
      'liveUseRequiresSeparateApproval: true',
      'gatewayProfileDraft',
    ]],
    ['src/services/ZavorthExternalAgentOnboardingService.ts', [
      'External Agent Onboarding',
      'read-only inspection',
      'noProcessStarted: true',
      'noNetworkProbe: true',
      'noDefaultRuntimeBinding: true',
      'materializeGatewayProfile',
      'ZavorthExternalAgentGatewayService',
    ]],
    ['package.json', [
      'zavorth:external-agent-onboarding',
      'zavorth:external-agent-onboarding:check',
    ]],
    ['src/zavorth-cli.ts', [
      'runExternalAgentOnboarding',
      'external-agent-onboarding',
      'agent-onboarding',
    ]],
    ['src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts', [
      '/api/runtime/external-agent-onboarding',
      'ZavorthExternalAgentOnboardingService',
    ]],
    ['src/telegram/TelegramCommandRoutingService.ts', [
      '/agentonboarding',
      'handleExternalAgentOnboarding',
    ]],
    ['src/telegram/controllers/TelegramOpsController.ts', [
      'handleExternalAgentOnboarding',
      'parseExternalAgentOnboardingTelegramArgs',
    ]],
  ];
  const missing = [];
  for (const [file, needles] of checks) {
    const text = read(file);
    if (text === null) {
      missing.push(`missing ${file}`);
      continue;
    }
    for (const needle of needles) {
      if (!text.includes(needle)) missing.push(`${file}: missing ${needle}`);
    }
  }
  return {
    id: 'markers',
    label: 'Safety markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'onboarding stays consent-first, read-only and not bound by default',
    details: missing,
  };
}

function runPromptFixture() {
  const result = runCli(['--json', '--no-write']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.status === 'needs-user-hint'
    && snapshot?.policy?.automaticDiscoveryEnabled === false
    && snapshot?.inspection?.performed === false
    && snapshot?.safety?.noFilesystemScanWithoutConsent === true;
  return {
    id: 'prompt-fixture',
    label: 'No hint prompts instead of scanning',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, inspected=${snapshot.inspection.performed}` : `exit ${result.status}`,
    target: 'running without a hint must not inspect anything',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runConsentPathFixture() {
  const fixtureRoot = path.join(root, 'tmp', 'external-agent-onboarding-fixture');
  fs.mkdirSync(path.join(fixtureRoot, 'agent'), { recursive: true });
  fs.writeFileSync(path.join(fixtureRoot, 'package.json'), JSON.stringify({
    name: 'fixture-acp-agent',
    scripts: { acp: 'node agent/server.js' },
    keywords: ['agent', 'acp'],
  }, null, 2));
  fs.writeFileSync(path.join(fixtureRoot, 'agent', 'run_agent.py'), 'print("fixture")\n');
  const result = runCli(['--json', '--no-write', '--path', fixtureRoot, '--consent']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.status === 'ready-for-review'
    && snapshot?.consent?.provided === true
    && snapshot?.inspection?.performed === true
    && Array.isArray(snapshot?.candidates)
    && snapshot.candidates.length >= 1
    && snapshot.candidates[0].registration.liveExecutionEnabled === false
    && snapshot.candidates[0].gatewayProfileDraft?.canRegisterAutomatically === true
    && snapshot.candidates[0].safety.noProcessStarted === true;
  return {
    id: 'consent-path-fixture',
    label: 'Consented path produces candidate only',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.candidates.length} candidate(s)` : `exit ${result.status}`,
    target: 'path inspection is read-only and candidate-only',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runMaterializeFixture() {
  const registryFile = path.join(root, 'tmp', 'external-agent-onboarding-materialize-registry.json');
  const binDir = path.join(root, 'tmp', 'external-agent-onboarding-materialize-bin');
  fs.mkdirSync(binDir, { recursive: true });
  const executable = process.platform === 'win32' ? 'fixture-agent.cmd' : 'fixture-agent';
  fs.writeFileSync(path.join(binDir, executable), 'echo fixture\n');
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    Path: `${binDir}${path.delimiter}${process.env.Path || process.env.PATH || ''}`,
    ZAVORTH_EXTERNAL_AGENT_GATEWAY_REGISTRY: registryFile,
  };
  const result = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-agent-onboarding.ts',
    '--json',
    '--no-write',
    '--command',
    'fixture-agent',
    '--consent',
    '--materialize-first',
    '--approve-registration',
    '--enable-live',
  ], {
    cwd: root,
    env,
    encoding: 'utf8',
  });
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'external-agent-onboarding-materialize'
    && snapshot?.status === 'registered'
    && snapshot?.receipt?.execution?.adapterInvoked === false
    && snapshot?.receipt?.profile?.adapter === 'cli'
    && snapshot?.safety?.noInvocationPerformed === true;
  return {
    id: 'materialize-fixture',
    label: 'Candidate can become approved gateway profile',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, invoked=${snapshot.receipt.execution.adapterInvoked}` : `exit ${result.status}`,
    target: 'materialization registers profile but does not invoke external agent',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runNoConsentFixture() {
  const result = runCli(['--json', '--no-write', '--path', root]);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.status === 'blocked'
    && snapshot?.consent?.provided === false
    && snapshot?.inspection?.performed === false
    && snapshot?.candidates?.length === 0;
  return {
    id: 'no-consent-fixture',
    label: 'Path without consent is blocked',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.status}, inspected=${snapshot.inspection.performed}` : `exit ${result.status}`,
    target: 'declared path still requires explicit consent',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runCli(args) {
  return spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-agent-onboarding.ts', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function read(file) {
  try {
    return fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    return null;
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
