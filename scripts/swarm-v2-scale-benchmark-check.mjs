#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

const issues = [];
const source = read('scripts/swarm-v2-scale-benchmark.ts');
for (const marker of [
  'roles: 100',
  'configuredMaximum: 300',
  'maxConcurrency',
  'benchmark: true',
  'temp-worktree',
]) {
  if (!source.includes(marker)) {
    issues.push(`scripts/swarm-v2-scale-benchmark.ts: missing marker ${marker}`);
  }
}

const service = read('src/agents/SwarmV2Service.ts');
for (const marker of [
  'selectRoleIdsForObjective',
  'resolveSyncRoleSelection',
  'normalizeToolSpecs',
  'buildBenchmarkSnapshot',
  'isStrongIsolationMode',
  'role.tool.bound',
]) {
  if (!service.includes(marker)) {
    issues.push(`src/agents/SwarmV2Service.ts: missing marker ${marker}`);
  }
}

if (issues.length === 0) {
  const output = execSync('npx tsx scripts/swarm-v2-scale-benchmark.ts --roles=12 --concurrency=6 --json --require-pass', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const parsed = JSON.parse(output);
  if (!parsed.ok || parsed.requestedRoles !== 12 || parsed.completedRoles !== 12) {
    issues.push(`scale benchmark smoke failed: ${output}`);
  }
  if (!parsed.benchmark?.enabled || parsed.benchmark.qualityScore <= 0) {
    issues.push(`scale benchmark missing useful benchmark metrics: ${output}`);
  }
}

const pkg = JSON.parse(read('package.json'));
for (const scriptName of ['swarm-v2:benchmark', 'swarm-v2:benchmark:json', 'swarm-v2:benchmark:check', 'qa:swarm-v2-benchmark']) {
  if (!pkg.scripts?.[scriptName]) {
    issues.push(`package.json: missing script ${scriptName}`);
  }
}

if (issues.length > 0) {
  console.error('[swarm-v2-scale-benchmark-check] failed');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[swarm-v2-scale-benchmark-check] passed');
