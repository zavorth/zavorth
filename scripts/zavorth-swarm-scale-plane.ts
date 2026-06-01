#!/usr/bin/env tsx
import os from 'os';
import path from 'path';
import { SwarmScalePlaneService } from '../src/domain/execution/infrastructure/SwarmScalePlaneService.js';

type Args = {
  agents: number;
  concurrency: number;
  steps: number;
  pauseAfterSteps: number | null;
  json: boolean;
  requirePass: boolean;
  persist: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    agents: 20,
    concurrency: 30,
    steps: 4000,
    pauseAfterSteps: null,
    json: false,
    requirePass: false,
    persist: false,
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    if (arg === '--require-pass') args.requirePass = true;
    if (arg === '--persist') args.persist = true;
    if (arg.startsWith('--agents=')) args.agents = clamp(Number(arg.slice('--agents='.length)), 1, 4000, args.agents);
    if (arg.startsWith('--concurrency=')) args.concurrency = clamp(Number(arg.slice('--concurrency='.length)), 1, 4000, args.concurrency);
    if (arg.startsWith('--steps=')) args.steps = clamp(Number(arg.slice('--steps='.length)), 1, 4000, args.steps);
    if (arg.startsWith('--pause-after-steps=')) {
      args.pauseAfterSteps = clamp(Number(arg.slice('--pause-after-steps='.length)), 1, 4000, 10);
    }
  }
  return args;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function summarize(snapshot: Awaited<ReturnType<SwarmScalePlaneService['launch']>>) {
  return {
    ok: snapshot.status === 'completed',
    contractVersion: snapshot.contractVersion,
    runId: snapshot.runId,
    status: snapshot.status,
    requestedAgents: snapshot.planner.requestedAgents,
    plannedAgents: snapshot.planner.plannedAgents,
    completedAgents: snapshot.metrics.completedAgents,
    failedAgents: snapshot.metrics.failedAgents,
    maxConcurrency: snapshot.workerPool.maxConcurrency,
    actualMaxConcurrency: snapshot.workerPool.actualMaxConcurrency,
    batchesStarted: snapshot.workerPool.batchesStarted,
    usedSteps: snapshot.ledger.usedSteps,
    maxSteps: snapshot.ledger.maxSteps,
    reducerStatus: snapshot.reducer.status,
    conflictCount: snapshot.reducer.conflictCount,
    synthesis: snapshot.reducer.synthesis,
    durable: snapshot.workerPool.durable,
    pauseReason: snapshot.workerPool.pauseReason,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stateFilePath = args.persist
    ? path.join(os.tmpdir(), `zavorth-swarm-scale-${Date.now()}.json`)
    : null;
  const service = new SwarmScalePlaneService({ stateFilePath });
  let snapshot = await service.launch({
    objective: `Run Zavorth Swarm Scale Plane benchmark with ${args.agents} dynamic agent(s).`,
    desiredAgents: args.agents,
    maxAgents: 4000,
    maxSteps: args.steps,
    maxConcurrency: args.concurrency,
    executionMode: 'deterministic',
    plannerMode: 'heuristic',
    stopAfterSteps: args.pauseAfterSteps,
    persistState: args.persist,
  });
  const pausedOnce = snapshot.status === 'paused';
  if (pausedOnce && args.persist) {
    snapshot = await service.resume({
      runId: snapshot.runId,
      persistState: args.persist,
    });
  }
  const summary = {
    ...summarize(snapshot),
    pausedOnce,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    console.log('[zavorth-swarm-scale-plane]');
    console.log(`status: ${summary.status}`);
    console.log(`agents: ${summary.completedAgents}/${summary.plannedAgents}`);
    console.log(`steps: ${summary.usedSteps}/${summary.maxSteps}`);
    console.log(`concurrency: ${summary.actualMaxConcurrency}/${summary.maxConcurrency}`);
    console.log(`batches: ${summary.batchesStarted}`);
    console.log(`conflicts: ${summary.conflictCount}`);
  }

  if (args.requirePass && !summary.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
