#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const asJson = process.argv.includes('--json');
const rules = [];

const requiredFiles = [
  'src/contracts/ZavorthExperienceProfileContract.ts',
  'src/services/ZavorthExperienceProfileService.ts',
  'scripts/zavorth-experience-profiles.ts',
  'scripts/zavorth-experience-profiles-check.mjs',
  'tests/services/ZavorthExperienceProfileService.test.ts',
];

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
    ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/zavorth-experience-profiles.ts', '--json', '--intent=I want business mode with audit']
    : ['tsx', 'scripts/zavorth-experience-profiles.ts', '--json', '--intent=I want business mode with audit'];
  snapshot = JSON.parse(execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }));
} catch (error) {
  rules.push({
    id: 'script:json',
    status: 'failed',
    summary: `experience profile script did not return valid JSON: ${error instanceof Error ? error.message : String(error)}`,
  });
}

if (snapshot) {
  assertRule('surface:experience-profile', snapshot.surface === 'experience-profile', 'Experience profile contract is exposed');
  assertRule('profiles:five', Array.isArray(snapshot.profiles) && snapshot.profiles.length === 5, 'Five life-mode profiles are available');
  for (const profile of ['personal', 'creator', 'developer', 'business', 'power']) {
    assertRule(`profile:${profile}`, snapshot.profiles.some((item) => item.id === profile), `${profile} profile exists`);
  }
  assertRule('resolution:natural-business', snapshot.selected?.profileId === 'business', 'Natural language resolves business profile');
  assertRule('posture:governed', snapshot.selected?.dailyMode === 'governed', 'Business defaults to governed posture');
  assertRule('detail:advanced', snapshot.selected?.detailMode === 'advanced', 'Business defaults to advanced detail');
  assertRule('authority:invariant', snapshot.invariants?.some((text) => text.includes('not execution authority')), 'Profiles do not grant execution authority');
  assertRule('policy:invariant', snapshot.invariants?.some((text) => text.includes('Policy Broker')), 'Policy Broker remains mandatory');
  assertRule('switch:natural-language', snapshot.naturalSwitchExamples?.some((text) => text.includes('vibe coding')), 'Natural switch examples include developer/vibe coding use');
}

try {
  execFileSync(process.platform === 'win32' ? 'cmd.exe' : 'npx', process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx', 'jest', 'tests/services/ZavorthExperienceProfileService.test.ts', '--runInBand']
    : ['jest', 'tests/services/ZavorthExperienceProfileService.test.ts', '--runInBand'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assertRule('tests:experience-profile', true, 'Experience profile unit tests pass');
} catch (error) {
  rules.push({
    id: 'tests:experience-profile',
    status: 'failed',
    summary: `Experience profile unit tests failed: ${error instanceof Error ? error.message : String(error)}`,
  });
}

const failed = rules.filter((rule) => rule.status === 'failed');
const result = {
  generatedAt: new Date().toISOString(),
  status: failed.length ? 'failed' : 'passed',
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
  console.log('[zavorth-experience] profile system certification');
  for (const rule of rules) {
    console.log(`[zavorth-experience] ${rule.status === 'passed' ? 'ok' : 'fail'} ${rule.id}: ${rule.summary}`);
  }
}

if (failed.length) {
  process.exitCode = 1;
}

function assertRule(id, condition, summary) {
  rules.push({
    id,
    status: condition ? 'passed' : 'failed',
    summary,
  });
}
