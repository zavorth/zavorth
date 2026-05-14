#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');

const requiredFiles = [
  'src/contracts/ZavorthProductModeContract.ts',
  'src/contracts/ZavorthFirstRunProductJourneyContract.ts',
  'src/contracts/ZavorthMissionContract.ts',
  'src/contracts/ZavorthVisualReceiptContract.ts',
  'src/contracts/ZavorthSandboxReadinessContract.ts',
  'src/services/ZavorthProductizationProtectedRuntimeService.ts',
  'scripts/zavorth-productization-protected-runtime.ts',
  'tests/services/ZavorthProductizationProtectedRuntimeService.test.ts',
];

const rules = [];

for (const file of requiredFiles) {
  rules.push({
    id: `file:${file}`,
    status: fs.existsSync(path.join(root, file)) ? 'passed' : 'failed',
    summary: `${file} exists`,
  });
}

let snapshot = null;
try {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-productization-protected-runtime.ts', '--json', '--request=sk-test-secret-should-redact']
    : ['tsx', 'scripts/zavorth-productization-protected-runtime.ts', '--json', '--request=sk-test-secret-should-redact'];
  const output = execFileSync(
    command,
    args,
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  snapshot = JSON.parse(output);
} catch (error) {
  rules.push({
    id: 'script:json',
    status: 'failed',
    summary: `script did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  });
}

if (snapshot) {
  assertRule('mode:personal', snapshot.productMode?.dailyModes?.some((mode) => mode.id === 'personal'), 'Personal mode is exposed');
  assertRule('mode:governed', snapshot.productMode?.dailyModes?.some((mode) => mode.id === 'governed'), 'Governed mode is exposed');
  assertRule('detail:simple', snapshot.productMode?.detailModes?.some((mode) => mode.id === 'simple'), 'Simple detail mode is exposed');
  assertRule('detail:advanced', snapshot.productMode?.detailModes?.some((mode) => mode.id === 'advanced'), 'Advanced detail mode is exposed');
  assertRule('templates:five', Array.isArray(snapshot.templates) && snapshot.templates.length >= 5, 'At least five guided templates exist');
  assertRule('mission:projection', snapshot.mission?.surface === 'mission' && Array.isArray(snapshot.mission?.timeline), 'Mission projection has timeline');
  assertRule('receipt:visual', snapshot.receipt?.surface === 'visual-receipt' && snapshot.receipt?.redaction?.rawSecretsPresent === false, 'Visual receipt exists and forbids raw secrets');
  assertRule('secret:redacted', !JSON.stringify(snapshot).includes('sk-test-secret-should-redact'), 'Raw test secret is redacted');
  assertRule('sandbox:fallback', ['ready', 'fallback', 'blocked'].includes(snapshot.sandbox?.status), 'Sandbox readiness status is normalized');
  assertRule('sandbox:dry-run-fallback', snapshot.sandbox?.strongSandboxAvailable === true || snapshot.sandbox?.mutationMode !== 'sandbox', 'No strong sandbox means no sandboxed mutations claim');
  assertRule('sandbox:default-policy', snapshot.sandbox?.defaultPolicy?.liveMutationsRequire === 'strong-sandbox-and-approval', 'Live mutations require strong sandbox and scoped approval');
  assertRule(
    'sandbox:no-live-mutation-without-strong-boundary',
    snapshot.sandbox?.strongSandboxAvailable === true || snapshot.sandbox?.defaultPolicy?.liveMutationsAllowed === false,
    'Fallback mode does not allow live mutations',
  );
  assertRule('sandbox:doctor-clear', typeof snapshot.sandbox?.doctor?.summary === 'string' && snapshot.sandbox.doctor.summary.length > 20, 'Sandbox doctor exposes a human-readable summary');
  assertRule('command-center:no-authority', snapshot.commandCenterProjection?.executionAuthority === false, 'Command Center projection has no execution authority');
  assertRule('distribution:private', snapshot.distribution?.privateExecutableFirst === true && snapshot.distribution?.proprietaryLicenseRequired === true, 'Private executable/proprietary posture is explicit');
}

const failed = rules.filter((rule) => rule.status === 'failed');
const result = {
  generatedAt: new Date().toISOString(),
  status: failed.length > 0 ? 'failed' : 'passed',
  summary: {
    rules: rules.length,
    passed: rules.length - failed.length,
    failed: failed.length,
  },
  rules,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log('[zavorth-product] protected runtime certification');
  for (const rule of rules) {
    console.log(`[zavorth-product] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length > 0) {
  process.exitCode = 1;
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}
