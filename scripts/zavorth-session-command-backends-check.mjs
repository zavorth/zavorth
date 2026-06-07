#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const commands = ['status', 'usage', 'context', 'model', 'models', 'profile', 'tools', 'skills', 'agents', 'whoami', 'plan-review', 'brief-reply', 'test-loop'];
const rules = [
  ruleFilesExist(),
  ruleBackendServiceMarkers(),
  ruleRouteContractMarkers(),
  ruleDashboardBridgeMarkers(),
  ruleFocusedTestsPass(),
];
const failed = rules.filter((item) => item.status === 'failed');

console.log('[zavorth-session-command-backends] checking dedicated chat command backends');
for (const item of rules) {
  console.log(`[zavorth-session-command-backends] ${item.status === 'passed' ? 'ok' : 'fail'} ${item.label}: ${item.observed} | ${item.target}`);
  for (const detail of item.details.slice(0, 12)) {
    console.log(`  - ${detail}`);
  }
}
if (failed.length > 0) process.exitCode = 1;

function ruleFilesExist() {
  const files = [
    'src/services/WebAppRuntimeSessionCommandService.ts',
    'tests/services/WebAppRuntimeSessionCommandService.test.ts',
    'tests/services/WebAppRuntimeInteractionRouteService.test.ts',
    'apps/zavorth-control-vite-shell/src/runtime-bridge.ts',
    'apps/zavorth-control-vite-shell/src/app.ts',
  ];
  const missing = files.filter((file) => !fs.existsSync(path.join(root, file)));
  return rule('files', 'Session command backend files exist', missing.length === 0, `${files.length - missing.length}/${files.length}`, 'service, tests, route and dashboard files are present', missing);
}

function ruleBackendServiceMarkers() {
  const service = read('src/services/WebAppRuntimeSessionCommandService.ts');
  const missing = [];
  for (const command of commands) {
    if (!service.includes(`case '${command}'`) && !service.includes(`${command}: '${command}'`)) {
      missing.push(`missing backend command ${command}`);
    }
  }
  for (const marker of ['rawSecretsSerialized', 'redactRecord', 'providerProbePerformed: false', 'patchSessionMetadata']) {
    if (!service.includes(marker)) missing.push(`missing safety marker ${marker}`);
  }
  return rule('service-markers', 'Service covers daily commands with redacted receipts', missing.length === 0, missing.length === 0 ? 'all markers' : `${missing.length} missing`, 'all commands, redaction, model metadata and no implicit provider probe', missing);
}

function ruleRouteContractMarkers() {
  const contract = read('src/contracts/GatewayContract.ts');
  const routeHelpers = read('src/domain/surface/presentation/web-app/web-app-runtime-route/WebAppRuntimeRouteHelpers.ts');
  const interaction = read('src/domain/surface/presentation/web-app/WebAppRuntimeInteractionRouteService.ts');
  const routeService = read('src/domain/surface/presentation/web-app/WebAppRuntimeRouteService.ts');
  const missing = [];
  for (const command of commands) {
    if (!contract.includes(`${command}: '/api/web/gateway/sessions/${command}'`)
      && !contract.includes(`'${command}': '/api/web/gateway/sessions/${command}'`)) {
      missing.push(`missing canonical route ${command}`);
    }
    if (!contract.includes(`/api/web/session/${command}`)) {
      missing.push(`missing legacy route alias ${command}`);
    }
    if (!routeHelpers.includes(`['${command}', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES.${command}]`)
      && !routeHelpers.includes(`['${command}', LEGACY_GATEWAY_SESSION_ROUTE_ALIASES['${command}']]`)) {
      missing.push(`missing route helper ${command}`);
    }
  }
  for (const marker of ['resolveWebAppRuntimeCanonicalSessionCommand', 'handleSessionCommand', 'WebAppRuntimeSessionCommandService']) {
    if (!`${interaction}\n${routeService}`.includes(marker)) missing.push(`missing route marker ${marker}`);
  }
  return rule('route-contracts', 'Routes expose dedicated command backends', missing.length === 0, missing.length === 0 ? 'wired' : `${missing.length} missing`, 'canonical route, alias, resolver and handler are wired', missing);
}

function ruleDashboardBridgeMarkers() {
  const app = read('apps/zavorth-control-vite-shell/src/app.ts');
  const bridge = read('apps/zavorth-control-vite-shell/src/runtime-bridge.ts');
  const missing = [];
  if (!bridge.includes('async function runSessionCommand')) missing.push('runtime bridge runSessionCommand');
  if (!bridge.includes('/api/web/session/')) missing.push('runtime bridge command endpoint');
  for (const command of ['status', 'usage', 'context', 'models', 'tools', 'skills', 'agents', 'whoami']) {
    if (!app.includes(`runBackendSessionCommand('${command}'`)) missing.push(`dashboard ${command} backend call`);
  }
  for (const command of ['plan-review', 'brief-reply', 'test-loop']) {
    if (!app.includes(`runBackendSessionCommand('${command}'`)) missing.push(`dashboard ${command} backend call`);
  }
  if (!app.includes("runBackendSessionCommand('model'")) missing.push('dashboard model backend call');
  if (!app.includes('buildSlashClientContext')) missing.push('sanitized client context');
  return rule('dashboard-bridge', 'Dashboard uses backend commands before local fallback', missing.length === 0, missing.length === 0 ? 'wired' : `${missing.length} missing`, 'runtime bridge and app dispatch are wired', missing);
}

function ruleFocusedTestsPass() {
  const result = spawnSync(process.execPath, [
    path.join(root, 'node_modules', 'jest', 'bin', 'jest.js'),
    'tests/services/WebAppRuntimeSessionCommandService.test.ts',
    'tests/services/WebAppRuntimeInteractionRouteService.test.ts',
    '--runInBand',
  ], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  return rule(
    'focused-tests',
    'Focused session command tests pass',
    result.status === 0,
    `exit ${result.status ?? 'unknown'}`,
    'Jest command service and route tests pass',
    result.status === 0 ? [] : compact(result.stdout, result.stderr),
  );
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function rule(id, label, passed, observed, target, details = []) {
  return { id, label, status: passed ? 'passed' : 'failed', observed, target, details };
}

function compact(...parts) {
  return parts.join('\n').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(-20);
}
