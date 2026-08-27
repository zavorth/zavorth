#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();

const checks = [
  {
    file: 'src/agents/ZavorthEnsembleService.ts',
    markers: [
      'ZAVORTH_ENSEMBLE_OFFICIAL_CONTRACT_VERSION',
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
      'Zavorth Ensemble Official Synthesis',
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
    file: 'src/domain/surface/presentation/web-app/web-app-supervision-route/zavorthEnsembleRoutes.ts',
    markers: [
      'zavorth-ensemble-official',
      'launchOfficialSwarmAsync',
      "isZavorthEnsembleRoute('/roles')",
      "isZavorthEnsembleRoute('/replay')",
    ],
  },
  {
    file: 'src/web/components/SwarmMonitor.tsx',
    markers: [
      '/api/web/gateway/zavorth-ensemble',
      'Official Zavorth Ensemble',
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
      'Official Zavorth Ensemble',
      'zavorth-ensemble:check',
      '/api/web/gateway/zavorth-ensemble',
    ],
  },
  {
    file: 'tests/services/ZavorthEnsembleService.test.ts',
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
      'official ensemble launch, role library and replay',
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
for (const scriptName of ['zavorth-ensemble:check', 'qa:zavorth-ensemble', 'zavorth-ensemble:benchmark:check', 'qa:zavorth-ensemble-benchmark']) {
  if (!pkg.scripts?.[scriptName]) {
    issues.push(`package.json: missing script ${scriptName}`);
  }
}

if (issues.length > 0) {
  console.error('[zavorth-ensemble-official-check] failed');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log('[zavorth-ensemble-official-check] passed');
