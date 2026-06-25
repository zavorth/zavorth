#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const checks = [
  {
    file: 'src/agents/SwarmV2Service.ts',
    markers: [
      'SWARM_V2_OFFICIAL_CONTRACT_VERSION',
      'launchOfficialSwarm',
      'getSwarmReplay',
      'buildReplayInsights',
      'replayInsights',
      'listRoleLibrary',
      'batch-queue',
      'temp-worktree',
      'llmRuntime',
      'selectRoleIdsForObjective',
      'normalizeToolSpecs',
      'buildBenchmarkSnapshot',
      'buildTokenBudgetSnapshot',
      'Swarm Token Budget Guard',
      'role.tool.bound',
      'Swarm v2 Official Synthesis',
    ],
  },
  {
    file: 'src/runtime/sessions/v2/SwarmOrchestrator.ts',
    markers: [
      'cwd?: string',
      "stdinMode?: 'prompt' | 'none'",
      'isolation?:',
      'isolationMode',
      'isolationWorkerId',
    ],
  },
  {
    file: 'src/domain/surface/presentation/web-app/web-app-supervision-route/swarmV2Routes.ts',
    markers: [
      'swarm-v2-official',
      'launchOfficialSwarmAsync',
      "isSwarmV2Route('/roles')",
      "isSwarmV2Route('/replay')",
    ],
  },
  {
    file: 'src/web/components/SwarmMonitor.tsx',
    markers: [
      '/api/web/gateway/swarm-v2',
      'Official Swarm v2',
      'Batch queue',
      'Worker isolation',
      'Orchestration profile',
      'Token budget',
      'Replay',
      'Final synthesis',
    ],
  },
  {
    file: 'config/operational-maturity.json',
    markers: [
      'Official Swarm v2',
      'swarm-v2:check',
      '/api/web/gateway/swarm-v2',
    ],
  },
  {
    file: 'tests/services/ExperimentalSwarmV2Service.test.ts',
    markers: [
      'official swarm surface with role library',
      'replayInsights',
      'auto-selects roles through the LLM selector',
      'estimated LLM token budget is exceeded',
      'uses LLM synthesis',
      'persists custom role library entries',
      'cancels an official swarm',
    ],
  },
  {
    file: 'tests/domain/surface/presentation/web-app/WebAppRuntimeRouteService.experimental.test.ts',
    markers: [
      'official swarm v2 launch',
      'getSwarmReplay',
      'launchOfficialSwarm',
    ],
  },
];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`missing file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

const issues = [];
for (const check of checks) {
  const text = read(check.file);
  for (const marker of check.markers) {
    if (!text.includes(marker)) {
      issues.push(`${check.file}: missing marker ${marker}`);
    }
  }
}

const pkg = JSON.parse(read('package.json'));
for (const scriptName of ['swarm-v2:check', 'qa:swarm-v2', 'swarm-v2:benchmark:check', 'qa:swarm-v2-benchmark']) {
  if (!pkg.scripts?.[scriptName]) {
    issues.push(`package.json: missing script ${scriptName}`);
  }
}

if (issues.length > 0) {
  console.error('[swarm-v2-official-check] failed');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[swarm-v2-official-check] passed');
