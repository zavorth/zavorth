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
  runListFixture(),
  runRegistrationPreviewFixture(),
  runApprovedCliFixture(),
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
  console.log('[zavorth-external-agent-gateway] checking governed external agent use');
  for (const rule of rules) {
    const marker = rule.status === 'passed' ? 'ok' : 'fail';
    console.log(`[zavorth-external-agent-gateway] ${marker} ${rule.label}: ${rule.observed} | ${rule.target}`);
    for (const detail of rule.details.slice(0, 16)) console.log(`  - ${detail}`);
  }
}

if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/contracts/ZavorthExternalAgentGatewayContract.ts',
    'src/services/ZavorthExternalAgentGatewayService.ts',
    'scripts/zavorth-external-agent-gateway.ts',
    'scripts/zavorth-external-agent-gateway-check.mjs',
    'tests/services/ZavorthExternalAgentGatewayService.test.ts',
    'docs/external-agent-gateway.md',
    'src/zavorth-cli.ts',
    'src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts',
    'src/telegram/TelegramCommandRoutingService.ts',
    'src/telegram/controllers/TelegramOpsController.ts',
    'package.json',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return {
    id: 'files-exist',
    label: 'Gateway files exist',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: `${files.length - missing.length}/${files.length} file(s) present`,
    target: 'contract, service, CLI, check, tests, docs and package script are present',
    details: missing.map((file) => `missing ${file}`),
  };
}

function ruleContainsMarkers() {
  const checks = [
    ['src/contracts/ZavorthExternalAgentGatewayContract.ts', [
      'zavorth-external-agent-gateway/1',
      'requiresApprovalPerInvocation: true',
      'liveUseRequiresApproval: true',
      'noShellInterpolation: true',
      'ZavorthExternalAgentIsolationKind',
      'strongIsolationRequiredForUntrustedCli',
    ]],
    ['src/services/ZavorthExternalAgentGatewayService.ts', [
      'spawnSyncImpl',
      'shell: false',
      'buildSafeEnv',
      'allowRemoteNetwork',
      'AcpLiveSessionService',
      'docker run',
      'wsl.exe',
      'Strong isolation is required',
    ]],
    ['package.json', [
      'zavorth:external-agent-gateway',
      'zavorth:external-agent-gateway:check',
    ]],
    ['src/zavorth-cli.ts', [
      'runExternalAgentGateway',
      'external-agent',
      'external-agents',
    ]],
    ['src/domain/surface/presentation/web-app/WebAppRuntimeStateRouteService.ts', [
      '/api/runtime/external-agents',
      'ZavorthExternalAgentGatewayService',
      'isExternalAgentApiApprovalAccepted',
      'ZAVORTH_EXTERNAL_AGENT_API_APPROVAL_TOKEN',
      'bodyApprovalIgnored',
    ]],
    ['src/telegram/TelegramCommandRoutingService.ts', [
      '/externalagent',
      'handleExternalAgentGateway',
    ]],
    ['src/telegram/controllers/TelegramOpsController.ts', [
      'handleExternalAgentGateway',
      'parseExternalAgentGatewayTelegramArgs',
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
    label: 'Gateway safety markers are present',
    status: missing.length === 0 ? 'passed' : 'failed',
    observed: missing.length === 0 ? 'all markers present' : `${missing.length} missing marker(s)`,
    target: 'external agents remain profile-scoped and approval-gated',
    details: missing,
  };
}

function runListFixture() {
  const result = runCli(['list', '--json']);
  const snapshot = parseJson(result.stdout);
  const ok = result.status === 0
    && snapshot?.surface === 'external-agent-gateway'
    && snapshot?.safety?.liveUseRequiresApproval === true
    && Array.isArray(snapshot?.profiles);
  return {
    id: 'list-fixture',
    label: 'Registry list is read-only',
    status: ok ? 'passed' : 'failed',
    observed: ok ? `${snapshot.profiles.length} profile(s)` : `exit ${result.status}`,
    target: 'listing profiles does not invoke an external agent',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runRegistrationPreviewFixture() {
  const result = runCli(['register', '--json', '--id', 'fixture-preview', '--adapter', 'cli', '--command', process.execPath]);
  const receipt = parseJson(result.stdout);
  const ok = result.status === 0
    && receipt?.status === 'approval-required'
    && receipt?.execution?.adapterInvoked === false
    && receipt?.profile?.liveExecutionEnabled === false;
  return {
    id: 'registration-preview-fixture',
    label: 'Registration previews without approval',
    status: ok ? 'passed' : 'failed',
    observed: ok ? receipt.status : `exit ${result.status}`,
    target: 'registration does not persist or enable live without approval',
    details: ok ? [] : [result.stderr || result.stdout || 'no output'],
  };
}

function runApprovedCliFixture() {
  const registryFile = path.join(root, 'tmp', 'external-agent-gateway-check-registry.json');
  const env = { ...process.env, ZAVORTH_EXTERNAL_AGENT_GATEWAY_REGISTRY: registryFile };
  const script = 'process.stdin.resume();let d=\"\";process.stdin.on(\"data\",c=>d+=c);process.stdin.on(\"end\",()=>console.log(\"fixture-agent:\"+d.trim()))';
  const register = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-agent-gateway.ts',
    'register',
    '--json',
    '--id',
    'fixture-live',
    '--adapter',
    'cli',
    '--command',
    process.execPath,
    '--args-json',
    JSON.stringify(['-e', script]),
    '--approve-registration',
    '--enable-live',
  ], { cwd: root, env, encoding: 'utf8' });
  const run = spawnSync(process.execPath, [
    tsxCli,
    'scripts/zavorth-external-agent-gateway.ts',
    'run',
    '--json',
    '--id',
    'fixture-live',
    '--prompt',
    'ping',
    '--approve-external-execution',
  ], { cwd: root, env, encoding: 'utf8' });
  const receipt = parseJson(run.stdout);
  const ok = register.status === 0
    && run.status === 0
    && receipt?.status === 'completed'
    && receipt?.execution?.adapterInvoked === true
    && receipt?.execution?.liveExecutionPerformed === true
    && String(receipt?.output?.text || '').includes('fixture-agent:ping');
  return {
    id: 'approved-cli-fixture',
    label: 'Approved CLI profile can be invoked',
    status: ok ? 'passed' : 'failed',
    observed: ok ? receipt.status : `register ${register.status}, run ${run.status}`,
    target: 'approved profile invocation runs through governed receipt',
    details: ok ? [] : [register.stderr || register.stdout || 'no register output', run.stderr || run.stdout || 'no run output'],
  };
}

function runCli(args) {
  return spawnSync(process.execPath, [tsxCli, 'scripts/zavorth-external-agent-gateway.ts', ...args], {
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
