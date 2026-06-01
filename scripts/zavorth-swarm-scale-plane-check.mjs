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

const service = read('src/domain/execution/infrastructure/SwarmScalePlaneService.ts');
for (const marker of [
  'SWARM_SCALE_PLANE_CONTRACT_VERSION',
  'MAX_SCALE_AGENTS = 4000',
  'SwarmScaleLedger',
  'SwarmScaleReducerSnapshot',
  'actualMaxConcurrency',
  'resume(input: SwarmScaleResumeInput)',
  'llm-live',
  'toolCallsGoverned: true',
  'Global swarm step ledger',
]) {
  if (!service.includes(marker)) {
    issues.push(`SwarmScalePlaneService.ts missing marker ${marker}`);
  }
}

const script = read('scripts/zavorth-swarm-scale-plane.ts');
for (const marker of [
  '--agents=',
  '--concurrency=',
  '--steps=',
  '--pause-after-steps=',
  'desiredAgents: args.agents',
]) {
  if (!script.includes(marker)) {
    issues.push(`zavorth-swarm-scale-plane.ts missing marker ${marker}`);
  }
}

const pkg = JSON.parse(read('package.json'));
for (const scriptName of ['zavorth:swarm-scale-plane', 'zavorth:swarm-scale-plane:check', 'qa:zavorth-swarm-scale-plane']) {
  if (!pkg.scripts?.[scriptName]) {
    issues.push(`package.json missing script ${scriptName}`);
  }
}

const agentRunSwarm = read('src/runtime/agent/AgentRunSwarmFlows.ts');
for (const marker of [
  'Swarm Scale Plane',
  'resolveSwarmScalePlan',
  'executeApprovedSwarmScaleProposal',
  'swarmScalePlaneService',
  'buildSwarmScaleExecutionReply',
  'assessSwarmWorkload',
]) {
  if (!agentRunSwarm.includes(marker)) {
    issues.push(`AgentRunSwarmFlows.ts missing marker ${marker}`);
  }
}
const planning = read('src/runtime/agent/AgentRunPlanningFlows.ts');
if (!planning.includes('assessSwarmWorkload')) {
  issues.push('AgentRunPlanningFlows.ts must use workload assessment for scale decisions');
}

const webRoutes = read('src/domain/surface/presentation/web-app/web-app-supervision-route/swarmV2Routes.ts');
for (const marker of [
  'isSwarmScaleRoute',
  'Swarm Scale Plane',
  'swarm_scale_live_approval_required',
  'scaleService.launch',
  'scaleService.resume',
]) {
  if (!webRoutes.includes(marker)) {
    issues.push(`swarmV2Routes.ts missing marker ${marker}`);
  }
}

if (issues.length === 0) {
  const output = execSync('npx tsx scripts/zavorth-swarm-scale-plane.ts --agents=4000 --concurrency=256 --steps=4000 --json --require-pass', {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const parsed = JSON.parse(output);
  if (!parsed.ok || parsed.plannedAgents !== 4000 || parsed.completedAgents !== 4000) {
    issues.push(`4000-agent scale smoke failed: ${output}`);
  }
  if (parsed.actualMaxConcurrency <= 1 || parsed.actualMaxConcurrency > 256) {
    issues.push(`unexpected concurrency metrics: ${output}`);
  }
  if (parsed.usedSteps > 4000) {
    issues.push(`global step ledger exceeded 4000: ${output}`);
  }
}

if (issues.length > 0) {
  console.error('[zavorth-swarm-scale-plane-check] failed');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[zavorth-swarm-scale-plane-check] passed');
